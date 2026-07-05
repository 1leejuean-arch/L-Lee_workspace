import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { getSupabaseServerClient } from "../../../../../lib/supabaseServer";
import {
  createNoteUnlockToken,
  decryptNoteContent,
  verifyNotePassword,
} from "../../../../../lib/noteSecurity";

const DEFAULT_NOTE_TITLE = "메모";
const DEFAULT_NOTE_TAG = "개인";

async function getUserEmail() {
  const session = await getServerSession(authOptions);
  return session?.user?.email || null;
}

function jsonError(error, status = 500) {
  return Response.json({ error }, { status });
}

function logNoteSecurityError(context, error) {
  console.error(context, {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
  });
}

export async function POST(request, context) {
  try {
    const userEmail = await getUserEmail();
    if (!userEmail) return jsonError("UNAUTHORIZED", 401);

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const password = body.password;
    if (!password) return jsonError("INVALID_PASSWORD", 401);

    const supabase = getSupabaseServerClient();
    const { data: note, error } = await supabase
      .from("notes")
      .select("id,title,tag,user_email,is_locked,password_hash,encrypted_content,encryption_iv,encryption_tag")
      .eq("id", id)
      .eq("user_email", userEmail)
      .single();

    if (error) throw error;
    if (!note) return jsonError("NOTE_NOT_FOUND", 404);
    if (!note.is_locked) return jsonError("NOTE_NOT_LOCKED", 409);

    const passwordMatches = await verifyNotePassword(password, note.password_hash);
    if (!passwordMatches) return jsonError("INVALID_PASSWORD", 401);

    const content = decryptNoteContent({
      encryptedContent: note.encrypted_content,
      encryptionIv: note.encryption_iv,
      encryptionTag: note.encryption_tag,
    });
    const unlockToken = createNoteUnlockToken({ noteId: note.id, userEmail });

    return Response.json({
      ok: true,
      unlockToken,
      note: {
        id: note.id,
        title: note.title || DEFAULT_NOTE_TITLE,
        body: content,
        content,
        tag: note.tag || DEFAULT_NOTE_TAG,
        isLocked: true,
      },
    });
  } catch (error) {
    logNoteSecurityError("Note unlock failed", error);
    return jsonError("NOTE_SECURITY_OPERATION_FAILED", 500);
  }
}
