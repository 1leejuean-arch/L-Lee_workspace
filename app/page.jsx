"use client";

import { useEffect, useMemo, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import {
  createNoteInSupabase,
  createTaskInSupabase,
  deleteNoteFromSupabase,
  deleteTaskFromSupabase,
  fetchNotesFromSupabase,
  fetchTasksFromSupabase,
  updateNoteInSupabase,
  updateTaskInSupabase,
} from "../lib/workspaceStorage";
import {
  Bell,
  Bot,
  CalendarDays,
  Check,
  CheckSquare,
  ChevronRight,
  Circle,
  Clock3,
  Cloud,
  File,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  HardDrive,
  Instagram,
  LayoutDashboard,
  Link,
  LogIn,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Music,
  Moon,
  MoreHorizontal,
  Palette,
  Pencil,
  Plus,
  Search,
  Send,
  Settings,
  Shield,
  Sparkles,
  Sun,
  Trash2,
  User,
  Youtube,
  X,
} from "lucide-react";

const TASKS_KEY = "l-lee-workspace.tasks";
const NOTES_KEY = "l-lee-workspace.notes";
const CALENDAR_EVENTS_KEY = "l-lee-workspace.calendarEvents";
const DRIVE_FILES_KEY = "l-lee-workspace.driveFiles";
const THEME_KEY = "l-lee-workspace.theme";

const themeOptions = [
  {
    key: "dark-glass",
    name: "다크 글래스",
    description: "딥 네이비, 시안, 바이올렛",
    icon: Moon,
  },
  {
    key: "light-glass",
    name: "라이트 글래스",
    description: "소프트 화이트, 아이스 블루, 라벤더",
    icon: Sun,
  },
  {
    key: "rgb-glass",
    name: "RGB 글래스",
    description: "네온 레드, 그린, 블루",
    icon: Sparkles,
  },
];

const quickLaunchApps = [
  {
    name: "YouTube Music",
    description: "음악 스트리밍",
    href: "https://music.youtube.com",
    icon: Music,
    color: "from-red-400/25 to-pink-500/10 text-red-200",
  },
  {
    name: "Instagram",
    aliases: ["인스타", "인스타그램", "instagram"],
    description: "피드와 메시지",
    href: "https://www.instagram.com",
    icon: Instagram,
    color: "from-pink-400/25 to-violet-500/10 text-pink-200",
  },
  {
    name: "Discord",
    aliases: ["디스코드", "discord"],
    description: "커뮤니티 채팅",
    href: "https://discord.com/app",
    icon: MessageSquare,
    color: "from-indigo-400/25 to-blue-500/10 text-indigo-200",
  },
  {
    name: "내 메일",
    aliases: ["메일", "내 메일", "mail", "이메일"],
    description: "메일함 열기",
    href: "https://mail.1leejuean.kr",
    icon: Mail,
    color: "from-emerald-300/25 to-cyan-500/10 text-emerald-200",
  },
  {
    name: "Google Calendar",
    aliases: ["구글 캘린더", "캘린더", "google calendar"],
    description: "캘린더 웹",
    href: "https://calendar.google.com",
    icon: CalendarDays,
    color: "from-cyan-300/25 to-blue-500/10 text-cyan-200",
  },
  {
    name: "Google Drive",
    aliases: ["구글 드라이브", "드라이브", "google drive"],
    description: "드라이브 웹",
    href: "https://drive.google.com",
    icon: HardDrive,
    color: "from-lime-300/25 to-emerald-500/10 text-lime-200",
  },
  {
    name: "YouTube",
    aliases: ["유튜브", "youtube"],
    description: "동영상 바로가기",
    href: "https://www.youtube.com",
    icon: Youtube,
    color: "from-red-500/25 to-orange-500/10 text-red-200",
  },
  {
    name: "ChatGPT",
    aliases: ["chatgpt", "챗지피티", "챗 gpt", "chat gpt"],
    description: "AI 작업 도우미",
    href: "https://chatgpt.com",
    icon: Bot,
    color: "from-teal-300/25 to-emerald-500/10 text-teal-200",
  },
  {
    name: "Gemini",
    aliases: ["gemini", "제미나이", "구글 ai"],
    description: "Google AI",
    href: "https://gemini.google.com",
    icon: Sparkles,
    color: "from-violet-300/25 to-fuchsia-500/10 text-violet-200",
  },
];

const assistantAppShortcuts = [
  ...quickLaunchApps,
  {
    name: "KakaoTalk",
    aliases: ["카톡", "카카오톡", "kakao", "kakaotalk"],
    href: "https://www.kakaocorp.com/page/service/service/KakaoTalk",
  },
];

async function readApiResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      return { data: await response.json(), text: "" };
    } catch {
      throw new Error("서버 응답을 읽지 못했습니다.");
    }
  }

  return { data: null, text: await response.text().catch(() => "") };
}

function getApiErrorMessage(response, data, text, fallback) {
  if (response.status === 401) {
    return data?.error || "Google 계정 연결이 필요합니다.";
  }

  return data?.error || text || fallback;
}

function normalizeCommand(input) {
  return input.trim().toLowerCase();
}

function findAssistantShortcut(input) {
  const normalizedInput = normalizeCommand(input);
  return assistantAppShortcuts.find((app) =>
    (app.aliases || [app.name]).some((alias) => normalizedInput.includes(alias.toLowerCase())),
  );
}

function getAssistantIntent(input) {
  const text = normalizeCommand(input);

  if ((text.includes("열어") || text.includes("켜줘") || text.includes("바로가기")) && findAssistantShortcut(text)) {
    return "app_open";
  }
  if (text.includes("드라이브") && (text.includes("정리") || text.includes("최근") || text.includes("보여") || text.includes("요약"))) {
    return "drive_summary";
  }
  if (
    text.includes("일정") &&
    (text.includes("요약") ||
      text.includes("알려") ||
      text.includes("정리") ||
      text.includes("남은") ||
      text.includes("있어") ||
      text.includes("있나요") ||
      text.includes("있는지") ||
      text.includes("있나") ||
      text.includes("뭐") ||
      text.includes("무슨") ||
      text.includes("어떤") ||
      text.includes("이번주") ||
      text.includes("이번 주") ||
      text.includes("다음주") ||
      text.includes("다음 주") ||
      /\d{1,2}\s*월\s*\d{1,2}\s*일/.test(text))
  ) {
    return "calendar_summary";
  }
  if ((text.includes("할 일") || text.includes("할일")) && (text.includes("추가") || text.includes("넣어") || text.includes("등록"))) {
    return "task_create";
  }
  if (text.includes("메모") && (text.includes("추가") || text.includes("적어") || text.includes("기록") || text.includes("저장"))) {
    return "note_create";
  }
  if (text.includes("일정") || text.includes("예약") || text.includes("회의") || text.includes("운동")) {
    return "calendar_create";
  }

  return "general_help";
}

function stripCommandText(input, patterns) {
  let value = input.trim();
  patterns.forEach((pattern) => {
    value = value.replace(pattern, " ");
  });
  return value.replace(/\s+/g, " ").trim();
}

function extractTaskTitle(input) {
  return stripCommandText(input, [/할\s*일/g, /오늘/g, /로/g, /에/g, /추가해줘/g, /추가/g, /넣어줘/g, /등록해줘/g]).trim();
}

function extractNoteDraft(input) {
  const cleaned = stripCommandText(input, [/메모에/g, /메모로/g, /메모/g, /적어줘/g, /기록해줘/g, /저장해줘/g, /추가해줘/g]);
  const [rawTitle, ...bodyParts] = cleaned.split(":");
  const body = bodyParts.join(":").trim();

  if (body) {
    return {
      title: rawTitle.trim() || "메모",
      body,
      tag: "AI",
    };
  }

  return {
    title: "AI 메모",
    body: cleaned.trim(),
    tag: "AI",
  };
}

function getEventStart(event) {
  const date = new Date(event.start);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getWeekStart(date) {
  const start = startOfDay(date);
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  return start;
}

function formatKoreanDate(date) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function getCalendarQueryRange(input, now = new Date()) {
  const text = normalizeCommand(input);
  const monthDayMatch = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);

  if (monthDayMatch) {
    const month = Number(monthDayMatch[1]) - 1;
    const day = Number(monthDayMatch[2]);
    const date = new Date(now.getFullYear(), month, day);
    return {
      start: startOfDay(date),
      end: addDays(startOfDay(date), 1),
      label: `${month + 1}월 ${day}일`,
      includeDate: false,
    };
  }

  if (text.includes("다음주") || text.includes("다음 주")) {
    const start = addDays(getWeekStart(now), 7);
    return {
      start,
      end: addDays(start, 7),
      label: "다음 주",
      includeDate: true,
    };
  }

  if (text.includes("이번주") || text.includes("이번 주")) {
    const start = getWeekStart(now);
    return {
      start,
      end: addDays(start, 7),
      label: "이번 주",
      includeDate: true,
    };
  }

  if (text.includes("내일")) {
    const start = addDays(startOfDay(now), 1);
    return {
      start,
      end: addDays(start, 1),
      label: "내일",
      includeDate: false,
    };
  }

  const start = startOfDay(now);
  return {
    start,
    end: addDays(start, 1),
    label: "오늘",
    includeDate: false,
  };
}

