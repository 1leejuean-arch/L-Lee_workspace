import { getServerSession } from "next-auth";
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
      .from("notes")
      .select("id,title,content,tag,created_at,updated_at")
      .eq("user_email", userEmail)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return Response.json({ notes: (data || []).map(mapNoteRow) });
  } catch (error) {
    logSupabaseQueryError("Notes GET failed", error);
    return jsonError(getSupabaseErrorCode(error), 500);
  }
}

export async function POST(request) {
  try {
    const userEmail = await getUserEmail();
    if (!userEmail) return jsonError("UNAUTHORIZED", 401);

    const body = await request.json().catch(() => ({}));
    const content = body.content?.trim();
    if (!content) return jsonError("NOTE_CONTENT_REQUIRED", 400);

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
    return Response.json({ note: mapNoteRow(data) });
  } catch (error) {
    logSupabaseQueryError("Notes POST failed", error);
    return jsonError(getSupabaseErrorCode(error), 500);
  }
}

export async function PATCH(request) {
  try {
    const userEmail = await getUserEmail();
    if (!userEmail) return jsonError("UNAUTHORIZED", 401);

    const body = await request.json().catch(() => ({}));
    if (!body.id) return jsonError("NOTE_ID_REQUIRED", 400);

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
    return Response.json({ ok: true });
  } catch (error) {
    logSupabaseQueryError("Notes PATCH failed", error);
    return jsonError(getSupabaseErrorCode(error), 500);
  }
}

export async function DELETE(request) {
  try {
    const userEmail = await getUserEmail();
    if (!userEmail) return jsonError("UNAUTHORIZED", 401);

    const body = await request.json().catch(() => ({}));
    if (!body.id) return jsonError("NOTE_ID_REQUIRED", 400);

    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("notes")
      .delete()
      .eq("id", body.id)
      .eq("user_email", userEmail);

    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    logSupabaseQueryError("Notes DELETE failed", error);
    return jsonError(getSupabaseErrorCode(error), 500);
  }
}
