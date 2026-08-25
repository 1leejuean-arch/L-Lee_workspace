import { calculateAssetSummary, mapAssetTransaction } from "./assets";
import { fetchGoogleApi } from "./googleApiServer";
import { MEETING_COLUMNS, MEETINGS_TABLE_MISSING_MESSAGE, mapMeetingRow } from "./meetings";

const KOREA_TIME_ZONE = "Asia/Seoul";
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TASK_COLUMNS = "id,title,completed,priority,steps,created_at";
const TASK_FALLBACK_COLUMNS = "id,title,completed,steps,created_at";
const TASK_MINIMAL_COLUMNS = "id,title,completed,created_at";

export class AssistantDataError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AssistantDataError";
    this.code = code;
  }
}

function isMissingRelation(error) {
  const details = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return error?.code === "42P01" || details.includes("does not exist") || details.includes("schema cache");
}

function isMissingColumn(error) {
  const details = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return error?.code === "42703" || details.includes("column") || details.includes("schema cache");
}

function normalizePriority(value) {
  if (value === "High") return "높음";
  if (value === "Low") return "낮음";
  return ["높음", "보통", "낮음"].includes(value) ? value : "보통";
}

function normalizeSteps(value) {
  if (typeof value === "string") {
    try { return normalizeSteps(JSON.parse(value)); } catch { return []; }
  }
  if (!Array.isArray(value)) return [];
  return value.map((step) => ({
    title: String(step?.title || "").trim(),
    completed: Boolean(step?.completed),
    priority: normalizePriority(step?.priority),
  })).filter((step) => step.title);
}

export function getQuestionScopes(message) {
  const scopes = [];
  const calendarText = message.replace(/회의록/g, "");
  const asksAssets = /(자산|수입|지출|순이익|거래|알바|급여|월급|카테고리|얼마|썼어|썼니)/.test(message);
  const asksTasks = /(할\s*일|태스크|작업|우선순위|세부\s*단계|완료|남은)/.test(message);
  const asksCalendar = /(일정|캘린더|스케줄|약속|회의|미팅)/.test(calendarText);
  const asksMeetings = /회의록/.test(message);
  const hasDateOnly = /(오늘|내일|이번\s*주|이번\s*달|\d{1,2}월\s*\d{1,2}일|\d{4}-\d{2}-\d{2})/.test(message);
  if (asksAssets) scopes.push("assets");
  if (asksTasks) scopes.push("tasks");
  if (asksCalendar || (hasDateOnly && !asksAssets && !asksTasks && !asksMeetings)) scopes.push("calendar");
  if (asksMeetings) scopes.push("meetings");
  return scopes.length ? scopes : ["assets", "tasks", "calendar", "meetings"];
}

export function isMutationRequest(message) {
  return /(추가|등록|생성|만들어|삭제|지워|제거|수정|변경|바꿔|완료\s*처리|체크해|취소해)(줘|주세요|해줘|해 주세요|할래|해봐)?/i.test(message);
}

export async function loadAssetsSummary(supabase, userEmail, now = new Date()) {
  let settingsResult = await supabase.from("finance_settings").select("initial_balance").eq("user_email", userEmail).maybeSingle();
  let transactionsResult = await supabase
    .from("finance_transactions")
    .select("id,type,title,amount,category,status,transaction_date,work_session_id,created_at")
    .eq("user_email", userEmail)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (isMissingRelation(settingsResult.error) || isMissingRelation(transactionsResult.error)) {
    settingsResult = await supabase.from("asset_settings").select("initial_balance").eq("user_email", userEmail).maybeSingle();
    transactionsResult = await supabase
      .from("asset_transactions")
      .select("id,type,title,amount,category,transaction_date,created_at")
      .eq("user_email", userEmail)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false });
  }
  if (settingsResult.error || transactionsResult.error) {
    throw new AssistantDataError("SUPABASE_ERROR", "워크스페이스 데이터를 불러오지 못했습니다.");
  }

  const transactions = (transactionsResult.data || []).map((row) => mapAssetTransaction({ ...row, status: row.status || "paid" }));
  const summary = calculateAssetSummary(Number(settingsResult.data?.initial_balance) || 0, transactions, getKoreaMonthKey(now));
  const monthlyTransactions = transactions.filter((transaction) =>
    transaction.status !== "expected" && String(transaction.transactionDate || "").startsWith(summary.monthKey));
  const categoryExpenses = Object.entries(monthlyTransactions.filter((transaction) => transaction.type === "expense").reduce((totals, transaction) => {
    totals[transaction.category || "기타"] = (totals[transaction.category || "기타"] || 0) + transaction.amount;
    return totals;
  }, {})).map(([category, amount]) => ({ category, amount })).sort((first, second) => second.amount - first.amount);
  const laborTransactions = transactions.filter((transaction) =>
    transaction.type === "income" && (transaction.workSessionId || /(알바|급여|월급|시급|근무)/i.test(`${transaction.title} ${transaction.category}`)));

  return {
    totalBalance: summary.totalBalance,
    monthlyIncome: summary.monthlyIncome,
    monthlyExpense: summary.monthlyExpense,
    monthlyNet: summary.monthlyNet,
    recentTransactions: transactions.slice(0, 10).map(toSafeTransaction),
    recentExpenses: transactions.filter((transaction) => transaction.type === "expense" && transaction.status !== "expected").slice(0, 10).map(toSafeTransaction),
    recentIncomes: transactions.filter((transaction) => transaction.type === "income" && transaction.status !== "expected").slice(0, 10).map(toSafeTransaction),
    monthlyLaborIncome: laborTransactions.filter((transaction) =>
      String(transaction.transactionDate || "").startsWith(summary.monthKey) && transaction.status !== "expected")
      .reduce((total, transaction) => total + transaction.amount, 0),
    laborTransactions: laborTransactions.slice(0, 20).map(toSafeTransaction),
    categoryExpenses,
  };
}

