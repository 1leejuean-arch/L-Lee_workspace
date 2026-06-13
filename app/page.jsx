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
  LayoutDashboard,
  Link,
  LogIn,
  LogOut,
  Menu,
  MessageSquare,
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
  Trash2,
  User,
  X,
} from "lucide-react";

const TASKS_KEY = "l-lee-workspace.tasks";
const NOTES_KEY = "l-lee-workspace.notes";

const sidebarItems = [
  { key: "Dashboard", label: "대시보드", icon: LayoutDashboard },
  { key: "Calendar", label: "캘린더", icon: CalendarDays },
  { key: "Drive", label: "드라이브", icon: HardDrive },
  { key: "Notes", label: "메모", icon: FileText },
  { key: "Tasks", label: "할 일", icon: CheckSquare },
  { key: "AI Assistant", label: "AI 비서", icon: Bot },
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
  "최근 드라이브 파일 정리해줘",
  "이번 주 할 일 우선순위 잡아줘",
];

const aiMessages = [
  { id: 1, role: "assistant", text: "안녕하세요, 주언님. 오늘 일정, 파일, 메모, 할 일을 한곳에서 정리할 준비가 되어 있어요." },
  { id: 2, role: "user", text: "오늘 남은 일정과 할 일을 요약해줘." },
  { id: 3, role: "assistant", text: "남은 일정은 집중 작업 시간과 저녁 회고가 있고, 우선 처리할 작업은 캘린더 API 권한 범위 검토입니다." },
];

