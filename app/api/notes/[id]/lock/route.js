import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { getSupabaseServerClient } from "../../../../../lib/supabaseServer";
import {
  decryptNoteContent,
  encryptNoteContent,
  hashNotePassword,
  verifyNotePassword,
} from "../../../../../lib/noteSecurity";

const DEFAULT_NOTE_TITLE = "메모";
const DEFAULT_NOTE_TAG = "개인";
const MIN_PASSWORD_LENGTH = 6;

async function getUserEmail() {
  const session = await getServerSession(authOptions);
  return session?.user?.email || null;
}

function jsonError(error, status = 500) {
  return Response.json({ error }, { status });
}

function isValidPassword(password) {
  return typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH;
}

function mapNote(row, content) {
  return {
    id: row.id,
    title: row.title || DEFAULT_NOTE_TITLE,
    body: content,
    content,
    tag: row.tag || DEFAULT_NOTE_TAG,
    isLocked: Boolean(row.is_locked),
  };
}

function logNoteSecurityError(context, error) {
  console.error(context, {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
  });
}

async function findOwnedNote(supabase, id, userEmail) {
  const { data, error } = await supabase
    .from("notes")
    .select("id,title,content,tag,user_email,is_locked,password_hash,encrypted_content,encryption_iv,encryption_tag")
    .eq("id", id)
    .eq("user_email", userEmail)
    .single();

  if (error) throw error;
  return data;
}

export async function POST(request, context) {
  try {
    const userEmail = await getUserEmail();
    if (!userEmail) return jsonError("UNAUTHORIZED", 401);

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    if (!isValidPassword(body.password)) return jsonError("PASSWORD_TOO_SHORT", 400);

    const supabase = getSupabaseServerClient();
    const note = await findOwnedNote(supabase, id, userEmail);
    if (!note) return jsonError("NOTE_NOT_FOUND", 404);
    if (note.is_locked) return jsonError("NOTE_ALREADY_LOCKED", 409);

    const { encryptedContent, encryptionIv, encryptionTag } = encryptNoteContent(note.content || "");
    const passwordHash = await hashNotePassword(body.password);
    const { data, error } = await supabase
      .from("notes")
      .update({
        is_locked: true,
        password_hash: passwordHash,
        encrypted_content: encryptedContent,
        encryption_iv: encryptionIv,
        encryption_tag: encryptionTag,
        content: null,
        locked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_email", userEmail)
      .select("id,title,content,tag,is_locked")
      .single();

    if (error) throw error;
    return Response.json({ ok: true, note: mapNote(data, null) });
  } catch (error) {
    logNoteSecurityError("Note lock failed", error);
    return jsonError("NOTE_SECURITY_OPERATION_FAILED", 500);
  }
}

export async function PATCH(request, context) {
  try {
    const userEmail = await getUserEmail();
    if (!userEmail) return jsonError("UNAUTHORIZED", 401);

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    if (!isValidPassword(body.currentPassword)) return jsonError("INVALID_PASSWORD", 401);
    if (!isValidPassword(body.newPassword)) return jsonError("PASSWORD_TOO_SHORT", 400);

    const supabase = getSupabaseServerClient();
    const note = await findOwnedNote(supabase, id, userEmail);
    if (!note) return jsonError("NOTE_NOT_FOUND", 404);
    if (!note.is_locked) return jsonError("NOTE_NOT_LOCKED", 409);

    const passwordMatches = await verifyNotePassword(body.currentPassword, note.password_hash);
    if (!passwordMatches) return jsonError("INVALID_PASSWORD", 401);

    const passwordHash = await hashNotePassword(body.newPassword);
    const { error } = await supabase
      .from("notes")
      .update({
        password_hash: passwordHash,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_email", userEmail);

    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    logNoteSecurityError("Note password change failed", error);
    return jsonError("NOTE_SECURITY_OPERATION_FAILED", 500);
  }
}

export async function DELETE(request, context) {
  try {
    const userEmail = await getUserEmail();
    if (!userEmail) return jsonError("UNAUTHORIZED", 401);

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    if (!isValidPassword(body.currentPassword)) return jsonError("INVALID_PASSWORD", 401);

    const supabase = getSupabaseServerClient();
    const note = await findOwnedNote(supabase, id, userEmail);
    if (!note) return jsonError("NOTE_NOT_FOUND", 404);
    if (!note.is_locked) return jsonError("NOTE_NOT_LOCKED", 409);

    const passwordMatches = await verifyNotePassword(body.currentPassword, note.password_hash);
    if (!passwordMatches) return jsonError("INVALID_PASSWORD", 401);

    const content = decryptNoteContent({
      encryptedContent: note.encrypted_content,
      encryptionIv: note.encryption_iv,
      encryptionTag: note.encryption_tag,
    });
    const { data, error } = await supabase
      .from("notes")
      .update({
        is_locked: false,
        password_hash: null,
        encrypted_content: null,
        encryption_iv: null,
        encryption_tag: null,
        locked_at: null,
        content,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_email", userEmail)
      .select("id,title,content,tag,is_locked")
      .single();

    if (error) throw error;
    return Response.json({ ok: true, note: mapNote(data, data.content || "") });
  } catch (error) {
    logNoteSecurityError("Note unlock removal failed", error);
    return jsonError("NOTE_SECURITY_OPERATION_FAILED", 500);
  }
}
