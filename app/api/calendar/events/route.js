import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";

function formatTime(value) {
  if (!value) return "시간 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function formatDuration(startValue, endValue, isAllDay) {
  if (isAllDay || !startValue || !endValue) return isAllDay ? "종일" : "시간 미정";

  const start = new Date(startValue);
  const end = new Date(endValue);
  const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  if (minutes < 60) return `${minutes}분`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}시간 ${rest}분` : `${hours}시간`;
}

function normalizeEvent(event, index) {
  const startValue = event.start?.dateTime || event.start?.date;
  const endValue = event.end?.dateTime || event.end?.date;
  const isAllDay = Boolean(event.start?.date);
  const accents = ["bg-cyan-400", "bg-violet-400", "bg-blue-400", "bg-fuchsia-400", "bg-emerald-400"];

  return {
    id: event.id,
    title: event.summary || "제목 없는 일정",
    time: isAllDay ? "종일" : formatTime(startValue),
    duration: formatDuration(startValue, endValue, isAllDay),
    place: event.location || event.hangoutLink || event.organizer?.email || "Google Calendar",
    location: event.location || "",
    description: event.description || "",
    accent: accents[index % accents.length],
    start: startValue,
    end: endValue,
    htmlLink: event.htmlLink,
  };
}

function getDateRange(searchParams) {
  const now = new Date();
  const range = searchParams.get("range");
  const requestedYear = Number(searchParams.get("year"));
  const requestedMonth = Number(searchParams.get("month"));
  const targetYear = Number.isInteger(requestedYear) && requestedYear >= 1970 ? requestedYear : now.getFullYear();
  const targetMonth = Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12 ? requestedMonth - 1 : now.getMonth();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const weekEnd = new Date(todayStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  weekEnd.setHours(23, 59, 59, 999);

  const monthStart = range === "year" ? new Date(targetYear, 0, 1) : new Date(targetYear, targetMonth, 1);
  const monthEnd = range === "year" ? new Date(targetYear, 11, 31) : new Date(targetYear, targetMonth + 1, 0);
  monthEnd.setHours(23, 59, 59, 999);

  const lookupEnd = range === "year" ? new Date(targetYear, 11, 31) : new Date(targetYear, targetMonth + 2, 0);
  lookupEnd.setHours(23, 59, 59, 999);

  const fetchStart = monthStart < todayStart ? monthStart : todayStart;
  const fetchEnd = lookupEnd > weekEnd ? lookupEnd : weekEnd;

  return { todayStart, tomorrowStart, weekEnd, monthStart, monthEnd, lookupEnd, fetchStart, fetchEnd };
}

async function readGoogleError(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const data = await response.json();
      return data.error?.message || data.error || data.message || "Google Calendar API error";
    } catch {
      return "Google Calendar API error";
    }
  }

  return (await response.text().catch(() => "")) || "Google Calendar API error";
}

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Google 계정 연결이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const { todayStart, tomorrowStart, weekEnd, monthStart, monthEnd, fetchStart, fetchEnd } = getDateRange(searchParams);
    const params = new URLSearchParams({
      timeMin: fetchStart.toISOString(),
      timeMax: fetchEnd.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "2500",
    });

    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const details = await readGoogleError(response);
      return NextResponse.json(
        { error: "Google Calendar 일정을 가져오지 못했습니다.", details },
        { status: response.status },
      );
    }

    const data = await response.json();
    const lookupEvents = (data.items || []).map(normalizeEvent);
    const monthEvents = lookupEvents.filter((event) => {
      const start = new Date(event.start);
      return start >= monthStart && start <= monthEnd;
    });
    const todayEvents = lookupEvents.filter((event) => {
      const start = new Date(event.start);
      return start >= todayStart && start < tomorrowStart;
    });
    const weekEvents = lookupEvents.filter((event) => {
      const start = new Date(event.start);
      return start >= todayStart && start <= weekEnd;
    });

    return NextResponse.json({
      today: todayEvents,
      week: weekEvents,
      month: monthEvents,
      lookup: lookupEvents,
      source: "google-calendar",
    });
  } catch (error) {
    console.error("Calendar events failed:", error);
    return NextResponse.json({ error: "Google Calendar 일정을 가져오지 못했습니다." }, { status: 500 });
  }
}
