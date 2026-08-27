import { parseAssistantAction } from "../../../../../lib/assistantActions";

export const dynamic = "force-dynamic";

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export async function POST(request) {
  try {
    const rawBody = new TextDecoder("utf-8").decode(await request.arrayBuffer());
    const body = JSON.parse(rawBody || "{}");
    const message = String(body.message || "").trim().slice(0, 2000);
    if (!message) return json({ error: "MESSAGE_REQUIRED", message: "요청 내용을 입력해주세요." }, 400);
    const questionMarkCount = (message.match(/\?/g) || []).length;
    const koreanCount = (message.match(/[가-힣]/g) || []).length;
    if (questionMarkCount >= 3 && koreanCount === 0) {
      return json({
        matched: false,
        requiresConfirmation: false,
        message: "지원하지 않는 추가 요청입니다.",
      });
    }

    const result = parseAssistantAction(message);
    if (!result.matched) {
      return json({
        matched: false,
        requiresConfirmation: false,
        message: "지원하지 않는 추가 요청입니다.",
      });
    }
    return json(result);
  } catch (error) {
    console.error("Assistant action parse failed", { message: error?.message });
    return json({ error: "ACTION_PARSE_FAILED", message: "추가할 내용을 이해하지 못했습니다. 표현을 조금 더 구체적으로 입력해주세요." }, 500);
  }
}
