import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";

function getFileType(mimeType = "") {
  if (mimeType === "application/vnd.google-apps.folder") return "folder";
  if (mimeType === "application/vnd.google-apps.spreadsheet") return "sheet";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.includes("document") || mimeType === "application/vnd.google-apps.document") return "doc";
  return "file";
}

function formatModifiedTime(value) {
  if (!value) return "수정일 없음";

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Google 계정 연결이 필요합니다." }, { status: 401 });
  }

  const params = new URLSearchParams({
    pageSize: "10",
    orderBy: "modifiedTime desc",
    fields: "files(id,name,mimeType,modifiedTime,webViewLink,iconLink,size,owners(displayName,emailAddress))",
    q: "trashed=false",
  });

  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();
    return NextResponse.json(
      { error: "Google Drive 파일을 가져오지 못했습니다.", details },
      { status: response.status },
    );
  }

  const data = await response.json();
  const files = (data.files || []).map((file) => ({
    id: file.id,
    name: file.name,
    type: getFileType(file.mimeType),
    mimeType: file.mimeType,
    updated: formatModifiedTime(file.modifiedTime),
    modifiedTime: file.modifiedTime,
    link: file.webViewLink,
    iconLink: file.iconLink,
    owner: file.owners?.[0]?.displayName || file.owners?.[0]?.emailAddress || "Google Drive",
    size: file.size ? `${Math.ceil(Number(file.size) / 1024)} KB` : "Google 파일",
  }));

  return NextResponse.json({
    files,
    source: "google-drive",
  });
}
