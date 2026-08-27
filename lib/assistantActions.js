const KOREA_TIME_ZONE = "Asia/Seoul";
const DEFAULT_CALENDAR_START = "15:00";

const ACTION_TYPE_LABELS = {
  create_task: "할 일 추가",
  create_calendar_event: "캘린더 일정 추가",
  create_note: "메모 추가",
  create_asset_transaction: "자산 거래 추가",
  create_meeting: "회의록 추가",
};

const TYPO_REPLACEMENTS = [
  [/회으록|회의록록|회록/g, "회의록"],
  [/회의\s*기록/g, "회의기록"],
  [/할\s*일/g, "할일"],
  [/스케줄|캘린더/g, "일정"],
  [/쓴\s*돈|쓴\s*거/g, "지출"],
  [/들어온\s*돈|번\s*돈/g, "수입"],
  [/추가\s*ㄱㄱ/g, "추가해줘"],
];

export function normalizeActionMessage(message) {
  let text = String(message || "").normalize("NFKC").toLocaleLowerCase().trim();
  text = text.replace(/[^0-9a-z가-힣\s,:/.~-]/g, " ").replace(/\s+/g, " ");
  for (const [pattern, replacement] of TYPO_REPLACEMENTS) text = text.replace(pattern, replacement);
  return { text: text.trim(), compact: text.replace(/\s+/g, "") };
}

export function parseAssistantAction(message, { now = new Date() } = {}) {
  const normalized = normalizeActionMessage(message);
  const text = normalized.text;
  const compact = normalized.compact;
  if (!text) return { matched: false };

  const hasDomain = /(할일|일정|메모|회의록|회의기록|자산|거래|지출|수입)/.test(compact);
  if (hasDomain && /(삭제|지워|제거|수정|변경|바꿔)/.test(compact)) {
    return {
      matched: true,
      requiresConfirmation: false,
      blocked: true,
      message: "현재 L-Lee AI는 추가 기능만 지원합니다. 수정/삭제는 각 메뉴에서 직접 진행해주세요.",
    };
  }

  if (/(잠금|비밀번호)/.test(compact) && /(메모|노트)/.test(compact)) {
    return {
      matched: true,
      requiresConfirmation: false,
      blocked: true,
      message: "잠금 메모 생성은 메모 화면에서 직접 설정해주세요.",
    };
  }

  const date = parseNaturalDate(text, now);
  const time = parseNaturalTime(text);
  const hasCreateVerb = /(추가|추가해줘|추가해주세요|넣어줘|넣어주세요|넣어|등록|등록해줘|등록해주세요|만들어줘|만들어주세요|만들어|생성|기록해줘|기록해주세요|기록해|저장해줘|저장해주세요|적어|메모해줘|메모해주세요|메모해)/.test(compact);
  const hasTaskKeyword = /(할일|해야할일|작업|체크리스트)/.test(compact);
  const moneyAmount = extractMoneyAmount(text);
  let intent = null;

  if (/(회의록|회의기록)/.test(compact) && hasCreateVerb) intent = "create_meeting";
  else if (/(메모|노트)/.test(compact) && hasCreateVerb) intent = "create_note";
  else if (moneyAmount && /(지출|수입|썼어|썼다|결제|알바|급여|벌었|받았)/.test(compact)) intent = "create_asset_transaction";
  else if (hasTaskKeyword && hasCreateVerb) intent = "create_task";
  else if (/(일정)/.test(compact) && hasCreateVerb) intent = "create_calendar_event";
  else if (hasCreateVerb && date && (time || /(시간은너가원하는대로|시간없음)/.test(compact))) intent = "create_calendar_event";

  if (!intent) return { matched: false };

  if (intent === "create_task") return buildTaskAction(text, date, time);
  if (intent === "create_calendar_event") return buildCalendarAction(text, date, time, compact, now);
  if (intent === "create_note") return buildNoteAction(text);
  if (intent === "create_asset_transaction") return buildAssetAction(text, date, moneyAmount, now);
  return buildMeetingAction(text, date, now);
}

