import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getSupabaseServerClient } from "../../../../lib/supabaseServer";
import {
  ASSET_TABLES_MISSING_MESSAGE,
  ASSET_TRANSACTION_COLUMNS,
  buildAssetTransactionPayload,
  isAssetTableMissingError,
  logAssetError,
  mapAssetTransaction,
} from "../../../../lib/assets";

async function getUserEmail() {
  const session = await getServerSession(authOptions);
  return session?.user?.email || null;
}

function handleError(context, error) {
  logAssetError(context, error);
  if (isAssetTableMissingError(error)) {
    return Response.json({ error: "ASSET_TABLES_MISSING", message: ASSET_TABLES_MISSING_MESSAGE }, { status: 409 });
  }
  if (String(error?.message || "").startsWith("ASSET_")) {
    return Response.json({ error: error.message, message: "거래 정보를 올바르게 입력해주세요." }, { status: 400 });
  }
  return Response.json({ error: "ASSET_TRANSACTION_FAILED", message: "거래 내역을 저장하지 못했습니다." }, { status: 500 });
}

export async function POST(request) {
  try {
    const userEmail = await getUserEmail();
    if (!userEmail) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const payload = buildAssetTransactionPayload(body);
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("asset_transactions")
      .insert({ user_email: userEmail, ...payload })
      .select(ASSET_TRANSACTION_COLUMNS)
      .single();
    if (error) throw error;
    return Response.json({ transaction: mapAssetTransaction(data) }, { status: 201 });
  } catch (error) {
    return handleError("Asset transaction POST failed", error);
  }
}

export async function PATCH(request) {
  try {
    const userEmail = await getUserEmail();
    if (!userEmail) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    if (!body.id) return Response.json({ error: "ASSET_TRANSACTION_ID_REQUIRED", message: "수정할 거래를 찾지 못했습니다." }, { status: 400 });
    const payload = buildAssetTransactionPayload(body, { partial: true });
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("asset_transactions")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", body.id)
      .eq("user_email", userEmail)
      .select(ASSET_TRANSACTION_COLUMNS)
      .single();
    if (error) throw error;
    return Response.json({ transaction: mapAssetTransaction(data) });
  } catch (error) {
    return handleError("Asset transaction PATCH failed", error);
  }
}

export async function DELETE(request) {
  try {
    const userEmail = await getUserEmail();
    if (!userEmail) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    if (!body.id) return Response.json({ error: "ASSET_TRANSACTION_ID_REQUIRED", message: "삭제할 거래를 찾지 못했습니다." }, { status: 400 });
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("asset_transactions").delete().eq("id", body.id).eq("user_email", userEmail);
    if (error) throw error;
    return Response.json({ ok: true, deletedId: body.id });
  } catch (error) {
    return handleError("Asset transaction DELETE failed", error);
  }
}
