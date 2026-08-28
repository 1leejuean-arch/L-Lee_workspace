import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { getSupabaseServerClient } from "../../../../../lib/supabaseServer";
import { SUBSCRIPTION_COLUMNS, getKoreaDateValue, isAssetTableMissingError, logAssetError, mapAssetTransaction, mapSubscription } from "../../../../../lib/assets";
import { createRecurringCalendarEvent } from "../../../../../lib/recurringCalendar";

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    if (!userEmail) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    if (!body.subscriptionId || !/^\d{4}-\d{2}-\d{2}$/.test(String(body.paymentDate || ""))) {
      return Response.json({ error: "SUBSCRIPTION_PROCESS_INPUT_INVALID", message: "처리할 정기결제 정보를 확인해주세요." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.rpc("process_recurring_payment", {
      p_subscription_id: body.subscriptionId,
      p_user_email: userEmail,
      p_payment_date: body.paymentDate,
      p_today: getKoreaDateValue(),
    });
    if (error) throw error;

    let subscription = mapSubscription(data.subscription || {});
    const transaction = mapAssetTransaction(data.transaction || {});
    let calendarWarning = null;

    if (!subscription.calendarEventId) {
      try {
        const calendar = await createRecurringCalendarEvent(request, session, subscription);
        const updated = await supabase
          .from("subscriptions")
          .update({ calendar_event_id: calendar.eventId, updated_at: new Date().toISOString() })
          .eq("id", subscription.id)
          .eq("user_email", userEmail)
          .select(SUBSCRIPTION_COLUMNS)
          .single();
        if (updated.error) throw updated.error;
        subscription = mapSubscription(updated.data);
      } catch (calendarError) {
        console.error("Next recurring payment Google Calendar sync failed", {
          status: calendarError?.status || null,
          googleCode: calendarError?.googleCode || null,
          googleReason: calendarError?.googleReason || null,
          message: calendarError?.message || "Unknown Google Calendar error",
        });
        calendarWarning = "지출은 등록했지만 다음 결제일을 Google Calendar에 추가하지 못했습니다. 캘린더 권한을 확인해주세요.";
      }
    }

    return Response.json({
      ok: true,
      duplicate: Boolean(data.duplicate),
      transaction,
      subscription,
      calendarSynced: !calendarWarning,
      calendarWarning,
      message: data.duplicate ? "이미 지출로 등록된 결제입니다." : "정기결제를 지출로 등록했습니다.",
    });
  } catch (error) {
    logAssetError("Recurring payment process failed", error);
    if (isAssetTableMissingError(error) || error?.code === "PGRST202") {
      return Response.json({ error: "RECURRING_PAYMENT_SCHEMA_MISSING", message: "supabase/recurring_payments_update.sql을 먼저 실행해주세요." }, { status: 409 });
    }
    const message = String(error?.message || "");
    if (message.includes("SUBSCRIPTION_NOT_DUE") || message.includes("SUBSCRIPTION_INACTIVE") || message.includes("SUBSCRIPTION_PAYMENT_DATE_CHANGED")) {
      return Response.json({ error: "SUBSCRIPTION_NOT_PROCESSABLE", message: "이미 처리되었거나 아직 결제일이 아닌 정기결제입니다." }, { status: 409 });
    }
    return Response.json({ error: "SUBSCRIPTION_PROCESS_FAILED", message: "정기결제를 지출로 등록하지 못했습니다." }, { status: 500 });
  }
}
