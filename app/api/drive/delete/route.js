import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";

async function readGoogleError(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const data = await response.json();
      return data.error?.message || data.error || data.message || "Google Drive API error";
    } catch {
      return "Google Drive API error";
    }
  }

  return (await response.text().catch(() => "")) || "Google Drive API error";
}

function getDriveDeleteMessage(status, details) {
  if (status === 401) return "Google Drive 권한이 필요합니다. 다시 로그인해주세요.";
  if (status === 403) return "삭제 권한이 없는 파일입니다. Google Drive 권한을 확인하거나 다시 로그인해주세요.";
  if (status === 404) return "삭제할 파일을 찾지 못했습니다.";
  return details || "파일을 삭제하지 못했습니다.";
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Google Drive 권한이 필요합니다. 다시 로그인해주세요." }, { status: 401 });
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "요청 본문을 읽지 못했습니다." }, { status: 400 });
    }

    const fileId = typeof body.fileId === "string" ? body.fileId.trim() : "";

    if (!fileId) {
      return NextResponse.json({ error: "삭제할 파일 ID가 필요합니다." }, { status: 400 });
    }

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const details = await readGoogleError(response);
      return NextResponse.json(
        { error: getDriveDeleteMessage(response.status, details), details },
        { status: response.status },
      );
    }

    return NextResponse.json({ success: true, fileId });
  } catch (error) {
    console.error("Drive delete failed:", error);
    return NextResponse.json({ error: "파일을 삭제하지 못했습니다." }, { status: 500 });
  }
}
