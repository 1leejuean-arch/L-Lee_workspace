import { analyzeMeetingLocally } from "./meetingAnalysis.js";

export const LOCAL_MODE_LIMIT_MESSAGE = "아직은 자산, 일정, 할 일, 회의록 관련 질문을 중심으로 답할 수 있어요. 예를 들면 '이번 달 지출 알려줘', '회의록 요약해줘'처럼 물어볼 수 있습니다.";
const MEETING_TASK_NOTICE = "회의록 화면에서 확인 후 할 일로 추가할 수 있습니다.";

const TYPO_REPLACEMENTS = [
  [/회으록|회의록록|회록/g, "회의록"],
  [/해야\s*할\s*일/g, "해야할일"],
  [/남은\s*일/g, "남은할일"],
  [/할\s*일/g, "할일"],
  [/회의\s*내용/g, "회의내용"],
  [/후속\s*작업/g, "후속작업"],
  [/이번\s*주/g, "이번주"],
  [/이번\s*달/g, "이번달"],
  [/오늘\s*(?:스케줄|캘린더)/g, "오늘 일정"],
  [/스케줄|캘린더/g, "일정"],
  [/쓴\s*돈|쓴\s*거|얼마나\s*썼어|사용\s*금액/g, "지출"],
  [/들어온\s*돈|번\s*돈|입금/g, "수입"],
  [/총\s*돈|현재\s*돈|잔액/g, "자산"],
  [/정리\s*해\s*줘|정리\s*해주세요|정리/g, "요약"],
  [/보여\s*줘|보여\s*주세요|알려\s*줘|알려\s*주세요|뭐야|얼마야/g, "조회"],
];

export function normalizeMessage(message) {
  let text = String(message || "").normalize("NFKC").toLocaleLowerCase().trim();
  text = text.replace(/[^0-9a-z가-힣\s-]/g, " ").replace(/\s+/g, " ");
  for (const [pattern, replacement] of TYPO_REPLACEMENTS) text = text.replace(pattern, replacement);
  text = text
    .split(" ")
    .map((word) => word.length > 2 ? word.replace(/(?:은|는|이|가|을|를|의|좀|만|도)$/u, "") : word)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return { text, compact: text.replace(/\s+/g, "") };
}

const containsAny = (value, keywords) => keywords.some((keyword) => value.includes(keyword));

export function classifyLocalQuestion(message) {
  const normalized = normalizeMessage(message);
  const value = `${normalized.text} ${normalized.compact}`;
  const candidates = [];
  const add = (intent, scopes, score) => { if (score > 0) candidates.push({ intent, scopes, score }); };

  const hasMeeting = containsAny(value, ["회의록", "회의내용", "회의기록", "방금회의", "최근회의", "회의"]);
  const hasMeetingRecord = containsAny(value, ["회의록", "회의내용", "회의기록"]);
  const hasMeetingAction = containsAny(value, ["회의할일", "회의에서할일", "후속작업", "해야할거", "할일뽑", "할일추출"]);
  const hasSummary = containsAny(value, ["요약", "핵심"]);
  const hasSearch = containsAny(value, ["검색", "찾아", "관련"]);

  if (hasMeeting && hasMeetingAction) add("meetings_action_items", ["meetings"], 16 + (containsAny(value, ["뽑", "추출"]) ? 2 : 0));
  if (hasMeeting && hasSummary) add("meetings_summary", ["meetings"], 14 + (containsAny(value, ["최근", "방금"]) ? 1 : 0));
  if (hasMeeting && hasSearch) add("meetings_search", ["meetings"], 13);
  if (hasMeetingRecord || (hasMeeting && containsAny(value, ["최근", "방금", "조회", "기록"]))) {
    add("meetings_recent", ["meetings"], 8 + (containsAny(value, ["최근", "방금", "조회", "기록"]) ? 2 : 0));
  }

  const hasExpense = containsAny(value, ["지출", "썼어", "썼지", "사용금액", "결제"]);
  const hasIncome = containsAny(value, ["수입", "벌었", "들어왔", "받았"]);
  const hasRecent = containsAny(value, ["최근", "요즘", "5개"]);
  const hasAssetBalance = containsAny(value, ["자산", "총자산", "돈얼마있어", "돈얼마", "보유금액"]);
  add("asset_recent_expenses", ["assets"], hasExpense && hasRecent ? 14 : 0);
  add("asset_recent_income", ["assets"], hasIncome && hasRecent ? 14 : 0);
  add("asset_monthly_labor_income", ["assets"], containsAny(value, ["알바비", "급여", "월급", "시급"]) ? 13 : 0);
  add("asset_monthly_net", ["assets"], containsAny(value, ["순이익", "순수익"]) ? 14 : 0);
  add("asset_monthly_expense", ["assets"], hasExpense ? 10 + (value.includes("이번달") ? 2 : 0) : 0);
  add("asset_monthly_income", ["assets"], hasIncome ? 10 + (value.includes("이번달") ? 2 : 0) : 0);
  add("asset_current_balance", ["assets"], hasAssetBalance && !hasExpense && !hasIncome ? 11 + (containsAny(value, ["현재", "얼마", "있어", "조회"]) ? 2 : 0) : 0);

  const hasTask = containsAny(value, ["할일", "해야할일", "해야할거", "남은일", "태스크"]);
  if (hasTask) {
    add("tasks_high_priority", ["tasks"], containsAny(value, ["우선순위높", "높은우선순위", "중요", "긴급"]) ? 15 : 0);
    add("tasks_completed", ["tasks"], containsAny(value, ["완료", "끝낸", "끝난", "한일"]) ? 14 : 0);
    add("tasks_remaining", ["tasks"], containsAny(value, ["남은", "뭐남았", "해야", "미완료"]) ? 13 : 7);
  }

  const hasCalendar = containsAny(value, ["일정", "약속"]);
  if (hasCalendar) {
    add("calendar_today", ["calendar"], value.includes("오늘") ? 14 : 0);
    add("calendar_week", ["calendar"], value.includes("이번주") ? 14 : 0);
    add("calendar_month", ["calendar"], value.includes("이번달") ? 14 : 0);
  }

  candidates.sort((first, second) => second.score - first.score);
  const best = candidates[0];
  return best && best.score >= 7
    ? { intent: best.intent, scopes: best.scopes, normalized }
    : { intent: "unsupported", scopes: [], normalized };
}