function toSafeTransaction(transaction) {
  return { type: transaction.type, title: transaction.title, amount: transaction.amount, category: transaction.category, date: transaction.transactionDate, status: transaction.status };
}

function getKoreaMonthKey(date) {
  const parts = getKoreaDateParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
}

export async function loadTasksSummary(supabase, userEmail) {
  let result = await supabase.from("tasks").select(TASK_COLUMNS).eq("user_email", userEmail).order("created_at", { ascending: false });
  if (result.error && isMissingColumn(result.error)) {
    result = await supabase.from("tasks").select(TASK_FALLBACK_COLUMNS).eq("user_email", userEmail).order("created_at", { ascending: false });
  }
  if (result.error && isMissingColumn(result.error)) {
    result = await supabase.from("tasks").select(TASK_MINIMAL_COLUMNS).eq("user_email", userEmail).order("created_at", { ascending: false });
  }
  if (result.error) throw new AssistantDataError("SUPABASE_ERROR", "워크스페이스 데이터를 불러오지 못했습니다.");

  const tasks = (result.data || []).map((task) => {
    const steps = normalizeSteps(task.steps);
    const completedSteps = steps.filter((step) => step.completed).length;
    return {
      title: String(task.title || "").trim(), completed: Boolean(task.completed), priority: normalizePriority(task.priority),
      stepProgress: steps.length ? Math.round((completedSteps / steps.length) * 100) : null,
      completedSteps, totalSteps: steps.length,
    };
  });
  const completed = tasks.filter((task) => task.completed);
  const active = tasks.filter((task) => !task.completed);
  return { total: tasks.length, completed: completed.length, active: active.length, highPriority: active.filter((task) => task.priority === "높음"), activeTasks: active, completedTasks: completed };
}

export async function loadMeetingsSummary(supabase, userEmail) {
  const result = await supabase
    .from("meeting_minutes")
    .select(MEETING_COLUMNS)
    .eq("user_email", userEmail)
    .order("meeting_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (result.error) {
    if (isMissingRelation(result.error)) {
      throw new AssistantDataError("MEETINGS_TABLE_MISSING", MEETINGS_TABLE_MISSING_MESSAGE);
    }
    throw new AssistantDataError("SUPABASE_ERROR", "워크스페이스 데이터를 불러오지 못했습니다.");
  }
  const meetings = (result.data || []).map(mapMeetingRow).map((meeting) => ({
    title: meeting.title,
    meetingDate: meeting.meetingDate,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    attendees: meeting.attendees,
    location: meeting.location,
    tag: meeting.tag,
    content: meeting.content.slice(0, 1000),
    decisions: meeting.decisions.slice(0, 1000),
    actionItems: meeting.actionItems.slice(0, 1000),
    searchText: `${meeting.title} ${meeting.attendees} ${meeting.content} ${meeting.decisions} ${meeting.actionItems} ${meeting.tag}`.toLocaleLowerCase(),
  }));
  return { total: meetings.length, recentMeetings: meetings.slice(0, 5), searchableMeetings: meetings };
}

