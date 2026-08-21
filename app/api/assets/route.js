import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { getSupabaseServerClient } from "../../../lib/supabaseServer";
import {
  ASSET_LOAD_ERROR_MESSAGE,
  ASSET_TABLES_MISSING_MESSAGE,
  ASSET_TRANSACTION_COLUMNS,
  CATEGORY_COLUMNS,
  SUBSCRIPTION_COLUMNS,
  WORK_SESSION_COLUMNS,
  calculateAssetSummary,
  isAssetTableMissingError,
  logAssetError,
  mapAssetTransaction,
  mapSubscription,
  mapWorkSession,
} from "../../../lib/assets";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    if (!userEmail) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const supabase = getSupabaseServerClient();
    const [settingsResult, transactionsResult, categoriesResult, workResult, subscriptionsResult] = await Promise.all([
      supabase.from("finance_settings").select("initial_balance").eq("user_email", userEmail).maybeSingle(),
      supabase
        .from("finance_transactions")
        .select(ASSET_TRANSACTION_COLUMNS)
        .eq("user_email", userEmail)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("finance_categories").select(CATEGORY_COLUMNS).eq("user_email", userEmail).order("name"),
      supabase.from("work_sessions").select(WORK_SESSION_COLUMNS).eq("user_email", userEmail).order("work_date", { ascending: false }),
      supabase.from("subscriptions").select(SUBSCRIPTION_COLUMNS).eq("user_email", userEmail).order("next_billing_date"),
    ]);

    if (settingsResult.error) throw settingsResult.error;
    if (transactionsResult.error) throw transactionsResult.error;
    if (categoriesResult.error) throw categoriesResult.error;
    if (workResult.error) throw workResult.error;
    if (subscriptionsResult.error) throw subscriptionsResult.error;

    const initialBalance = Number(settingsResult.data?.initial_balance) || 0;
    const transactions = (transactionsResult.data || []).map(mapAssetTransaction);
    return Response.json({
      initialBalance,
      hasInitialBalance: Boolean(settingsResult.data),
      transactions,
      categories: categoriesResult.data || [],
      workSessions: (workResult.data || []).map(mapWorkSession),
      subscriptions: (subscriptionsResult.data || []).map(mapSubscription),
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
