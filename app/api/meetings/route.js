import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { getSupabaseServerClient } from "../../../lib/supabaseServer";
import {
  MEETING_COLUMNS,
  MEETING_DELETE_ERROR_MESSAGE,
  MEETING_SAVE_ERROR_MESSAGE,
  MEETINGS_TABLE_MISSING_MESSAGE,
  buildMeetingPayload,
  isMeetingTableMissingError,
  logMeetingError,
  mapMeetingRow,
} from "../../../lib/meetings";

async function getUserEmail() {
  const session = await getServerSession(authOptions);
  return session?.user?.email || null;
}

function errorResponse(error, fallbackMessage, status = 500) {
  if (isMeetingTableMissingError(error)) {
    return Response.json({ error: "MEETINGS_TABLE_MISSING", message: MEETINGS_TABLE_MISSING_MESSAGE }, { status: 409 });
  }
  return Response.json({ error: "MEETING_REQUEST_FAILED", message: fallbackMessage }, { status });
}

export async function GET() {
  try {
    const userEmail = await getUserEmail();
    if (!userEmail) return Response.json({ error: "UNAUTHORIZED", message: "Google 로그인이 필요합니다." }, { status: 401 });
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("meeting_minutes")
      .select(MEETING_COLUMNS)
      .eq("user_email", userEmail)
      .order("meeting_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return Response.json({ meetings: (data || []).map(mapMeetingRow) });
  } catch (error) {
    logMeetingError("Meetings GET failed", error);
    return errorResponse(error, "회의록을 불러오지 못했습니다.");
  }
}

export async function POST(request) {
  try {
    const userEmail = await getUserEmail();
    if (!userEmail) return Response.json({ error: "UNAUTHORIZED", message: "Google 로그인이 필요합니다." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const payload = buildMeetingPayload(body);
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("meeting_minutes")
      .insert({ user_email: userEmail, ...payload })
      .select(MEETING_COLUMNS)
      .single();
    if (error) throw error;
    return Response.json({ meeting: mapMeetingRow(data) }, { status: 201 });
  } catch (error) {
    logMeetingError("Meetings POST failed", error);
    const validationError = ["MEETING_TITLE_REQUIRED", "MEETING_DATE_REQUIRED", "MEETING_TIME_INVALID", "MEETING_TIME_RANGE_INVALID"].includes(error?.message);
    return errorResponse(error, MEETING_SAVE_ERROR_MESSAGE, validationError ? 400 : 500);
  }
}

export async function PATCH(request) {
  try {
    const userEmail = await getUserEmail();
    if (!userEmail) return Response.json({ error: "UNAUTHORIZED", message: "Google 로그인이 필요합니다." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    if (!body.id) return Response.json({ error: "MEETING_ID_REQUIRED", message: MEETING_SAVE_ERROR_MESSAGE }, { status: 400 });
    const payload = buildMeetingPayload(body);
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("meeting_minutes")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", body.id)
      .eq("user_email", userEmail)
      .select(MEETING_COLUMNS)
      .single();
    if (error) throw error;
    return Response.json({ meeting: mapMeetingRow(data) });
  } catch (error) {
    logMeetingError("Meetings PATCH failed", error);
    const validationError = ["MEETING_TITLE_REQUIRED", "MEETING_DATE_REQUIRED", "MEETING_TIME_INVALID", "MEETING_TIME_RANGE_INVALID"].includes(error?.message);
    return errorResponse(error, MEETING_SAVE_ERROR_MESSAGE, validationError ? 400 : 500);
  }
}

export async function DELETE(request) {
  try {
    const userEmail = await getUserEmail();
    if (!userEmail) return Response.json({ error: "UNAUTHORIZED", message: "Google 로그인이 필요합니다." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    if (!body.id) return Response.json({ error: "MEETING_ID_REQUIRED", message: MEETING_DELETE_ERROR_MESSAGE }, { status: 400 });
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("meeting_minutes").delete().eq("id", body.id).eq("user_email", userEmail);
    if (error) throw error;
    return Response.json({ ok: true, deletedMeetingId: body.id });
  } catch (error) {
    logMeetingError("Meetings DELETE failed", error);
    return errorResponse(error, MEETING_DELETE_ERROR_MESSAGE);
  }
}
