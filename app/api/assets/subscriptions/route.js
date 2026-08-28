import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getSupabaseServerClient } from "../../../../lib/supabaseServer";
import { SUBSCRIPTION_COLUMNS, buildSubscriptionPayload, isAssetTableMissingError, logAssetError, mapSubscription } from "../../../../lib/assets";
import { createRecurringCalendarEvent } from "../../../../lib/recurringCalendar";

async function authContext() {
  const session = await getServerSession(authOptions);
  return { session, userEmail: session?.user?.email || null };
}

function failure(error) {
  logAssetError("Subscription request failed", error);
  if (isAssetTableMissingError(error)) return Response.json({ error: "ASSET_TABLES_MISSING" }, { status: 409 });
  if (String(error?.message || "").startsWith("SUBSCRIPTION_")) return Response.json({ error: error.message, message: "정기결제 정보를 확인해주세요." }, { status: 400 });
  return Response.json({ error: "SUBSCRIPTION_FAILED", message: "정기결제를 저장하지 못했습니다." }, { status: 500 });
}

export async function POST(request) {
  try {
    const { session, userEmail } = await authContext();
    if (!userEmail) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const payload = buildSubscriptionPayload(await request.json().catch(() => ({})));
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.from("subscriptions").insert({ user_email: userEmail, ...payload }).select(SUBSCRIPTION_COLUMNS).single();
    if (error) throw error;
    let subscription = mapSubscription(data);
    let calendarWarning = null;

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
      console.error("Recurring payment Google Calendar sync failed", {
        status: calendarError?.status || null,
        googleCode: calendarError?.googleCode || null,
        googleReason: calendarError?.googleReason || null,
        message: calendarError?.message || "Unknown Google Calendar error",
      });
      calendarWarning = "정기결제는 등록했지만 캘린더 일정은 추가하지 못했습니다.";
    }

    return Response.json({ subscription, calendarSynced: !calendarWarning, calendarWarning }, { status: 201 });
  } catch (error) { return failure(error); }
}

export async function PATCH(request) {
  try {
    const { userEmail } = await authContext();
    if (!userEmail) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    if (!body.id) return Response.json({ error: "ID_REQUIRED" }, { status: 400 });
    const payload = buildSubscriptionPayload(body, { partial: true });
    const supabase = getSupabaseServerClient();
    if (body.nextBillingDate !== undefined) {
      const current = await supabase.from("subscriptions").select("next_billing_date").eq("id", body.id).eq("user_email", userEmail).single();
      if (current.error) throw current.error;
      if (current.data.next_billing_date !== body.nextBillingDate) payload.calendar_event_id = null;
    }
    const { data, error } = await supabase.from("subscriptions").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", body.id).eq("user_email", userEmail).select(SUBSCRIPTION_COLUMNS).single();
    if (error) throw error;
    return Response.json({ subscription: mapSubscription(data) });
  } catch (error) { return failure(error); }
}

export async function DELETE(request) {
  try {
    const { userEmail } = await authContext();
    if (!userEmail) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    if (!body.id) return Response.json({ error: "ID_REQUIRED" }, { status: 400 });
    const { error } = await getSupabaseServerClient().from("subscriptions").delete().eq("id", body.id).eq("user_email", userEmail);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) { return failure(error); }
}
