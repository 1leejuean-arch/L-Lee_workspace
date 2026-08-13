import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { fetchGoogleApi } from "../../../../lib/googleApiServer";

const GOOGLE_RECONNECT_MESSAGE = "Google 권한을 다시 연결해주세요.";
const DRIVE_SCOPE_MESSAGE = "Google Drive 삭제 권한이 부족합니다. Google 계정을 다시 연결해주세요.";
const FILE_PERMISSION_MESSAGE = "이 파일은 삭제 권한이 없습니다. 공유받은 파일이거나 소유자가 다른 파일일 수 있습니다.";
const FILE_NOT_FOUND_MESSAGE = "파일을 찾을 수 없습니다. 이미 삭제되었거나 접근 권한이 없을 수 있습니다.";
const DELETE_FAILED_MESSAGE = "파일 삭제를 처리하지 못했습니다. 잠시 후 다시 시도해주세요.";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const DRIVE_SCOPE_REASONS = new Set([
  "insufficientPermissions",
  "insufficientAuthenticationScopes",
  "ACCESS_TOKEN_SCOPE_INSUFFICIENT",
]);

async function readGoogleError(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const data = await response.json();
      const detailReason = Array.isArray(data.error?.details)
        ? data.error.details.find((detail) => typeof detail?.reason === "string")?.reason
        : "";
      return {
        code: data.error?.code || response.status,
        message:
          (typeof data.error?.message === "string" && data.error.message) ||
          (typeof data.message === "string" && data.message) ||
          "Google Drive API error",
        reason: data.error?.errors?.[0]?.reason || detailReason || "",
      };
    } catch {
      return { code: response.status, message: "Google Drive API error", reason: "" };
    }
  }

  return {
    code: response.status,
    message: (await response.text().catch(() => "")) || "Google Drive API error",
    reason: "",
  };
}

function getDriveDeleteMessage(status, googleError) {
  if (status === 401) return GOOGLE_RECONNECT_MESSAGE;
  if (googleError?.reason === "fileNotFound" || status === 404) return FILE_NOT_FOUND_MESSAGE;
  if (DRIVE_SCOPE_REASONS.has(googleError?.reason)) return DRIVE_SCOPE_MESSAGE;
  if (googleError?.reason === "insufficientFilePermissions" || status === 403) return FILE_PERMISSION_MESSAGE;
  return DELETE_FAILED_MESSAGE;
}

function logGoogleDriveError(response, googleError) {
  console.error("Drive delete failed", {
    status: response.status,
    code: googleError.code,
    message: googleError.message,
    reason: googleError.reason,
  });
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return Response.json({ error: GOOGLE_RECONNECT_MESSAGE }, { status: 401 });
    }

    if (!session?.accessToken) {
      return Response.json({ error: GOOGLE_RECONNECT_MESSAGE }, { status: 401 });
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "요청 본문을 읽지 못했습니다." }, { status: 400 });
    }

    const fileId = typeof body.fileId === "string" ? body.fileId.trim() : "";
    const fileName = typeof body.name === "string" ? body.name.trim() : "";

    if (!fileId) {
      return Response.json({ error: "INVALID_FILE_ID", message: "삭제할 파일 정보를 찾지 못했습니다." }, { status: 400 });
    }

    const grantedScopes = new Set(String(session.scope || "").split(/\s+/).filter(Boolean));
    if (grantedScopes.size > 0 && !grantedScopes.has(DRIVE_SCOPE)) {
      console.error("Drive delete failed", {
        status: 403,
        code: 403,
        message: "The current OAuth grant does not include the full Google Drive scope.",
        reason: "insufficientAuthenticationScopes",
      });
      return Response.json(
        { error: DRIVE_SCOPE_MESSAGE, reason: "insufficientAuthenticationScopes" },
        { status: 403 },
      );
    }

    console.info("[drive-trash] authorization", {
      scope: session.scope || "not-available-in-session",
      hasRefreshToken: Boolean(session.hasRefreshToken),
    });

    const metadataParams = new URLSearchParams({
      supportsAllDrives: "true",
      fields: "id,name,ownedByMe,capabilities(canDelete,canTrash)",
    });
    const metadataResult = await fetchGoogleApi(
      request,
      session,
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${metadataParams}`,
      { cache: "no-store" },
    );

    if (metadataResult.error) {
      const status = metadataResult.status || 401;
      return Response.json(
        { error: status === 401 ? "GOOGLE_RECONNECT_REQUIRED" : "DRIVE_PERMISSION_CHECK_FAILED", message: status === 401 ? GOOGLE_RECONNECT_MESSAGE : DELETE_FAILED_MESSAGE },
        { status },
      );
    }

    if (!metadataResult.response.ok) {
      const googleError = await readGoogleError(metadataResult.response);
      logGoogleDriveError(metadataResult.response, googleError);
      return Response.json(
        { error: googleError.reason || "DRIVE_PERMISSION_CHECK_FAILED", message: getDriveDeleteMessage(metadataResult.response.status, googleError) },
        { status: metadataResult.response.status },
      );
    }

    const fileMetadata = await metadataResult.response.json();
    const canTrash = fileMetadata.capabilities?.canTrash === true;
    const canDelete = fileMetadata.capabilities?.canDelete === true;
    if (!canTrash && !canDelete) {
      return Response.json(
        { error: "INSUFFICIENT_FILE_PERMISSION", message: "이 파일을 삭제할 권한이 없습니다." },
        { status: 403 },
      );
    }

    const params = new URLSearchParams({ supportsAllDrives: "true", fields: "id,trashed" });
    const googleResult = await fetchGoogleApi(request, session, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${params}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ trashed: true }),
      cache: "no-store",
    });
    if (googleResult.error) {
      const status = googleResult.status || 401;
      return Response.json({ error: status === 401 ? GOOGLE_RECONNECT_MESSAGE : DELETE_FAILED_MESSAGE }, { status });
    }

    const response = googleResult.response;

    if (!response.ok) {
      const googleError = await readGoogleError(response);
      logGoogleDriveError(response, googleError);
      return Response.json(
        {
          error: googleError.reason || "DRIVE_DELETE_FAILED",
          message: getDriveDeleteMessage(response.status, googleError),
          reason: googleError.reason,
        },
        { status: response.status },
      );
    }

    const updatedFile = await response.json().catch(() => ({}));
    if (updatedFile.trashed !== true) {
      console.error("[drive-trash] Google API returned an unexpected response", {
        status: response.status,
        code: "UNEXPECTED_RESPONSE",
        message: "The updated file was not marked as trashed.",
        reason: "trashedFieldNotTrue",
      });
      return Response.json({ error: DELETE_FAILED_MESSAGE }, { status: 500 });
    }

    return Response.json({ ok: true, deletedFileId: fileId, name: fileName, trashed: true });
  } catch (error) {
    console.error("Drive delete failed", {
      status: 500,
      code: "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : "Unknown internal error",
      reason: "internalError",
    });
    return Response.json({ error: DELETE_FAILED_MESSAGE }, { status: 500 });
  }
}

export async function DELETE(request) {
  return POST(request);
}
