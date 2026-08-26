import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { parseAssistantAction } from "../../../../../lib/assistantActions";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const message = String(body.message || "").trim().slice(0, 2000);
    if (!message) return Response.json({ error: "MESSAGE_REQUIRED", message: "요청 내용을 입력해주세요." }, { status: 400 });

    const result = parseAssistantAction(message);
    if (!result.matched) return Response.json({ matched: false, requiresConfirmation: false });
    if (result.requiresConfirmation) {
      const session = await getServerSession(authOptions);
      if (!session?.user?.email) {
        return Response.json({ error: "UNAUTHORIZED", message: "Google 로그인이 필요합니다." }, { status: 401 });
      }
    }
    return Response.json(result);
  } catch (error) {
    console.error("Assistant action parse failed", { message: error?.message });
    return Response.json({ error: "ACTION_PARSE_FAILED", message: "추가할 내용을 이해하지 못했습니다. 표현을 조금 더 구체적으로 입력해주세요." }, { status: 500 });
  }
}
