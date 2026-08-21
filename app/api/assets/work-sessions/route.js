import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getSupabaseServerClient } from "../../../../lib/supabaseServer";
import { ASSET_TRANSACTION_COLUMNS, WORK_SESSION_COLUMNS, buildWorkSessionPayload, calculateWorkSession, isAssetTableMissingError, logAssetError, mapWorkSession } from "../../../../lib/assets";

async function owner() {
  const session = await getServerSession(authOptions);
  return session?.user?.email || null;
}

async function createIncome(supabase, userEmail, session) {
  const { data, error } = await supabase.from("finance_transactions").insert({
    user_email: userEmail, type: "income", title: "알바 급여", amount: session.expected_wage, category: "알바",
    memo: session.memo || String(session.start_time).slice(0, 5) + "~" + String(session.end_time).slice(0, 5) + " 근무",
    payment_method: "", status: "paid", transaction_date: session.work_date, work_session_id: session.id,
  }).select(ASSET_TRANSACTION_COLUMNS).single();
  if (error) throw error;
  const updated = await supabase.from("work_sessions").update({ transaction_id: data.id, updated_at: new Date().toISOString() }).eq("id", session.id).eq("user_email", userEmail);
  if (updated.error) throw updated.error;
}

function failure(error) {
  logAssetError("Work session request failed", error);
  if (isAssetTableMissingError(error)) return Response.json({ error: "ASSET_TABLES_MISSING" }, { status: 409 });
  if (String(error?.message || "").startsWith("WORK_")) return Response.json({ error: error.message, message: "근무 시간과 시급을 확인해주세요." }, { status: 400 });
  return Response.json({ error: "WORK_SESSION_FAILED", message: "근무 기록을 저장하지 못했습니다." }, { status: 500 });
}

export async function POST(request) {
  try {
    const userEmail = await owner();
    if (!userEmail) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const payload = buildWorkSessionPayload(await request.json().catch(() => ({})));
    const calculation = calculateWorkSession(payload.start_time, payload.end_time, payload.break_minutes, payload.hourly_wage);
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.from("work_sessions").insert({ user_email: userEmail, ...payload, actual_minutes: calculation.actualMinutes, expected_wage: calculation.expectedWage }).select(WORK_SESSION_COLUMNS).single();
    if (error) throw error;
    if (data.status === "paid") {
      try {
        await createIncome(supabase, userEmail, data);
      } catch (incomeError) {
        await supabase.from("work_sessions").delete().eq("id", data.id).eq("user_email", userEmail);
        throw incomeError;
      }
    }
    return Response.json({ workSession: mapWorkSession(data) }, { status: 201 });
  } catch (error) { return failure(error); }
}

export async function PATCH(request) {
  try {
    const userEmail = await owner();
    if (!userEmail) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    if (!body.id) return Response.json({ error: "ID_REQUIRED" }, { status: 400 });
    const supabase = getSupabaseServerClient();
    const currentResult = await supabase.from("work_sessions").select(WORK_SESSION_COLUMNS).eq("id", body.id).eq("user_email", userEmail).single();
    if (currentResult.error) throw currentResult.error;
    const payload = buildWorkSessionPayload(body, { partial: true });
    const merged = { ...currentResult.data, ...payload };
    const calculation = calculateWorkSession(merged.start_time, merged.end_time, merged.break_minutes, merged.hourly_wage);
    const { data, error } = await supabase.from("work_sessions").update({ ...payload, actual_minutes: calculation.actualMinutes, expected_wage: calculation.expectedWage, updated_at: new Date().toISOString() }).eq("id", body.id).eq("user_email", userEmail).select(WORK_SESSION_COLUMNS).single();
    if (error) throw error;
    if (data.status === "paid" && !data.transaction_id) {
      try {
        await createIncome(supabase, userEmail, data);
      } catch (incomeError) {
        await supabase.from("work_sessions").update({ status: currentResult.data.status }).eq("id", data.id).eq("user_email", userEmail);
        throw incomeError;
      }
    }
    if (data.status === "expected" && data.transaction_id) {
      const deletion = await supabase.from("finance_transactions").delete().eq("id", data.transaction_id).eq("user_email", userEmail);
      if (deletion.error) throw deletion.error;
      const unlink = await supabase.from("work_sessions").update({ transaction_id: null }).eq("id", data.id).eq("user_email", userEmail);
      if (unlink.error) throw unlink.error;
    }
    return Response.json({ workSession: mapWorkSession(data) });
  } catch (error) { return failure(error); }
}

export async function DELETE(request) {
  try {
    const userEmail = await owner();
    if (!userEmail) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    if (!body.id) return Response.json({ error: "ID_REQUIRED" }, { status: 400 });
    const { error } = await getSupabaseServerClient().from("work_sessions").delete().eq("id", body.id).eq("user_email", userEmail);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) { return failure(error); }
}
