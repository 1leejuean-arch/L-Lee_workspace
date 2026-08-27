import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { isWorkspaceOwnerEmail } from "./lib/workspaceOwner";

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/auth/")) return NextResponse.next();

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.email) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Google 로그인이 필요합니다." },
      { status: 401 },
    );
  }

  if (!isWorkspaceOwnerEmail(token.email)) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "이 워크스페이스는 소유자 계정만 사용할 수 있습니다." },
      { status: 403 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
