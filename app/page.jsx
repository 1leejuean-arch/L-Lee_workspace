"use client";

import { useMemo, useState } from "react";
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
  FileSpreadsheet,
  FileText,
  FolderOpen,
  HardDrive,
  LayoutDashboard,
  Link,
  Menu,
  MessageSquare,
  Moon,
  MoreHorizontal,
  Palette,
  Plus,
  Search,
  Send,
  Settings,
  Shield,
  Sparkles,
  User,
} from "lucide-react";

const sidebarItems = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Calendar", icon: CalendarDays },
  { label: "Drive", icon: HardDrive },
  { label: "Notes", icon: FileText },
  { label: "Tasks", icon: CheckSquare },
  { label: "AI Assistant", icon: Bot },
  { label: "Settings", icon: Settings },
];

const agendaItems = [
  { id: 1, title: "Morning planning", time: "09:00", duration: "30m", accent: "bg-cyan-400", place: "Workspace desk" },
  { id: 2, title: "Project sync", time: "11:30", duration: "45m", accent: "bg-violet-400", place: "Google Meet" },
  { id: 3, title: "Drive cleanup", time: "14:00", duration: "1h", accent: "bg-blue-400", place: "Admin block" },
  { id: 4, title: "Deep work block", time: "16:00", duration: "2h", accent: "bg-fuchsia-400", place: "Focus mode" },
  { id: 5, title: "Evening review", time: "19:00", duration: "20m", accent: "bg-emerald-400", place: "Notes" },
];

const driveFiles = [
  { id: 1, name: "Workspace roadmap.pdf", type: "pdf", updated: "12 min ago", owner: "Juean", size: "2.4 MB" },
  { id: 2, name: "Google API integration notes", type: "doc", updated: "1 hour ago", owner: "Juean", size: "84 KB" },
  { id: 3, name: "Personal metrics.xlsx", type: "sheet", updated: "Today", owner: "Workspace", size: "415 KB" },
  { id: 4, name: "AI assistant prompts", type: "doc", updated: "Yesterday", owner: "Juean", size: "126 KB" },
  { id: 5, name: "Design inspiration board", type: "folder", updated: "Jun 12", owner: "Workspace", size: "18 items" },
];

const initialTasks = [
  { id: 1, title: "Review Calendar API scopes", completed: false, priority: "High" },
  { id: 2, title: "Sort Drive workspace folders", completed: true, priority: "Medium" },
  { id: 3, title: "Write tomorrow's focus note", completed: false, priority: "Low" },
  { id: 4, title: "Prepare task sync schema", completed: false, priority: "High" },
  { id: 5, title: "Sketch settings connection states", completed: true, priority: "Medium" },
];

const quickNotes = [
  {
    id: 1,
    title: "API adapter plan",
    body: "Use separate adapters for Calendar and Drive data later. Keep mock arrays shaped close to API responses.",
    tag: "Architecture",
  },
  {
    id: 2,
    title: "Assistant behavior",
    body: "AI should first parse intent, then suggest calendar, drive, notes, or task actions before writing anything.",
    tag: "AI",
  },
  {
    id: 3,
    title: "Command palette",
    body: "Add quick actions after core dashboard is stable: create note, add task, search files, schedule event.",
    tag: "Product",
  },
  {
    id: 4,
    title: "Daily review",
    body: "Evening flow: agenda recap, unfinished tasks, tomorrow focus block, and Drive changes summary.",
    tag: "Routine",
  },
];

const aiSuggestions = [
  "내일 오후 6시에 회의 예약해줘",
  "오늘 일정 요약해줘",
  "최근 Drive 파일 정리해줘",
  "이번 주 할 일 우선순위 잡아줘",
];

const aiMessages = [
  { id: 1, role: "assistant", text: "안녕하세요 Juean. 오늘 일정, 파일, 메모, 작업을 한 곳에서 정리할 준비가 되어 있어요." },
  { id: 2, role: "user", text: "오늘 남은 일정과 할 일을 요약해줘." },
  { id: 3, role: "assistant", text: "남은 일정은 Deep work block과 Evening review가 있고, 우선 처리할 작업은 Calendar API scopes 검토입니다." },
];

