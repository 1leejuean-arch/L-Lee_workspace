"use client";

import {
  CalendarDays,
  Check,
  CheckSquare,
  ChevronRight,
  ClipboardList,
  Cloud,
  CreditCard,
  ExternalLink,
  File,
  FileText,
  FolderOpen,
  Lock,
  Sparkles,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { formatWon } from "./AssetsView";

const cardClass = "rounded-2xl border border-[color:var(--workspace-border)] bg-[var(--workspace-card)] shadow-glow backdrop-blur-2xl";

function Panel({ children, className = "" }) {
  return <section className={`${cardClass} overflow-hidden ${className}`}>{children}</section>;
}

function PanelHeader({ icon: Icon, eyebrow, title, action }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.07] p-2 text-cyan-200"><Icon className="h-4 w-4" /></span>
        <div className="min-w-0">
          {eyebrow && <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300/60">{eyebrow}</p>}
          <h3 className="truncate text-sm font-semibold text-slate-100">{title}</h3>
        </div>
      </div>
      {action}
    </div>
  );
}

function TextAction({ children, onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex shrink-0 items-center gap-1 text-xs text-cyan-200 transition hover:text-cyan-100">
      {children}
      <ChevronRight className="h-3.5 w-3.5" />
    </button>
  );
}

function MetricCard({ icon: Icon, label, value, helper, tone, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`${cardClass} group p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-[var(--workspace-card-hover)] disabled:cursor-default`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`rounded-xl border border-white/10 bg-white/[0.04] p-2.5 ${tone}`}><Icon className="h-4 w-4" /></span>
        {onClick && <ChevronRight className="h-4 w-4 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-cyan-200" />}
      </div>
      <p className="mt-5 text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 truncate text-xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{helper}</p>
    </button>
  );
}

function formatDashboardDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "오늘";
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "long" }).format(date);
}

function formatMeetingDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${Number(match[2])}월 ${Number(match[3])}일` : value || "날짜 미정";
}

function ScheduleList({ events, status, calendarStatus }) {
  if (calendarStatus === "loading") return <p className="p-5 text-sm text-slate-500">오늘 일정을 확인하는 중...</p>;
  if (status !== "authenticated") return <p className="p-5 text-sm leading-6 text-slate-500">Google 로그인 후 오늘 일정을 확인할 수 있어요.</p>;
  if (!events.length) return <p className="p-5 text-sm text-slate-500">오늘 등록된 일정이 없습니다.</p>;

  return (
    <div className="space-y-2 p-5">
      {events.slice(0, 4).map((event, index) => (
        <div key={event.id || `${event.title}-${index}`} className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/35 p-3">
          <span className="h-9 w-1 rounded-full bg-gradient-to-b from-cyan-300 to-blue-500" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-100">{event.title}</p>
            <p className="mt-1 truncate text-xs text-slate-500">{[event.time || "시간 미정", event.place].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function TaskPreview({ tasks, onToggle, onOpenTasks }) {
  if (!tasks.length) return <p className="p-5 text-sm text-slate-500">남은 할 일이 없습니다. 가볍게 하루를 시작해보세요.</p>;
  return (
    <div className="space-y-2 p-5">
      {tasks.slice(0, 5).map((task) => (
        <button key={task.id} type="button" onClick={() => onToggle(task.id)} className="flex w-full items-start gap-3 rounded-xl border border-transparent p-2.5 text-left transition hover:border-white/10 hover:bg-white/[0.05]">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-600 text-transparent"><Check className="h-3.5 w-3.5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-slate-100">{task.title}</span>
            <span className="mt-1 block text-xs text-slate-500">우선순위 {task.priority || "보통"}</span>
          </span>
        </button>
      ))}
      {tasks.length > 5 && <button type="button" onClick={onOpenTasks} className="w-full rounded-xl bg-white/[0.04] py-2.5 text-xs text-slate-400 transition hover:bg-white/10 hover:text-white">남은 {tasks.length - 5}개 더 보기</button>}
    </div>
  );
}

function RecentRecords({ meetings, notes, meetingStatus, onOpenMeetings, onOpenNotes }) {
  const records = [
    ...meetings.slice(0, 2).map((meeting) => ({ id: `meeting-${meeting.id}`, title: meeting.title, helper: formatMeetingDate(meeting.meetingDate), type: "meeting", onClick: onOpenMeetings })),
    ...notes.slice(0, 2).map((note) => {
      const locked = Boolean(note.isLocked ?? note.is_locked);
      return { id: `note-${note.id}`, title: note.title, helper: locked ? "잠긴 메모" : note.tag || "메모", type: locked ? "locked" : "note", onClick: onOpenNotes };
    }),
  ].slice(0, 4);

  if (meetingStatus === "loading" && !records.length) return <p className="p-5 text-sm text-slate-500">최근 기록을 불러오는 중...</p>;
  if (!records.length) return <p className="p-5 text-sm text-slate-500">아직 표시할 회의록이나 메모가 없습니다.</p>;

  return (
    <div className="space-y-2 p-5">
      {records.map((record) => {
        const Icon = record.type === "meeting" ? ClipboardList : record.type === "locked" ? Lock : FileText;
        return (
          <button key={record.id} type="button" onClick={record.onClick} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-slate-950/35 p-3 text-left transition hover:bg-white/[0.06]">
            <span className="rounded-lg bg-cyan-300/10 p-2 text-cyan-200"><Icon className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-100">{record.title}</span><span className="mt-1 block text-xs text-slate-500">{record.helper}</span></span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
          </button>
        );
      })}
    </div>
  );
}

function DrivePreview({ files, status, driveStatus, onOpenDrive, onRequestDriveDelete, deletingDriveFileId, deleteMessage, deleteMessageType }) {
  return (
    <>
      <div className="space-y-2 p-5">
        {files.slice(0, 5).map((file) => (
          <div key={file.id} className="flex items-center gap-3 rounded-xl border border-transparent p-2.5 transition hover:border-white/10 hover:bg-white/[0.05]">
            <span className="rounded-xl border border-white/10 bg-slate-950/35 p-2.5 text-cyan-200">
              {file.iconLink ? <img src={file.iconLink} alt="" className="h-4 w-4" /> : <File className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-100">{file.name}</p>
              <p className="mt-1 truncate text-xs text-slate-500">{file.updated || file.owner || "Google Drive"}</p>
            </div>
            {file.link && <a href={file.link} target="_blank" rel="noreferrer" aria-label={`${file.name} 열기`} className="rounded-lg border border-white/10 p-2 text-slate-500 transition hover:bg-white/10 hover:text-cyan-200"><ExternalLink className="h-4 w-4" /></a>}
            {onRequestDriveDelete && (
              <button type="button" aria-label={`${file.name} 삭제`} disabled={(file.canTrash !== true && file.canDelete !== true) || deletingDriveFileId === file.id} onClick={() => onRequestDriveDelete(file)} className="rounded-lg border border-white/10 p-2 text-slate-500 transition hover:border-rose-300/30 hover:bg-rose-400/10 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-30">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {driveStatus === "loading" && <p className="py-4 text-center text-sm text-slate-500">최근 파일을 불러오는 중...</p>}
        {driveStatus !== "loading" && !files.length && <p className="py-4 text-center text-sm text-slate-500">{status === "authenticated" ? "최근 Drive 파일이 없습니다." : "Google 로그인 후 Drive 파일을 확인할 수 있어요."}</p>}
      </div>
      {deleteMessage && <p className={`px-5 pb-4 text-sm ${deleteMessageType === "success" ? "text-emerald-200" : "text-rose-200"}`}>{deleteMessage}</p>}
      <div className="border-t border-white/10 p-4"><button type="button" onClick={onOpenDrive} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.04] py-2.5 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white">전체 Drive 보기 <ChevronRight className="h-4 w-4" /></button></div>
    </>
  );
}

export default function DashboardRedesign({
  tasks,
  notes,
  meetings,
  meetingStatus,
  toggleTask,
  todayDate,
  session,
  status,
  calendarEvents,
  calendarStatus,
  driveFilesData,
  driveStatus,
  onRequestDriveDelete,
  deletingDriveFileId,
  driveDeleteMessage,
  driveDeleteMessageType,
  weather,
  weatherStatus,
  weatherError,
  onOpenWeather,
  onOpenNotes,
  onOpenMeetings,
  onOpenCalendar,
  onOpenTasks,
  onOpenDrive,
  onOpenAI,
  assetManager,
  onOpenAssets,
}) {
  const activeTasks = tasks.filter((task) => !task.completed);
  const todayEvents = calendarEvents?.today || [];
  const assetSummary = assetManager.data.summary;
  const currentWeather = weather?.current;
  const displayName = session?.user?.name?.trim()?.split(/\s+/)[0] || "주언";
  const todayLabel = formatDashboardDate(todayDate);
  const questions = ["이번 달 지출 알려줘", "오늘 일정 알려줘", "남은 할 일 알려줘", "최근 회의록 요약해줘"];

  return (
    <div className="space-y-5">
      <Panel className="relative">
        <div className="pointer-events-none absolute -right-20 -top-32 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-200">PERSONAL OS</span><span className="text-xs text-slate-500">{todayLabel}</span></div>
            <h3 className="mt-5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">좋은 하루예요, {displayName}님.</h3>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">오늘은 일정 {todayEvents.length}개, 남은 할 일 {activeTasks.length}개, 이번 달 지출 {formatWon(assetSummary.monthlyExpense)}이 있어요.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <button type="button" onClick={onOpenAI} className="flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"><Sparkles className="h-4 w-4" />L-Lee AI 열기</button>
              <button type="button" onClick={onOpenTasks} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/10 hover:text-white">오늘 정리하기 <ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-slate-950/35 p-3">
            <div className="rounded-xl bg-white/[0.04] p-3"><p className="text-[11px] text-slate-500">Calendar</p><p className="mt-2 text-sm font-semibold text-slate-100">{calendarStatus === "loading" ? "동기화 중" : `오늘 ${todayEvents.length}개`}</p></div>
            <div className="rounded-xl bg-white/[0.04] p-3"><p className="text-[11px] text-slate-500">Workspace</p><p className="mt-2 text-sm font-semibold text-slate-100">{status === "authenticated" ? "연결됨" : "로그인 필요"}</p></div>
          </div>
        </div>
      </Panel>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Wallet} label="현재 자산" value={formatWon(assetSummary.totalBalance)} helper="자산관리" tone="text-cyan-200" onClick={onOpenAssets} />
        <MetricCard icon={CreditCard} label="이번 달 지출" value={formatWon(assetSummary.monthlyExpense)} helper="월간 사용 금액" tone="text-rose-200" onClick={onOpenAssets} />
        <MetricCard icon={CalendarDays} label="오늘 일정" value={`${todayEvents.length}개`} helper="Google Calendar" tone="text-violet-200" onClick={onOpenCalendar} />
        <MetricCard icon={CheckSquare} label="남은 할 일" value={`${activeTasks.length}개`} helper={`전체 ${tasks.length}개`} tone="text-emerald-200" onClick={onOpenTasks} />
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3 px-1"><div><p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-300/70">Today flow</p><h3 className="mt-1 text-lg font-semibold text-white">오늘의 흐름</h3></div><span className="hidden text-xs text-slate-500 sm:block">지금 필요한 정보만 모았어요</span></div>
        <div className="grid gap-4 xl:grid-cols-3">
          <Panel><PanelHeader icon={CalendarDays} title="오늘 일정" action={<TextAction onClick={onOpenCalendar}>캘린더 열기</TextAction>} /><ScheduleList events={todayEvents} status={status} calendarStatus={calendarStatus} /></Panel>
          <Panel><PanelHeader icon={CheckSquare} title="남은 할 일" action={<TextAction onClick={onOpenTasks}>전체 보기</TextAction>} /><TaskPreview tasks={activeTasks} onToggle={toggleTask} onOpenTasks={onOpenTasks} /></Panel>
          <Panel><PanelHeader icon={ClipboardList} title="최근 기록" /><RecentRecords meetings={meetings} notes={notes} meetingStatus={meetingStatus} onOpenMeetings={onOpenMeetings} onOpenNotes={onOpenNotes} /></Panel>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-12">
        <Panel className="xl:col-span-7">
          <PanelHeader icon={TrendingUp} eyebrow="Finance" title="자산 흐름" action={<TextAction onClick={onOpenAssets}>자산관리 열기</TextAction>} />
          <div className="grid gap-px bg-white/[0.06] sm:grid-cols-2">
            {[
              ["현재 총 자산", assetSummary.totalBalance, "text-cyan-200"],
              ["이번 달 수입", assetSummary.monthlyIncome, "text-emerald-200"],
              ["이번 달 지출", assetSummary.monthlyExpense, "text-rose-200"],
              ["이번 달 순이익", assetSummary.monthlyNet, assetSummary.monthlyNet >= 0 ? "text-cyan-200" : "text-rose-200"],
            ].map(([label, amount, tone]) => <div key={label} className="bg-[var(--workspace-card)] p-5"><p className="text-xs text-slate-500">{label}</p><p className={`mt-2 text-xl font-semibold tracking-tight ${tone}`}>{formatWon(amount)}</p></div>)}
          </div>
          {assetManager.status === "missing" && <p className="border-t border-white/10 px-5 py-4 text-sm text-amber-200">자산관리 테이블이 아직 준비되지 않았습니다. SQL을 실행해주세요.</p>}
        </Panel>

        <Panel className="xl:col-span-5">
          <PanelHeader icon={Sparkles} eyebrow="Read only" title="L-Lee AI 추천 질문" action={<TextAction onClick={onOpenAI}>AI 열기</TextAction>} />
          <div className="grid gap-2 p-5 sm:grid-cols-2">
            {questions.map((question) => <button key={question} type="button" onClick={onOpenAI} className="group flex min-h-16 items-center justify-between gap-3 rounded-xl border border-white/10 bg-gradient-to-br from-cyan-300/[0.07] to-violet-400/[0.05] px-4 py-3 text-left text-sm leading-5 text-slate-200 transition hover:border-cyan-300/25 hover:bg-cyan-300/10"><span>{question}</span><ChevronRight className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-cyan-200" /></button>)}
          </div>
          <p className="border-t border-white/10 px-5 py-3 text-xs text-slate-500">워크스페이스 데이터를 읽기 전용으로 확인합니다.</p>
        </Panel>

        <Panel className="xl:col-span-7">
          <PanelHeader icon={FolderOpen} eyebrow="Google Drive" title="최근 파일" action={<TextAction onClick={onOpenDrive}>드라이브 열기</TextAction>} />
          <DrivePreview files={driveFilesData} status={status} driveStatus={driveStatus} onOpenDrive={onOpenDrive} onRequestDriveDelete={onRequestDriveDelete} deletingDriveFileId={deletingDriveFileId} deleteMessage={driveDeleteMessage} deleteMessageType={driveDeleteMessageType} />
        </Panel>

        <Panel className="xl:col-span-5">
          <PanelHeader icon={Cloud} eyebrow="Weather" title="오늘의 날씨" action={<TextAction onClick={onOpenWeather}>날씨 열기</TextAction>} />
          <div className="p-5">
            {weatherStatus === "loading" && <p className="text-sm text-slate-500">날씨를 불러오는 중...</p>}
            {weatherStatus !== "loading" && currentWeather && (
              <div className="rounded-2xl border border-cyan-300/15 bg-gradient-to-br from-cyan-300/[0.08] to-blue-500/[0.04] p-5">
                <div className="flex items-end justify-between gap-4"><div><p className="text-xs text-slate-500">{weather.location || "현재 위치"}</p><p className="mt-2 text-4xl font-semibold tracking-tight text-white">{currentWeather.temp}°</p><p className="mt-2 text-sm text-slate-300">{currentWeather.condition}</p></div><Cloud className="h-12 w-12 text-cyan-200" /></div>
                <div className="mt-5 grid grid-cols-2 gap-2 text-xs text-slate-400"><div className="rounded-xl bg-white/[0.04] p-3">최고 {currentWeather.high}° · 최저 {currentWeather.low}°</div><div className="rounded-xl bg-white/[0.04] p-3">습도 {currentWeather.humidity ?? "-"}%</div></div>
              </div>
            )}
            {weatherStatus === "error" && <p className="text-sm text-rose-200">{weatherError || "날씨를 불러오지 못했습니다."}</p>}
          </div>
        </Panel>
      </div>
    </div>
  );
}