export function createLocalAnswer(intent, summaries, message = "") {
  const assets = summaries.assetsSummary;
  const tasks = summaries.tasksSummary;
  const calendar = summaries.calendarSummary;
  const meetings = summaries.meetingsSummary;

  if (intent === "asset_monthly_expense") return `이번 달 지출은 총 ${formatWon(assets?.monthlyExpense)}입니다.`;
  if (intent === "asset_monthly_income") return `이번 달 수입은 총 ${formatWon(assets?.monthlyIncome)}입니다.`;
  if (intent === "asset_current_balance") return `현재 총 자산은 ${formatWon(assets?.totalBalance)}입니다.`;
  if (intent === "asset_monthly_net") return `이번 달 순이익은 ${formatWon(assets?.monthlyNet)}입니다.`;
  if (intent === "asset_monthly_labor_income") return `이번 달 알바비 수입은 총 ${formatWon(assets?.monthlyLaborIncome)}입니다.`;
  if (intent === "asset_recent_expenses") return formatTransactionAnswer("최근 지출", assets?.recentExpenses || []);
  if (intent === "asset_recent_income") return formatTransactionAnswer("최근 수입", assets?.recentIncomes || []);
  if (intent === "tasks_remaining") return formatTaskAnswer("남은 할 일", tasks?.activeTasks || []);
  if (intent === "tasks_completed") return formatTaskAnswer("완료한 할 일", tasks?.completedTasks || []);
  if (intent === "tasks_high_priority") return formatTaskAnswer("우선순위가 높은 할 일", tasks?.highPriority || []);
  if (intent === "calendar_today") return formatCalendarAnswer("오늘 일정", calendar?.today || []);
  if (intent === "calendar_week") return formatCalendarAnswer("이번 주 일정", calendar?.week || []);
  if (intent === "calendar_month") return formatCalendarAnswer("이번 달 일정", calendar?.month || []);
  if (intent === "meetings_recent") return formatMeetingAnswer("최근 회의록", meetings?.recentMeetings || []);
  if (intent === "meetings_summary" || intent === "meetings_action_items") return formatMeetingAnalysisAnswer(meetings, message, intent);
  if (intent === "meetings_search") {
    const keyword = extractMeetingKeyword(message);
    const source = meetings?.searchableMeetings || [];
    const matches = keyword ? source.filter((meeting) => meeting.searchText.includes(keyword.toLocaleLowerCase())) : source;
    return formatMeetingAnswer(keyword ? `“${keyword}” 회의록 검색 결과` : "회의록 검색 결과", matches.slice(0, 10));
  }
  return LOCAL_MODE_LIMIT_MESSAGE;
}