const settingsCards = [
  { title: "Profile", value: "Juean Lee", helper: "Personal workspace owner", icon: User },
  { title: "Theme", value: "Dark glass", helper: "Deep navy, cyan, violet", icon: Palette },
  { title: "Google Calendar", value: "Mock only", helper: "OAuth not connected yet", icon: CalendarDays },
  { title: "Google Drive", value: "Mock only", helper: "Drive API not connected yet", icon: Cloud },
];

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
        <button
          type="button"
          aria-label={`${title} options`}
          className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function ViewTitle({ activeView }) {
  const subtitles = {
    Dashboard: "Your command center for calendar, drive, notes, tasks, and AI.",
    Calendar: "Mock schedule view ready for Google Calendar API later.",
    Drive: "Recent files and folders shaped for future Google Drive data.",
    Notes: "A quiet board for personal workspace notes.",
    Tasks: "Local task state with interactive completion controls.",
    "AI Assistant": "Chat-style workspace assistant UI with example commands.",
    Settings: "Profile, theme, and integration status cards.",
  };

  return (
    <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300/80">L-Lee Workspace</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">{activeView}</h2>
        <p className="mt-1 text-sm text-slate-400">{subtitles[activeView]}</p>
      </div>
      <div className="rounded-lg border border-white/10 bg-white/[0.045] px-3 py-2 text-xs text-slate-400">
        Mock data only
      </div>
    </div>
  );
}

