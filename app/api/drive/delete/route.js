import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { fetchGoogleApi } from "../../../../lib/googleApiServer";

const DRIVE_PERMISSION_MESSAGE = "Google Drive 권한이 부족합니다. 설정에서 Google 계정을 다시 연결해주세요.";

async function readGoogleError(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const data = await response.json();
      return {
        message: data.error?.message || data.error || data.message || "Google Drive API error",
        reason: data.error?.errors?.[0]?.reason || data.error?.status || "",
      };
    } catch {
      return { message: "Google Drive API error", reason: "" };
    }
  }

  return {
    message: (await response.text().catch(() => "")) || "Google Drive API error",
    reason: "",
  };
}

function getDriveDeleteMessage(status, googleError) {
  if (status === 401 || status === 403) return DRIVE_PERMISSION_MESSAGE;
  if (status === 404) return "삭제할 파일을 찾지 못했습니다.";
  return googleError?.message || "파일을 삭제하지 못했습니다.";
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    if (!session?.accessToken && session.authError) {
      return Response.json({ error: DRIVE_PERMISSION_MESSAGE }, { status: 401 });
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "요청 본문을 읽지 못했습니다." }, { status: 400 });
    }

    const fileId = typeof body.fileId === "string" ? body.fileId.trim() : "";

    if (!fileId) {
      return Response.json({ error: "삭제할 파일 ID가 필요합니다." }, { status: 400 });
    }

    const params = new URLSearchParams({ supportsAllDrives: "true" });
    const googleResult = await fetchGoogleApi(request, session, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${params}`, {
      method: "DELETE",
      cache: "no-store",
    });
    if (googleResult.error) {
      const status = googleResult.status || 401;
      return Response.json(
        { error: status === 401 || status === 403 ? DRIVE_PERMISSION_MESSAGE : googleResult.message || "Google Drive 파일을 삭제하지 못했습니다." },
        { status },
      );
    }

    const response = googleResult.response;

    if (!response.ok) {
      const googleError = await readGoogleError(response);
      return Response.json(
        {
          error: getDriveDeleteMessage(response.status, googleError),
          details: googleError.message,
          reason: googleError.reason,
        },
        { status: response.status },
      );
    }

    return Response.json({ ok: true, deletedFileId: fileId });
  } catch (error) {
    console.error("Drive delete failed:", error);
    return Response.json({ error: "파일을 삭제하지 못했습니다." }, { status: 500 });
  }
}

export async function DELETE(request) {
  return POST(request);
}
