import { getServerSession } from "next-auth";
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

function jsonError(error, status = 500, details) {
  return Response.json({ error, ...(details ? { details } : {}) }, { status });
}

function getSupabaseErrorCode(error) {
  if (error?.message?.includes("Supabase server environment variables")) {
    return "SUPABASE_NOT_CONFIGURED";
  }

  return "SUPABASE_QUERY_FAILED";
}

function logSupabaseQueryError(context, error) {
  console.error(context, {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
  });
}

export async function GET() {
  try {
    const userEmail = await getUserEmail();
    if (!userEmail) return jsonError("UNAUTHORIZED", 401);

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("tasks")
      .select("id,title,completed,priority,created_at,updated_at")
      .eq("user_email", userEmail)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return Response.json({ tasks: (data || []).map(mapTaskRow) });
  } catch (error) {
    logSupabaseQueryError("Tasks GET failed", error);
    return jsonError(getSupabaseErrorCode(error), 500);
  }
}

export async function POST(request) {
  try {
    const userEmail = await getUserEmail();
    if (!userEmail) return jsonError("UNAUTHORIZED", 401);

    const body = await request.json().catch(() => ({}));
    const title = body.title?.trim();
    if (!title) return jsonError("TASK_TITLE_REQUIRED", 400);

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
    return Response.json({ task: mapTaskRow(data) });
  } catch (error) {
    logSupabaseQueryError("Tasks POST failed", error);
    return jsonError(getSupabaseErrorCode(error), 500);
  }
}

export async function PATCH(request) {
  try {
    const userEmail = await getUserEmail();
    if (!userEmail) return jsonError("UNAUTHORIZED", 401);

    const body = await request.json().catch(() => ({}));
    if (!body.id) return jsonError("TASK_ID_REQUIRED", 400);

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
    return Response.json({ ok: true });
  } catch (error) {
    logSupabaseQueryError("Tasks PATCH failed", error);
    return jsonError(getSupabaseErrorCode(error), 500);
  }
}

export async function DELETE(request) {
  try {
    const userEmail = await getUserEmail();
    if (!userEmail) return jsonError("UNAUTHORIZED", 401);

    const body = await request.json().catch(() => ({}));
    if (!body.id) return jsonError("TASK_ID_REQUIRED", 400);

    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", body.id)
      .eq("user_email", userEmail);

    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    logSupabaseQueryError("Tasks DELETE failed", error);
    return jsonError(getSupabaseErrorCode(error), 500);
  }
}
