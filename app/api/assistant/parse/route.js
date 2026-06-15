import { NextResponse } from "next/server";
import { normalizeCalendarParseResult, parseCalendarRequest } from "../../../../lib/aiCalendarParser";

function stripJsonFence(text) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function buildPrompt(input, now = new Date()) {
  const today = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    timeZone: "Asia/Seoul",
  }).format(now);

  return `
너는 L-Lee Workspace의 한국어 일정 분석기다.
사용자 입력이 Google Calendar 일정 생성 요청인지 판단하고, 반드시 JSON 객체 하나만 반환한다.
오늘 날짜는 ${today}, 시간대는 Asia/Seoul이다.

지원해야 하는 예:
- 내일 오후 6시에 회의 예약해줘
- 다음 주 월요일 오전 10시에 팀 미팅 잡아줘
- 오늘 오후 3시에 공부 일정 추가해줘
- 금요일 오후 2시에 발표 준비 일정 만들어줘

일정 생성 요청이면 이 형태로만 반환:
{
  "intent": "create_calendar_event",
  "title": "회의",
  "dateText": "내일",
  "startTime": "18:00",
  "endTime": "19:00",
  "description": "",
  "confidence": 0.9
}

규칙:
- dateText는 "오늘", "내일", "금요일", "다음 주 월요일" 또는 YYYY-MM-DD 중 하나로 써라.
- startTime과 endTime은 24시간 HH:mm 형식으로 써라.
- 종료 시간이 명확하지 않으면 시작 시간 + 1시간으로 써라.
- 날짜나 시간이 애매하면 create_calendar_event로 추측하지 말고 unknown으로 반환해라.
- 일정 생성 요청이 아니면 이 형태로 반환:
{
  "intent": "unknown",
  "message": "아직은 일정 추가 요청을 중심으로 도와드릴 수 있어요."
}

사용자 입력:
${input}
`.trim();
}

async function parseWithGemini(input) {
  if (!process.env.GEMINI_API_KEY) return null;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: buildPrompt(input) }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Gemini API request failed");
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini API returned an empty response");

  return JSON.parse(stripJsonFence(text));
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const input = body.input?.trim();

    if (!input) {
      return NextResponse.json(
        {
          intent: "unknown",
          message: "분석할 문장을 입력해주세요.",
          source: "validation",
        },
        { status: 400 },
      );
    }

    try {
      const geminiResult = await parseWithGemini(input);

      if (geminiResult) {
        return NextResponse.json({
          ...normalizeCalendarParseResult(geminiResult, input),
          source: "gemini",
        });
      }
    } catch (error) {
      console.error("Gemini parse failed, falling back to local parser:", error);
    }

    return NextResponse.json({
      ...parseCalendarRequest(input),
      source: "fallback",
    });
  } catch (error) {
    console.error("Assistant parse failed:", error);
    return NextResponse.json(
      {
        intent: "unknown",
        message: "일정 요청을 분석하지 못했습니다. 잠시 후 다시 시도해주세요.",
        source: "error",
      },
      { status: 500 },
    );
  }
}