const settingsCards = [
  { title: "프로필", value: "이주언", helper: "개인 워크스페이스 소유자", icon: User },
  { title: "테마", value: "다크 글래스", helper: "딥 네이비, 시안, 바이올렛", icon: Palette },
  { title: "Google 캘린더", value: "목업 상태", helper: "OAuth는 아직 연결되지 않았습니다", icon: CalendarDays },
  { title: "Google 드라이브", value: "목업 상태", helper: "드라이브 API는 아직 연결되지 않았습니다", icon: Cloud },
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

function GlassCard({ children, className = "" }) {
  return (
    <section
      className={`rounded-lg border border-white/10 bg-white/[0.045] shadow-glow backdrop-blur-2xl transition duration-300 hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-white/[0.07] ${className}`}
    >
      {children}
    </section>
  );
}

function CardHeader({ icon: Icon, title, action = true }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-cyan-300" />
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
      </div>
      {action && (
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

function GoogleAccountPanel({ session, status, compact = false }) {
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
          onClick={() => (isConnected ? signOut() : signIn("google"))}
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
    Settings: "설정",
  };

  const subtitles = {
    Dashboard: "캘린더, 드라이브, 메모, 할 일, AI를 한곳에서 관리하는 시작 화면입니다.",
    Calendar: "나중에 Google 캘린더 API를 연결하기 쉬운 목업 일정 화면입니다.",
    Drive: "나중에 Google 드라이브 데이터로 바꿀 수 있는 최근 파일과 폴더 화면입니다.",
    Notes: "개인 메모를 작성, 수정, 삭제하고 이 브라우저에 저장합니다.",
    Tasks: "할 일을 추가, 완료, 삭제하고 이 브라우저에 저장합니다.",
    "AI Assistant": "예시 명령어를 담은 채팅형 워크스페이스 AI 비서 화면입니다.",
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
  return (
    <div className="p-5">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-lg font-semibold text-white">2026년 6월</p>
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

function DriveFileList({ files = driveFiles, detailed = false, emptyMessage = "표시할 파일이 없습니다." }) {
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
          file.link ? (
            <a
              key={file.id}
              href={file.link}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-4 rounded-lg border border-transparent p-3 transition hover:border-white/10 hover:bg-white/[0.05]"
            >
              {content}
            </a>
          ) : (
            <article key={file.id} className="flex items-center gap-4 rounded-lg border border-transparent p-3 transition hover:border-white/10 hover:bg-white/[0.05]">
              {content}
            </article>
          )
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

function DashboardView({ tasks, notes, completedCount, toggleTask, monthDays, markedDays, currentDay, assistantInput, setAssistantInput, session, status, calendarEvents, calendarStatus, driveFilesData, driveStatus }) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <GlassCard className="xl:col-span-12">
        <div className="p-5">
          <GoogleAccountPanel session={session} status={status} />
        </div>
      </GlassCard>

      <GlassCard className="xl:col-span-4 xl:row-span-2">
        <CardHeader icon={CalendarDays} title="오늘의 일정" />
        <AgendaList
          events={calendarEvents.today}
          compact
          emptyMessage={status === "authenticated" ? "오늘 예정된 Google Calendar 일정이 없습니다." : "Google 계정을 연결하면 오늘 일정을 볼 수 있어요."}
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
        />
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

      <GlassCard className="xl:col-span-4">
        <AssistantCard assistantInput={assistantInput} setAssistantInput={setAssistantInput} compact />
      </GlassCard>

      <GlassCard className="xl:col-span-12">
        <SummaryGrid
          completedCount={completedCount}
          taskTotal={tasks.length}
          noteTotal={notes.length}
          driveFileTotal={driveFilesData.length}
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
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "일정 추가에 실패했습니다.");
      }

      setSubmitStatus("success");
      setMessage(data.message || "일정이 Google Calendar에 추가되었습니다.");
      setDraft({ title: "", date: "", startTime: "", endTime: "", description: "" });
      await onCreated();
    } catch (error) {
      setSubmitStatus("error");
      setMessage(error.message || "일정 추가 중 오류가 발생했습니다.");
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

function CalendarView({ monthDays, markedDays, currentDay, calendarEvents, calendarStatus, status, onCalendarCreated }) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <CalendarCreateForm status={status} onCreated={onCalendarCreated} />
      <GlassCard className="xl:col-span-7">
        <CardHeader icon={CalendarDays} title="캘린더 개요" action={false} />
        <MiniCalendar monthDays={monthDays} markedDays={markedDays} currentDay={currentDay} />
      </GlassCard>
      <GlassCard className="xl:col-span-5">
        <CardHeader icon={Clock3} title="이번 주 일정" />
        <AgendaList
          events={calendarEvents.week}
          emptyMessage={status === "authenticated" ? "이번 주 예정된 Google Calendar 일정이 없습니다." : "Google 계정을 연결하면 이번 주 일정을 볼 수 있어요."}
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

function DriveView({ files, driveStatus, status }) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <GlassCard className="xl:col-span-8">
        <CardHeader icon={HardDrive} title="최근 파일" />
        <DriveFileList
          files={files}
          detailed
          emptyMessage={status === "authenticated" ? "최근 수정된 Google Drive 파일이 없습니다." : "Google 계정을 연결하면 Drive 파일을 볼 수 있어요."}
        />
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

function AssistantView({ assistantInput, setAssistantInput, status, onCalendarCreated }) {
  const [chatMessages, setChatMessages] = useState(aiMessages);
  const [pendingEvent, setPendingEvent] = useState(null);
  const [assistantStatus, setAssistantStatus] = useState("idle");

  function addChatMessage(role, text) {
    setChatMessages((messages) => [...messages, { id: Date.now() + Math.random(), role, text }]);
  }

  async function handleAssistantSubmit(event) {
    event.preventDefault();
    const input = assistantInput.trim();
    if (!input) return;

    addChatMessage("user", input);
    setAssistantInput("");

    if (status !== "authenticated") {
      setPendingEvent(null);
      addChatMessage("assistant", "Google 계정을 연결하면 AI 비서가 일정을 추가할 수 있어요.");
      return;
    }

    setAssistantStatus("loading");

    try {
      const response = await fetch("/api/assistant/parse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input }),
      });
      const parsedEvent = await response.json();

      if (!response.ok || parsedEvent.intent !== "create_calendar_event") {
        setPendingEvent(null);
        addChatMessage(
          "assistant",
          parsedEvent.message || "아직은 일정 추가 요청을 중심으로 도와드릴 수 있어요.",
        );
        return;
      }

      setPendingEvent(parsedEvent);
      addChatMessage(
        "assistant",
        `${parsedEvent.displayDate} ${parsedEvent.displayTime}에 '${parsedEvent.title}'을 ${parsedEvent.durationText} 일정으로 추가할까요?`,
      );
    } catch (error) {
      setPendingEvent(null);
      addChatMessage("assistant", "일정 요청을 분석하지 못했어요. 예: 내일 오후 6시에 회의 예약해줘");
    } finally {
      setAssistantStatus("idle");
    }
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
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "일정 추가에 실패했습니다.");
      }

      addChatMessage("assistant", data.message || "일정이 Google Calendar에 추가되었습니다.");
      setPendingEvent(null);
      await onCalendarCreated();
    } catch (error) {
      addChatMessage("assistant", error.message || "일정 추가 중 오류가 발생했습니다.");
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
            <button key={suggestion} type="button" onClick={() => setAssistantInput(suggestion)} className="w-full rounded-lg border border-white/10 bg-white/[0.035] p-4 text-left text-sm text-slate-300 transition hover:border-cyan-300/30 hover:bg-white/[0.07] hover:text-white">
              {suggestion}
            </button>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

function SettingsView({ session, status }) {
  const isConnected = status === "authenticated";

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
      <GlassCard className="md:col-span-2 xl:col-span-4">
        <div className="p-5">
          <CardHeader icon={Link} title="Google 계정 연결" action={false} />
          <div className="pt-5">
            <GoogleAccountPanel session={session} status={status} />
          </div>
        </div>
      </GlassCard>

      {settingsCards.map((card) => {
        const Icon = card.icon;
        return (
          <GlassCard key={card.title}>
            <div className="p-5">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{card.title}</p>
              <h3 className="mt-2 text-lg font-semibold text-white">{card.value}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{card.helper}</p>
            </div>
          </GlassCard>
        );
      })}
      <GlassCard className="md:col-span-2 xl:col-span-4">
        <div className="grid gap-4 p-5 md:grid-cols-3">
          {[
            { label: "테마 모드", value: "다크", icon: Moon },
            { label: "캘린더 연결", value: isConnected ? "계정 연결됨" : "계정 연결 필요", icon: Link },
            { label: "드라이브 연결", value: isConnected ? "계정 연결됨" : "계정 연결 필요", icon: HardDrive },
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

function SummaryGrid({ completedCount, taskTotal, noteTotal, driveFileTotal }) {
  return (
    <div className="grid gap-4 p-5 md:grid-cols-4">
      {[
        ["완료한 할 일", `${completedCount}/${taskTotal}`, "로컬에 저장된 할 일"],
        ["메모", String(noteTotal), "로컬에 저장된 메모"],
        ["오늘 일정", String(agendaItems.length), "캘린더 목업 데이터"],
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

export default function Home() {
  const { data: session, status } = useSession();
  const [activeView, setActiveView] = useState("Dashboard");
  const [tasks, setTasks] = useState(initialTasks);
  const [notes, setNotes] = useState(initialNotes);
  const [taskInput, setTaskInput] = useState("");
  const [noteDraft, setNoteDraft] = useState({ title: "", body: "", tag: "개인" });
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [assistantInput, setAssistantInput] = useState("");
  const [storageReady, setStorageReady] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState({ today: [], week: [] });
  const [calendarStatus, setCalendarStatus] = useState("idle");
  const [driveFilesData, setDriveFilesData] = useState([]);
  const [driveStatus, setDriveStatus] = useState("idle");
  const [workspaceStorageMode, setWorkspaceStorageMode] = useState("local");
  const userEmail = session?.user?.email || null;

  useEffect(() => {
    let isActive = true;

    async function loadWorkspaceData() {
      const localTasks = localizeStoredTasks(loadStoredItems(TASKS_KEY, initialTasks));
      const localNotes = localizeStoredNotes(loadStoredItems(NOTES_KEY, initialNotes));

      if (!userEmail) {
        if (!isActive) return;
        setTasks(localTasks);
        setNotes(localNotes);
        setWorkspaceStorageMode("local");
        setStorageReady(true);
        return;
      }

      try {
        const [remoteTasks, remoteNotes] = await Promise.all([
          fetchTasksFromSupabase(userEmail),
          fetchNotesFromSupabase(userEmail),
        ]);

        if (!isActive) return;
        setTasks(remoteTasks.length ? remoteTasks : localTasks);
        setNotes(remoteNotes.length ? remoteNotes : localNotes);
        setWorkspaceStorageMode("supabase");
      } catch (error) {
        console.warn("Supabase workspace load failed, using localStorage fallback:", error);
        if (!isActive) return;
        setTasks(localTasks);
        setNotes(localNotes);
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
  }, [userEmail]);

  useEffect(() => {
    if (storageReady) window.localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  }, [storageReady, tasks]);

  useEffect(() => {
    if (storageReady) window.localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }, [storageReady, notes]);

  async function loadCalendarEvents(signal) {
    setCalendarStatus("loading");

    try {
      const response = await fetch("/api/calendar/events", {
        signal,
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Calendar API request failed");
      }

      const data = await response.json();
      setCalendarEvents({
        today: data.today || [],
        week: data.week || [],
      });
      setCalendarStatus("ready");
    } catch (error) {
      if (error.name === "AbortError") return;
      setCalendarEvents({ today: agendaItems, week: agendaItems });
      setCalendarStatus("fallback");
    }
  }

  useEffect(() => {
    if (status === "loading") return;

    if (status !== "authenticated") {
      setCalendarEvents({ today: [], week: [] });
      setCalendarStatus("idle");
      return;
    }

    const controller = new AbortController();
    loadCalendarEvents(controller.signal);

    return () => controller.abort();
  }, [status]);

  useEffect(() => {
    if (status === "loading") return;

    if (status !== "authenticated") {
      setDriveFilesData([]);
      setDriveStatus("idle");
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

        if (!response.ok) {
          throw new Error("Drive API request failed");
        }

        const data = await response.json();
        setDriveFilesData(data.files || []);
        setDriveStatus("ready");
      } catch (error) {
        if (error.name === "AbortError") return;
        setDriveFilesData(driveFiles);
        setDriveStatus("fallback");
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
  const monthDays = Array.from({ length: 30 }, (_, index) => index + 1);
  const markedDays = [4, 9, 14, 18, 24, 28];
  const currentDay = Math.min(new Date().getDate(), 30);

  async function addTask(event) {
    event.preventDefault();
    const title = taskInput.trim();
    if (!title) return;

    const localTask = { id: `local-${Date.now()}`, title, completed: false, priority: "보통" };
    setTasks((currentTasks) => [localTask, ...currentTasks]);
    setTaskInput("");

    if (workspaceStorageMode === "supabase" && userEmail) {
      try {
        const savedTask = await createTaskInSupabase(userEmail, localTask);
        setTasks((currentTasks) =>
          currentTasks.map((task) => (task.id === localTask.id ? savedTask : task)),
        );
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
        } catch (error) {
          console.warn("Supabase note update failed, keeping localStorage fallback:", error);
          setWorkspaceStorageMode("local");
        }
      }
      setEditingNoteId(null);
    } else {
      const localNote = { id: `local-${Date.now()}`, title, body, tag };
      setNotes((currentNotes) => [localNote, ...currentNotes]);

      if (workspaceStorageMode === "supabase" && userEmail) {
        try {
          const savedNote = await createNoteInSupabase(userEmail, localNote);
          setNotes((currentNotes) =>
            currentNotes.map((note) => (note.id === localNote.id ? savedNote : note)),
          );
        } catch (error) {
          console.warn("Supabase note create failed, keeping localStorage fallback:", error);
          setWorkspaceStorageMode("local");
        }
      }
    }

    setNoteDraft({ title: "", body: "", tag: "개인" });
  }

  async function deleteNote(noteId) {
    setNotes((currentNotes) => currentNotes.filter((note) => note.id !== noteId));
    if (workspaceStorageMode === "supabase" && userEmail && !String(noteId).startsWith("local-")) {
      try {
        await deleteNoteFromSupabase(userEmail, noteId);
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
        assistantInput={assistantInput}
        setAssistantInput={setAssistantInput}
        session={session}
        status={status}
        calendarEvents={calendarEvents}
        calendarStatus={calendarStatus}
        driveFilesData={driveFilesData}
        driveStatus={driveStatus}
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
    Drive: <DriveView files={driveFilesData} driveStatus={driveStatus} status={status} />,
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
        onCalendarCreated={() => loadCalendarEvents()}
      />
    ),
    Settings: <SettingsView session={session} status={status} />,
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#050812] text-slate-200">
      <div className="fixed inset-0 bg-[linear-gradient(135deg,rgba(56,189,248,0.14),transparent_26%,rgba(124,58,237,0.12)_58%,transparent_82%)]" />
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:48px_48px] opacity-20" />

      <div className="relative flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-slate-950/60 backdrop-blur-xl lg:flex lg:flex-col">
          <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-violet-500 shadow-lg shadow-cyan-500/20">
              <Sparkles className="h-5 w-5 text-white" />
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
                <h1 className="text-2xl font-semibold text-white">좋은 저녁이에요, {displayName}님</h1>
                <p className="mt-1 text-sm text-slate-400">{todayLabel}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="relative block sm:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="메모, 파일, 일정을 검색하세요..."
                  className="w-full rounded-lg border border-white/10 bg-white/[0.055] py-3 pl-10 pr-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50 focus:bg-white/[0.08] focus:ring-2 focus:ring-cyan-300/15"
                />
              </label>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="알림" className="relative rounded-lg border border-white/10 bg-white/[0.045] p-3 text-slate-300 transition hover:border-cyan-300/30 hover:text-white">
                  <Bell className="h-4 w-4" />
                  <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-cyan-300" />
                </button>
                {status === "authenticated" ? (
                  <button
                    type="button"
                    onClick={() => signOut()}
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
            {activeContent[activeView]}
          </div>
        </section>
      </div>
    </main>
  );
}
