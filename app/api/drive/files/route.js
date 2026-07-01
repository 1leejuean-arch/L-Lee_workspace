import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";

function getFileExtension(name = "") {
  const match = name.toLowerCase().match(/\.([^.]+)$/);
  return match ? match[1] : "";
}

function getFileCategory(file = {}) {
  const mimeType = (file.mimeType || "").toLowerCase();
  const extension = getFileExtension(file.name || "");

  if (mimeType === "application/vnd.google-apps.folder") return "folder";
  if (mimeType === "application/vnd.google-apps.document") return "document";
  if (mimeType === "application/vnd.google-apps.spreadsheet") return "spreadsheet";
  if (mimeType === "application/vnd.google-apps.presentation") return "presentation";

  if (extension === "txt") return "document";
  if (extension === "xlsx") return "spreadsheet";
  if (extension === "pptx") return "presentation";
  if (["png", "jpg", "jpeg"].includes(extension)) return "image";
  if (extension === "pdf") return "pdf";
  if (extension === "mp4") return "video";
  if (["hwp", "hwpx"].includes(extension)) return "hwp";

  return "other";
}

function getLegacyFileType(fileCategory) {
  if (fileCategory === "spreadsheet") return "sheet";
  if (fileCategory === "document") return "doc";
  if (fileCategory === "folder" || fileCategory === "pdf") return fileCategory;
  return "file";
}

function formatFileSize(value, mimeType = "") {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return mimeType.startsWith("application/vnd.google-apps") ? "Google 파일" : "크기 없음";
  }

  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.ceil(bytes / 1024)} KB`;
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

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Google 계정 연결이 필요합니다." }, { status: 401 });
    }

    const maxFiles = 1000;
    const maxPages = 10;
    const fetchedFiles = [];
    let nextPageToken = "";
    let pagesFetched = 0;

    for (let page = 0; page < maxPages && fetchedFiles.length < maxFiles; page += 1) {
      const params = new URLSearchParams({
        pageSize: String(Math.min(1000, maxFiles - fetchedFiles.length)),
        orderBy: "modifiedTime desc",
        fields: "nextPageToken,files(id,name,mimeType,modifiedTime,createdTime,size,webViewLink,iconLink,owners,parents)",
        q: "trashed = false",
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
      });
      if (nextPageToken) params.set("pageToken", nextPageToken);

      const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const details = await readGoogleError(response);
        return NextResponse.json(
          { error: "Google Drive 파일을 가져오지 못했습니다.", details },
          { status: response.status },
        );
      }

      const data = await response.json();
      pagesFetched += 1;
      fetchedFiles.push(...(data.files || []));
      nextPageToken = data.nextPageToken || "";
      if (!nextPageToken) break;
    }

    const files = fetchedFiles.slice(0, maxFiles).map((file) => {
      const fileCategory = getFileCategory(file);

      return {
        id: file.id,
        name: file.name,
        type: getLegacyFileType(fileCategory),
        fileCategory,
        mimeType: file.mimeType,
        updated: formatModifiedTime(file.modifiedTime),
        modifiedTime: file.modifiedTime,
        createdTime: file.createdTime,
        link: file.webViewLink,
        iconLink: file.iconLink,
        parents: file.parents || [],
        owner: file.owners?.[0]?.displayName || file.owners?.[0]?.emailAddress || "Google Drive",
        size: formatFileSize(file.size, file.mimeType),
        sizeBytes: Number(file.size) || 0,
      };
    });

    const categoryCounts = files.reduce((counts, file) => {
      counts[file.fileCategory] = (counts[file.fileCategory] || 0) + 1;
      return counts;
    }, {});

    if (process.env.NODE_ENV === "development") {
      console.debug("[drive-files] loaded", {
        totalFiles: files.length,
        pagesFetched,
        categoryCounts,
      });
    }

    return NextResponse.json({
      files,
      nextPageToken: nextPageToken || null,
      resultLimit: maxFiles,
      source: "google-drive",
    });
  } catch (error) {
    console.error("Drive files failed:", error);
    return NextResponse.json({ error: "Google Drive 파일을 가져오지 못했습니다." }, { status: 500 });
  }
}
