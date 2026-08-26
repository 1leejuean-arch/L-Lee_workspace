import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getSupabaseServerClient } from "../../../../lib/supabaseServer";
import { MEETING_COLUMNS, MEETINGS_TABLE_MISSING_MESSAGE, isMeetingTableMissingError, mapMeetingRow } from "../../../../lib/meetings";
import { analyzeMeetingLocally, normalizeAnalysisResult } from "../../../../lib/meetingAnalysis";

export const dynamic = "force-dynamic";

function stripJsonFence(text) {
  return String(text || "").replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}

async function enhanceWithGemini(meeting, localResult) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return localResult;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const prompt = `당신은 회의록 정리 도우미입니다. 반드시 JSON 객체 하나만 반환하세요.
형식: {"summary":"핵심 요약","decisions":["결정 사항"],"actionItems":[{"title":"후속 작업","priority":"high|normal|low"}]}
규칙:
- 제공된 회의록에 없는 사실을 만들지 마세요.
- summary는 한국어 2~3문장 이내로 작성하세요.
- 결정 사항과 할 일은 짧고 실행 가능한 문장으로 정리하세요.
- 로컬 기준 결과의 명확한 결정과 후속 작업은 누락하지 마세요.

회의 제목: ${meeting.title}
회의 내용: ${meeting.content}
결정 사항: ${meeting.decisions}
후속 작업: ${meeting.actionItems}
로컬 기준 결과: ${JSON.stringify(localResult)}`;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 900, responseMimeType: "application/json" },
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error(`GEMINI_HTTP_${response.status}`);
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n");
  if (!text) throw new Error("GEMINI_EMPTY_RESPONSE");
  return normalizeAnalysisResult(JSON.parse(stripJsonFence(text)), localResult);
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    if (!userEmail) return Response.json({ error: "UNAUTHORIZED", message: "Google 로그인이 필요합니다." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const meetingId = String(body.meetingId || "").trim();
    if (!meetingId) return Response.json({ error: "MEETING_ID_REQUIRED", message: "meetingId가 필요합니다." }, { status: 400 });
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(meetingId)) {
      return Response.json({ error: "MEETING_ID_INVALID", message: "meetingId 형식이 올바르지 않습니다." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("meeting_minutes")
      .select(MEETING_COLUMNS)
      .eq("id", meetingId)
      .eq("user_email", userEmail)
      .maybeSingle();
    if (error) throw error;
    if (!data) return Response.json({ error: "MEETING_NOT_FOUND", message: "회의록을 찾을 수 없습니다." }, { status: 404 });

    const meeting = mapMeetingRow(data);
    const localResult = analyzeMeetingLocally(meeting);
    if (!process.env.GEMINI_API_KEY) return Response.json(localResult);

    try {
      return Response.json(await enhanceWithGemini(meeting, localResult));
    } catch (error) {
      console.warn("Meeting Gemini enhancement failed; using local analysis", { message: error?.message });
      return Response.json(localResult);
    }
  } catch (error) {
    if (isMeetingTableMissingError(error)) {
      return Response.json({ error: "MEETINGS_TABLE_MISSING", message: MEETINGS_TABLE_MISSING_MESSAGE }, { status: 409 });
    }
    console.error("Meeting analysis failed", { code: error?.code, message: error?.message });
    return Response.json({ error: "MEETING_ANALYSIS_FAILED", message: "회의록을 분석하지 못했습니다." }, { status: 500 });
  }
}
