import { fetchGoogleApi } from "./googleApiServer";

function nextDate(dateValue) {
  const date = new Date(`${dateValue}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function calendarEventId(subscriptionId, paymentDate) {
  return `llee${String(subscriptionId).replace(/-/g, "")}${String(paymentDate).replace(/-/g, "")}`.toLowerCase();
}

export function buildRecurringCalendarEvent(subscription) {
  const paymentDate = subscription.nextBillingDate;
  return {
    id: calendarEventId(subscription.id, paymentDate),
    summary: `${subscription.serviceName} 결제일`,
    description: [
      `정기결제 금액: ₩${Math.round(Number(subscription.amount) || 0).toLocaleString("ko-KR")}`,
      `카테고리: ${subscription.category || "구독"}`,
      subscription.memo ? `메모: ${subscription.memo}` : null,
      "L-Lee Workspace 자산관리에서 생성됨",
    ].filter(Boolean).join("\n"),
    start: { date: paymentDate },
    end: { date: nextDate(paymentDate) },
    extendedProperties: {
      private: {
        lleeSubscriptionId: String(subscription.id),
        lleePaymentDate: String(paymentDate),
      },
    },
  };
}

async function readGoogleError(response) {
  const data = await response.json().catch(() => ({}));
  return {
    message: data?.error?.message || data?.message || "Google Calendar API error",
    code: data?.error?.code || response.status,
    reason: data?.error?.errors?.[0]?.reason || null,
  };
}

function googleCalendarError(details, status) {
  const error = new Error(details?.message || "Google Calendar API error");
  error.status = status;
  error.googleCode = details?.code || status;
  error.googleReason = details?.reason || null;
  return error;
}

async function fetchEventById(request, session, eventId) {
  const result = await fetchGoogleApi(request, session, `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, {
    cache: "no-store",
  });
  if (result.error) throw googleCalendarError({ message: result.message, code: result.status }, result.status);
  if (result.response.status === 404 || result.response.status === 410) return null;
  if (!result.response.ok) throw googleCalendarError(await readGoogleError(result.response), result.response.status);
  const event = await result.response.json();
  return event.status === "cancelled" ? null : event;
}

async function insertEvent(request, session, event) {
  const result = await fetchGoogleApi(request, session, "https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  if (result.error) throw googleCalendarError({ message: result.message, code: result.status }, result.status);
  return result.response;
}

export async function createRecurringCalendarEvent(request, session, subscription) {
  const event = buildRecurringCalendarEvent(subscription);
  if (subscription.calendarEventId) {
    const existing = await fetchEventById(request, session, subscription.calendarEventId);
    if (existing) return { eventId: existing.id, event: existing, duplicate: true };
  }

  let response = await insertEvent(request, session, event);
  if (response.status === 409) {
    const existing = await fetchEventById(request, session, event.id);
    if (existing) return { eventId: existing.id, event: existing, duplicate: true };
    // Google keeps deleted event IDs as tombstones. Retry without the deterministic ID.
    const eventWithoutId = { ...event };
    delete eventWithoutId.id;
    response = await insertEvent(request, session, eventWithoutId);
  }
  if (!response.ok) throw googleCalendarError(await readGoogleError(response), response.status);
  const created = await response.json();
  return { eventId: created.id || event.id, event: created, duplicate: false };
}