function extractCalendarSearchTerm(input) {
  return input
    .toLowerCase()
    .replace(/\d{1,2}\s*월\s*\d{1,2}\s*일/g, " ")
    .replace(/이번\s*주|다음\s*주|오늘|내일/g, " ")
    .replace(/일정|있나요|있는지|있나|있어|있니|무슨|어떤|뭐|알려줘|알려|요약|정리|남은|궁금해|확인해줘|확인|찾아줘|찾아|보여줘|보여|\?|#/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => word.replace(/(은|는|이|가|을|를|에)$/g, ""))
    .filter(Boolean)
    .join(" ")
    .trim();
}

function getCalendarSearchTerms(searchTerm) {
  if (!searchTerm) return [];
  if (searchTerm === "회의" || searchTerm === "미팅") {
    return ["회의", "미팅", "meet", "meeting"];
  }
  return [searchTerm];
}

function filterCalendarEventsForQuery(events, range, searchTerm) {
  const searchTerms = getCalendarSearchTerms(searchTerm);

  return events
    .filter((event) => {
      const start = getEventStart(event);
      if (!start || start < range.start || start >= range.end) return false;

      if (!searchTerms.length) return true;
      const targetText = `${event.title || ""} ${event.place || ""}`.toLowerCase();
      return searchTerms.some((term) => targetText.includes(term));
    })
    .sort((first, second) => getEventStart(first).getTime() - getEventStart(second).getTime());
}

function formatEventSummary(events, scopeLabel, options = {}) {
  const { searchTerm = "", includeDate = false } = options;
  const targetLabel = searchTerm ? `${scopeLabel} '${searchTerm}'` : scopeLabel;
  if (!events.length) return `${targetLabel} 예정된 일정이 없습니다.`;

  const lines = events.slice(0, 6).map((event, index) => {
    const start = getEventStart(event);
    const datePrefix = includeDate && start ? `${formatKoreanDate(start)} ` : "";
    return `${index + 1}. ${datePrefix}${event.time || "시간 미정"} - ${event.title}`;
  });
  const suffix = events.length > 6 ? `\n외 ${events.length - 6}개 일정이 더 있어요.` : "";
  return `${targetLabel} 일정은 ${events.length}개예요.\n${lines.join("\n")}${suffix}`;
}

function summarizeCalendar(input, calendarEvents) {
  const range = getCalendarQueryRange(input);
  const searchTerm = extractCalendarSearchTerm(input);
  const sourceEvents = calendarEvents.lookup || calendarEvents.month || calendarEvents.week || calendarEvents.today || [];
  const matchedEvents = filterCalendarEventsForQuery(sourceEvents, range, searchTerm);

  return formatEventSummary(matchedEvents, range.label, {
    searchTerm,
    includeDate: range.includeDate,
  });
}

function summarizeDriveFiles(files) {
  if (!files.length) return "최근 Google Drive 파일을 찾지 못했어요. Google 계정 연결이나 Drive 권한을 확인해주세요.";

  const lines = files.slice(0, 5).map((file, index) => `${index + 1}. ${file.name} (${file.updated || "수정일 없음"})`);
  return `최근 Drive 파일 ${Math.min(files.length, 5)}개를 정리했어요.\n${lines.join("\n")}`;
}

function getCalendarCreateErrorMessage(error) {
  const message = error?.message || "";

  if (message.includes("Google 계정") || message.includes("로그인")) {
    return "Google 계정 연결이 필요합니다.";
  }

  if (message.includes("권한") || message.includes("token") || message.includes("Token")) {
    return "캘린더 권한이 만료되었습니다. 다시 로그인해주세요.";
  }

  if (message.includes("제목") || message.includes("날짜") || message.includes("시간")) {
    return message;
  }

  if (message === "서버 응답을 읽지 못했습니다.") {
    return message;
  }

  return "일정을 추가하지 못했습니다. 잠시 후 다시 시도해주세요.";
}

async function executeWorkspaceAiCommand(command, context, options = {}) {
  const { status, calendarEvents, driveFilesData, onCalendarCreated, onTaskCreated, onNoteCreated } = context;
  const { confirmCalendar = true } = options;
  const intent = getAssistantIntent(command);

  if (intent === "app_open") {
    const shortcut = findAssistantShortcut(command);
    if (!shortcut) {
      return { message: "해당 바로가기를 찾지 못했어요. 앱 바로가기 목록을 확인해주세요." };
    }

    window.open(shortcut.href, "_blank", "noopener,noreferrer");
    return { message: `${shortcut.name}을 새 탭으로 열었어요.` };
  }

  if (intent === "calendar_summary") {
    return { message: summarizeCalendar(command, calendarEvents) };
  }

  if (intent === "drive_summary") {
    return { message: summarizeDriveFiles(driveFilesData) };
  }

  if (intent === "task_create") {
    const title = extractTaskTitle(command);
    if (!title) return { message: "추가할 할 일 내용을 다시 알려주세요." };

    await onTaskCreated(title);
    return { message: `좋아요. 할 일에 '${title}'을 추가했어요.` };
  }

  if (intent === "note_create") {
    const note = extractNoteDraft(command);
    if (!note.body) return { message: "메모에 적을 내용을 다시 알려주세요." };

    await onNoteCreated(note);
    return { message: `좋아요. '${note.title}' 메모를 추가했어요.` };
  }

  if (intent !== "calendar_create") {
    return {
      message: "이렇게 말해보세요: '오늘 일정 요약해줘', '최근 드라이브 파일 정리해줘', '할 일에 과제 제출 추가해줘', '인스타 열어줘'.",
    };
  }

  if (status !== "authenticated") {
    return { message: "Google 계정 연결이 필요해요. 계정을 연결하면 일정을 추가할 수 있어요." };
  }

  const parseResponse = await fetch("/api/assistant/parse", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: command }),
  });
  const { data: parsedEvent, text: parseText } = await readApiResponse(parseResponse);

  if (!parseResponse.ok || parsedEvent?.intent !== "create_calendar_event") {
    return {
      message:
        parsedEvent?.message ||
        getApiErrorMessage(parseResponse, parsedEvent, parseText, "아직은 일정 추가 요청을 중심으로 도와드릴 수 있어요."),
    };
  }

  if (confirmCalendar) {
    return {
      pendingEvent: parsedEvent,
      message: `${parsedEvent.displayDate} ${parsedEvent.displayTime}에 '${parsedEvent.title}'을 ${parsedEvent.durationText} 일정으로 추가할까요?`,
    };
  }

  const createResponse = await fetch("/api/calendar/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: parsedEvent.title,
      date: parsedEvent.date,
      startTime: parsedEvent.startTime,
      endTime: parsedEvent.endTime,
      description: parsedEvent.description,
    }),
  });
  const { data, text } = await readApiResponse(createResponse);

  if (!createResponse.ok) {
    throw new Error(getApiErrorMessage(createResponse, data, text, "일정 추가에 실패했습니다."));
  }

  await onCalendarCreated();
  return { message: data?.message || "좋아요. 일정을 추가했어요." };
}

const sidebarItems = [
  { key: "Dashboard", label: "대시보드", icon: LayoutDashboard },
  { key: "Calendar", label: "캘린더", icon: CalendarDays },
  { key: "Drive", label: "드라이브", icon: HardDrive },
  { key: "Notes", label: "메모", icon: FileText },
  { key: "Tasks", label: "할 일", icon: CheckSquare },
  { key: "AI Assistant", label: "AI 비서", icon: Bot },
  { key: "Quick Launch", label: "앱 바로가기", icon: Link },
  { key: "Settings", label: "설정", icon: Settings },
];

const agendaItems = [
  { id: 1, title: "아침 계획 정리", time: "09:00", duration: "30분", accent: "bg-cyan-400", place: "워크스페이스 데스크" },
  { id: 2, title: "프로젝트 싱크", time: "11:30", duration: "45분", accent: "bg-violet-400", place: "Google Meet" },
  { id: 3, title: "드라이브 정리", time: "14:00", duration: "1시간", accent: "bg-blue-400", place: "관리 블록" },
  { id: 4, title: "집중 작업 시간", time: "16:00", duration: "2시간", accent: "bg-fuchsia-400", place: "집중 모드" },
  { id: 5, title: "저녁 회고", time: "19:00", duration: "20분", accent: "bg-emerald-400", place: "메모" },
];

const driveFiles = [
  { id: 1, name: "워크스페이스 로드맵.pdf", type: "pdf", updated: "12분 전", owner: "주언", size: "2.4 MB" },
  { id: 2, name: "Google API 연동 메모", type: "doc", updated: "1시간 전", owner: "주언", size: "84 KB" },
  { id: 3, name: "개인 지표.xlsx", type: "sheet", updated: "오늘", owner: "워크스페이스", size: "415 KB" },
  { id: 4, name: "AI 비서 프롬프트", type: "doc", updated: "어제", owner: "주언", size: "126 KB" },
  { id: 5, name: "디자인 참고 보드", type: "folder", updated: "6월 12일", owner: "워크스페이스", size: "18개 항목" },
];

const initialTasks = [
  { id: 1, title: "캘린더 API 권한 범위 검토", completed: false, priority: "높음" },
  { id: 2, title: "드라이브 워크스페이스 폴더 정리", completed: true, priority: "보통" },
  { id: 3, title: "내일 집중 메모 작성", completed: false, priority: "낮음" },
  { id: 4, title: "할 일 동기화 스키마 준비", completed: false, priority: "높음" },
  { id: 5, title: "설정 연결 상태 UI 스케치", completed: true, priority: "보통" },
];

const initialNotes = [
  {
    id: 1,
    title: "API 어댑터 계획",
    body: "나중에 캘린더와 드라이브 데이터를 각각 별도 어댑터로 연결합니다. 목업 배열 구조는 실제 API 응답과 비슷하게 유지합니다.",
    tag: "아키텍처",
  },
  {
    id: 2,
    title: "AI 비서 동작 방식",
    body: "AI는 먼저 사용자의 의도를 파악한 뒤 캘린더, 드라이브, 메모, 할 일 중 어떤 작업이 필요한지 제안해야 합니다.",
    tag: "AI",
  },
  {
    id: 3,
    title: "명령 팔레트",
    body: "핵심 대시보드가 안정되면 빠른 작업을 추가합니다: 메모 작성, 할 일 추가, 파일 검색, 일정 예약.",
    tag: "제품",
  },
  {
    id: 4,
    title: "하루 회고",
    body: "저녁 흐름: 오늘 일정 요약, 남은 할 일, 내일 집중 시간, 드라이브 변경 사항 요약.",
    tag: "루틴",
  },
];

const aiSuggestions = [
  "내일 오후 6시에 회의 예약해줘",
  "오늘 일정 요약해줘",
  "이번주 일정 뭐 있어?",
  "다음주에 회의 일정있어?",
  "6월 21일에 무슨 일정있어?",
  "최근 드라이브 파일 정리해줘",
  "이번 주 할 일 우선순위 잡아줘",
  "인스타 열어줘",
  "디스코드 열어줘",
  "내 메일 열어줘",
];

const aiMessages = [
  { id: 1, role: "assistant", text: "안녕하세요, 주언님. 오늘 일정, 파일, 메모, 할 일을 한곳에서 정리할 준비가 되어 있어요." },
  { id: 2, role: "user", text: "오늘 남은 일정과 할 일을 요약해줘." },
  { id: 3, role: "assistant", text: "남은 일정은 집중 작업 시간과 저녁 회고가 있고, 우선 처리할 작업은 캘린더 API 권한 범위 검토입니다." },
];

const taskTitleTranslations = {
  "Review Calendar API scopes": "캘린더 API 권한 범위 검토",
  "Sort Drive workspace folders": "드라이브 워크스페이스 폴더 정리",
  "Calendar API 권한 범위 검토": "캘린더 API 권한 범위 검토",
  "Drive 워크스페이스 폴더 정리": "드라이브 워크스페이스 폴더 정리",
  "Write tomorrow's focus note": "내일 집중 메모 작성",
  "Prepare task sync schema": "할 일 동기화 스키마 준비",
  "Sketch settings connection states": "설정 연결 상태 UI 스케치",
};

const priorityTranslations = {
  High: "높음",
  Medium: "보통",
  Low: "낮음",
};

const noteTranslations = {
  "API adapter plan": {
    title: "API 어댑터 계획",
    body: "나중에 캘린더와 드라이브 데이터를 각각 별도 어댑터로 연결합니다. 목업 배열 구조는 실제 API 응답과 비슷하게 유지합니다.",
    tag: "아키텍처",
  },
  "Assistant behavior": {
    title: "AI 비서 동작 방식",
    body: "AI는 먼저 사용자의 의도를 파악한 뒤 캘린더, 드라이브, 메모, 할 일 중 어떤 작업이 필요한지 제안해야 합니다.",
    tag: "AI",
  },
  "Command palette": {
    title: "명령 팔레트",
    body: "핵심 대시보드가 안정되면 빠른 작업을 추가합니다: 메모 작성, 할 일 추가, 파일 검색, 일정 예약.",
    tag: "제품",
  },
  "Daily review": {
    title: "하루 회고",
    body: "저녁 흐름: 오늘 일정 요약, 남은 할 일, 내일 집중 시간, 드라이브 변경 사항 요약.",
    tag: "루틴",
  },
};

function loadStoredItems(key, fallback) {
  if (typeof window === "undefined") return fallback;

  try {
    const storedValue = window.localStorage.getItem(key);
    return storedValue ? JSON.parse(storedValue) : fallback;
  } catch {
    return fallback;
  }
}

function localizeStoredTasks(storedTasks) {
  return storedTasks.map((task) => ({
    ...task,
    title: taskTitleTranslations[task.title] || task.title,
    priority: priorityTranslations[task.priority] || task.priority,
  }));
}

function localizeStoredNotes(storedNotes) {
  return storedNotes.map((note) => {
    const translatedNote = noteTranslations[note.title];
    return translatedNote ? { ...note, ...translatedNote } : note;
  });
}

function getLocalWorkspaceData() {
  const hasStoredTasks = window.localStorage.getItem(TASKS_KEY) !== null;
  const hasStoredNotes = window.localStorage.getItem(NOTES_KEY) !== null;

  return {
    tasks: localizeStoredTasks(loadStoredItems(TASKS_KEY, initialTasks)),
    notes: localizeStoredNotes(loadStoredItems(NOTES_KEY, initialNotes)),
    pendingTasks: hasStoredTasks
      ? localizeStoredTasks(loadStoredItems(TASKS_KEY, [])).filter((task) => String(task.id).startsWith("local-"))
      : [],
    pendingNotes: hasStoredNotes
      ? localizeStoredNotes(loadStoredItems(NOTES_KEY, [])).filter((note) => String(note.id).startsWith("local-"))
      : [],
  };
}

function hasMatchingTask(tasks, candidate) {
  return tasks.some((task) => task.title.trim() === candidate.title.trim());
}

function hasMatchingNote(notes, candidate) {
  return notes.some(
    (note) =>
      note.title.trim() === candidate.title.trim() &&
      note.body.trim() === candidate.body.trim() &&
      (note.tag || "개인").trim() === (candidate.tag || "개인").trim(),
  );
}

function GlassCard({ children, className = "" }) {
  return (
    <section
      className={`rounded-lg border border-[color:var(--workspace-border)] bg-[var(--workspace-card)] shadow-glow backdrop-blur-2xl transition duration-300 hover:-translate-y-1 hover:border-[color:var(--workspace-accent-soft)] hover:bg-[var(--workspace-card-hover)] ${className}`}
    >
      {children}
    </section>
  );
}

