import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

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
  if (status === 401) return "Google Drive 권한이 필요합니다. 다시 로그인해주세요.";
  if (status === 403) {
    if (googleError?.reason === "insufficientPermissions") {
      return "Google Drive 삭제 권한이 부족합니다. 로그아웃 후 다시 로그인해주세요.";
    }
    return "삭제 권한이 없는 파일입니다. Google Drive 권한을 확인하거나 다시 로그인해주세요.";
  }
  if (status === 404) return "삭제할 파일을 찾지 못했습니다.";
  return googleError?.message || "파일을 삭제하지 못했습니다.";
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    if (!session?.accessToken) {
      return Response.json({ error: "Google Drive 권한이 필요합니다. 다시 로그인해주세요." }, { status: 401 });
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
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${params}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
      cache: "no-store",
    });

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
