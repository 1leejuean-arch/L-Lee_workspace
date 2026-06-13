import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";

function buildDateTime(date, time) {
  return `${date}T${time}:00`;
}

export async function POST(request) {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Google 계정 연결이 필요합니다." }, { status: 401 });
  }

  const body = await request.json();
  const title = body.title?.trim();
  const date = body.date;
  const startTime = body.startTime;
  const endTime = body.endTime;
  const description = body.description?.trim();

  if (!title || !date || !startTime || !endTime) {
    return NextResponse.json({ error: "일정 제목, 날짜, 시작 시간, 종료 시간을 모두 입력해주세요." }, { status: 400 });
  }

  const startDateTime = buildDateTime(date, startTime);
  const endDateTime = buildDateTime(date, endTime);

  if (new Date(endDateTime) <= new Date(startDateTime)) {
    return NextResponse.json({ error: "종료 시간은 시작 시간보다 늦어야 합니다." }, { status: 400 });
  }

  const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: title,
      description,
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
    const details = await response.text();
    return NextResponse.json(
      { error: "Google Calendar에 일정을 추가하지 못했습니다.", details },
      { status: response.status },
    );
  }

  const event = await response.json();

  return NextResponse.json({
    message: "일정이 Google Calendar에 추가되었습니다.",
    event,
  });
}