function buildTaskAction(text, date, time) {
  const title = cleanActionTitle(text, "task") || "새 할 일";
  const deadline = [date ? `기한: ${date}` : "", time ? `시간: ${time}` : ""].filter(Boolean).join("\n");
  const preview = {
    typeLabel: ACTION_TYPE_LABELS.create_task,
    title,
    date: date || null,
    time: time || null,
    priority: "보통",
    description: deadline,
  };
  return confirmation("create_task", preview, {
    title,
    description: deadline,
    priority: "보통",
    completed: false,
    steps: [],
  }, "아래 내용으로 할 일을 추가할까요?");
}

function buildCalendarAction(text, date, time, compact, now) {
  const targetDate = date || getKoreaDateKey(now);
  const usedDefaultTime = !time || /(시간은너가원하는대로|시간없음)/.test(compact);
  const startTime = usedDefaultTime ? DEFAULT_CALENDAR_START : time;
  const endTime = addMinutesToTime(startTime, 60);
  const title = cleanActionTitle(text, "calendar") || "새 일정";
  const defaultNotice = usedDefaultTime ? "시간이 없어 기본값 오후 3시~4시로 설정했어요." : "";
  const preview = {
    typeLabel: ACTION_TYPE_LABELS.create_calendar_event,
    title,
    date: targetDate,
    startTime,
    endTime,
    notice: defaultNotice,
  };
  return confirmation("create_calendar_event", preview, {
    title,
    date: targetDate,
    startTime,
    endTime,
    description: defaultNotice,
  }, `아래 내용으로 일정을 추가할까요?${defaultNotice ? ` ${defaultNotice}` : ""}`);
}

function buildNoteAction(text) {
  const explicitTitle = extractLabeledValue(text, "제목", ["내용", "태그"]);
  const titlePrefix = text.match(/^(.{1,40}?)\s*메모/)?.[1]?.trim() || "";
  const inferredTitle = titlePrefix && !/회의|오늘|내일|모레/.test(titlePrefix) ? cleanActionTitle(titlePrefix, "noteTitle") : "";
  const title = explicitTitle || inferredTitle || "AI 메모";
  const content = extractLabeledValue(text, "내용", ["태그"]) || cleanActionTitle(text, "noteContent") || "작성된 내용이 없습니다.";
  const tag = extractLabeledValue(text, "태그", []) || "AI";
  const preview = { typeLabel: ACTION_TYPE_LABELS.create_note, title, content, tag };
  return confirmation("create_note", preview, { title, content, tag }, "아래 내용으로 메모를 추가할까요?");
}

function buildAssetAction(text, date, directAmount, now) {
  const compact = text.replace(/\s+/g, "");
  const hoursMatch = text.match(/(\d+(?:\.\d+)?)\s*시간/);
  const wageMatch = text.match(/시급\s*([\d,]+)\s*원?/);
  const hours = hoursMatch ? Number(hoursMatch[1]) : null;
  const hourlyWage = wageMatch ? Number(wageMatch[1].replace(/,/g, "")) : null;
  const calculatedAmount = hours && hourlyWage ? Math.round(hours * hourlyWage) : null;
  const amount = calculatedAmount || directAmount;
  const type = /(수입|알바|급여|벌었|받았)/.test(compact) ? "income" : "expense";
  const category = inferAssetCategory(compact, type);
  const title = type === "income" && /(알바|시급)/.test(compact) ? "알바비" : category;
  const transactionDate = date || getKoreaDateKey(now);
  const memo = calculatedAmount ? `AI 계산: ${hours}시간 × 시급 ${hourlyWage.toLocaleString("ko-KR")}원` : "";
  const preview = {
    typeLabel: ACTION_TYPE_LABELS.create_asset_transaction,
    transactionType: type === "income" ? "수입" : "지출",
    title,
    amount,
    category,
    date: transactionDate,
    calculation: memo,
  };
  return confirmation("create_asset_transaction", preview, {
    type,
    title,
    amount,
    category,
    transactionDate,
    memo,
    paymentMethod: "",
    status: "paid",
  }, "아래 내용으로 자산 거래를 추가할까요?");
}

