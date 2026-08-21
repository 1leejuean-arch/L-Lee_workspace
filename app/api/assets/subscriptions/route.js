import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getSupabaseServerClient } from "../../../../lib/supabaseServer";
import { SUBSCRIPTION_COLUMNS, buildSubscriptionPayload, isAssetTableMissingError, logAssetError, mapSubscription } from "../../../../lib/assets";

async function owner() {
  const session = await getServerSession(authOptions);
  return session?.user?.email || null;
}

function failure(error) {
  logAssetError("Subscription request failed", error);
  if (isAssetTableMissingError(error)) return Response.json({ error: "ASSET_TABLES_MISSING" }, { status: 409 });
  if (String(error?.message || "").startsWith("SUBSCRIPTION_")) return Response.json({ error: error.message, message: "정기결제 정보를 확인해주세요." }, { status: 400 });
  return Response.json({ error: "SUBSCRIPTION_FAILED", message: "정기결제를 저장하지 못했습니다." }, { status: 500 });
}

export async function POST(request) {
  try {
    const userEmail = await owner();
    if (!userEmail) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const payload = buildSubscriptionPayload(await request.json().catch(() => ({})));
    const { data, error } = await getSupabaseServerClient().from("subscriptions").insert({ user_email: userEmail, ...payload }).select(SUBSCRIPTION_COLUMNS).single();
    if (error) throw error;
    return Response.json({ subscription: mapSubscription(data) }, { status: 201 });
  } catch (error) { return failure(error); }
}

export async function PATCH(request) {
  try {
    const userEmail = await owner();
    if (!userEmail) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    if (!body.id) return Response.json({ error: "ID_REQUIRED" }, { status: 400 });
    const payload = buildSubscriptionPayload(body, { partial: true });
    const { data, error } = await getSupabaseServerClient().from("subscriptions").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", body.id).eq("user_email", userEmail).select(SUBSCRIPTION_COLUMNS).single();
    if (error) throw error;
    return Response.json({ subscription: mapSubscription(data) });
  } catch (error) { return failure(error); }
}

export async function DELETE(request) {
  try {
    const userEmail = await owner();
    if (!userEmail) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    if (!body.id) return Response.json({ error: "ID_REQUIRED" }, { status: 400 });
    const { error } = await getSupabaseServerClient().from("subscriptions").delete().eq("id", body.id).eq("user_email", userEmail);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) { return failure(error); }
}