function MiniCalendar({ monthDays, markedDays, currentDay }) {
  return (
    <div className="p-5">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-lg font-semibold text-white">June 2026</p>
          <p className="text-xs text-slate-500">Mock calendar view</p>
        </div>
        <span className="rounded-lg bg-cyan-300/10 px-3 py-1 text-xs text-cyan-200">Today</span>
      </div>
      <div className="grid grid-cols-7 gap-2 text-center text-xs text-slate-500">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
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
            {markedDays.includes(day) && day !== currentDay && (
              <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-cyan-300" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function AgendaList({ compact = false }) {
  return (
    <div className="space-y-3 p-5">
      {agendaItems.slice(0, compact ? 4 : agendaItems.length).map((item) => (
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

function DriveFileList({ detailed = false }) {
  return (
    <div className="space-y-3 p-5">
      {driveFiles.map((file) => {
        const Icon = getFileIcon(file.type);
        return (
          <article key={file.id} className="flex items-center gap-4 rounded-lg border border-transparent p-3 transition hover:border-white/10 hover:bg-white/[0.05]">
            <div className="rounded-lg border border-white/10 bg-slate-900/80 p-3 text-cyan-300">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-100">{file.name}</p>
              <p className="mt-1 text-xs text-slate-500">
                {file.updated}
                {detailed ? ` · ${file.owner} · ${file.size}` : ""}
              </p>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function TaskList({ tasks, onToggle, detailed = false }) {
  return (
    <div className="space-y-2 p-5">
      {tasks.map((task) => (
        <button
          key={task.id}
          type="button"
          onClick={() => onToggle(task.id)}
          className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition hover:bg-white/[0.05]"
        >
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
              task.completed
                ? "border-cyan-300 bg-cyan-300 text-slate-950"
                : "border-slate-600 text-transparent"
            }`}
          >
            <Check className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block text-sm ${task.completed ? "text-slate-500 line-through" : "text-slate-100"}`}>
              {task.title}
            </span>
            {detailed && <span className="mt-1 block text-xs text-slate-500">{task.priority} priority</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

function DashboardView({ tasks, completedCount, toggleTask, monthDays, markedDays, currentDay, assistantInput, setAssistantInput }) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <GlassCard className="xl:col-span-4 xl:row-span-2">
        <CardHeader icon={CalendarDays} title="Today's Agenda" />
        <AgendaList compact />
        <div className="px-5 pb-5">
          <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 py-3 text-sm text-slate-300 transition hover:bg-white/[0.06] hover:text-white">
            <Plus className="h-4 w-4" />
            Add Event
          </button>
        </div>
      </GlassCard>

      <GlassCard className="xl:col-span-4">
        <CardHeader icon={CalendarDays} title="Mini Calendar" action={false} />
        <MiniCalendar monthDays={monthDays} markedDays={markedDays} currentDay={currentDay} />
      </GlassCard>

      <GlassCard className="xl:col-span-4 xl:row-span-2">
        <CardHeader icon={FolderOpen} title="Recent Google Drive Files" />
        <DriveFileList />
      </GlassCard>

      <GlassCard className="xl:col-span-4">
        <CardHeader icon={CheckSquare} title="Today's Tasks" />
        <TaskList tasks={tasks} onToggle={toggleTask} />
      </GlassCard>

      <GlassCard className="xl:col-span-4">
        <CardHeader icon={FileText} title="Quick Notes" />
        <div className="space-y-3 p-5">
          {quickNotes.slice(0, 3).map((note) => (
            <p key={note.id} className="rounded-lg border border-white/10 bg-slate-950/35 p-3 text-sm leading-6 text-slate-300">
              {note.body}
            </p>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="xl:col-span-4">
        <AssistantCard assistantInput={assistantInput} setAssistantInput={setAssistantInput} compact />
      </GlassCard>

      <GlassCard className="xl:col-span-12">
        <SummaryGrid completedCount={completedCount} taskTotal={tasks.length} />
      </GlassCard>
    </div>
  );
}

function CalendarView({ monthDays, markedDays, currentDay }) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <GlassCard className="xl:col-span-7">
        <CardHeader icon={CalendarDays} title="Calendar Overview" action={false} />
        <MiniCalendar monthDays={monthDays} markedDays={markedDays} currentDay={currentDay} />
      </GlassCard>
      <GlassCard className="xl:col-span-5">
        <CardHeader icon={Clock3} title="Upcoming Schedule" />
        <AgendaList />
      </GlassCard>
      <GlassCard className="xl:col-span-12">
        <div className="grid gap-4 p-5 md:grid-cols-3">
          {["Focus blocks", "Meetings", "Personal review"].map((label, index) => (
            <div key={label} className="rounded-lg border border-white/10 bg-slate-950/35 p-4">
              <p className="text-sm font-medium text-white">{label}</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Mock calendar lane {index + 1}, ready to map Google Calendar events into this area.
              </p>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

function DriveView() {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <GlassCard className="xl:col-span-8">
        <CardHeader icon={HardDrive} title="Recent Files" />
        <DriveFileList detailed />
      </GlassCard>
      <GlassCard className="xl:col-span-4">
        <CardHeader icon={Cloud} title="Storage Snapshot" action={false} />
        <div className="p-5">
          <div className="rounded-lg border border-white/10 bg-slate-950/35 p-4">
            <p className="text-3xl font-semibold text-white">18.4 GB</p>
            <p className="mt-1 text-xs text-slate-500">of mock 100 GB used</p>
            <div className="mt-4 h-2 rounded-full bg-slate-800">
              <div className="h-2 w-[18%] rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" />
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {["Project docs", "Notes archive", "Design references"].map((folder) => (
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

function NotesView() {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
      {quickNotes.map((note) => (
        <GlassCard key={note.id}>
          <div className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="rounded-lg bg-violet-300/10 px-3 py-1 text-xs text-violet-200">{note.tag}</span>
              <FileText className="h-4 w-4 text-slate-500" />
            </div>
            <h3 className="text-base font-semibold text-white">{note.title}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-400">{note.body}</p>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

function TasksView({ tasks, toggleTask, completedCount }) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <GlassCard className="xl:col-span-8">
        <CardHeader icon={CheckSquare} title="Task List" />
        <TaskList tasks={tasks} onToggle={toggleTask} detailed />
      </GlassCard>
      <GlassCard className="xl:col-span-4">
        <CardHeader icon={Shield} title="Task Progress" action={false} />
        <div className="p-5">
          <p className="text-4xl font-semibold text-white">{completedCount}/{tasks.length}</p>
          <p className="mt-2 text-sm text-slate-500">completed today</p>
          <div className="mt-5 h-2 rounded-full bg-slate-800">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500"
              style={{ width: `${(completedCount / tasks.length) * 100}%` }}
            />
          </div>
          <div className="mt-5 space-y-3">
            {["High priority review", "Evening focus reset", "Mock sync queue"].map((item) => (
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
      <CardHeader icon={Sparkles} title="AI Assistant" action={false} />
      <div className="p-5">
        <div className="rounded-lg border border-cyan-300/20 bg-gradient-to-br from-cyan-300/10 to-violet-400/10 p-4">
          <p className="text-sm text-slate-300">Ask L-Lee AI to organize, summarize, or draft from your workspace context.</p>
          <div className="mt-4 flex gap-2">
            <input
              value={assistantInput}
              onChange={(event) => setAssistantInput(event.target.value)}
              placeholder="What should we organize?"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-violet-300/50"
            />
            <button
              type="button"
              aria-label="Send assistant prompt"
              className="rounded-lg bg-cyan-300 px-4 text-slate-950 transition hover:bg-cyan-200"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {aiSuggestions.slice(0, compact ? 3 : aiSuggestions.length).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setAssistantInput(suggestion)}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function AssistantView({ assistantInput, setAssistantInput }) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <GlassCard className="xl:col-span-8">
        <CardHeader icon={MessageSquare} title="Workspace Chat" action={false} />
        <div className="space-y-4 p-5">
          {aiMessages.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-lg border px-4 py-3 text-sm leading-6 ${
                  message.role === "user"
                    ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-50"
                    : "border-white/10 bg-slate-950/45 text-slate-300"
                }`}
              >
                {message.text}
              </div>
            </div>
          ))}
          <div className="flex gap-2 border-t border-white/10 pt-4">
            <input
              value={assistantInput}
              onChange={(event) => setAssistantInput(event.target.value)}
              placeholder="예: 내일 오후 6시에 회의 예약해줘"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
            />
            <button type="button" className="rounded-lg bg-cyan-300 px-4 text-slate-950 transition hover:bg-cyan-200">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </GlassCard>
      <GlassCard className="xl:col-span-4">
        <CardHeader icon={Sparkles} title="Example Commands" action={false} />
        <div className="space-y-3 p-5">
          {aiSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setAssistantInput(suggestion)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.035] p-4 text-left text-sm text-slate-300 transition hover:border-cyan-300/30 hover:bg-white/[0.07] hover:text-white"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

function SettingsView() {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
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
            { label: "Theme mode", value: "Dark", icon: Moon },
            { label: "Calendar connection", value: "Disconnected", icon: Link },
            { label: "Drive connection", value: "Disconnected", icon: HardDrive },
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

function SummaryGrid({ completedCount, taskTotal }) {
  return (
    <div className="grid gap-4 p-5 md:grid-cols-4">
      {[
        ["Tasks done", `${completedCount}/${taskTotal}`, "Live local state"],
        ["Events today", String(agendaItems.length), "Calendar mock data"],
        ["Recent files", String(driveFiles.length), "Drive mock data"],
        ["Focus score", "86%", "Productivity summary"],
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
  const [activeView, setActiveView] = useState("Dashboard");
  const [tasks, setTasks] = useState(initialTasks);
  const [searchQuery, setSearchQuery] = useState("");
  const [assistantInput, setAssistantInput] = useState("");

  const todayLabel = useMemo(() => {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date());
  }, []);

  const completedCount = tasks.filter((task) => task.completed).length;
  const monthDays = Array.from({ length: 30 }, (_, index) => index + 1);
  const markedDays = [4, 9, 14, 18, 24, 28];
  const currentDay = Math.min(new Date().getDate(), 30);

  function toggleTask(taskId) {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId ? { ...task, completed: !task.completed } : task,
      ),
    );
  }

  const activeContent = {
    Dashboard: (
      <DashboardView
        tasks={tasks}
        completedCount={completedCount}
        toggleTask={toggleTask}
        monthDays={monthDays}
        markedDays={markedDays}
        currentDay={currentDay}
        assistantInput={assistantInput}
        setAssistantInput={setAssistantInput}
      />
    ),
    Calendar: <CalendarView monthDays={monthDays} markedDays={markedDays} currentDay={currentDay} />,
    Drive: <DriveView />,
    Notes: <NotesView />,
    Tasks: <TasksView tasks={tasks} toggleTask={toggleTask} completedCount={completedCount} />,
    "AI Assistant": <AssistantView assistantInput={assistantInput} setAssistantInput={setAssistantInput} />,
    Settings: <SettingsView />,
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
              <p className="text-xs text-slate-500">Personal OS</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1 px-4 py-6">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.label;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setActiveView(item.label)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm transition ${
                    isActive
                      ? "border border-cyan-300/20 bg-white/10 text-white"
                      : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
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
              <p className="text-xs font-medium text-slate-300">Workspace health</p>
              <div className="mt-3 h-2 rounded-full bg-slate-800">
                <div className="h-2 w-3/4 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" />
              </div>
              <p className="mt-2 text-xs text-slate-500">74% organized</p>
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex min-h-20 flex-col gap-4 border-b border-white/10 bg-slate-950/30 px-4 py-4 backdrop-blur-xl md:px-8 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <button
                type="button"
                aria-label="Open menu"
                className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-slate-300 lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-semibold text-white">Good evening, Juean</h1>
                <p className="mt-1 text-sm text-slate-400">{todayLabel}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="relative block sm:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search notes, files, events..."
                  className="w-full rounded-lg border border-white/10 bg-white/[0.055] py-3 pl-10 pr-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50 focus:bg-white/[0.08] focus:ring-2 focus:ring-cyan-300/15"
                />
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Notifications"
                  className="relative rounded-lg border border-white/10 bg-white/[0.045] p-3 text-slate-300 transition hover:border-cyan-300/30 hover:text-white"
                >
                  <Bell className="h-4 w-4" />
                  <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-cyan-300" />
                </button>
                <button
                  type="button"
                  aria-label="Profile"
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 py-2.5 text-sm text-slate-200 transition hover:border-violet-300/30 hover:text-white"
                >
                  <User className="h-4 w-4" />
                  <span>Juean</span>
                </button>
              </div>
            </div>
          </header>

          <div className="border-b border-white/10 bg-slate-950/20 px-4 py-3 backdrop-blur-xl lg:hidden">
            <div className="workspace-scrollbar flex gap-2 overflow-x-auto">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.label;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setActiveView(item.label)}
                    className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                      isActive
                        ? "border-cyan-300/30 bg-white/10 text-white"
                        : "border-white/10 bg-white/[0.035] text-slate-400"
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
