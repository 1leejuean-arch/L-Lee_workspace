import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getSupabaseServerClient } from "../../../../lib/supabaseServer";
import { ASSET_TABLES_MISSING_MESSAGE, isAssetTableMissingError, logAssetError, parseAssetNumber } from "../../../../lib/assets";

export async function PATCH(request) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    if (!userEmail) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const initialBalance = parseAssetNumber(body.initialBalance, { allowZero: true });
    if (initialBalance == null) {
      return Response.json({ error: "INITIAL_BALANCE_INVALID", message: "초기 자산을 올바르게 입력해주세요." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("finance_settings")
      .upsert(
        { user_email: userEmail, initial_balance: initialBalance, updated_at: new Date().toISOString() },
        { onConflict: "user_email" },
      )
      .select("initial_balance")
      .single();
    if (error) throw error;
    return Response.json({ initialBalance: Number(data.initial_balance) || 0 });
  } catch (error) {
    logAssetError("Asset settings PATCH failed", error);
    if (isAssetTableMissingError(error)) {
      return Response.json({ error: "ASSET_TABLES_MISSING", message: ASSET_TABLES_MISSING_MESSAGE }, { status: 409 });
    }
    return Response.json({ error: "ASSET_SETTINGS_FAILED", message: "초기 자산을 저장하지 못했습니다." }, { status: 500 });
  }
}