function CardHeader({ icon: Icon, title, action = true, actionContent = null }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-cyan-300" />
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
      </div>
      {actionContent}
      {action && !actionContent && (
        <button type="button" aria-label={`${title} 옵션`} className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function IconButton({ label, onClick, children, tone = "default" }) {
  const tones = {
    default: "text-slate-400 hover:border-cyan-300/30 hover:bg-white/10 hover:text-white",
    danger: "text-slate-500 hover:border-rose-300/30 hover:bg-rose-400/10 hover:text-rose-200",
  };

  return (
    <button type="button" aria-label={label} onClick={onClick} className={`rounded-lg border border-white/10 p-2 transition ${tones[tone]}`}>
      {children}
    </button>
  );
}

function GoogleAccountPanel({ session, status, compact = false, onLogout }) {
  const isConnected = status === "authenticated";
  const user = session?.user;

  return (
    <div className="rounded-lg border border-cyan-300/20 bg-gradient-to-br from-cyan-300/10 to-violet-400/10 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {user?.image ? (
            <img
              src={user.image}
              alt={`${user.name || "Google 사용자"} 프로필 이미지`}
              className="h-11 w-11 rounded-lg border border-white/10 object-cover"
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-slate-950/50 text-cyan-200">
              <User className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">
              {isConnected ? "Google 계정 연결됨" : "Google 계정 연결 필요"}
            </p>
            <p className="mt-1 truncate text-xs text-slate-400">
              {isConnected ? `${user?.name || "Google 사용자"} · ${user?.email || "이메일 없음"}` : "Calendar와 Drive 연동을 위한 로그인 기반을 준비합니다."}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => (isConnected ? onLogout?.() : signIn("google"))}
          className={`flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition ${
            isConnected
              ? "border border-white/10 bg-white/[0.045] text-slate-200 hover:border-rose-300/30 hover:bg-rose-400/10 hover:text-rose-100"
              : "bg-cyan-300 text-slate-950 hover:bg-cyan-200"
          } ${compact ? "sm:px-3 sm:py-2.5" : ""}`}
        >
          {isConnected ? <LogOut className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
          {isConnected ? "로그아웃" : "Google 계정 연결하기"}
        </button>
      </div>
    </div>
  );
}

function ViewTitle({ activeView }) {
  const titles = {
    Dashboard: "대시보드",
    Calendar: "캘린더",
    Drive: "드라이브",
    Notes: "메모",
    Tasks: "할 일",
    "AI Assistant": "AI 비서",
    "Quick Launch": "앱 바로가기",
    Settings: "설정",
  };

  const subtitles = {
    Dashboard: "캘린더, 드라이브, 메모, 할 일, AI를 한곳에서 관리하는 시작 화면입니다.",
    Calendar: "나중에 Google 캘린더 API를 연결하기 쉬운 목업 일정 화면입니다.",
    Drive: "나중에 Google 드라이브 데이터로 바꿀 수 있는 최근 파일과 폴더 화면입니다.",
    Notes: "개인 메모를 작성, 수정, 삭제하고 이 브라우저에 저장합니다.",
    Tasks: "할 일을 추가, 완료, 삭제하고 이 브라우저에 저장합니다.",
    "AI Assistant": "예시 명령어를 담은 채팅형 워크스페이스 AI 비서 화면입니다.",
    "Quick Launch": "자주 쓰는 외부 앱과 서비스를 한곳에서 빠르게 엽니다.",
    Settings: "프로필, 테마, Google 연결 상태를 확인하는 설정 화면입니다.",
  };

  return (
    <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300/80">L-Lee Workspace</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">{titles[activeView]}</h2>
        <p className="mt-1 text-sm text-slate-400">{subtitles[activeView]}</p>
      </div>
      <div className="rounded-lg border border-white/10 bg-white/[0.045] px-3 py-2 text-xs text-slate-400">
        {activeView === "Tasks" || activeView === "Notes" ? "로컬 저장됨" : "목업 데이터"}
      </div>
    </div>
  );
}

function MiniCalendar({ monthDays, markedDays, currentDay }) {
  const monthLabel = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div className="p-5">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-lg font-semibold text-white">{monthLabel}</p>
          <p className="text-xs text-slate-500">목업 캘린더 보기</p>
        </div>
        <span className="rounded-lg bg-cyan-300/10 px-3 py-1 text-xs text-cyan-200">오늘</span>
      </div>
      <div className="grid grid-cols-7 gap-2 text-center text-xs text-slate-500">
        {["일", "월", "화", "수", "목", "금", "토"].map((day, index) => (
          <span key={`${day}-${index}`}>{day}</span>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-7 gap-2">
        {monthDays.map((day) => (
          <button
            type="button"
            key={day}
            className={`relative flex aspect-square items-center justify-center rounded-lg text-sm transition ${
              day === currentDay
                ? "bg-gradient-to-br from-cyan-400 to-violet-500 text-white shadow-lg shadow-cyan-500/20"
                : "bg-white/[0.035] text-slate-300 hover:bg-white/10"
            }`}
          >
            {day}
            {markedDays.includes(day) && day !== currentDay && <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-cyan-300" />}
          </button>
        ))}
      </div>
    </div>
  );
}

function AgendaList({ events = agendaItems, compact = false, emptyMessage = "표시할 일정이 없습니다." }) {
  const visibleEvents = events.slice(0, compact ? 4 : events.length);

  if (visibleEvents.length === 0) {
    return <p className="p-5 text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3 p-5">
      {visibleEvents.map((item) => (
        <article key={item.id} className="flex items-center gap-4 rounded-lg border border-transparent p-3 transition hover:border-white/10 hover:bg-white/[0.05]">
          <div className={`h-12 w-1 rounded-full ${item.accent}`} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-100">{item.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
              <Clock3 className="h-3.5 w-3.5" />
              <span>{item.time} · {item.duration}</span>
              <span>{item.place}</span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-600" />
        </article>
      ))}
    </div>
  );
}

function getFileIcon(type) {
  if (type === "sheet") return FileSpreadsheet;
  if (type === "folder") return FolderOpen;
  if (type === "pdf" || type === "doc") return FileText;
  return File;
}

function DriveFileList({ files = driveFiles, detailed = false, emptyMessage = "표시할 파일이 없습니다.", onRequestDelete, deletingFileId }) {
  if (files.length === 0) {
    return <p className="p-5 text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3 p-5">
      {files.map((file) => {
        const Icon = getFileIcon(file.type);
        const content = (
          <>
            <div className="rounded-lg border border-white/10 bg-slate-900/80 p-3 text-cyan-300">
              {file.iconLink ? (
                <img src={file.iconLink} alt="" className="h-5 w-5" />
              ) : (
                <Icon className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-100">{file.name}</p>
              <p className="mt-1 text-xs text-slate-500">
                {file.updated}
                {detailed ? ` · ${file.owner} · ${file.size || file.mimeType || "파일"}` : ""}
              </p>
            </div>
            {file.link && <ExternalLink className="h-4 w-4 shrink-0 text-slate-600" />}
          </>
        );

        return (
          <article key={file.id} className="flex items-center gap-3 rounded-lg border border-transparent p-3 transition hover:border-white/10 hover:bg-white/[0.05]">
            {file.link ? (
              <a
                href={file.link}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 flex-1 items-center gap-4"
              >
                {content}
              </a>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-4">{content}</div>
            )}
            {onRequestDelete && (
              <IconButton
                label={`${file.name} Google Drive에서 삭제`}
                onClick={() => onRequestDelete(file)}
                tone="danger"
              >
                {deletingFileId === file.id ? <Clock3 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </IconButton>
            )}
          </article>
        );
      })}
    </div>
  );
}

function TaskList({ tasks, onToggle, onDelete, detailed = false }) {
  if (tasks.length === 0) {
    return <p className="p-5 text-sm text-slate-500">아직 할 일이 없습니다. 오늘을 정리할 첫 할 일을 추가해보세요.</p>;
  }

  return (
    <div className="space-y-2 p-5">
      {tasks.map((task) => (
        <div key={task.id} className="flex items-center gap-3 rounded-lg p-3 transition hover:bg-white/[0.05]">
          <button type="button" onClick={() => onToggle(task.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                task.completed ? "border-cyan-300 bg-cyan-300 text-slate-950" : "border-slate-600 text-transparent"
              }`}
            >
              <Check className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-sm ${task.completed ? "text-slate-500 line-through" : "text-slate-100"}`}>
                {task.title}
              </span>
              {detailed && <span className="mt-1 block text-xs text-slate-500">우선순위 {task.priority}</span>}
            </span>
          </button>
          {onDelete && (
            <IconButton label={`${task.title} 삭제`} onClick={() => onDelete(task.id)} tone="danger">
              <Trash2 className="h-4 w-4" />
            </IconButton>
          )}
        </div>
      ))}
    </div>
  );
}

function TaskComposer({ value, onChange, onAdd }) {
  return (
    <form onSubmit={onAdd} className="flex flex-col gap-3 border-b border-white/10 p-5 sm:flex-row">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="새 할 일을 입력하세요..."
        className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950/55 px-3 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
      />
      <button type="submit" className="flex items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-3 text-sm font-medium text-slate-950 transition hover:bg-cyan-200">
        <Plus className="h-4 w-4" />
        할 일 추가
      </button>
    </form>
  );
}

function CalendarStatusNotice({ status, calendarStatus }) {
  if (status !== "authenticated") {
    return (
      <div className="mx-5 mb-5 rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm text-cyan-50">
        Google 계정을 연결하면 캘린더 일정을 볼 수 있어요.
      </div>
    );
  }

  if (calendarStatus === "loading") {
    return <p className="px-5 pb-5 text-sm text-slate-500">Google Calendar 일정을 불러오는 중입니다...</p>;
  }

  if (calendarStatus === "fallback") {
    return (
      <div className="mx-5 mb-5 rounded-lg border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-50">
        Google Calendar 일정을 가져오지 못해 목업 일정을 표시하고 있어요.
      </div>
    );
  }

  return null;
}

function DriveStatusNotice({ status, driveStatus }) {
  if (status !== "authenticated") {
    return (
      <div className="mx-5 mb-5 rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm text-cyan-50">
        Google 계정을 연결하면 Drive 파일을 볼 수 있어요.
      </div>
    );
  }

  if (driveStatus === "loading") {
    return <p className="px-5 pb-5 text-sm text-slate-500">Google Drive 파일을 불러오는 중입니다...</p>;
  }

  if (driveStatus === "fallback") {
    return (
      <div className="mx-5 mb-5 rounded-lg border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-50">
        Drive 파일을 불러오지 못해 목업 데이터를 표시합니다.
      </div>
    );
  }

  return null;
}

function QuickLaunchGrid() {
  return (
    <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
      {quickLaunchApps.map((app) => {
        const Icon = app.icon;

        return (
          <a
            key={app.name}
            href={app.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex min-h-24 items-center gap-3 rounded-lg border border-white/10 bg-slate-950/35 p-4 transition hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-white/[0.08]"
          >
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${app.color}`}>
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-slate-100">{app.name}</span>
              <span className="mt-1 block truncate text-xs text-slate-500">{app.description}</span>
            </span>
            <ExternalLink className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-cyan-200" />
          </a>
        );
      })}
    </div>
  );
}

function QuickLaunchView() {
  return (
    <GlassCard>
      <CardHeader icon={Link} title="앱 바로가기" action={false} />
      <QuickLaunchGrid />
    </GlassCard>
  );
}

function SearchResultsPanel({ results, onSelect }) {
  return (
    <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-lg border border-white/10 bg-slate-950/95 shadow-2xl shadow-black/30 backdrop-blur-xl">
      {results.length > 0 ? (
        <div className="max-h-96 overflow-y-auto p-2">
          {results.map((result) => (
            <button
              key={result.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onSelect(result)}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-white/[0.07]"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-100">{result.title}</span>
                <span className="mt-1 block truncate text-xs text-slate-500">{result.helper}</span>
              </span>
              <span className="shrink-0 rounded-md bg-white/[0.06] px-2 py-1 text-[11px] text-slate-400">{result.type}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="p-4 text-sm text-slate-500">검색 결과가 없습니다.</p>
      )}
    </div>
  );
}

function NotificationPanel({ notifications, onSelect }) {
  return (
    <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-80 overflow-hidden rounded-lg border border-white/10 bg-slate-950/95 shadow-2xl shadow-black/30 backdrop-blur-xl">
      <div className="border-b border-white/10 px-4 py-3">
        <p className="text-sm font-semibold text-white">알림</p>
        <p className="mt-1 text-xs text-slate-500">워크스페이스 상태를 빠르게 확인합니다.</p>
      </div>
      <div className="max-h-96 overflow-y-auto p-2">
        {notifications.map((notification) => (
          <button
            key={notification.id}
            type="button"
            onClick={() => onSelect(notification)}
            className="flex w-full gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-white/[0.07]"
          >
            <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${notification.dot}`} />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-100">{notification.title}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">{notification.message}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function getGoogleIntegrationStatus({ isConnected, hasAccessToken, serviceStatus, serviceName }) {
  if (!isConnected) {
    return {
      value: "Google 계정 연결 필요",
      helper: `Google 계정을 연결하면 ${serviceName}를 사용할 수 있습니다.`,
    };
  }

  if (!hasAccessToken) {
    return {
      value: "다시 로그인 필요",
      helper: `${serviceName} 권한을 확인하려면 Google 계정으로 다시 로그인해주세요.`,
    };
  }

  if (serviceStatus === "reauth") {
    return {
      value: "다시 로그인 필요",
      helper: `${serviceName} API 권한이 만료되었을 수 있습니다. Google 계정으로 다시 로그인해주세요.`,
    };
  }

  if (serviceStatus === "fallback") {
    return {
      value: "권한 확인 필요",
      helper: `${serviceName} API 응답을 가져오지 못했습니다. 권한을 확인하거나 다시 로그인해주세요.`,
    };
  }

  if (serviceStatus === "loading") {
    return {
      value: "연결 확인 중",
      helper: `${serviceName} API 연결 상태를 확인하고 있습니다.`,
    };
  }

  return {
    value: `${serviceName} API 사용 가능`,
    helper: `${serviceName} 데이터를 워크스페이스에서 사용할 수 있습니다.`,
  };
}

function DashboardView({ tasks, notes, completedCount, toggleTask, monthDays, markedDays, currentDay, session, status, calendarEvents, calendarStatus, driveFilesData, driveStatus, storageMode, onLogout, onRequestDriveDelete, deletingDriveFileId, driveDeleteMessage, driveDeleteMessageType }) {
  const [scheduleRange, setScheduleRange] = useState("today");
  const [scheduleMenuOpen, setScheduleMenuOpen] = useState(false);
  const scheduleOptions = [
    { key: "today", label: "오늘의 일정" },
    { key: "week", label: "이번 주 일정" },
    { key: "month", label: "이번 달 일정" },
  ];
  const selectedSchedule = scheduleOptions.find((option) => option.key === scheduleRange) || scheduleOptions[0];
  const selectedScheduleEvents = getDashboardScheduleEvents(calendarEvents, scheduleRange);

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <GlassCard className="xl:col-span-12">
        <div className="p-5">
          <GoogleAccountPanel session={session} status={status} onLogout={onLogout} />
        </div>
      </GlassCard>

      <GlassCard className="xl:col-span-4 xl:row-span-2">
        <CardHeader
          icon={CalendarDays}
          title={selectedSchedule.label}
          actionContent={
            <div className="relative">
              <button
                type="button"
                aria-label="일정 범위 선택"
                onClick={() => setScheduleMenuOpen((isOpen) => !isOpen)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {scheduleMenuOpen && (
                <div className="absolute right-0 top-10 z-20 w-36 overflow-hidden rounded-lg border border-white/10 bg-slate-950/95 p-1 shadow-2xl shadow-black/30 backdrop-blur-xl">
                  {scheduleOptions.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => {
                        setScheduleRange(option.key);
                        setScheduleMenuOpen(false);
                      }}
                      className={`block w-full rounded-md px-3 py-2 text-left text-xs transition ${
                        scheduleRange === option.key ? "bg-cyan-300 text-slate-950" : "text-slate-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          }
        />
        <AgendaList
          events={selectedScheduleEvents}
          compact
          emptyMessage={getScheduleEmptyMessage(scheduleRange, status)}
        />
        <CalendarStatusNotice status={status} calendarStatus={calendarStatus} />
      </GlassCard>

      <GlassCard className="xl:col-span-4">
        <CardHeader icon={CalendarDays} title="미니 캘린더" action={false} />
        <MiniCalendar monthDays={monthDays} markedDays={markedDays} currentDay={currentDay} />
      </GlassCard>

      <GlassCard className="xl:col-span-4 xl:row-span-2">
        <CardHeader icon={FolderOpen} title="최근 Google 드라이브 파일" />
        <DriveFileList
          files={driveFilesData}
          emptyMessage={status === "authenticated" ? "최근 수정된 Google Drive 파일이 없습니다." : "Google 계정을 연결하면 Drive 파일을 볼 수 있어요."}
          onRequestDelete={onRequestDriveDelete}
          deletingFileId={deletingDriveFileId}
        />
        {driveDeleteMessage && (
          <p className={`px-5 pb-4 text-sm ${driveDeleteMessageType === "success" ? "text-emerald-200" : "text-rose-200"}`}>
            {driveDeleteMessage}
          </p>
        )}
        <DriveStatusNotice status={status} driveStatus={driveStatus} />
      </GlassCard>

      <GlassCard className="xl:col-span-4">
        <CardHeader icon={CheckSquare} title="오늘의 할 일" />
        <TaskList tasks={tasks.slice(0, 5)} onToggle={toggleTask} />
      </GlassCard>

      <GlassCard className="xl:col-span-4">
        <CardHeader icon={FileText} title="빠른 메모" />
        <div className="space-y-3 p-5">
          {notes.slice(0, 3).map((note) => (
            <article key={note.id} className="rounded-lg border border-white/10 bg-slate-950/35 p-3">
              <p className="text-sm font-medium text-slate-100">{note.title}</p>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-400">{note.body}</p>
            </article>
          ))}
          {notes.length === 0 && <p className="text-sm text-slate-500">아직 메모가 없습니다.</p>}
        </div>
      </GlassCard>

      <GlassCard className="xl:col-span-12">
        <SummaryGrid
          completedCount={completedCount}
          taskTotal={tasks.length}
          noteTotal={notes.length}
          todayEventTotal={calendarEvents.today.length}
          driveFileTotal={driveFilesData.length}
          storageMode={storageMode}
        />
      </GlassCard>
    </div>
  );
}

function CalendarCreateForm({ status, onCreated }) {
  const [draft, setDraft] = useState({
    title: "",
    date: "",
    startTime: "",
    endTime: "",
    description: "",
  });
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [message, setMessage] = useState("");

  function updateDraft(field, value) {
    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (status !== "authenticated") {
      setSubmitStatus("error");
      setMessage("Google 계정을 연결하면 일정을 추가할 수 있어요.");
      return;
    }

    setSubmitStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/calendar/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draft),
      });
      const { data, text } = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(getApiErrorMessage(response, data, text, "일정 추가에 실패했습니다."));
      }

      setSubmitStatus("success");
      setMessage(data?.message || "일정이 Google Calendar에 추가되었습니다.");
      setDraft({ title: "", date: "", startTime: "", endTime: "", description: "" });
      await onCreated();
    } catch (error) {
      setSubmitStatus("error");
      setMessage(getCalendarCreateErrorMessage(error));
    }
  }

  return (
    <GlassCard className="xl:col-span-12">
      <CardHeader icon={Plus} title="일정 추가" action={false} />
      <form onSubmit={handleSubmit} className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-5">
        <input
          value={draft.title}
          onChange={(event) => updateDraft("title", event.target.value)}
          placeholder="일정 제목"
          className="rounded-lg border border-white/10 bg-slate-950/55 px-3 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/50 xl:col-span-2"
        />
        <input
          type="date"
          value={draft.date}
          onChange={(event) => updateDraft("date", event.target.value)}
          className="rounded-lg border border-white/10 bg-slate-950/55 px-3 py-3 text-sm text-slate-100 outline-none focus:border-cyan-300/50"
        />
        <input
          type="time"
          value={draft.startTime}
          onChange={(event) => updateDraft("startTime", event.target.value)}
          className="rounded-lg border border-white/10 bg-slate-950/55 px-3 py-3 text-sm text-slate-100 outline-none focus:border-cyan-300/50"
        />
        <input
          type="time"
          value={draft.endTime}
          onChange={(event) => updateDraft("endTime", event.target.value)}
          className="rounded-lg border border-white/10 bg-slate-950/55 px-3 py-3 text-sm text-slate-100 outline-none focus:border-cyan-300/50"
        />
        <textarea
          value={draft.description}
          onChange={(event) => updateDraft("description", event.target.value)}
          placeholder="설명 또는 메모 (선택)"
          rows={3}
          className="workspace-scrollbar resize-none rounded-lg border border-white/10 bg-slate-950/55 px-3 py-3 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/50 md:col-span-2 xl:col-span-4"
        />
        <button
          type="submit"
          disabled={submitStatus === "loading"}
          className="flex items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-3 text-sm font-medium text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          {submitStatus === "loading" ? "추가 중..." : "일정 추가"}
        </button>
        {status !== "authenticated" && (
          <p className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-3 text-sm text-cyan-50 md:col-span-2 xl:col-span-5">
            Google 계정을 연결하면 일정을 추가할 수 있어요.
          </p>
        )}
        {message && (
          <p
            className={`rounded-lg border p-3 text-sm md:col-span-2 xl:col-span-5 ${
              submitStatus === "success"
                ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-50"
                : "border-rose-300/20 bg-rose-300/10 text-rose-50"
            }`}
          >
            {message}
          </p>
        )}
      </form>
    </GlassCard>
  );
}

function getDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLocalEventDate(event) {
  if (!event?.start) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(event.start)) {
    return new Date(`${event.start}T00:00:00`);
  }

  const date = new Date(event.start);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getEventDateKey(event) {
  const date = getLocalEventDate(event);
  if (!date) return "";
  return getDateInputValue(date);
}

function isSameLocalDay(date, target) {
  return date.getFullYear() === target.getFullYear() && date.getMonth() === target.getMonth() && date.getDate() === target.getDate();
}

function getLocalWeekRange(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function getDashboardScheduleEvents(calendarEvents, range) {
  const monthEvents = calendarEvents.month || [];
  const now = new Date();

  if (range === "today") {
    return monthEvents.filter((event) => {
      const eventDate = getLocalEventDate(event);
      return eventDate ? isSameLocalDay(eventDate, now) : false;
    });
  }

  if (range === "week") {
    const { start, end } = getLocalWeekRange(now);
    return monthEvents.filter((event) => {
      const eventDate = getLocalEventDate(event);
      return eventDate ? eventDate >= start && eventDate <= end : false;
    });
  }

  return monthEvents.filter((event) => {
    const eventDate = getLocalEventDate(event);
    return eventDate ? eventDate.getFullYear() === now.getFullYear() && eventDate.getMonth() === now.getMonth() : false;
  });
}

function getScheduleEmptyMessage(range, status) {
  if (status !== "authenticated") return "Google 계정을 연결하면 일정을 볼 수 있어요.";
  if (range === "week") return "이번 주 예정된 일정이 없습니다.";
  if (range === "month") return "이번 달 예정된 일정이 없습니다.";
  return "오늘 예정된 일정이 없습니다.";
}

function getCalendarMarkedDays(calendarEvents, visibleDate = new Date()) {
  const markedDays = new Set();
  const monthEvents = calendarEvents.month || [];

  monthEvents.forEach((event) => {
    const eventDate = getLocalEventDate(event);
    if (!eventDate) return;
    if (eventDate.getFullYear() === visibleDate.getFullYear() && eventDate.getMonth() === visibleDate.getMonth()) {
      markedDays.add(eventDate.getDate());
    }
  });

  return Array.from(markedDays);
}

function getCalendarScopeLabel(mode, selectedDate) {
  if (mode === "day") {
    return new Intl.DateTimeFormat("ko-KR", {
      month: "long",
      day: "numeric",
      weekday: "long",
    }).format(new Date(`${selectedDate}T00:00:00`));
  }

  if (mode === "month") return "이번달 일정";
  return "이번 주 일정";
}

function CalendarView({ monthDays, markedDays, currentDay, calendarEvents, calendarStatus, status, onCalendarCreated }) {
  const [scheduleMode, setScheduleMode] = useState("week");
  const [selectedDate, setSelectedDate] = useState(getDateInputValue());
  const monthEvents = calendarEvents.month || calendarEvents.week || [];
  const selectedEvents =
    scheduleMode === "day"
      ? monthEvents.filter((event) => getEventDateKey(event) === selectedDate)
      : scheduleMode === "month"
        ? monthEvents
        : calendarEvents.week || [];
  const scheduleTitle = getCalendarScopeLabel(scheduleMode, selectedDate);
  const emptyMessage =
    status === "authenticated"
      ? `${scheduleTitle}에 표시할 Google Calendar 일정이 없습니다.`
      : "Google 계정을 연결하면 일정을 볼 수 있어요.";

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <CalendarCreateForm status={status} onCreated={onCalendarCreated} />
      <GlassCard className="xl:col-span-7">
        <CardHeader icon={CalendarDays} title="캘린더 개요" action={false} />
        <MiniCalendar monthDays={monthDays} markedDays={markedDays} currentDay={currentDay} />
      </GlassCard>
      <GlassCard className="xl:col-span-5">
        <CardHeader icon={Clock3} title={scheduleTitle} action={false} />
        <div className="space-y-3 border-b border-white/[0.06] p-5">
          <div className="grid grid-cols-3 gap-2 rounded-lg border border-white/10 bg-slate-950/35 p-1">
            {[
              ["day", "요일 일정"],
              ["week", "이번주 일정"],
              ["month", "이번달 일정"],
            ].map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setScheduleMode(mode)}
                className={`rounded-md px-3 py-2 text-xs font-medium transition ${
                  scheduleMode === mode
                    ? "bg-cyan-300 text-slate-950"
                    : "text-slate-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {scheduleMode === "day" && (
            <label className="block">
              <span className="mb-2 block text-xs text-slate-500">확인할 날짜</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-950/55 px-3 py-3 text-sm text-slate-100 outline-none focus:border-cyan-300/50"
              />
            </label>
          )}
        </div>
        <AgendaList
          events={selectedEvents}
          emptyMessage={emptyMessage}
        />
        <CalendarStatusNotice status={status} calendarStatus={calendarStatus} />
      </GlassCard>
      <GlassCard className="xl:col-span-12">
        <div className="grid gap-4 p-5 md:grid-cols-3">
          {["집중 시간", "회의", "개인 회고"].map((label, index) => (
            <div key={label} className="rounded-lg border border-white/10 bg-slate-950/35 p-4">
              <p className="text-sm font-medium text-white">{label}</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">목업 캘린더 영역 {index + 1}입니다. 나중에 Google 캘린더 일정을 이곳에 연결할 수 있습니다.</p>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

function DriveView({ files, driveStatus, status, onRequestDelete, deletingFileId, deleteMessage, deleteMessageType }) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <GlassCard className="xl:col-span-8">
        <CardHeader icon={HardDrive} title="최근 파일" />
        <DriveFileList
          files={files}
          detailed
          emptyMessage={status === "authenticated" ? "최근 수정된 Google Drive 파일이 없습니다." : "Google 계정을 연결하면 Drive 파일을 볼 수 있어요."}
          onRequestDelete={onRequestDelete}
          deletingFileId={deletingFileId}
        />
        {deleteMessage && (
          <p className={`px-5 pb-4 text-sm ${deleteMessageType === "success" ? "text-emerald-200" : "text-rose-200"}`}>
            {deleteMessage}
          </p>
        )}
        <DriveStatusNotice status={status} driveStatus={driveStatus} />
      </GlassCard>
      <GlassCard className="xl:col-span-4">
        <CardHeader icon={Cloud} title="저장공간 요약" action={false} />
        <div className="p-5">
          <div className="rounded-lg border border-white/10 bg-slate-950/35 p-4">
            <p className="text-3xl font-semibold text-white">18.4 GB</p>
            <p className="mt-1 text-xs text-slate-500">목업 100GB 중 사용</p>
            <div className="mt-4 h-2 rounded-full bg-slate-800">
              <div className="h-2 w-[18%] rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" />
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {["프로젝트 문서", "메모 아카이브", "디자인 참고 자료"].map((folder) => (
              <div key={folder} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-3">
                <FolderOpen className="h-4 w-4 text-cyan-300" />
                <span className="text-sm text-slate-200">{folder}</span>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

function NotesView({ notes, noteDraft, setNoteDraft, editingNoteId, setEditingNoteId, onSaveNote, onDeleteNote }) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <GlassCard className="xl:col-span-4">
        <CardHeader icon={FileText} title={editingNoteId ? "메모 수정" : "새 메모"} action={false} />
        <form onSubmit={onSaveNote} className="space-y-3 p-5">
          <input
            value={noteDraft.title}
            onChange={(event) => setNoteDraft((draft) => ({ ...draft, title: event.target.value }))}
            placeholder="메모 제목"
            className="w-full rounded-lg border border-white/10 bg-slate-950/55 px-3 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
          />
          <input
            value={noteDraft.tag}
            onChange={(event) => setNoteDraft((draft) => ({ ...draft, tag: event.target.value }))}
            placeholder="태그"
            className="w-full rounded-lg border border-white/10 bg-slate-950/55 px-3 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
          />
          <textarea
            value={noteDraft.body}
            onChange={(event) => setNoteDraft((draft) => ({ ...draft, body: event.target.value }))}
            placeholder="메모를 작성하세요..."
            rows={8}
            className="workspace-scrollbar w-full resize-none rounded-lg border border-white/10 bg-slate-950/55 px-3 py-3 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
          />
          <div className="flex gap-2">
            <button type="submit" className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-3 text-sm font-medium text-slate-950 transition hover:bg-cyan-200">
              <Plus className="h-4 w-4" />
              {editingNoteId ? "메모 저장" : "메모 추가"}
            </button>
            {editingNoteId && (
              <button
                type="button"
                onClick={() => {
                  setEditingNoteId(null);
                  setNoteDraft({ title: "", body: "", tag: "개인" });
                }}
                className="rounded-lg border border-white/10 px-4 text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </form>
      </GlassCard>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:col-span-8">
        {notes.map((note) => (
          <GlassCard key={note.id}>
            <div className="flex h-full flex-col p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="truncate rounded-lg bg-violet-300/10 px-3 py-1 text-xs text-violet-200">{note.tag || "개인"}</span>
                <div className="flex gap-2">
                  <IconButton
                    label={`${note.title} 수정`}
                    onClick={() => {
                      setEditingNoteId(note.id);
                      setNoteDraft({ title: note.title, body: note.body, tag: note.tag || "개인" });
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </IconButton>
                  <IconButton label={`${note.title} 삭제`} onClick={() => onDeleteNote(note.id)} tone="danger">
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
              <h3 className="text-base font-semibold text-white">{note.title}</h3>
              <p className="mt-3 flex-1 whitespace-pre-wrap text-sm leading-6 text-slate-400">{note.body}</p>
            </div>
          </GlassCard>
        ))}
        {notes.length === 0 && (
          <GlassCard className="md:col-span-2">
            <p className="p-5 text-sm text-slate-500">아직 메모가 없습니다. 왼쪽 작성 영역에서 첫 메모를 남겨보세요.</p>
          </GlassCard>
        )}
      </div>
    </div>
  );
}

function TasksView({ tasks, taskInput, setTaskInput, addTask, toggleTask, deleteTask, completedCount }) {
  const progressWidth = tasks.length ? `${(completedCount / tasks.length) * 100}%` : "0%";

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <GlassCard className="xl:col-span-8">
        <CardHeader icon={CheckSquare} title="할 일 목록" />
        <TaskComposer value={taskInput} onChange={setTaskInput} onAdd={addTask} />
        <TaskList tasks={tasks} onToggle={toggleTask} onDelete={deleteTask} detailed />
      </GlassCard>
      <GlassCard className="xl:col-span-4">
        <CardHeader icon={Shield} title="할 일 진행률" action={false} />
        <div className="p-5">
          <p className="text-4xl font-semibold text-white">{completedCount}/{tasks.length}</p>
          <p className="mt-2 text-sm text-slate-500">오늘 완료됨</p>
          <div className="mt-5 h-2 rounded-full bg-slate-800">
            <div className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" style={{ width: progressWidth }} />
          </div>
          <div className="mt-5 space-y-3">
            {["새 할 일 추가", "완료한 작업 확인", "오래된 항목 삭제"].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-slate-400">
                <Circle className="h-3 w-3 fill-cyan-300/30 text-cyan-300" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

function AssistantCard({ assistantInput, setAssistantInput, compact = false }) {
  return (
    <>
      <CardHeader icon={Sparkles} title="AI 비서" action={false} />
      <div className="p-5">
        <div className="rounded-lg border border-cyan-300/20 bg-gradient-to-br from-cyan-300/10 to-violet-400/10 p-4">
          <p className="text-sm text-slate-300">L-Lee AI에게 워크스페이스 정리, 요약, 초안 작성을 요청해보세요.</p>
          <div className="mt-4 flex gap-2">
            <input
              value={assistantInput}
              onChange={(event) => setAssistantInput(event.target.value)}
              placeholder="오늘 무엇을 정리할까요?"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-violet-300/50"
            />
            <button type="button" aria-label="AI 비서에게 보내기" className="rounded-lg bg-cyan-300 px-4 text-slate-950 transition hover:bg-cyan-200">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {aiSuggestions.slice(0, compact ? 3 : aiSuggestions.length).map((suggestion) => (
            <button key={suggestion} type="button" onClick={() => setAssistantInput(suggestion)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 transition hover:bg-white/[0.06] hover:text-white">
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function MiniAssistantBox({ status, calendarEvents, driveFilesData, onCalendarCreated, onTaskCreated, onNoteCreated, onOpenFullAssistant }) {
  const [miniInput, setMiniInput] = useState("");
  const [miniStatus, setMiniStatus] = useState("idle");
  const [miniMessage, setMiniMessage] = useState("간단한 명령을 바로 실행해요.");

  async function submitMiniAssistant(event) {
    event.preventDefault();
    const command = miniInput.trim();
    if (!command || miniStatus === "loading") return;

    setMiniStatus("loading");
    setMiniMessage("처리 중이에요...");

    try {
      const result = await executeWorkspaceAiCommand(
        command,
        {
          status,
          calendarEvents,
          driveFilesData,
          onCalendarCreated,
          onTaskCreated,
          onNoteCreated,
        },
        { confirmCalendar: false },
      );
      setMiniMessage(result.message || "처리했어요.");
      setMiniInput("");
    } catch (error) {
      setMiniMessage(getCalendarCreateErrorMessage(error));
    } finally {
      setMiniStatus("idle");
    }
  }

  return (
    <div className="rounded-lg border border-cyan-300/15 bg-gradient-to-br from-cyan-300/10 to-violet-400/10 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan-300" />
          <p className="text-xs font-semibold text-slate-100">미니 AI 비서</p>
        </div>
        <button
          type="button"
          onClick={onOpenFullAssistant}
          className="rounded-md px-2 py-1 text-[11px] text-cyan-200 transition hover:bg-white/10 hover:text-white"
        >
          전체
        </button>
      </div>
      <p className="mt-2 line-clamp-3 rounded-lg border border-white/10 bg-slate-950/35 p-2 text-[11px] leading-5 text-slate-300">
        {miniMessage}
      </p>
      <form onSubmit={submitMiniAssistant} className="mt-3 flex gap-2">
        <input
          value={miniInput}
          onChange={(event) => setMiniInput(event.target.value)}
          placeholder="AI에게 바로 요청..."
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950/55 px-3 py-2 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
        />
        <button
          type="submit"
          disabled={!miniInput.trim() || miniStatus === "loading"}
          aria-label="미니 AI 전송"
          className="rounded-lg bg-cyan-300 px-3 text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {miniStatus === "loading" ? <Clock3 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}

function EdgeMiniAssistant({ status, calendarEvents, driveFilesData, onCalendarCreated, onTaskCreated, onNoteCreated, onOpenFullAssistant }) {
  return (
    <div className="group fixed bottom-8 right-0 z-40 hidden h-80 w-[340px] translate-x-[300px] transition-transform duration-300 ease-out hover:translate-x-0 focus-within:translate-x-0 lg:block">
      <div className="absolute left-0 top-1/2 flex -translate-x-full -translate-y-1/2 items-center gap-2 rounded-l-lg border border-r-0 border-cyan-300/20 bg-slate-950/90 px-2 py-3 text-cyan-200 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <Sparkles className="h-4 w-4" />
        <span className="text-[11px] font-semibold tracking-[0.14em] [writing-mode:vertical-rl]">AI</span>
      </div>
      <div className="h-full rounded-l-xl border border-r-0 border-cyan-300/20 bg-slate-950/90 p-4 shadow-2xl shadow-black/40 backdrop-blur-2xl">
        <MiniAssistantBox
          status={status}
          calendarEvents={calendarEvents}
          driveFilesData={driveFilesData}
          onCalendarCreated={onCalendarCreated}
          onTaskCreated={onTaskCreated}
          onNoteCreated={onNoteCreated}
          onOpenFullAssistant={onOpenFullAssistant}
        />
        <p className="mt-3 text-[11px] leading-5 text-slate-500">오른쪽 라인에 마우스를 올리면 열리고, 벗어나면 접혀요.</p>
      </div>
    </div>
  );
}

function AssistantView({ assistantInput, setAssistantInput, status, calendarEvents, driveFilesData, onCalendarCreated, onTaskCreated, onNoteCreated }) {
  const [chatMessages, setChatMessages] = useState(aiMessages);
  const [pendingEvent, setPendingEvent] = useState(null);
  const [assistantStatus, setAssistantStatus] = useState("idle");

  function addChatMessage(role, text) {
    setChatMessages((messages) => [...messages, { id: Date.now() + Math.random(), role, text }]);
  }

  async function runAssistantCommand(rawInput) {
    const input = assistantInput.trim();
    const command = rawInput?.trim() || input;
    if (!command) return;

    addChatMessage("user", command);
    setAssistantInput("");
    setPendingEvent(null);
    setAssistantStatus("loading");

    try {
      const result = await executeWorkspaceAiCommand(
        command,
        {
          status,
          calendarEvents,
          driveFilesData,
          onCalendarCreated,
          onTaskCreated,
          onNoteCreated,
        },
        { confirmCalendar: true },
      );
      if (result.pendingEvent) setPendingEvent(result.pendingEvent);
      addChatMessage("assistant", result.message);
    } catch (error) {
      setPendingEvent(null);
      addChatMessage("assistant", "일정 요청을 분석하지 못했어요. 예: 내일 오후 6시에 회의 예약해줘");
    } finally {
      setAssistantStatus("idle");
    }
  }

  async function handleAssistantSubmit(event) {
    event.preventDefault();
    await runAssistantCommand();
  }

  async function confirmCalendarEvent() {
    if (!pendingEvent) return;
    setAssistantStatus("loading");

    try {
      const response = await fetch("/api/calendar/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: pendingEvent.title,
          date: pendingEvent.date,
          startTime: pendingEvent.startTime,
          endTime: pendingEvent.endTime,
          description: pendingEvent.description,
        }),
      });
      const { data, text } = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(getApiErrorMessage(response, data, text, "일정 추가에 실패했습니다."));
      }

      addChatMessage("assistant", data?.message || "일정이 Google Calendar에 추가되었습니다.");
      setPendingEvent(null);
      await onCalendarCreated();
    } catch (error) {
      addChatMessage("assistant", getCalendarCreateErrorMessage(error));
    } finally {
      setAssistantStatus("idle");
    }
  }

  function cancelCalendarEvent() {
    setPendingEvent(null);
    addChatMessage("assistant", "일정 추가를 취소했어요.");
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <GlassCard className="xl:col-span-8">
        <CardHeader icon={MessageSquare} title="워크스페이스 채팅" action={false} />
        <div className="space-y-4 p-5">
          {chatMessages.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-lg border px-4 py-3 text-sm leading-6 ${message.role === "user" ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-50" : "border-white/10 bg-slate-950/45 text-slate-300"}`}>
                {message.text}
              </div>
            </div>
          ))}
          {pendingEvent && (
            <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4">
              <p className="text-sm font-semibold text-white">일정 추가 확인</p>
              <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                <p>제목: {pendingEvent.title}</p>
                <p>날짜: {pendingEvent.displayDate}</p>
                <p>시작: {pendingEvent.startTime}</p>
                <p>종료: {pendingEvent.endTime}</p>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">{pendingEvent.originalText}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={confirmCalendarEvent}
                  disabled={assistantStatus === "loading"}
                  className="rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {assistantStatus === "loading" ? "추가 중..." : "확인"}
                </button>
                <button
                  type="button"
                  onClick={cancelCalendarEvent}
                  disabled={assistantStatus === "loading"}
                  className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  취소
                </button>
              </div>
            </div>
          )}
          <form onSubmit={handleAssistantSubmit} className="flex gap-2 border-t border-white/10 pt-4">
            <input
              value={assistantInput}
              onChange={(event) => setAssistantInput(event.target.value)}
              placeholder="예: 내일 오후 6시에 회의 예약해줘"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
            />
            <button type="submit" className="rounded-lg bg-cyan-300 px-4 text-slate-950 transition hover:bg-cyan-200">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </GlassCard>
      <GlassCard className="xl:col-span-4">
        <CardHeader icon={Sparkles} title="예시 명령어" action={false} />
        <div className="space-y-3 p-5">
          {aiSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => runAssistantCommand(suggestion)}
              disabled={assistantStatus === "loading"}
              className="w-full rounded-lg border border-white/10 bg-white/[0.035] p-4 text-left text-sm text-slate-300 transition hover:border-cyan-300/30 hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

function SettingsView({ session, status, onLogout, themeMode, onThemeChange, calendarStatus, driveStatus }) {
  const isConnected = status === "authenticated";
  const hasAccessToken = Boolean(session?.accessToken);
  const user = session?.user;
  const selectedTheme = themeOptions.find((theme) => theme.key === themeMode) || themeOptions[0];
  const calendarIntegration = getGoogleIntegrationStatus({
    isConnected,
    hasAccessToken,
    serviceStatus: calendarStatus,
    serviceName: "캘린더",
  });
  const driveIntegration = getGoogleIntegrationStatus({
    isConnected,
    hasAccessToken,
    serviceStatus: driveStatus,
    serviceName: "드라이브",
  });

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
      <GlassCard className="md:col-span-2 xl:col-span-4">
        <div className="p-5">
          <CardHeader icon={Link} title="Google 계정 연결" action={false} />
          <div className="pt-5">
            <GoogleAccountPanel session={session} status={status} onLogout={onLogout} />
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="p-5">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
            {user?.image ? (
              <img src={user.image} alt="" className="h-9 w-9 rounded-md object-cover" />
            ) : (
              <User className="h-5 w-5" />
            )}
          </div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">프로필</p>
          <h3 className="mt-2 text-lg font-semibold text-white">{user?.name || "방문자"}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">{user?.email || "Google 계정을 연결하면 이메일이 표시됩니다."}</p>
        </div>
      </GlassCard>

      <GlassCard className="md:col-span-1 xl:col-span-2">
        <div className="p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
              <Palette className="h-5 w-5" />
            </div>
            <span className="rounded-lg border border-white/10 bg-white/[0.045] px-3 py-1 text-xs text-slate-400">{selectedTheme.name}</span>
          </div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">테마</p>
          <h3 className="mt-2 text-lg font-semibold text-white">테마 모드</h3>
          <div className="mt-4 grid gap-2">
            {themeOptions.map((theme) => {
              const Icon = theme.icon;
              const isActive = themeMode === theme.key;
              return (
                <button
                  key={theme.key}
                  type="button"
                  onClick={() => onThemeChange(theme.key)}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-left transition ${
                    isActive
                      ? "border-cyan-300/40 bg-cyan-300/10 text-white"
                      : "border-white/10 bg-slate-950/30 text-slate-300 hover:border-cyan-300/25 hover:bg-white/[0.06]"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0 text-cyan-200" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{theme.name}</span>
                    <span className="mt-1 block text-xs text-slate-500">{theme.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="p-5">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
            <CalendarDays className="h-5 w-5" />
          </div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Google 캘린더</p>
          <h3 className="mt-2 text-lg font-semibold text-white">{calendarIntegration.value}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">{calendarIntegration.helper}</p>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="p-5">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
            <Cloud className="h-5 w-5" />
          </div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Google 드라이브</p>
          <h3 className="mt-2 text-lg font-semibold text-white">{driveIntegration.value}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">{driveIntegration.helper}</p>
        </div>
      </GlassCard>
      <GlassCard className="md:col-span-2 xl:col-span-4">
        <div className="grid gap-4 p-5 md:grid-cols-3">
          {[
            { label: "테마 모드", value: selectedTheme.name, icon: selectedTheme.icon },
            { label: "캘린더 연결", value: calendarIntegration.value, icon: Link },
            { label: "드라이브 연결", value: driveIntegration.value, icon: HardDrive },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-lg border border-white/10 bg-slate-950/35 p-4">
                <Icon className="h-5 w-5 text-violet-300" />
                <p className="mt-4 text-sm font-medium text-white">{item.label}</p>
                <p className="mt-1 text-xs text-slate-500">{item.value}</p>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}

function SummaryGrid({ completedCount, taskTotal, noteTotal, todayEventTotal, driveFileTotal, storageMode }) {
  const workspaceDataLabel = storageMode === "supabase" ? "계정 기준 동기화 데이터" : "임시 로컬 데이터";

  return (
    <div className="grid gap-4 p-5 md:grid-cols-4">
      {[
        ["완료한 할 일", `${completedCount}/${taskTotal}`, workspaceDataLabel],
        ["메모", String(noteTotal), workspaceDataLabel],
        ["오늘 일정", String(todayEventTotal), "Google Calendar 데이터"],
        ["최근 파일", String(driveFileTotal), "드라이브 파일 메타데이터"],
      ].map(([label, value, helper]) => (
        <div key={label} className="rounded-lg border border-white/10 bg-slate-950/35 p-4">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{helper}</p>
        </div>
      ))}
    </div>
  );
}

function WorkspaceStorageNotice({ mode, status }) {
  if (status !== "authenticated" || mode !== "local") return null;

  return (
    <div className="mb-5 rounded-lg border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-50">
      임시 로컬 데이터로 표시 중입니다. Google 계정과 Supabase 연결이 정상화되면 계정 기준 데이터로 다시 동기화됩니다.
    </div>
  );
}

function getTimeBasedGreeting(hour) {
  if (hour >= 5 && hour < 12) return "좋은 아침이에요";
  if (hour >= 12 && hour < 18) return "좋은 점심이에요";
  if (hour >= 18 && hour < 23) return "좋은 저녁이에요";
  return "좋은 밤이에요";
}

export default function Home() {
  const { data: session, status } = useSession();
  const [activeView, setActiveView] = useState("Dashboard");
  const [tasks, setTasks] = useState(initialTasks);
  const [notes, setNotes] = useState(initialNotes);
  const [taskInput, setTaskInput] = useState("");
  const [noteDraft, setNoteDraft] = useState({ title: "", body: "", tag: "개인" });
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [assistantInput, setAssistantInput] = useState("");
  const [themeMode, setThemeMode] = useState("dark-glass");
  const [storageReady, setStorageReady] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState({ today: [], week: [], month: [], lookup: [] });
  const [calendarStatus, setCalendarStatus] = useState("idle");
  const [driveFilesData, setDriveFilesData] = useState([]);
  const [driveStatus, setDriveStatus] = useState("idle");
  const [driveFileToDelete, setDriveFileToDelete] = useState(null);
  const [deletingDriveFileId, setDeletingDriveFileId] = useState(null);
  const [driveDeleteMessage, setDriveDeleteMessage] = useState("");
  const [driveDeleteMessageType, setDriveDeleteMessageType] = useState("error");
  const [workspaceStorageMode, setWorkspaceStorageMode] = useState("local");
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());
  const userEmail = session?.user?.email || null;

  useEffect(() => {
    const updateCurrentHour = () => setCurrentHour(new Date().getHours());
    updateCurrentHour();
    const intervalId = window.setInterval(updateCurrentHour, 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_KEY);
    if (themeOptions.some((theme) => theme.key === storedTheme)) {
      setThemeMode(storedTheme);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(THEME_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (status === "loading") return;

    let isActive = true;

    async function loadWorkspaceData() {
      const localWorkspace = getLocalWorkspaceData();

      if (!userEmail) {
        if (!isActive) return;
        setTasks(localWorkspace.tasks);
        setNotes(localWorkspace.notes);
        setWorkspaceStorageMode("local");
        setStorageReady(true);
        return;
      }

      try {
        let [remoteTasks, remoteNotes] = await Promise.all([
          fetchTasksFromSupabase(userEmail),
          fetchNotesFromSupabase(userEmail),
        ]);

        const tasksToSync = localWorkspace.pendingTasks.filter((task) => !hasMatchingTask(remoteTasks, task));
        const notesToSync = localWorkspace.pendingNotes.filter((note) => !hasMatchingNote(remoteNotes, note));

        if (tasksToSync.length || notesToSync.length) {
          await Promise.all([
            ...tasksToSync.map((task) => createTaskInSupabase(userEmail, task)),
            ...notesToSync.map((note) => createNoteInSupabase(userEmail, note)),
          ]);
          [remoteTasks, remoteNotes] = await Promise.all([
            fetchTasksFromSupabase(userEmail),
            fetchNotesFromSupabase(userEmail),
          ]);
        }

        if (!isActive) return;
        setTasks(remoteTasks);
        setNotes(remoteNotes);
        setWorkspaceStorageMode("supabase");
        window.localStorage.removeItem(TASKS_KEY);
        window.localStorage.removeItem(NOTES_KEY);
      } catch (error) {
        console.warn("Supabase workspace load failed, using localStorage fallback:", error);
        if (!isActive) return;
        setTasks(localWorkspace.tasks);
        setNotes(localWorkspace.notes);
        setWorkspaceStorageMode("local");
      } finally {
        if (isActive) setStorageReady(true);
      }
    }

    setStorageReady(false);
    loadWorkspaceData();

    return () => {
      isActive = false;
    };
  }, [status, userEmail]);

  useEffect(() => {
    if (storageReady && workspaceStorageMode === "local") {
      window.localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    }
  }, [storageReady, tasks, workspaceStorageMode]);

  useEffect(() => {
    if (storageReady && workspaceStorageMode === "local") {
      window.localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    }
  }, [storageReady, notes, workspaceStorageMode]);

  function loadCachedCalendarEvents() {
    const cachedEvents = loadStoredItems(CALENDAR_EVENTS_KEY, { today: [], week: [], month: [], lookup: [] });
    return {
      today: cachedEvents.today || [],
      week: cachedEvents.week || [],
      month: cachedEvents.month || cachedEvents.week || [],
      lookup: cachedEvents.lookup || cachedEvents.month || cachedEvents.week || [],
    };
  }

  function loadCachedDriveFiles() {
    return loadStoredItems(DRIVE_FILES_KEY, []);
  }

  async function loadCalendarEvents(signal) {
    setCalendarStatus("loading");

    try {
      const response = await fetch("/api/calendar/events", {
        signal,
        cache: "no-store",
      });

      if (response.status === 401) {
        const cachedEvents = loadCachedCalendarEvents();
        setCalendarEvents(cachedEvents);
        setCalendarStatus("reauth");
        return;
      }

      const { data, text } = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(getApiErrorMessage(response, data, text, "Calendar API request failed"));
      }

      const nextCalendarEvents = {
        today: data?.today || [],
        week: data?.week || [],
        month: data?.month || data?.week || [],
        lookup: data?.lookup || data?.month || data?.week || [],
      };
      setCalendarEvents(nextCalendarEvents);
      window.localStorage.setItem(CALENDAR_EVENTS_KEY, JSON.stringify(nextCalendarEvents));
      setCalendarStatus("ready");
    } catch (error) {
      if (error.name === "AbortError") return;
      const cachedEvents = loadCachedCalendarEvents();
      if (cachedEvents.today.length || cachedEvents.week.length || cachedEvents.month.length) {
        setCalendarEvents(cachedEvents);
        setCalendarStatus("ready");
      } else if (status === "authenticated") {
        setCalendarEvents({ today: [], week: [], month: [], lookup: [] });
        setCalendarStatus("fallback");
      } else {
        setCalendarEvents({ today: agendaItems, week: agendaItems, month: agendaItems, lookup: agendaItems });
        setCalendarStatus("fallback");
      }
    }
  }

  useEffect(() => {
    if (status === "loading") return;

    if (status !== "authenticated") {
      const cachedEvents = loadCachedCalendarEvents();
      setCalendarEvents(cachedEvents);
      setCalendarStatus(cachedEvents.today.length || cachedEvents.week.length || cachedEvents.month.length ? "ready" : "idle");
      return;
    }

    const controller = new AbortController();
    loadCalendarEvents(controller.signal);

    return () => controller.abort();
  }, [status]);

  useEffect(() => {
    if (status === "loading") return;

    if (status !== "authenticated") {
      const cachedFiles = loadCachedDriveFiles();
      setDriveFilesData(cachedFiles);
      setDriveStatus(cachedFiles.length ? "ready" : "idle");
      return;
    }

    const controller = new AbortController();

    async function loadDriveFiles() {
      setDriveStatus("loading");

      try {
        const response = await fetch("/api/drive/files", {
          signal: controller.signal,
          cache: "no-store",
        });

        if (response.status === 401) {
          const cachedFiles = loadCachedDriveFiles();
          setDriveFilesData(cachedFiles);
          setDriveStatus("reauth");
          return;
        }

        const { data, text } = await readApiResponse(response);

        if (!response.ok) {
          throw new Error(getApiErrorMessage(response, data, text, "Drive API request failed"));
        }

        const nextDriveFiles = data?.files || [];
        setDriveFilesData(nextDriveFiles);
        window.localStorage.setItem(DRIVE_FILES_KEY, JSON.stringify(nextDriveFiles));
        setDriveStatus("ready");
      } catch (error) {
        if (error.name === "AbortError") return;
        const cachedFiles = loadCachedDriveFiles();
        if (cachedFiles.length) {
          setDriveFilesData(cachedFiles);
          setDriveStatus("ready");
        } else {
          setDriveFilesData(driveFiles);
          setDriveStatus("fallback");
        }
      }
    }

    loadDriveFiles();

    return () => controller.abort();
  }, [status]);

  const todayLabel = useMemo(() => {
    return new Intl.DateTimeFormat("ko-KR", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date());
  }, []);

  const completedCount = tasks.filter((task) => task.completed).length;
  const signedInUser = session?.user;
  const displayName = signedInUser?.name || "주언";
  const greetingText = getTimeBasedGreeting(currentHour);
  const currentMonthLength = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const monthDays = Array.from({ length: currentMonthLength }, (_, index) => index + 1);
  const currentDay = new Date().getDate();
  const markedDays = useMemo(() => getCalendarMarkedDays(calendarEvents), [calendarEvents]);
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];

    const items = [
      ...sidebarItems.map((item) => ({
        id: `view-${item.key}`,
        title: item.label,
        helper: "워크스페이스 화면으로 이동",
        type: "화면",
        view: item.key,
        searchText: `${item.label} ${item.key}`,
      })),
      ...quickLaunchApps.map((app) => ({
        id: `app-${app.name}`,
        title: app.name,
        helper: app.description,
        type: "바로가기",
        href: app.href,
        searchText: `${app.name} ${app.description}`,
      })),
      ...tasks.map((task) => ({
        id: `task-${task.id}`,
        title: task.title,
        helper: task.completed ? "완료된 할 일" : "진행 중인 할 일",
        type: "할 일",
        view: "Tasks",
        searchText: `${task.title} ${task.priority || ""}`,
      })),
      ...notes.map((note) => ({
        id: `note-${note.id}`,
        title: note.title,
        helper: note.body,
        type: "메모",
        view: "Notes",
        searchText: `${note.title} ${note.body} ${note.tag || ""}`,
      })),
      ...calendarEvents.week.map((event) => ({
        id: `event-${event.id}`,
        title: event.title,
        helper: `${event.time || ""} ${event.place || ""}`,
        type: "일정",
        view: "Calendar",
        href: event.htmlLink,
        searchText: `${event.title} ${event.time || ""} ${event.place || ""}`,
      })),
      ...driveFilesData.map((file) => ({
        id: `drive-${file.id}`,
        title: file.name,
        helper: `${file.owner || "Google Drive"} · ${file.updated || ""}`,
        type: "파일",
        view: "Drive",
        href: file.link,
        searchText: `${file.name} ${file.owner || ""} ${file.mimeType || ""}`,
      })),
    ];

    return items.filter((item) => item.searchText.toLowerCase().includes(query)).slice(0, 8);
  }, [calendarEvents.week, driveFilesData, notes, searchQuery, tasks]);

  const notifications = useMemo(() => {
    const remainingTasks = tasks.filter((task) => !task.completed).length;
    const todayEvents = calendarEvents.today.length;
    const recentFiles = driveFilesData.length;

    return [
      {
        id: "calendar",
        title: todayEvents > 0 ? `오늘 일정 ${todayEvents}개` : "오늘 예정된 일정 없음",
        message:
          status === "authenticated"
            ? calendarStatus === "fallback"
              ? "Calendar 일정을 가져오지 못해 fallback 데이터를 표시 중입니다."
              : "Google Calendar 상태를 확인했습니다."
            : "Google 계정을 연결하면 오늘 일정을 볼 수 있습니다.",
        dot: calendarStatus === "fallback" ? "bg-amber-300" : "bg-cyan-300",
        view: "Calendar",
      },
      {
        id: "tasks",
        title: `남은 할 일 ${remainingTasks}개`,
        message: remainingTasks > 0 ? "처리할 작업이 남아 있습니다." : "모든 할 일을 완료했습니다.",
        dot: remainingTasks > 0 ? "bg-violet-300" : "bg-emerald-300",
        view: "Tasks",
      },
      {
        id: "drive",
        title: recentFiles > 0 ? `최근 Drive 파일 ${recentFiles}개` : "Drive 파일 대기 중",
        message:
          status === "authenticated"
            ? driveStatus === "fallback"
              ? "Drive 파일을 가져오지 못해 fallback 데이터를 표시 중입니다."
              : "최근 파일 목록을 확인했습니다."
            : "Google 계정을 연결하면 Drive 파일을 볼 수 있습니다.",
        dot: driveStatus === "fallback" ? "bg-amber-300" : "bg-lime-300",
        view: "Drive",
      },
      {
        id: "apps",
        title: `앱 바로가기 ${quickLaunchApps.length}개`,
        message: "자주 쓰는 외부 앱을 앱 바로가기 화면으로 옮겼습니다.",
        dot: "bg-pink-300",
        view: "Quick Launch",
      },
    ];
  }, [calendarEvents.today.length, calendarStatus, driveFilesData.length, driveStatus, status, tasks]);

  function openSearchResult(result) {
    if (result.href) window.open(result.href, "_blank", "noopener,noreferrer");
    if (result.view) setActiveView(result.view);
    setSearchQuery("");
    setIsSearchFocused(false);
  }

  function openNotification(notification) {
    setActiveView(notification.view);
    setNotificationsOpen(false);
  }

  async function refreshWorkspaceFromSupabase() {
    if (!userEmail) return;

    const [remoteTasks, remoteNotes] = await Promise.all([
      fetchTasksFromSupabase(userEmail),
      fetchNotesFromSupabase(userEmail),
    ]);

    setTasks(remoteTasks);
    setNotes(remoteNotes);
    setWorkspaceStorageMode("supabase");
    window.localStorage.removeItem(TASKS_KEY);
    window.localStorage.removeItem(NOTES_KEY);
  }

  async function handleLogout() {
    window.localStorage.removeItem(CALENDAR_EVENTS_KEY);
    window.localStorage.removeItem(DRIVE_FILES_KEY);
    setCalendarEvents({ today: [], week: [], month: [], lookup: [] });
    setDriveFilesData([]);
    setCalendarStatus("idle");
    setDriveStatus("idle");
    await signOut();
  }

  async function addTask(event) {
    event.preventDefault();
    const title = taskInput.trim();
    if (!title) return;

    await createTaskFromTitle(title);
    setTaskInput("");
  }

  async function createTaskFromTitle(title) {
    const localTask = { id: `local-${Date.now()}`, title, completed: false, priority: "보통" };
    setTasks((currentTasks) => [localTask, ...currentTasks]);

    if (workspaceStorageMode === "supabase" && userEmail) {
      try {
        const savedTask = await createTaskInSupabase(userEmail, localTask);
        setTasks((currentTasks) =>
          currentTasks.map((task) => (task.id === localTask.id ? savedTask : task)),
        );
        await refreshWorkspaceFromSupabase();
      } catch (error) {
        console.warn("Supabase task create failed, keeping localStorage fallback:", error);
        setWorkspaceStorageMode("local");
      }
    }
  }

  async function toggleTask(taskId) {
    let nextTask = null;
    setTasks((currentTasks) =>
      currentTasks.map((task) => {
        if (task.id !== taskId) return task;
        nextTask = { ...task, completed: !task.completed };
        return nextTask;
      }),
    );

    if (workspaceStorageMode === "supabase" && userEmail && nextTask) {
      try {
        await updateTaskInSupabase(userEmail, nextTask);
        await refreshWorkspaceFromSupabase();
      } catch (error) {
        console.warn("Supabase task update failed, keeping localStorage fallback:", error);
        setWorkspaceStorageMode("local");
      }
    }
  }

  async function deleteTask(taskId) {
    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskId));

    if (workspaceStorageMode === "supabase" && userEmail && !String(taskId).startsWith("local-")) {
      try {
        await deleteTaskFromSupabase(userEmail, taskId);
        await refreshWorkspaceFromSupabase();
      } catch (error) {
        console.warn("Supabase task delete failed, keeping localStorage fallback:", error);
        setWorkspaceStorageMode("local");
      }
    }
  }

  async function saveNote(event) {
    event.preventDefault();
    const title = noteDraft.title.trim();
    const body = noteDraft.body.trim();
    const tag = noteDraft.tag.trim() || "개인";
    if (!title || !body) return;

    if (editingNoteId) {
      const updatedNote = { id: editingNoteId, title, body, tag };
      setNotes((currentNotes) =>
        currentNotes.map((note) =>
          note.id === editingNoteId ? { ...note, title, body, tag } : note,
        ),
      );
      if (workspaceStorageMode === "supabase" && userEmail && !String(editingNoteId).startsWith("local-")) {
        try {
          await updateNoteInSupabase(userEmail, updatedNote);
          await refreshWorkspaceFromSupabase();
        } catch (error) {
          console.warn("Supabase note update failed, keeping localStorage fallback:", error);
          setWorkspaceStorageMode("local");
        }
      }
      setEditingNoteId(null);
    } else {
      await createNoteFromDraft({ title, body, tag });
    }

    setNoteDraft({ title: "", body: "", tag: "개인" });
  }

  async function createNoteFromDraft({ title, body, tag = "개인" }) {
    const localNote = { id: `local-${Date.now()}`, title, body, tag };
    setNotes((currentNotes) => [localNote, ...currentNotes]);

    if (workspaceStorageMode === "supabase" && userEmail) {
      try {
        const savedNote = await createNoteInSupabase(userEmail, localNote);
        setNotes((currentNotes) =>
          currentNotes.map((note) => (note.id === localNote.id ? savedNote : note)),
        );
        await refreshWorkspaceFromSupabase();
      } catch (error) {
        console.warn("Supabase note create failed, keeping localStorage fallback:", error);
        setWorkspaceStorageMode("local");
      }
    }
  }

  async function deleteNote(noteId) {
    setNotes((currentNotes) => currentNotes.filter((note) => note.id !== noteId));
    if (workspaceStorageMode === "supabase" && userEmail && !String(noteId).startsWith("local-")) {
      try {
        await deleteNoteFromSupabase(userEmail, noteId);
        await refreshWorkspaceFromSupabase();
      } catch (error) {
        console.warn("Supabase note delete failed, keeping localStorage fallback:", error);
        setWorkspaceStorageMode("local");
      }
    }
    if (editingNoteId === noteId) {
      setEditingNoteId(null);
      setNoteDraft({ title: "", body: "", tag: "개인" });
    }
  }

  async function confirmDriveFileDelete() {
    if (!driveFileToDelete?.id) return;

    setDeletingDriveFileId(driveFileToDelete.id);
    setDriveDeleteMessage("");
    setDriveDeleteMessageType("error");

    try {
      const response = await fetch("/api/drive/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileId: driveFileToDelete.id }),
      });
      const { data, text } = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(getApiErrorMessage(response, data, text, "파일을 삭제하지 못했습니다."));
      }

      if (!data?.ok || data?.deletedFileId !== driveFileToDelete.id) {
        throw new Error("파일 삭제 응답을 확인하지 못했습니다.");
      }

      const nextFiles = driveFilesData.filter((file) => file.id !== driveFileToDelete.id);
      setDriveFilesData(nextFiles);
      window.localStorage.setItem(DRIVE_FILES_KEY, JSON.stringify(nextFiles));
      setDriveFileToDelete(null);
      setDriveDeleteMessageType("success");
      setDriveDeleteMessage("파일을 삭제했어요.");
    } catch (error) {
      setDriveDeleteMessageType("error");
      setDriveDeleteMessage(error.message || "파일을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setDeletingDriveFileId(null);
    }
  }

  const activeContent = {
    Dashboard: (
      <DashboardView
        tasks={tasks}
        notes={notes}
        completedCount={completedCount}
        toggleTask={toggleTask}
        monthDays={monthDays}
        markedDays={markedDays}
        currentDay={currentDay}
        session={session}
        status={status}
        calendarEvents={calendarEvents}
        calendarStatus={calendarStatus}
        driveFilesData={driveFilesData}
        driveStatus={driveStatus}
        storageMode={workspaceStorageMode}
        onLogout={handleLogout}
        onRequestDriveDelete={(file) => {
          setDriveDeleteMessage("");
          setDriveDeleteMessageType("error");
          setDriveFileToDelete(file);
        }}
        deletingDriveFileId={deletingDriveFileId}
        driveDeleteMessage={driveDeleteMessage}
        driveDeleteMessageType={driveDeleteMessageType}
      />
    ),
    Calendar: (
      <CalendarView
        monthDays={monthDays}
        markedDays={markedDays}
        currentDay={currentDay}
        calendarEvents={calendarEvents}
        calendarStatus={calendarStatus}
        status={status}
        onCalendarCreated={() => loadCalendarEvents()}
      />
    ),
    Drive: (
      <DriveView
        files={driveFilesData}
        driveStatus={driveStatus}
        status={status}
        onRequestDelete={(file) => {
          setDriveDeleteMessage("");
          setDriveDeleteMessageType("error");
          setDriveFileToDelete(file);
        }}
        deletingFileId={deletingDriveFileId}
        deleteMessage={driveDeleteMessage}
        deleteMessageType={driveDeleteMessageType}
      />
    ),
    Notes: (
      <NotesView
        notes={notes}
        noteDraft={noteDraft}
        setNoteDraft={setNoteDraft}
        editingNoteId={editingNoteId}
        setEditingNoteId={setEditingNoteId}
        onSaveNote={saveNote}
        onDeleteNote={deleteNote}
      />
    ),
    Tasks: (
      <TasksView
        tasks={tasks}
        taskInput={taskInput}
        setTaskInput={setTaskInput}
        addTask={addTask}
        toggleTask={toggleTask}
        deleteTask={deleteTask}
        completedCount={completedCount}
      />
    ),
    "AI Assistant": (
      <AssistantView
        assistantInput={assistantInput}
        setAssistantInput={setAssistantInput}
        status={status}
        calendarEvents={calendarEvents}
        driveFilesData={driveFilesData}
        onCalendarCreated={() => loadCalendarEvents()}
        onTaskCreated={createTaskFromTitle}
        onNoteCreated={createNoteFromDraft}
      />
    ),
    "Quick Launch": <QuickLaunchView />,
    Settings: (
      <SettingsView
        session={session}
        status={status}
        onLogout={handleLogout}
        themeMode={themeMode}
        onThemeChange={setThemeMode}
        calendarStatus={calendarStatus}
        driveStatus={driveStatus}
      />
    ),
  };

  return (
    <main className={`workspace-shell theme-${themeMode} min-h-screen overflow-hidden bg-[var(--workspace-bg)] text-slate-200`}>
      <div className="fixed inset-0 bg-[var(--workspace-ambient)]" />
      <div className="fixed inset-0 bg-[var(--workspace-grid)] bg-[size:48px_48px] opacity-20" />

      <div className="relative flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-slate-950/60 backdrop-blur-xl lg:flex lg:flex-col">
          <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-white/15 bg-white shadow-lg shadow-cyan-500/15">
              <img src="/l-lee-icon.png" alt="L-Lee Workspace" className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">L-Lee Workspace</p>
              <p className="text-xs text-slate-500">개인 OS</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1 px-4 py-6">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveView(item.key)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm transition ${
                    isActive ? "border border-cyan-300/20 bg-white/10 text-white" : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="border-t border-white/10 p-4">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-medium text-slate-300">워크스페이스 상태</p>
              <div className="mt-3 h-2 rounded-full bg-slate-800">
                <div className="h-2 w-3/4 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" />
              </div>
              <p className="mt-2 text-xs text-slate-500">74% 정리됨</p>
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex min-h-20 flex-col gap-4 border-b border-white/10 bg-slate-950/30 px-4 py-4 backdrop-blur-xl md:px-8 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <button type="button" aria-label="메뉴 열기" className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-slate-300 lg:hidden">
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-semibold text-white">{greetingText}, {displayName}님</h1>
                <p className="mt-1 text-sm text-slate-400">{todayLabel}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative block sm:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setIsSearchFocused(true);
                  }}
                  onFocus={() => setIsSearchFocused(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && searchResults[0]) {
                      event.preventDefault();
                      openSearchResult(searchResults[0]);
                    }
                    if (event.key === "Escape") {
                      setSearchQuery("");
                      setIsSearchFocused(false);
                    }
                  }}
                  placeholder="메모, 파일, 일정, 앱을 검색하세요..."
                  className="w-full rounded-lg border border-white/10 bg-white/[0.055] py-3 pl-10 pr-10 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50 focus:bg-white/[0.08] focus:ring-2 focus:ring-cyan-300/15"
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="검색어 지우기"
                    onClick={() => {
                      setSearchQuery("");
                      setIsSearchFocused(false);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 transition hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                {isSearchFocused && searchQuery.trim() && (
                  <SearchResultsPanel results={searchResults} onSelect={openSearchResult} />
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    aria-label="알림"
                    onClick={() => setNotificationsOpen((isOpen) => !isOpen)}
                    className="relative rounded-lg border border-white/10 bg-white/[0.045] p-3 text-slate-300 transition hover:border-cyan-300/30 hover:text-white"
                  >
                    <Bell className="h-4 w-4" />
                    <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-cyan-300" />
                  </button>
                  {notificationsOpen && <NotificationPanel notifications={notifications} onSelect={openNotification} />}
                </div>
                {status === "authenticated" ? (
                  <button
                    type="button"
                    onClick={handleLogout}
                    aria-label="Google 로그아웃"
                    className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 py-2.5 text-sm text-slate-200 transition hover:border-violet-300/30 hover:text-white"
                  >
                    {signedInUser?.image ? (
                      <img src={signedInUser.image} alt={`${displayName} 프로필 이미지`} className="h-6 w-6 rounded-md object-cover" />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                    <span className="max-w-28 truncate">{displayName}</span>
                    <span className="hidden rounded-md bg-cyan-300/10 px-2 py-1 text-xs text-cyan-200 sm:inline">연결됨</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => signIn("google")}
                    aria-label="Google 계정 연결하기"
                    className="flex items-center gap-2 rounded-lg bg-cyan-300 px-3 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-200"
                  >
                    <LogIn className="h-4 w-4" />
                    <span>Google 계정 연결하기</span>
                  </button>
                )}
              </div>
            </div>
          </header>

          <div className="border-b border-white/10 bg-slate-950/20 px-4 py-3 backdrop-blur-xl lg:hidden">
            <div className="workspace-scrollbar flex gap-2 overflow-x-auto">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveView(item.key)}
                    className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                      isActive ? "border-cyan-300/30 bg-white/10 text-white" : "border-white/10 bg-white/[0.035] text-slate-400"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="workspace-scrollbar flex-1 overflow-y-auto p-4 md:p-8">
            <ViewTitle activeView={activeView} />
            <WorkspaceStorageNotice mode={workspaceStorageMode} status={status} />
            {activeContent[activeView]}
          </div>
        </section>
      </div>
      <EdgeMiniAssistant
        status={status}
        calendarEvents={calendarEvents}
        driveFilesData={driveFilesData}
        onCalendarCreated={() => loadCalendarEvents()}
        onTaskCreated={createTaskFromTitle}
        onNoteCreated={createNoteFromDraft}
        onOpenFullAssistant={() => setActiveView("AI Assistant")}
      />
      {driveFileToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-white/10 bg-slate-950/95 p-5 shadow-2xl shadow-black/40">
            <div className="flex items-start gap-3">
              <div className="rounded-lg border border-rose-300/20 bg-rose-400/10 p-2 text-rose-200">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-white">정말 이 파일을 Google Drive에서 삭제할까요?</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  <span className="font-medium text-slate-200">{driveFileToDelete.name}</span> 파일이 실제 Google Drive에서 삭제됩니다. 이 작업은 Google Drive에 반영됩니다.
                </p>
                {driveDeleteMessage && driveDeleteMessageType === "error" && (
                  <p className="mt-3 rounded-lg border border-rose-300/20 bg-rose-400/10 p-3 text-sm leading-6 text-rose-100">
                    {driveDeleteMessage}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDriveFileToDelete(null)}
                disabled={Boolean(deletingDriveFileId)}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmDriveFileDelete}
                disabled={Boolean(deletingDriveFileId)}
                className="rounded-lg bg-rose-400 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingDriveFileId ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
