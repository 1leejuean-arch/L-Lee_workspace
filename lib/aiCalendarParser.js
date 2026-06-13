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

function resolveDate(input, now = new Date()) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);

  if (input.includes("오늘")) return date;

  if (input.includes("내일")) {
    date.setDate(date.getDate() + 1);
    return date;
  }

  const weekdayEntry = Object.entries(weekdayMap).find(([label]) => input.includes(label));
  if (!weekdayEntry) return null;

  const [, targetDay] = weekdayEntry;
  const currentDay = date.getDay();
  const daysUntilTarget = (targetDay - currentDay + 7) % 7 || 7;
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

function resolveTitle(input) {
  const knownTitle = titlePatterns.find((title) => input.includes(title));
  if (knownTitle) return knownTitle;

  const fallbackMatch = input.match(/(?:시에|분에)\s*(.+?)(?:\s*(?:일정|예약|추가|잡아|만들어))/);
  return fallbackMatch?.[1]?.trim() || null;
}

function getDisplayDateLabel(input, parsedDate) {
  if (input.includes("오늘")) return "오늘";
  if (input.includes("내일")) return "내일";

  const weekdayLabel = Object.keys(weekdayMap).find((label) => input.includes(label));
  if (weekdayLabel) return weekdayLabel;

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

export function parseCalendarRequest(input, now = new Date()) {
  const trimmedInput = input.trim();
  const hasCalendarIntent = /(예약|추가|잡아|만들어|등록)/.test(trimmedInput);
  if (!trimmedInput || !hasCalendarIntent) return null;

  const date = resolveDate(trimmedInput, now);
  const startTime = resolveTime(trimmedInput);
  const title = resolveTitle(trimmedInput);

  if (!date || !startTime || !title) return null;

  const endTime = addHours(startTime, 1);

  return {
    title,
    date: formatDate(date),
    startTime,
    endTime,
    description: `AI 비서가 문장에서 추출한 일정입니다.\n원문: ${trimmedInput}`,
    displayDate: getDisplayDateLabel(trimmedInput, date),
    displayTime: getDisplayTimeLabel(trimmedInput, startTime),
    durationText: "1시간",
    originalText: trimmedInput,
  };
}
