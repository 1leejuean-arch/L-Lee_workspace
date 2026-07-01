import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";

const KOREA_TIME_ZONE = "Asia/Seoul";
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function getKoreanDateKey(dateOrDateTime = new Date()) {
  if (typeof dateOrDateTime === "string" && DATE_KEY_PATTERN.test(dateOrDateTime)) {
    return dateOrDateTime;
  }

  const date = dateOrDateTime instanceof Date ? dateOrDateTime : new Date(dateOrDateTime);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: KOREA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

function parseDateKey(dateKey) {
  if (!DATE_KEY_PATTERN.test(dateKey || "")) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  return { year, month, day };
}

function addDaysToDateKey(dateKey, days) {
  const parts = parseDateKey(dateKey);
  if (!parts) return "";
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function koreanDateTimeToUtcDate(dateKey, hour = 0, minute = 0, second = 0, millisecond = 0) {
  const parts = parseDateKey(dateKey);
  if (!parts) return new Date();
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, hour - 9, minute, second, millisecond));
}

function getKoreanWeekRangeKeys(dateOrDateTime = new Date()) {
  const dateKey = getKoreanDateKey(dateOrDateTime);
  const parts = parseDateKey(dateKey);
  if (!parts) return { startKey: "", endKey: "" };
  const utcDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const startKey = addDaysToDateKey(dateKey, -utcDate.getUTCDay());
  return { startKey, endKey: addDaysToDateKey(startKey, 6) };
}

function isDateKeyInRange(dateKey, startKey, endKey) {
  return Boolean(dateKey && startKey && endKey && dateKey >= startKey && dateKey <= endKey);
}

function formatTime(value) {
  if (!value) return "시간 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: KOREA_TIME_ZONE,
  }).format(new Date(value));
}

function formatDuration(startValue, endValue, isAllDay) {
  if (isAllDay || !startValue || !endValue) return isAllDay ? "하루 종일" : "시간 미정";

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
    time: isAllDay ? "하루 종일" : formatTime(startValue),
    duration: formatDuration(startValue, endValue, isAllDay),
    place: event.location || event.hangoutLink || event.organizer?.email || "Google Calendar",
    location: event.location || "",
    description: event.description || "",
    accent: accents[index % accents.length],
    start: startValue,
    end: endValue,
    allDay: isAllDay,
    dateKey: getKoreanDateKey(startValue),
    htmlLink: event.htmlLink,
  };
}

function getDateRange(searchParams) {
  const now = new Date();
  const range = searchParams.get("range");
  const requestedYear = Number(searchParams.get("year"));
  const requestedMonth = Number(searchParams.get("month"));
  const todayKey = getKoreanDateKey(now);
  const todayParts = parseDateKey(todayKey);
  const targetYear = Number.isInteger(requestedYear) && requestedYear >= 1970 ? requestedYear : todayParts.year;
  const targetMonthNumber = Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12 ? requestedMonth : todayParts.month;
  const monthStartKey = range === "year" ? `${targetYear}-01-01` : `${targetYear}-${String(targetMonthNumber).padStart(2, "0")}-01`;
  const monthEndKey =
    range === "year"
      ? `${targetYear}-12-31`
      : addDaysToDateKey(
          `${targetMonthNumber === 12 ? targetYear + 1 : targetYear}-${String(targetMonthNumber === 12 ? 1 : targetMonthNumber + 1).padStart(2, "0")}-01`,
          -1,
        );
  const lookupEndKey = range === "year" ? monthEndKey : addDaysToDateKey(monthEndKey, 31);
  const { startKey: weekStartKey, endKey: weekEndKey } = getKoreanWeekRangeKeys(now);
  const fetchStartKey = [monthStartKey, weekStartKey, todayKey].sort()[0];
  const fetchEndKeys = [lookupEndKey, weekEndKey, todayKey].sort();
  const fetchEndKey = fetchEndKeys[fetchEndKeys.length - 1];

  return {
    todayKey,
    tomorrowKey: addDaysToDateKey(todayKey, 1),
    weekStartKey,
    weekEndKey,
    monthStartKey,
    monthEndKey,
    lookupEndKey,
    fetchStart: koreanDateTimeToUtcDate(addDaysToDateKey(fetchStartKey, -1)),
    fetchEnd: koreanDateTimeToUtcDate(addDaysToDateKey(fetchEndKey, 1), 23, 59, 59, 999),
  };
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
    const { todayKey, weekStartKey, weekEndKey, monthStartKey, monthEndKey, fetchStart, fetchEnd } = getDateRange(searchParams);
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
    const monthEvents = lookupEvents.filter((event) => isDateKeyInRange(event.dateKey, monthStartKey, monthEndKey));
    const todayEvents = lookupEvents.filter((event) => event.dateKey === todayKey);
    const weekEvents = lookupEvents.filter((event) => isDateKeyInRange(event.dateKey, weekStartKey, weekEndKey));

    if (process.env.NODE_ENV === "development") {
      lookupEvents.forEach((event) => {
        console.debug("[calendar-api] event date key", {
          summary: event.title,
          eventDateKey: event.dateKey,
        });
      });
    }

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