export async function loadCalendarSummary(request, session, message, now = new Date()) {
  const todayKey = getKoreaDateKey(now);
  const targetDate = extractTargetDate(message, todayKey);
  const weekRange = getWeekRange(todayKey);
  const monthStart = `${todayKey.slice(0, 7)}-01`;
  const monthEnd = addDays(addMonths(monthStart, 1), -1);
  const rangeKeys = [monthStart, monthEnd, weekRange.start, weekRange.end, targetDate].filter(Boolean).sort();
  const params = new URLSearchParams({
    timeMin: koreaMidnightToUtc(addDays(rangeKeys[0], -1)).toISOString(),
    timeMax: koreaMidnightToUtc(addDays(rangeKeys[rangeKeys.length - 1], 2)).toISOString(),
    singleEvents: "true", orderBy: "startTime", maxResults: "500",
  });
  const result = await fetchGoogleApi(request, session, `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, { cache: "no-store" });
  if (result.error || !result.response) throw new AssistantDataError("CALENDAR_AUTH_ERROR", "Google Calendar 권한을 다시 연결해주세요.");
  if (!result.response.ok) {
    if ([401, 403].includes(result.response.status)) throw new AssistantDataError("CALENDAR_AUTH_ERROR", "Google Calendar 권한을 다시 연결해주세요.");
    throw new AssistantDataError("CALENDAR_ERROR", "Google Calendar 일정을 불러오지 못했습니다.");
  }
  const data = await result.response.json();
  const events = (data.items || []).map(toSafeCalendarEvent).filter((event) => event.date);
  return {
    today: events.filter((event) => event.date === todayKey),
    week: events.filter((event) => event.date >= weekRange.start && event.date <= weekRange.end),
    month: events.filter((event) => event.date >= monthStart && event.date <= monthEnd),
    targetDate: targetDate || null,
    targetDateEvents: targetDate ? events.filter((event) => event.date === targetDate) : [],
  };
}

function toSafeCalendarEvent(event) {
  const start = event.start?.dateTime || event.start?.date;
  const end = event.end?.dateTime || event.end?.date;
  return { title: event.summary || "제목 없는 일정", date: getKoreaDateKey(start), start: event.start?.date ? "하루 종일" : formatKoreaTime(start), end: event.end?.date ? null : formatKoreaTime(end), location: String(event.location || "").slice(0, 120) };
}

function formatKoreaTime(value) {
  if (!value) return null;
  return new Intl.DateTimeFormat("ko-KR", { timeZone: KOREA_TIME_ZONE, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(value));
}

function getKoreaDateParts(value) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: KOREA_TIME_ZONE, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date(value));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: Number(map.year), month: Number(map.month), day: Number(map.day) };
}

function getKoreaDateKey(value) {
  if (typeof value === "string" && DATE_KEY_PATTERN.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = getKoreaDateParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function dateKeyToUtc(dateKey) { const [year, month, day] = dateKey.split("-").map(Number); return new Date(Date.UTC(year, month - 1, day)); }
function addDays(dateKey, amount) { const date = dateKeyToUtc(dateKey); date.setUTCDate(date.getUTCDate() + amount); return date.toISOString().slice(0, 10); }
function addMonths(dateKey, amount) { const date = dateKeyToUtc(dateKey); date.setUTCMonth(date.getUTCMonth() + amount); return date.toISOString().slice(0, 10); }
function koreaMidnightToUtc(dateKey) { const [year, month, day] = dateKey.split("-").map(Number); return new Date(Date.UTC(year, month - 1, day, -9)); }
function getWeekRange(todayKey) { const day = dateKeyToUtc(todayKey).getUTCDay(); const start = addDays(todayKey, day === 0 ? -6 : 1 - day); return { start, end: addDays(start, 6) }; }

function extractTargetDate(message, todayKey) {
  const isoMatch = message.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) return validDateKey(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  const fullMatch = message.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (fullMatch) return validDateKey(Number(fullMatch[1]), Number(fullMatch[2]), Number(fullMatch[3]));
  const shortMatch = message.match(/(\d{1,2})월\s*(\d{1,2})일/);
  if (shortMatch) return validDateKey(Number(todayKey.slice(0, 4)), Number(shortMatch[1]), Number(shortMatch[2]));
  if (/내일/.test(message)) return addDays(todayKey, 1);
  if (/오늘/.test(message)) return todayKey;
  return "";
}

function validDateKey(year, month, day) {
  const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const date = dateKeyToUtc(key);
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day ? key : "";
}