function buildMeetingAction(text, date, now) {
  const title = extractLabeledValue(text, "제목", ["참석자", "내용", "결정사항", "결정", "할일", "후속작업", "태그"]) || "회의 기록";
  const attendeesRaw = extractLabeledValue(text, "참석자", ["내용", "결정사항", "결정", "할일", "후속작업", "태그"]);
  const attendees = attendeesRaw ? attendeesRaw.split(/[\s,]+/).filter(Boolean).join(", ") : "";
  const content = extractLabeledValue(text, "내용", ["결정사항", "결정", "할일", "후속작업", "태그"]);
  const decisions = extractLabeledValue(text, "결정사항", ["할일", "후속작업", "태그"]) || extractLabeledValue(text, "결정", ["할일", "후속작업", "태그"]);
  const actionItems = extractLabeledValue(text, "할일", ["태그"]) || extractLabeledValue(text, "후속작업", ["태그"]);
  const tag = extractLabeledValue(text, "태그", []) || "AI";
  const meetingDate = date || getKoreaDateKey(now);
  const preview = {
    typeLabel: ACTION_TYPE_LABELS.create_meeting,
    title,
    date: meetingDate,
    attendees,
    content,
    decisions,
    actionItems,
    tag,
  };
  return confirmation("create_meeting", preview, {
    title,
    meetingDate,
    startTime: "",
    endTime: "",
    attendees,
    location: "",
    content,
    decisions,
    actionItems,
    tag,
  }, "아래 내용으로 회의록을 추가할까요?");
}

function confirmation(intent, preview, confirmPayload, message) {
  return { matched: true, requiresConfirmation: true, intent, preview, confirmPayload, message };
}

export function parseNaturalDate(message, now = new Date()) {
  const today = getKoreaDateKey(now);
  if (/모레/.test(message)) return addDays(today, 2);
  if (/내일/.test(message)) return addDays(today, 1);
  if (/오늘/.test(message)) return today;

  const full = message.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (full) return validDateKey(Number(full[1]), Number(full[2]), Number(full[3]));
  const monthDay = message.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (monthDay) return validDateKey(Number(today.slice(0, 4)), Number(monthDay[1]), Number(monthDay[2]));
  const slash = message.match(/(?<!\d)(\d{1,2})\s*\/\s*(\d{1,2})(?!\d)/);
  if (slash) return validDateKey(Number(today.slice(0, 4)), Number(slash[1]), Number(slash[2]));

  const weekdayMatch = message.match(/(다음\s*주|이번\s*주)\s*(월|화|수|목|금|토|일)요일/);
  if (weekdayMatch) {
    const target = ["일", "월", "화", "수", "목", "금", "토"].indexOf(weekdayMatch[2]);
    const currentDate = dateKeyToUtc(today);
    const current = currentDate.getUTCDay();
    const weekOffset = weekdayMatch[1].replace(/\s/g, "") === "다음주" ? 7 : 0;
    const mondayOffset = current === 0 ? -6 : 1 - current;
    return addDays(today, mondayOffset + weekOffset + (target === 0 ? 6 : target - 1));
  }
  if (/다음\s*주/.test(message)) {
    const current = dateKeyToUtc(today).getUTCDay();
    return addDays(today, (current === 0 ? 1 : 8 - current));
  }
  if (/이번\s*주/.test(message)) return today;
  return null;
}

export function parseNaturalTime(message) {
  const meridiem = message.match(/(오전|오후)\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/);
  if (meridiem) {
    let hour = Number(meridiem[2]);
    const minute = Number(meridiem[3] || 0);
    if (hour > 12 || minute > 59) return null;
    if (meridiem[1] === "오후" && hour < 12) hour += 12;
    if (meridiem[1] === "오전" && hour === 12) hour = 0;
    return formatTime(hour, minute);
  }
  const colon = message.match(/(?<!\d)([01]?\d|2[0-3]):([0-5]\d)(?!\d)/);
  if (colon) return formatTime(Number(colon[1]), Number(colon[2]));
  const plain = message.match(/(?<!\d)([01]?\d|2[0-3])\s*시(?:\s*(\d{1,2})\s*분)?(?=\s|$|부터|에)/);
  if (plain && Number(plain[2] || 0) <= 59) return formatTime(Number(plain[1]), Number(plain[2] || 0));
  return null;
}