function formatMeetingAnalysisAnswer(meetingsSummary, message, intent) {
  const meetings = meetingsSummary?.searchableMeetings || meetingsSummary?.recentMeetings || [];
  const keyword = extractMeetingAnalysisKeyword(message);
  const meeting = keyword
    ? meetings.find((item) => item.title.toLocaleLowerCase().includes(keyword.toLocaleLowerCase()) || item.searchText?.includes(keyword.toLocaleLowerCase())) || meetings[0]
    : meetings[0];
  if (!meeting) return intent === "meetings_action_items" ? `후속 작업을 추출할 회의록이 없습니다.\n\n${MEETING_TASK_NOTICE}` : "요약할 회의록이 없습니다.";

  const analysis = analyzeMeetingLocally(meeting);
  const contentSummary = meeting.content?.trim() ? analysis.summary : "작성된 회의 내용이 없습니다.";
  const decisions = analysis.decisions.length ? analysis.decisions.map((item, index) => `${index + 1}. ${item}`).join("\n") : "작성된 결정 사항이 없습니다.";
  const actions = analysis.actionItems.length ? analysis.actionItems.map((item, index) => `${index + 1}. ${item.title}`).join("\n") : "작성되거나 추출된 후속 작업이 없습니다.";
  const heading = intent === "meetings_action_items" ? `${meeting.title} 회의록의 후속 작업 후보입니다.` : `${meeting.title} 회의록을 요약했습니다.`;
  return `${heading}\n\n날짜\n${formatDate(meeting.meetingDate)}\n\n핵심 요약\n${contentSummary}\n\n결정 사항\n${decisions}\n\n후속 작업\n${actions}\n\n${MEETING_TASK_NOTICE}`;
}

function formatWon(value) {
  const number = Number(value) || 0;
  const sign = number < 0 ? "-" : "";
  return `${sign}${Math.abs(Math.round(number)).toLocaleString("ko-KR")}원`;
}

function formatTransactionAnswer(label, transactions) {
  const items = transactions.slice(0, 5);
  if (!items.length) return `${label} 내역이 없습니다.`;
  return `${label} ${items.length}개입니다.\n${items.map((transaction, index) =>
    `${index + 1}. ${formatDate(transaction.date)} · ${transaction.title || "제목 없음"} · ${formatWon(transaction.amount)}`).join("\n")}`;
}

function formatTaskAnswer(label, tasks) {
  if (!tasks.length) return `${label}이 없습니다.`;
  return `${label}은 ${tasks.length}개입니다.\n${tasks.map((task, index) => {
    const progress = task.totalSteps ? ` · 세부 단계 ${task.completedSteps}/${task.totalSteps} (${task.stepProgress}%)` : "";
    return `${index + 1}. ${task.title}${task.priority ? ` · 우선순위 ${task.priority}` : ""}${progress}`;
  }).join("\n")}`;
}

function formatCalendarAnswer(label, events) {
  if (!events.length) return `${label}이 없습니다.`;
  return `${label}은 ${events.length}개입니다.\n${events.map((event, index) => {
    const time = event.start || "시간 미정";
    const location = event.location ? ` · ${event.location}` : "";
    return `${index + 1}. ${formatDate(event.date)} ${time} - ${event.title}${location}`;
  }).join("\n")}`;
}

function formatMeetingAnswer(label, meetings) {
  if (!meetings.length) return `${label}: 결과가 없습니다.`;
  return `${label} ${meetings.length}개입니다.\n${meetings.map((meeting, index) => {
    const attendees = meeting.attendees ? ` · 참석자 ${meeting.attendees}` : "";
    return `${index + 1}. ${formatDate(meeting.meetingDate)} · ${meeting.title}${attendees}`;
  }).join("\n")}`;
}

function formatDate(dateKey) {
  const match = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${Number(match[2])}월 ${Number(match[3])}일` : "날짜 미정";
}

function extractMeetingKeyword(message) {
  return normalizeMessage(message).text
    .replace(/검색|찾아|조회|회의록|회의내용|회의기록|에서|관련|최근|방금/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMeetingAnalysisKeyword(message) {
  return normalizeMessage(message).text
    .replace(/최근|방금|회의록에서|회의록|회의내용|회의기록|회의|할일|후속작업|작업|요약|추출|뽑아|뽑|핵심|조회/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
