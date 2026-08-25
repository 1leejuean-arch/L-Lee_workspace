export const LOCAL_MODE_LIMIT_MESSAGE = "현재 무료 로컬 모드에서는 자산, 일정, 할 일, 회의록 요약 질문만 답할 수 있습니다.";

export function classifyLocalQuestion(message) {
  const text = String(message || "").replace(/\s+/g, " ").trim();
  if (/회의록/.test(text)) {
    return { intent: /(검색|찾아|찾기|관련)/.test(text) ? "meetings_search" : "meetings_recent", scopes: ["meetings"] };
  }
  if (/(최근|요즘).*(지출|쓴|결제)|(지출|쓴|결제).*(최근|5개)/.test(text)) return { intent: "recent_expenses", scopes: ["assets"] };
  if (/(최근|요즘).*(수입|입금)|(수입|입금).*(최근|5개)/.test(text)) return { intent: "recent_incomes", scopes: ["assets"] };
  if (/(알바|급여|월급|시급|근무).*(얼마|수입|들어|받)|알바비/.test(text)) return { intent: "monthly_labor_income", scopes: ["assets"] };
  if (/(총\s*자산|현재\s*자산|자산.*얼마)/.test(text)) return { intent: "total_balance", scopes: ["assets"] };
  if (/(순이익|순수익)/.test(text)) return { intent: "monthly_net", scopes: ["assets"] };
  if (/(지출|얼마\s*썼|쓴\s*돈)/.test(text)) return { intent: "monthly_expense", scopes: ["assets"] };
  if (/(수입|얼마\s*벌|들어온\s*돈)/.test(text)) return { intent: "monthly_income", scopes: ["assets"] };
  if (/(일정|캘린더|스케줄|약속|미팅|회의)/.test(text)) {
    if (/오늘/.test(text)) return { intent: "calendar_today", scopes: ["calendar"] };
    if (/이번\s*달/.test(text)) return { intent: "calendar_month", scopes: ["calendar"] };
    if (/이번\s*주/.test(text)) return { intent: "calendar_week", scopes: ["calendar"] };
  }
  if (/(할\s*일|태스크|작업)/.test(text)) {
    if (/(우선순위.*높|높은\s*우선순위|중요)/.test(text)) return { intent: "tasks_high", scopes: ["tasks"] };
    if (/(완료|끝낸|한\s*일)/.test(text)) return { intent: "tasks_completed", scopes: ["tasks"] };
    if (/(남은|미완료|해야)/.test(text)) return { intent: "tasks_active", scopes: ["tasks"] };
  }
  return { intent: "unsupported", scopes: [] };
}

export function createLocalAnswer(intent, summaries, message = "") {
  const assets = summaries.assetsSummary;
  const tasks = summaries.tasksSummary;
  const calendar = summaries.calendarSummary;
  const meetings = summaries.meetingsSummary;

  if (intent === "monthly_expense") return `이번 달 지출은 총 ${formatWon(assets?.monthlyExpense)}입니다.`;
  if (intent === "monthly_income") return `이번 달 수입은 총 ${formatWon(assets?.monthlyIncome)}입니다.`;
  if (intent === "total_balance") return `현재 총 자산은 ${formatWon(assets?.totalBalance)}입니다.`;
  if (intent === "monthly_net") return `이번 달 순이익은 ${formatWon(assets?.monthlyNet)}입니다.`;
  if (intent === "monthly_labor_income") return `이번 달 알바비 수입은 총 ${formatWon(assets?.monthlyLaborIncome)}입니다.`;
  if (intent === "recent_expenses") return formatTransactionAnswer("최근 지출", assets?.recentExpenses || []);
  if (intent === "recent_incomes") return formatTransactionAnswer("최근 수입", assets?.recentIncomes || []);
  if (intent === "tasks_active") return formatTaskAnswer("남은 할 일", tasks?.activeTasks || []);
  if (intent === "tasks_completed") return formatTaskAnswer("완료한 할 일", tasks?.completedTasks || []);
  if (intent === "tasks_high") return formatTaskAnswer("우선순위가 높은 할 일", tasks?.highPriority || []);
  if (intent === "calendar_today") return formatCalendarAnswer("오늘 일정", calendar?.today || []);
  if (intent === "calendar_week") return formatCalendarAnswer("이번 주 일정", calendar?.week || []);
  if (intent === "calendar_month") return formatCalendarAnswer("이번 달 일정", calendar?.month || []);
  if (intent === "meetings_recent") return formatMeetingAnswer("최근 회의록", meetings?.recentMeetings || []);
  if (intent === "meetings_search") {
    const keyword = extractMeetingKeyword(message);
    const source = meetings?.searchableMeetings || [];
    const matches = keyword ? source.filter((meeting) => meeting.searchText.includes(keyword.toLocaleLowerCase())) : source;
    return formatMeetingAnswer(keyword ? `“${keyword}” 회의록 검색 결과` : "회의록 검색 결과", matches.slice(0, 10));
  }
  return LOCAL_MODE_LIMIT_MESSAGE;
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
  return String(message || "")
    .replace(/["']/g, "")
    .replace(/검색해주세요|검색해줘|찾아주세요|찾아줘|보여주세요|보여줘|알려주세요|알려줘|회의록|에서|검색|찾기|관련/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