function cleanActionTitle(message, kind) {
  let value = String(message || "");
  value = value
    .replace(/\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일|\d{1,2}\s*월\s*\d{1,2}\s*일|(?:^|\s)\d{1,2}\s*\/\s*\d{1,2}/g, " ")
    .replace(/오늘|내일|모레|이번\s*주|다음\s*주|월요일|화요일|수요일|목요일|금요일|토요일|일요일/g, " ")
    .replace(/(?:오전|오후)\s*\d{1,2}\s*시(?:\s*\d{1,2}\s*분)?|(?<!\d)(?:[01]?\d|2[0-3]):[0-5]\d|(?<!\d)(?:[01]?\d|2[0-3])\s*시(?:\s*\d{1,2}\s*분)?/g, " ")
    .replace(/시간은\s*너가\s*원하는대로|시간\s*없음|부터\s*해서|부터해서/g, " ")
    .replace(/^\s*에\s*|\s+에\s+/g, " ");
  const patterns = {
    task: /할일|해야할일|작업|체크리스트|추가해줘|추가해주세요|추가|등록해줘|등록|넣어줘|넣어|만들어줘|만들어|기록해줘|기록해|해줘|해주세요/g,
    calendar: /일정|추가해주고|추가해줘|추가해주세요|추가|등록해줘|등록|넣어줘|넣어|해줘|해주세요|원하는대로|ㄱㄱ/g,
    noteTitle: /메모|노트|하나|추가해줘|추가해주세요|추가|만들어줘|만들어|내용(?:은|:)?[\s\S]*/g,
    noteContent: /메모해줘|메모해주세요|메모해|메모(?:에)?|노트(?:에)?|추가해줘|추가해주세요|추가|만들어줘|만들어|적어줘|적어/g,
  };
  value = value.replace(patterns[kind] || /$^/, " ").replace(/\b(제목은?|내용은?)\b/g, " ");
  return value.replace(/\s+/g, " ").replace(/^(?:은|는|이|가|을|를)\s*/, "").trim().slice(0, kind === "noteContent" ? 10000 : 200);
}

function extractLabeledValue(message, label, nextLabels) {
  const next = nextLabels.length ? `(?=\\s*(?:(?:${nextLabels.join("|")})(?:은|는|:)?\\s*|$))` : "$";
  const match = String(message || "").match(new RegExp(`${label}(?:은|는|:)?\\s*([\\s\\S]*?)${next}`, "i"));
  return match ? match[1].replace(/\s+/g, " ").trim() : "";
}

function extractMoneyAmount(message) {
  const amounts = [...String(message || "").matchAll(/([\d,]+)\s*원/g)].map((match) => Number(match[1].replace(/,/g, ""))).filter((value) => Number.isFinite(value) && value > 0);
  return amounts[0] || null;
}

function inferAssetCategory(compact, type) {
  const categories = type === "income"
    ? [["알바", /알바|시급|급여/], ["용돈", /용돈/], ["프로젝트 수익", /프로젝트/], ["중고거래", /중고/]]
    : [["식비", /식비|밥|음식|카페/], ["교통", /교통|버스|택시|지하철/], ["쇼핑", /쇼핑|구매/], ["구독", /구독/], ["개발", /개발/], ["영상\/장비", /장비|영상/], ["학교", /학교|학용품/], ["여가", /여가|게임|영화/]];
  return categories.find(([, pattern]) => pattern.test(compact))?.[0] || (type === "income" ? "기타" : "기타");
}

function getKoreaDateKey(value) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: KOREA_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function validDateKey(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dateKeyToUtc(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(dateKey, amount) {
  const date = dateKeyToUtc(dateKey);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function formatTime(hour, minute) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function addMinutesToTime(time, minutes) {
  const [hour, minute] = time.split(":").map(Number);
  const total = (hour * 60 + minute + minutes) % 1440;
  return formatTime(Math.floor(total / 60), total % 60);
}
