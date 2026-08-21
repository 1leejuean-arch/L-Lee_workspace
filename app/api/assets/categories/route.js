import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getSupabaseServerClient } from "../../../../lib/supabaseServer";
import { CATEGORY_COLUMNS, isAssetTableMissingError, logAssetError } from "../../../../lib/assets";

async function owner() {
  const session = await getServerSession(authOptions);
  return session?.user?.email || null;
}

export async function POST(request) {
  try {
    const userEmail = await owner();
    if (!userEmail) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const type = String(body.type || "");
    const name = String(body.name || "").trim();
    if (!["income", "expense"].includes(type) || !name || name.length > 60) {
      return Response.json({ error: "CATEGORY_INVALID", message: "카테고리 이름을 확인해주세요." }, { status: 400 });
    }
    const { data, error } = await getSupabaseServerClient().from("finance_categories").insert({ user_email: userEmail, type, name }).select(CATEGORY_COLUMNS).single();
    if (error) throw error;
    return Response.json({ category: data }, { status: 201 });
  } catch (error) {
    logAssetError("Finance category POST failed", error);
    if (error?.code === "23505") return Response.json({ error: "CATEGORY_EXISTS", message: "이미 등록된 카테고리입니다." }, { status: 409 });
    if (isAssetTableMissingError(error)) return Response.json({ error: "ASSET_TABLES_MISSING" }, { status: 409 });
    return Response.json({ error: "CATEGORY_FAILED", message: "카테고리를 저장하지 못했습니다." }, { status: 500 });
  }
}
