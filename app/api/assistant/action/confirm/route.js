import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { createTaskForUser } from "../../../../../lib/taskPersistence";
import { POST as createCalendarEvent } from "../../../calendar/create/route";
import { POST as createNote } from "../../../notes/route";
import { POST as createAssetTransaction } from "../../../assets/transactions/route";
import { POST as createMeeting } from "../../../meetings/route";
import { getSupabaseServerClient } from "../../../../../lib/supabaseServer";

export const dynamic = "force-dynamic";

const ACTIONS = {
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

function safePayloadForLog(intent, payload) {
  if (intent !== "create_task") return { title: String(payload?.title || "") };
  return {
    title: String(payload?.title || ""),
    description: String(payload?.description || ""),
    priority: String(payload?.priority || ""),
    completed: Boolean(payload?.completed),
  };
}

function logSaveFailure(intent, payload, error) {
  console.error("Assistant action save failed", {
    intent,
    payload: safePayloadForLog(intent, payload),
    supabaseError: error?.message || "Unknown save error",
    code: error?.code,
  });
}

export async function POST(request) {
  let intent = "";
  let payload = {};

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return Response.json({ success: false, error: "UNAUTHORIZED", message: "Google 로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    intent = body.intent;
    payload = body.payload && typeof body.payload === "object" ? body.payload : {};

    if (intent === "create_task") {
      try {
        const result = await createTaskForUser({
          supabase: getSupabaseServerClient(),
          userEmail: session.user.email,
          body: payload,
        });
        if (!result?.task?.id) throw new Error("Saved task response does not contain a task id");

        return Response.json({
          success: true,
          intent,
          message: `${result.task.title} 할 일을 추가했습니다.`,
          result,
        });
      } catch (error) {
        logSaveFailure(intent, payload, error);
        return Response.json({
          success: false,
          error: error?.code || "TASK_SAVE_FAILED",
          message: "할 일을 추가하지 못했습니다. 잠시 후 다시 시도해주세요.",
        }, { status: error?.status || 500 });
      }
    }

    const action = ACTIONS[intent];
    if (!action) {
      return Response.json({ success: false, error: "ACTION_NOT_SUPPORTED", message: "지원하지 않는 추가 요청입니다." }, { status: 400 });
    }

    const response = await action.handler(createForwardRequest(request, payload));
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      logSaveFailure(intent, payload, { message: result?.message || result?.error, code: result?.error });
      const calendarPermissionError = intent === "create_calendar_event" && [401, 403].includes(response.status);
      return Response.json({
        success: false,
        error: result.error || "ACTION_SAVE_FAILED",
        message: calendarPermissionError ? "Google Calendar 권한을 다시 연결해주세요." : "저장하지 못했습니다. 잠시 후 다시 시도해주세요.",
      }, { status: response.status });
    }

    return Response.json({
      success: true,
      intent,
      message: action.success(payload),
      result,
    });
  } catch (error) {
    logSaveFailure(intent, payload, error);
    return Response.json({ success: false, error: "ACTION_SAVE_FAILED", message: "저장하지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}
