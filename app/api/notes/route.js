import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { getSupabaseServerClient } from "../../../lib/supabaseServer";
import {
  decryptNoteContent,
  encryptNoteContent,
  hasValidNoteUnlock,
} from "../../../lib/noteSecurity";

const DEFAULT_NOTE_TITLE = "메모";
const DEFAULT_NOTE_TAG = "개인";

function mapLockedSafeNote(row) {
  const isLocked = Boolean(row.is_locked);
  const content = isLocked ? null : row.content || "";

  return {
    id: row.id,
    title: row.title || DEFAULT_NOTE_TITLE,
    body: content,
    content,
    tag: row.tag || DEFAULT_NOTE_TAG,
    isLocked,
  };
}

function mapReadableNote(row) {
  const isLocked = Boolean(row.is_locked);
  const content = isLocked
    ? decryptNoteContent({
        encryptedContent: row.encrypted_content,
        encryptionIv: row.encryption_iv,
        encryptionTag: row.encryption_tag,
      })
    : row.content || "";

  return {
    id: row.id,
    title: row.title || DEFAULT_NOTE_TITLE,
    body: content,
    content,
    tag: row.tag || DEFAULT_NOTE_TAG,
    isLocked,
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

  if (error?.message?.includes("Note security secret")) {
    return "NOTE_SECURITY_NOT_CONFIGURED";
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
      .select("id,title,content,tag,is_locked,created_at,updated_at")
      .eq("user_email", userEmail)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return Response.json({ notes: (data || []).map(mapLockedSafeNote) });
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
        title: body.title?.trim() || DEFAULT_NOTE_TITLE,
        content,
        tag: body.tag?.trim() || DEFAULT_NOTE_TAG,
        is_locked: false,
      })
      .select("id,title,content,tag,is_locked,created_at,updated_at")
      .single();

    if (error) throw error;
    return Response.json({ note: mapLockedSafeNote(data) });
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
    const { data: existingNote, error: findError } = await supabase
      .from("notes")
      .select("id,user_email,is_locked,password_hash,encrypted_content,encryption_iv,encryption_tag")
      .eq("id", body.id)
      .eq("user_email", userEmail)
      .single();

    if (findError) throw findError;
    if (!existingNote) return jsonError("NOTE_NOT_FOUND", 404);

    const isUnlocked = await hasValidNoteUnlock({
      note: existingNote,
      userEmail,
      password: body.password,
      unlockToken: body.unlockToken,
    });

    if (!isUnlocked) return jsonError("NOTE_UNLOCK_REQUIRED", 403);

    const content = body.content || "";
    const secureContent = existingNote.is_locked
      ? {
          ...encryptNoteContent(content),
          content: null,
        }
      : { content };

    const { data, error } = await supabase
      .from("notes")
      .update({
        title: body.title?.trim() || DEFAULT_NOTE_TITLE,
        tag: body.tag?.trim() || DEFAULT_NOTE_TAG,
        ...secureContent,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.id)
      .eq("user_email", userEmail)
      .select("id,title,content,tag,is_locked,encrypted_content,encryption_iv,encryption_tag,created_at,updated_at")
      .single();

    if (error) throw error;
    return Response.json({ ok: true, note: mapReadableNote(data) });
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
    const { data: existingNote, error: findError } = await supabase
      .from("notes")
      .select("id,user_email,is_locked,password_hash")
      .eq("id", body.id)
      .eq("user_email", userEmail)
      .single();

    if (findError) throw findError;
    if (!existingNote) return jsonError("NOTE_NOT_FOUND", 404);

    const isUnlocked = await hasValidNoteUnlock({
      note: existingNote,
      userEmail,
      password: body.password,
      unlockToken: body.unlockToken,
    });

    if (!isUnlocked) return jsonError("NOTE_UNLOCK_REQUIRED", 403);

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
