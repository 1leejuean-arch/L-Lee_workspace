import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../auth/[...nextauth]/route";
import { getSupabaseServerClient } from "../../../lib/supabaseServer";

function mapTaskRow(row) {
  return {
    id: row.id,
    title: row.title,
    completed: Boolean(row.completed),
    priority: row.priority || "보통",
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
      .from("tasks")
      .select("id,title,completed,priority,created_at,updated_at")
      .eq("user_email", userEmail)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ tasks: (data || []).map(mapTaskRow) });
  } catch (error) {
    console.error("Tasks GET failed:", error);
    return jsonError("할 일을 불러오지 못했습니다.");
  }
}

export async function POST(request) {
  try {
    const userEmail = await getUserEmail();
    if (!userEmail) return jsonError("로그인이 필요합니다.", 401);

    const body = await request.json().catch(() => ({}));
    const title = body.title?.trim();
    if (!title) return jsonError("할 일 제목이 필요합니다.", 400);

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_email: userEmail,
        title,
        completed: Boolean(body.completed),
        priority: body.priority || "보통",
      })
      .select("id,title,completed,priority,created_at,updated_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ task: mapTaskRow(data) });
  } catch (error) {
    console.error("Tasks POST failed:", error);
    return jsonError("할 일을 저장하지 못했습니다.");
  }
}

export async function PATCH(request) {
  try {
    const userEmail = await getUserEmail();
    if (!userEmail) return jsonError("로그인이 필요합니다.", 401);

    const body = await request.json().catch(() => ({}));
    if (!body.id) return jsonError("수정할 할 일 ID가 필요합니다.", 400);

    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("tasks")
      .update({
        title: body.title,
        completed: Boolean(body.completed),
        priority: body.priority || "보통",
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.id)
      .eq("user_email", userEmail);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Tasks PATCH failed:", error);
    return jsonError("할 일을 수정하지 못했습니다.");
  }
}

export async function DELETE(request) {
  try {
    const userEmail = await getUserEmail();
    if (!userEmail) return jsonError("로그인이 필요합니다.", 401);

    const body = await request.json().catch(() => ({}));
    if (!body.id) return jsonError("삭제할 할 일 ID가 필요합니다.", 400);

    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", body.id)
      .eq("user_email", userEmail);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Tasks DELETE failed:", error);
    return jsonError("할 일을 삭제하지 못했습니다.");
  }
}
