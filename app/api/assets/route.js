import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { getSupabaseServerClient } from "../../../lib/supabaseServer";
import {
  ASSET_LOAD_ERROR_MESSAGE,
  ASSET_TABLES_MISSING_MESSAGE,
  ASSET_TRANSACTION_COLUMNS,
  calculateAssetSummary,
  isAssetTableMissingError,
  logAssetError,
  mapAssetTransaction,
} from "../../../lib/assets";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    if (!userEmail) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const supabase = getSupabaseServerClient();
    const [settingsResult, transactionsResult] = await Promise.all([
      supabase.from("asset_settings").select("initial_balance").eq("user_email", userEmail).maybeSingle(),
      supabase
        .from("asset_transactions")
        .select(ASSET_TRANSACTION_COLUMNS)
        .eq("user_email", userEmail)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

    if (settingsResult.error) throw settingsResult.error;
    if (transactionsResult.error) throw transactionsResult.error;

    const initialBalance = Number(settingsResult.data?.initial_balance) || 0;
    const transactions = (transactionsResult.data || []).map(mapAssetTransaction);
    return Response.json({
      initialBalance,
      hasInitialBalance: Boolean(settingsResult.data),
      transactions,
      summary: calculateAssetSummary(initialBalance, transactions),
    });
  } catch (error) {
    logAssetError("Assets GET failed", error);
    if (isAssetTableMissingError(error)) {
      return Response.json({ error: "ASSET_TABLES_MISSING", message: ASSET_TABLES_MISSING_MESSAGE }, { status: 409 });
    }
    return Response.json({ error: "ASSET_LOAD_FAILED", message: ASSET_LOAD_ERROR_MESSAGE }, { status: 500 });
  }
}
