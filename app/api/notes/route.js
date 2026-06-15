import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../auth/[...nextauth]/route";
import { getSupabaseServerClient } from "../../../lib/supabaseServer";

function mapNoteRow(row) {
  return {
    id: row.id,
    title: row.title || "메모",
    body: row.content || "",
    tag: row.tag || "개인",
  };
}

async function getUserEmail() {
  const session = await getServerSession(authOptions);
  return session?.user?.email || null;
}

function jsonError(message, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    const userEmail = await getUserEmail();
    if (!userEmail) return jsonError("로그인이 필요합니다.", 401);

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("notes")
      .select("id,title,content,tag,created_at,updated_at")
      .eq("user_email", userEmail)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ notes: (data || []).map(mapNoteRow) });
  } catch (error) {
    console.error("Notes GET failed:", error);
    return jsonError("메모를 불러오지 못했습니다.");
  }
}

export async function POST(request) {
  try {
    const userEmail = await getUserEmail();
    if (!userEmail) return jsonError("로그인이 필요합니다.", 401);

    const body = await request.json().catch(() => ({}));
    const content = body.content?.trim();
    if (!content) return jsonError("메모 내용이 필요합니다.", 400);

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("notes")
      .insert({
        user_email: userEmail,
        title: body.title?.trim() || "메모",
        content,
        tag: body.tag?.trim() || "개인",
      })
      .select("id,title,content,tag,created_at,updated_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ note: mapNoteRow(data) });
  } catch (error) {
    console.error("Notes POST failed:", error);
    return jsonError("메모를 저장하지 못했습니다.");
  }
}

export async function PATCH(request) {
  try {
    const userEmail = await getUserEmail();
    if (!userEmail) return jsonError("로그인이 필요합니다.", 401);

    const body = await request.json().catch(() => ({}));
    if (!body.id) return jsonError("수정할 메모 ID가 필요합니다.", 400);

    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("notes")
      .update({
        title: body.title?.trim() || "메모",
        content: body.content || "",
        tag: body.tag?.trim() || "개인",
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.id)
      .eq("user_email", userEmail);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Notes PATCH failed:", error);
    return jsonError("메모를 수정하지 못했습니다.");
  }
}

export async function DELETE(request) {
  try {
    const userEmail = await getUserEmail();
    if (!userEmail) return jsonError("로그인이 필요합니다.", 401);

    const body = await request.json().catch(() => ({}));
    if (!body.id) return jsonError("삭제할 메모 ID가 필요합니다.", 400);

    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("notes")
      .delete()
      .eq("id", body.id)
      .eq("user_email", userEmail);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Notes DELETE failed:", error);
    return jsonError("메모를 삭제하지 못했습니다.");
  }
}
