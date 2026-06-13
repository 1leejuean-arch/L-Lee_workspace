const titlePatterns = ["발표 준비", "팀 미팅", "회의", "미팅", "공부"];
const weekdayMap = {
  일요일: 0,
  월요일: 1,
  화요일: 2,
  수요일: 3,
  목요일: 4,
  금요일: 5,
  토요일: 6,
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatTime(hour, minute = 0) {
  return `${pad(hour)}:${pad(minute)}`;
}

function addHours(time, hoursToAdd) {
  const [hour, minute] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hour + hoursToAdd, minute, 0, 0);
  return formatTime(date.getHours(), date.getMinutes());
}

function isValidTime(time) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time || "");
}

export function resolveDateText(dateText, now = new Date()) {
  if (!dateText) return null;

  const input = dateText.trim();
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);

  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const parsed = new Date(`${input}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (input.includes("오늘")) return date;

  if (input.includes("내일")) {
    date.setDate(date.getDate() + 1);
    return date;
  }

  const weekdayEntry = Object.entries(weekdayMap).find(([label]) => input.includes(label));
  if (!weekdayEntry) return null;

  const [, targetDay] = weekdayEntry;
  const currentDay = date.getDay();
  let daysUntilTarget = (targetDay - currentDay + 7) % 7 || 7;

  if (input.includes("다음 주") || input.includes("다음주")) {
    daysUntilTarget += 7;
  }

  date.setDate(date.getDate() + daysUntilTarget);
  return date;
}

function resolveTime(input) {
  const match = input.match(/(오전|오후)\s*(\d{1,2})시(?:\s*(\d{1,2})분)?/);
  if (!match) return null;

  const meridiem = match[1];
  let hour = Number(match[2]);
  const minute = Number(match[3] || 0);

  if (meridiem === "오후" && hour < 12) hour += 12;
  if (meridiem === "오전" && hour === 12) hour = 0;

  if (hour > 23 || minute > 59) return null;
  return formatTime(hour, minute);
}

function resolveDateLabel(input) {
  if (input.includes("오늘")) return "오늘";
  if (input.includes("내일")) return "내일";

  const weekdayLabel = Object.keys(weekdayMap).find((label) => input.includes(label));
  if (!weekdayLabel) return null;

  return input.includes("다음 주") || input.includes("다음주") ? `다음 주 ${weekdayLabel}` : weekdayLabel;
}

function resolveTitle(input) {
  const knownTitle = titlePatterns.find((title) => input.includes(title));
  if (knownTitle) return knownTitle;

  const fallbackMatch = input.match(/(?:시에|분에)\s*(.+?)(?:\s*(?:일정|예약|추가|잡아|만들어|등록))/);
  return fallbackMatch?.[1]?.trim() || null;
}

function getDisplayDateLabel(dateText, parsedDate) {
  if (dateText) return dateText;

  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(parsedDate);
}

function getDisplayTimeLabel(input, startTime) {
  const match = input.match(/(오전|오후)\s*\d{1,2}시(?:\s*\d{1,2}분)?/);
  return match?.[0] || startTime;
}

export function normalizeCalendarParseResult(result, originalText, now = new Date()) {
  if (!result || result.intent !== "create_calendar_event") {
    return {
      intent: "unknown",
      message: result?.message || "아직은 일정 추가 요청을 중심으로 도와드릴 수 있어요.",
    };
  }

  const date = resolveDateText(result.dateText, now);
  const startTime = result.startTime;
  const endTime = result.endTime || (isValidTime(startTime) ? addHours(startTime, 1) : null);
  const title = result.title?.trim();

  if (!title || !date || !isValidTime(startTime) || !isValidTime(endTime)) {
    return {
      intent: "unknown",
      message: "날짜나 시간이 애매해서 바로 추가하기 어려워요. 예: 내일 오후 6시에 회의 예약해줘",
    };
  }

  return {
    intent: "create_calendar_event",
    title,
    date: formatDate(date),
    dateText: result.dateText || getDisplayDateLabel(null, date),
    startTime,
    endTime,
    description: result.description || `AI 비서가 문장에서 추출한 일정입니다.\n원문: ${originalText}`,
    confidence: typeof result.confidence === "number" ? result.confidence : 0.7,
    displayDate: getDisplayDateLabel(result.dateText, date),
    displayTime: startTime,
    durationText: "1시간",
    originalText,
  };
}

export function parseCalendarRequest(input, now = new Date()) {
  const trimmedInput = input.trim();
  const hasCalendarIntent = /(예약|추가|잡아|만들어|등록)/.test(trimmedInput);
  if (!trimmedInput || !hasCalendarIntent) {
    return {
      intent: "unknown",
      message: "아직은 일정 추가 요청을 중심으로 도와드릴 수 있어요.",
    };
  }

  const dateText = resolveDateLabel(trimmedInput);
  const startTime = resolveTime(trimmedInput);
  const title = resolveTitle(trimmedInput);

  if (!dateText || !startTime || !title) {
    return {
      intent: "unknown",
      message: "아직은 일정 추가 요청만 이해할 수 있어요. 예: 내일 오후 6시에 회의 예약해줘",
    };
  }

  return normalizeCalendarParseResult(
    {
      intent: "create_calendar_event",
      title,
      dateText,
      startTime,
      endTime: addHours(startTime, 1),
      description: "",
      confidence: 0.72,
    },
    trimmedInput,
    now,
  );
}
