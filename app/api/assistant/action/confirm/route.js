import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { POST as createTask } from "../../../tasks/route";
import { POST as createCalendarEvent } from "../../../calendar/create/route";
import { POST as createNote } from "../../../notes/route";
import { POST as createAssetTransaction } from "../../../assets/transactions/route";
import { POST as createMeeting } from "../../../meetings/route";

export const dynamic = "force-dynamic";

const ACTIONS = {
  create_task: {
    handler: createTask,
    success: (payload) => `${payload.title} 할 일을 추가했습니다.`,
  },
  create_calendar_event: {
    handler: createCalendarEvent,
    success: (payload) => `${payload.title} 일정을 추가했습니다.`,
  },
  create_note: {
    handler: createNote,
    success: (payload) => `${payload.title} 메모를 추가했습니다.`,
  },
  create_asset_transaction: {
    handler: createAssetTransaction,
    success: (payload) => `${payload.title} ${payload.type === "income" ? "수입" : "지출"}을 추가했습니다.`,
  },
  create_meeting: {
    handler: createMeeting,
    success: (payload) => `${payload.title} 회의록을 추가했습니다.`,
  },
};

function createForwardRequest(request, payload) {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const authorization = request.headers.get("authorization");
  if (authorization) headers.set("authorization", authorization);
  return new Request(request.url, { method: "POST", headers, body: JSON.stringify(payload) });
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return Response.json({ success: false, error: "UNAUTHORIZED", message: "Google 로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const action = ACTIONS[body.intent];
    if (!action) {
      return Response.json({ success: false, error: "ACTION_NOT_SUPPORTED", message: "지원하지 않는 추가 요청입니다." }, { status: 400 });
    }
    const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
    const response = await action.handler(createForwardRequest(request, payload));
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const calendarPermissionError = body.intent === "create_calendar_event" && [401, 403].includes(response.status);
      return Response.json({
        success: false,
        error: result.error || "ACTION_SAVE_FAILED",
        message: calendarPermissionError ? "Google Calendar 권한을 다시 연결해주세요." : "저장하지 못했습니다. 잠시 후 다시 시도해주세요.",
      }, { status: response.status });
    }

    return Response.json({
      success: true,
      intent: body.intent,
      message: action.success(payload),
      result,
    });
  } catch (error) {
    console.error("Assistant action confirm failed", { message: error?.message, code: error?.code });
    return Response.json({ success: false, error: "ACTION_SAVE_FAILED", message: "저장하지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}
