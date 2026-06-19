import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";

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

export async function DELETE(request) {
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

    if (!eventId) {
      return NextResponse.json({ error: "삭제할 일정 ID가 필요합니다." }, { status: 400 });
    }

    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    });

    if (!response.ok) {
      const details = await readGoogleError(response);
      return NextResponse.json(
        { error: "일정을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.", details },
        { status: response.status },
      );
    }

    return NextResponse.json({
      ok: true,
      deletedEventId: eventId,
      message: "일정이 Google Calendar에서 삭제되었습니다.",
    });
  } catch (error) {
    console.error("Calendar delete failed:", error);
    return NextResponse.json(
      { error: "일정을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  }
}
