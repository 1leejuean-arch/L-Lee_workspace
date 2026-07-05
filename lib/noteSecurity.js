import crypto from "crypto";
import bcrypt from "bcryptjs";

const UNLOCK_TOKEN_TTL_SECONDS = 10 * 60;
const BCRYPT_ROUNDS = 12;

function getSecretValue() {
  const secret = process.env.NOTES_ENCRYPTION_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("Note security secret is not configured");
  }
  return secret;
}

function getEncryptionKey() {
  return crypto.createHash("sha256").update(getSecretValue()).digest();
}

function toBase64Url(input) {
  return Buffer.from(input).toString("base64url");
}

function fromBase64Url(input) {
  return Buffer.from(input, "base64url");
}

function signPayload(payload) {
  return crypto.createHmac("sha256", getSecretValue()).update(payload).digest("base64url");
}

export async function hashNotePassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyNotePassword(password, passwordHash) {
  if (!password || !passwordHash) return false;
  return bcrypt.compare(password, passwordHash);
}

export function encryptNoteContent(content) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(content || ""), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    encryptedContent: encrypted.toString("base64"),
    encryptionIv: iv.toString("base64"),
    encryptionTag: tag.toString("base64"),
  };
}

export function decryptNoteContent({ encryptedContent, encryptionIv, encryptionTag }) {
  if (!encryptedContent || !encryptionIv || !encryptionTag) return "";

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(encryptionIv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(encryptionTag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedContent, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function createNoteUnlockToken({ noteId, userEmail }) {
  const payload = toBase64Url(JSON.stringify({
    noteId,
    userEmail,
    exp: Math.floor(Date.now() / 1000) + UNLOCK_TOKEN_TTL_SECONDS,
  }));
  return `${payload}.${signPayload(payload)}`;
}

export function verifyNoteUnlockToken(token, { noteId, userEmail }) {
  if (!token || typeof token !== "string" || !token.includes(".")) return false;

  const [payload, signature] = token.split(".");
  const expectedSignature = signPayload(payload);
  const signatureBuffer = fromBase64Url(signature);
  const expectedBuffer = fromBase64Url(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return false;
  }

  try {
    const data = JSON.parse(fromBase64Url(payload).toString("utf8"));
    return (
      data.noteId === noteId &&
      data.userEmail === userEmail &&
      Number(data.exp) > Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}

export async function hasValidNoteUnlock({ note, userEmail, password, unlockToken }) {
  if (!note?.is_locked) return true;
  if (verifyNoteUnlockToken(unlockToken, { noteId: note.id, userEmail })) return true;
  return verifyNotePassword(password, note.password_hash);
}
