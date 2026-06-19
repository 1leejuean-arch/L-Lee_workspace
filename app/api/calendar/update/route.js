import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";

function buildDateTime(date, time) {
  return `${date}T${time}:00`;
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

export async function PATCH(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Google 계정 연결이 필요합니다." }, { status: 401 });
    }

    if (!session.accessToken) {
      return NextResponse.json({ error: "캘린더 권한이 만료되었습니다. 다시 로그인해주세요." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const eventId = body.id?.trim();
    const title = body.title?.trim();
    const date = body.date;
    const startTime = body.startTime;
    const endTime = body.endTime;
    const description = body.description?.trim() || "";
    const location = body.location?.trim() || "";

    if (!eventId || !title || !date || !startTime || !endTime) {
      return NextResponse.json({ error: "일정 ID, 제목, 날짜, 시작 시간, 종료 시간을 모두 입력해주세요." }, { status: 400 });
    }

    const startDateTime = buildDateTime(date, startTime);
    const endDateTime = buildDateTime(date, endTime);

    if (new Date(endDateTime) <= new Date(startDateTime)) {
      return NextResponse.json({ error: "종료 시간은 시작 시간보다 늦어야 합니다." }, { status: 400 });
    }

    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: title,
        description,
        location,
        start: {
          dateTime: startDateTime,
          timeZone: "Asia/Seoul",
        },
        end: {
          dateTime: endDateTime,
          timeZone: "Asia/Seoul",
        },
      }),
    });

    if (!response.ok) {
      const details = await readGoogleError(response);
      return NextResponse.json(
        { error: "일정을 수정하지 못했습니다. 잠시 후 다시 시도해주세요.", details },
        { status: response.status },
      );
    }

    const event = await response.json();

    return NextResponse.json({
      message: "일정이 Google Calendar에 수정되었습니다.",
      event,
    });
  } catch (error) {
    console.error("Calendar update failed:", error);
    return NextResponse.json(
      { error: "일정을 수정하지 못했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  }
}
