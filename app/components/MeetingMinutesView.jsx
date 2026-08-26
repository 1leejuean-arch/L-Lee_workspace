"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  Clock3,
  Eye,
  LoaderCircle,
  MapPin,
  Mic2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
  Users,
  X,
} from "lucide-react";

const TABLE_MISSING_MESSAGE = "회의록 테이블이 아직 준비되지 않았습니다. SQL을 실행해주세요.";

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Seoul" }).format(new Date());
}

function emptyDraft() {
  return { title: "", meetingDate: todayKey(), startTime: "", endTime: "", attendees: "", location: "", content: "", decisions: "", actionItems: "", tag: "" };
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

export function useMeetingMinutes(authStatus) {
  const [meetings, setMeetings] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  async function load() {
    if (authStatus !== "authenticated") {
      setMeetings([]);
      setStatus(authStatus === "loading" ? "loading" : "unauthenticated");
      setError("");
      return;
    }
    setStatus("loading");
    setError("");
    try {
      const response = await fetch("/api/meetings", { cache: "no-store" });
      const data = await readJson(response);
      if (!response.ok) {
        const requestError = new Error(data.message || "회의록을 불러오지 못했습니다.");
        requestError.code = data.error;
        throw requestError;
      }
      setMeetings(data.meetings || []);
      setStatus("ready");
    } catch (requestError) {
      setMeetings([]);
      setStatus(requestError.code === "MEETINGS_TABLE_MISSING" ? "missing" : "error");
      setError(requestError.message || "회의록을 불러오지 못했습니다.");
    }
  }

  useEffect(() => { load(); }, [authStatus]);

  async function save(draft, id = null) {
    const response = await fetch("/api/meetings", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { ...draft, id } : draft),
    });
    const data = await readJson(response);
    if (!response.ok) {
      const requestError = new Error(data.message || "회의록을 저장하지 못했습니다.");
      requestError.code = data.error;
      if (data.error === "MEETINGS_TABLE_MISSING") { setStatus("missing"); setError(TABLE_MISSING_MESSAGE); }
      throw requestError;
    }
    setMeetings((current) => {
      const next = id ? current.map((meeting) => meeting.id === id ? data.meeting : meeting) : [data.meeting, ...current];
      return [...next].sort(compareMeetings);
    });
    setStatus("ready");
    return data.meeting;
  }

  async function remove(id) {
    const response = await fetch("/api/meetings", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
    });
    const data = await readJson(response);
    if (!response.ok) {
      const requestError = new Error(data.message || "회의록을 삭제하지 못했습니다.");
      requestError.code = data.error;
      throw requestError;
    }
    setMeetings((current) => current.filter((meeting) => meeting.id !== id));
  }

  return { meetings, status, error, reload: load, save, remove };
}

function compareMeetings(first, second) {
  return String(second.meetingDate || "").localeCompare(String(first.meetingDate || "")) ||
    String(second.createdAt || "").localeCompare(String(first.createdAt || ""));
}

function koreaDateLabel(dateKey) {
  if (!dateKey) return "날짜 없음";
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(new Date(year, month - 1, day));
}

function dateTimeLabel(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(value));
}

function timeRange(meeting) {
  if (!meeting.startTime) return "시간 미정";
  return meeting.endTime ? `${meeting.startTime} - ${meeting.endTime}` : meeting.startTime;
}

function preview(value, fallback = "기록된 내용이 없습니다.") {
  return String(value || "").replace(/\s+/g, " ").trim() || fallback;
}

function getDateRange(filter) {
  const today = todayKey();
  const date = new Date(`${today}T00:00:00`);
  if (filter === "today") return { start: today, end: today };
  if (filter === "week") {
    const weekday = date.getDay();
    const start = new Date(date);
    start.setDate(date.getDate() + (weekday === 0 ? -6 : 1 - weekday));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: localDateKey(start), end: localDateKey(end) };
  }
  if (filter === "month") {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { start: localDateKey(start), end: localDateKey(end) };
  }
  return null;
}

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function Field({ label, children, className = "" }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>{children}</label>;
}

const inputClass = "w-full rounded-lg border border-white/10 bg-slate-950/55 px-3 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/50 disabled:opacity-60";

function MeetingForm({ draft, setDraft, onSubmit, status, submitLabel, onCancel }) {
  function update(field, value) { setDraft((current) => ({ ...current, [field]: value })); }
  return (
    <form onSubmit={onSubmit} className="grid gap-4 p-5 md:grid-cols-2">
      <Field label="회의 제목 *" className="md:col-span-2"><input required maxLength={200} value={draft.title} onChange={(event) => update("title", event.target.value)} placeholder="예: 방송부 회의" className={inputClass} /></Field>
      <Field label="날짜 *"><input required type="date" value={draft.meetingDate} onChange={(event) => update("meetingDate", event.target.value)} className={inputClass} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="시작 시간"><input type="time" value={draft.startTime} onChange={(event) => update("startTime", event.target.value)} className={inputClass} /></Field>
        <Field label="종료 시간"><input type="time" value={draft.endTime} onChange={(event) => update("endTime", event.target.value)} className={inputClass} /></Field>
      </div>
      <Field label="참석자" className="md:col-span-2"><input value={draft.attendees} onChange={(event) => update("attendees", event.target.value)} placeholder="주언, 민수, 지훈" className={inputClass} /></Field>
      <Field label="장소 또는 방식"><input value={draft.location} onChange={(event) => update("location", event.target.value)} placeholder="회의실, Google Meet 등" className={inputClass} /></Field>
      <Field label="태그"><input value={draft.tag} onChange={(event) => update("tag", event.target.value)} placeholder="예: 방송부, 프로젝트" className={inputClass} /></Field>
      <Field label="회의 내용" className="md:col-span-2"><textarea rows={5} value={draft.content} onChange={(event) => update("content", event.target.value)} placeholder="논의한 내용을 기록하세요." className={`${inputClass} workspace-scrollbar resize-y leading-6`} /></Field>
      <Field label="결정 사항" className="md:col-span-2"><textarea rows={3} value={draft.decisions} onChange={(event) => update("decisions", event.target.value)} placeholder="회의에서 결정된 사항을 기록하세요." className={`${inputClass} workspace-scrollbar resize-y leading-6`} /></Field>
      <Field label="할 일 / 후속 작업" className="md:col-span-2"><textarea rows={3} value={draft.actionItems} onChange={(event) => update("actionItems", event.target.value)} placeholder="담당자와 후속 작업을 기록하세요." className={`${inputClass} workspace-scrollbar resize-y leading-6`} /></Field>
      <div className="flex justify-end gap-2 md:col-span-2">
        {onCancel && <button type="button" onClick={onCancel} disabled={status === "loading"} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-slate-300 transition hover:bg-white/10 disabled:opacity-50">취소</button>}
        <button type="submit" disabled={status === "loading"} className="flex items-center gap-2 rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60">
          {status === "loading" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{status === "loading" ? "저장 중..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

function DetailSection({ title, value }) {
  return <section><h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-300/80">{title}</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-300">{value || "기록된 내용이 없습니다."}</p></section>;
}

export default function MeetingMinutesView({ manager, authStatus, onTasksAdded }) {
  const { meetings, status, error, save, remove, reload } = manager;
  const [draft, setDraft] = useState(emptyDraft);
  const [formStatus, setFormStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(emptyDraft);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteStatus, setDeleteStatus] = useState("idle");
  const [analysisTarget, setAnalysisTarget] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisStatus, setAnalysisStatus] = useState("idle");
  const [analysisError, setAnalysisError] = useState("");
  const [selectedActions, setSelectedActions] = useState(new Set());
  const [addedActions, setAddedActions] = useState(new Set());
  const [taskAddStatus, setTaskAddStatus] = useState("idle");
  const [taskAddMessage, setTaskAddMessage] = useState("");

  const tags = useMemo(() => [...new Set(meetings.map((meeting) => meeting.tag).filter(Boolean))].sort(), [meetings]);
  const filteredMeetings = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const range = getDateRange(dateFilter);
    return meetings.filter((meeting) => {
      const matchesQuery = !normalizedQuery || [meeting.title, meeting.attendees, meeting.content, meeting.decisions, meeting.actionItems, meeting.tag]
        .join(" ").toLocaleLowerCase().includes(normalizedQuery);
      const matchesDate = !range || (meeting.meetingDate >= range.start && meeting.meetingDate <= range.end);
      const matchesTag = tagFilter === "all" || meeting.tag === tagFilter;
      return matchesQuery && matchesDate && matchesTag;
    });
  }, [dateFilter, meetings, query, tagFilter]);

  async function createMeeting(event) {
    event.preventDefault();
    if (authStatus !== "authenticated") { setMessage("Google 로그인이 필요합니다."); return; }
    setFormStatus("loading"); setMessage("");
    try {
      await save(draft);
      setDraft(emptyDraft());
      setMessage("회의록을 저장했습니다.");
      setFormStatus("success");
    } catch (requestError) {
      setMessage(requestError.message || "회의록을 저장하지 못했습니다.");
      setFormStatus("error");
    }
  }

  function openDetail(meeting) { setSelected(meeting); setEditing(false); setMessage(""); setFormStatus("idle"); }
  function openEdit(meeting) { setSelected(meeting); setEditDraft({ ...meeting }); setEditing(true); setMessage(""); setFormStatus("idle"); }
  function requestDelete(meeting) { setDeleteTarget(meeting); setDeleteStatus("idle"); setMessage(""); }

  async function updateMeeting(event) {
    event.preventDefault(); setFormStatus("loading"); setMessage("");
    try {
      const updated = await save(editDraft, selected.id);
      setSelected(updated); setEditing(false); setFormStatus("success"); setMessage("회의록을 수정했습니다.");
    } catch (requestError) {
      setFormStatus("error"); setMessage(requestError.message || "회의록을 저장하지 못했습니다.");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleteStatus === "loading") return;
    setDeleteStatus("loading"); setMessage("");
    try {
      await remove(deleteTarget.id);
      if (selected?.id === deleteTarget.id) setSelected(null);
      setDeleteTarget(null); setMessage("회의록을 삭제했습니다.");
    } catch (requestError) {
      setMessage(requestError.message || "회의록을 삭제하지 못했습니다.");
      setDeleteStatus("error");
      return;
    }
    setDeleteStatus("idle");
  }

  function actionKey(meetingId, title) {
    return `${meetingId}:${String(title || "").trim().toLocaleLowerCase()}`;
  }

  async function analyzeMeeting(meeting) {
    setAnalysisTarget(meeting);
    setAnalysisResult(null);
    setAnalysisStatus("loading");
    setAnalysisError("");
    setTaskAddStatus("idle");
    setTaskAddMessage("");
    try {
      const response = await fetch("/api/meetings/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: meeting.id }),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.message || "회의록을 분석하지 못했습니다.");
      const result = {
        summary: data.summary || "기록된 회의 내용이 없습니다.",
        decisions: Array.isArray(data.decisions) ? data.decisions : [],
        actionItems: Array.isArray(data.actionItems) ? data.actionItems : [],
        mode: data.mode || "local",
      };
      setAnalysisResult(result);
      setSelectedActions(new Set(result.actionItems.map((item) => actionKey(meeting.id, item.title)).filter((key) => !addedActions.has(key))));
      setAnalysisStatus("ready");
    } catch {
      setAnalysisStatus("error");
      setAnalysisError("회의록을 분석하지 못했습니다.");
    }
  }

  function toggleAnalysisAction(key) {
    setSelectedActions((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function addSelectedTasks() {
    if (!analysisTarget || !analysisResult || taskAddStatus === "loading") return;
    const targets = analysisResult.actionItems.filter((item) => {
      const key = actionKey(analysisTarget.id, item.title);
      return selectedActions.has(key) && !addedActions.has(key);
    });
    if (!targets.length) return;
    setTaskAddStatus("loading");
    setTaskAddMessage("");
    const results = await Promise.allSettled(targets.map(async (item) => {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.title,
          priority: item.priority === "high" ? "높음" : item.priority === "low" ? "낮음" : "보통",
          source: "meeting",
          sourceId: analysisTarget.id,
        }),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || "TASK_CREATE_FAILED");
      return { key: actionKey(analysisTarget.id, item.title), duplicate: Boolean(data.duplicate) };
    }));
    const successes = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
    if (successes.length) {
      setAddedActions((current) => new Set([...current, ...successes.map((result) => result.key)]));
      setSelectedActions((current) => {
        const next = new Set(current);
        successes.forEach((result) => next.delete(result.key));
        return next;
      });
      try { await onTasksAdded?.(); } catch { /* The task API succeeded; the next workspace refresh can retry. */ }
    }
    if (successes.length !== targets.length) {
      setTaskAddStatus("error");
      setTaskAddMessage("선택한 할 일을 추가하지 못했습니다.");
    } else {
      setTaskAddStatus("success");
      const duplicateCount = successes.filter((result) => result.duplicate).length;
      setTaskAddMessage(duplicateCount ? "이미 추가된 항목은 중복 생성하지 않았습니다." : "선택한 할 일을 추가했습니다.");
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <section className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.045] shadow-lg shadow-black/10 xl:col-span-5">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4"><span className="rounded-lg bg-cyan-300/10 p-2 text-cyan-300"><Mic2 className="h-4 w-4" /></span><div><h3 className="font-semibold text-slate-100">새 회의록 작성</h3><p className="mt-0.5 text-xs text-slate-500">회의에서 남길 핵심 내용을 기록하세요.</p></div></div>
        <MeetingForm draft={draft} setDraft={setDraft} onSubmit={createMeeting} status={formStatus} submitLabel="회의록 저장" />
        {authStatus !== "authenticated" && <p className="mx-5 mb-5 rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-3 text-sm text-cyan-50">Google 로그인 후 회의록을 저장할 수 있습니다.</p>}
        {message && <p className={`mx-5 mb-5 rounded-lg border p-3 text-sm ${formStatus === "error" || deleteStatus === "error" ? "border-rose-300/20 bg-rose-400/10 text-rose-100" : "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"}`}>{message}</p>}
      </section>

      <section className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.045] shadow-lg shadow-black/10 xl:col-span-7">
        <div className="border-b border-white/10 p-5">
          <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold text-slate-100">회의록 목록</h3><p className="mt-1 text-xs text-slate-500">최신 회의부터 표시합니다.</p></div><span className="rounded-full bg-cyan-300/10 px-3 py-1 text-xs text-cyan-200">{filteredMeetings.length}개</span></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <label className="relative sm:col-span-3"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="제목, 참석자, 내용, 결정 사항, 할 일, 태그 검색" className={`${inputClass} pl-10`} /></label>
            <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className={`${inputClass} sm:col-span-2`}><option value="all">전체 기간</option><option value="today">오늘</option><option value="week">이번 주</option><option value="month">이번 달</option></select>
            <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} className={inputClass}><option value="all">전체 태그</option>{tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select>
          </div>
        </div>

        <div className="workspace-scrollbar max-h-[780px] space-y-3 overflow-y-auto p-5">
          {status === "loading" && <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin" /> 회의록을 불러오는 중...</div>}
          {status === "missing" && <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100"><p>{TABLE_MISSING_MESSAGE}</p><button type="button" onClick={reload} className="mt-3 rounded-lg border border-amber-200/20 px-3 py-2 text-xs hover:bg-white/10">다시 확인</button></div>}
          {status === "error" && <div className="rounded-lg border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-100">{error || "회의록을 불러오지 못했습니다."}</div>}
          {status === "unauthenticated" && <p className="py-12 text-center text-sm text-slate-500">Google 로그인 후 회의록을 확인할 수 있습니다.</p>}
          {status === "ready" && filteredMeetings.map((meeting) => (
            <article key={meeting.id} className="rounded-xl border border-white/10 bg-slate-950/35 p-4 transition hover:border-cyan-300/20 hover:bg-white/[0.055]">
              <button type="button" onClick={() => openDetail(meeting)} className="w-full text-left">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h4 className="break-words font-medium text-slate-100">{meeting.title}</h4><p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500"><span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{koreaDateLabel(meeting.meetingDate)}</span><span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{timeRange(meeting)}</span></p></div>{meeting.tag && <span className="shrink-0 rounded-full bg-cyan-300/10 px-2.5 py-1 text-[11px] text-cyan-200">{meeting.tag}</span>}</div>
                {meeting.attendees && <p className="mt-3 flex items-center gap-1.5 truncate text-xs text-slate-400"><Users className="h-3.5 w-3.5 shrink-0" />{meeting.attendees}</p>}
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-400">{preview(meeting.content)}</p>
              </button>
              <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-white/10 pt-3">
                <button type="button" onClick={() => analyzeMeeting(meeting)} className="flex items-center gap-1.5 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-2 text-xs text-cyan-200 hover:bg-cyan-300/10"><Sparkles className="h-3.5 w-3.5" />AI로 정리</button>
                <button type="button" onClick={() => openDetail(meeting)} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/10"><Eye className="h-3.5 w-3.5" />자세히</button>
                <button type="button" onClick={() => openEdit(meeting)} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/10"><Pencil className="h-3.5 w-3.5" />수정</button>
                <button type="button" onClick={() => requestDelete(meeting)} className="flex items-center gap-1.5 rounded-lg border border-rose-300/15 px-3 py-2 text-xs text-rose-200 hover:bg-rose-400/10"><Trash2 className="h-3.5 w-3.5" />삭제</button>
              </div>
            </article>
          ))}
          {status === "ready" && filteredMeetings.length === 0 && <p className="py-12 text-center text-sm text-slate-500">조건에 맞는 회의록이 없습니다.</p>}
        </div>
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <div className="workspace-scrollbar max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-black/50">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-slate-950/95 p-5 backdrop-blur-xl"><div><p className="text-xs font-medium uppercase tracking-[0.16em] text-cyan-300/80">회의록</p><h3 className="mt-2 text-xl font-semibold text-white">{selected.title}</h3></div><button type="button" onClick={() => setSelected(null)} aria-label="닫기" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button></div>
            {editing ? <div><MeetingForm draft={editDraft} setDraft={setEditDraft} onSubmit={updateMeeting} status={formStatus} submitLabel="수정 저장" onCancel={() => setEditing(false)} />{message && <p className={`mx-5 mb-5 rounded-lg border p-3 text-sm ${formStatus === "error" ? "border-rose-300/20 bg-rose-400/10 text-rose-100" : "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"}`}>{message}</p>}</div> : (
              <div className="space-y-6 p-5">
                <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-4 sm:grid-cols-2"><p className="flex items-center gap-2 text-sm text-slate-300"><CalendarDays className="h-4 w-4 text-cyan-300" />{koreaDateLabel(selected.meetingDate)}</p><p className="flex items-center gap-2 text-sm text-slate-300"><Clock3 className="h-4 w-4 text-cyan-300" />{timeRange(selected)}</p><p className="flex items-center gap-2 text-sm text-slate-300"><Users className="h-4 w-4 text-cyan-300" />{selected.attendees || "참석자 미입력"}</p><p className="flex items-center gap-2 text-sm text-slate-300"><MapPin className="h-4 w-4 text-cyan-300" />{selected.location || "장소/방식 미입력"}</p>{selected.tag && <p className="flex items-center gap-2 text-sm text-slate-300"><Tag className="h-4 w-4 text-cyan-300" />{selected.tag}</p>}</div>
                <DetailSection title="회의 내용" value={selected.content} /><DetailSection title="결정 사항" value={selected.decisions} /><DetailSection title="할 일 / 후속 작업" value={selected.actionItems} />
                <div className="border-t border-white/10 pt-4 text-xs leading-6 text-slate-500"><p>생성일: {dateTimeLabel(selected.createdAt)}</p><p>수정일: {dateTimeLabel(selected.updatedAt)}</p></div>
                <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => analyzeMeeting(selected)} className="flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.06] px-4 py-2.5 text-sm text-cyan-200 hover:bg-cyan-300/10"><Sparkles className="h-4 w-4" />AI로 정리</button><button type="button" onClick={() => requestDelete(selected)} className="rounded-lg border border-rose-300/20 px-4 py-2.5 text-sm text-rose-200 hover:bg-rose-400/10">삭제</button><button type="button" onClick={() => openEdit(selected)} className="rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-medium text-slate-950 hover:bg-cyan-200">수정</button></div>
              </div>
            )}
          </div>
        </div>
      )}

      {analysisTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && analysisStatus !== "loading" && taskAddStatus !== "loading") setAnalysisTarget(null); }}>
          <div className="workspace-scrollbar max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-cyan-300/20 bg-slate-950/95 shadow-2xl shadow-black/60">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-slate-950/95 p-5 backdrop-blur-xl">
              <div className="flex min-w-0 items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-300"><Sparkles className="h-5 w-5" /></span><div className="min-w-0"><p className="text-xs font-medium uppercase tracking-[0.16em] text-cyan-300/80">L-Lee AI 회의록 정리</p><h3 className="mt-1 truncate text-lg font-semibold text-white">{analysisTarget.title}</h3></div></div>
              <button type="button" onClick={() => setAnalysisTarget(null)} disabled={analysisStatus === "loading" || taskAddStatus === "loading"} aria-label="AI 분석 닫기" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-40"><X className="h-5 w-5" /></button>
            </div>

            {analysisStatus === "loading" && <div className="flex min-h-72 flex-col items-center justify-center gap-3 p-8 text-sm text-slate-400"><LoaderCircle className="h-7 w-7 animate-spin text-cyan-300" /><p>회의록을 정리하는 중...</p></div>}
            {analysisStatus === "error" && <div className="p-5"><p className="rounded-xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-100">{analysisError || "회의록을 분석하지 못했습니다."}</p></div>}
            {analysisStatus === "ready" && analysisResult && (
              <div className="space-y-6 p-5">
                <div className="flex justify-end"><span className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-1 text-[11px] text-cyan-200">{analysisResult.mode === "gemini" ? "Gemini 보강" : "무료 로컬 모드"}</span></div>
                <section className="rounded-xl border border-white/10 bg-white/[0.035] p-4"><h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-300/80">핵심 요약</h4><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-300">{analysisResult.summary}</p></section>
                <section><h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-300/80">결정 사항</h4>{analysisResult.decisions.length ? <ul className="mt-3 space-y-2">{analysisResult.decisions.map((decision, index) => <li key={`${decision}-${index}`} className="flex gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm leading-6 text-slate-300"><Check className="mt-1 h-4 w-4 shrink-0 text-cyan-300" /><span>{decision}</span></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">정리할 결정 사항이 없습니다.</p>}</section>
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-300/80">추출된 할 일</h4>
                  {analysisResult.actionItems.length ? <div className="mt-3 space-y-2">{analysisResult.actionItems.map((item, index) => { const key = actionKey(analysisTarget.id, item.title); const added = addedActions.has(key); return <label key={`${key}-${index}`} className={`flex items-start gap-3 rounded-xl border p-3 transition ${added ? "border-emerald-300/20 bg-emerald-300/[0.07]" : "border-white/10 bg-white/[0.03] hover:border-cyan-300/20"}`}><input type="checkbox" checked={added || selectedActions.has(key)} disabled={added || taskAddStatus === "loading"} onChange={() => toggleAnalysisAction(key)} className="mt-1 h-4 w-4 rounded border-white/20 accent-cyan-300" /><span className="min-w-0 flex-1 text-sm leading-6 text-slate-300">{item.title}</span><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] ${item.priority === "high" ? "bg-rose-400/10 text-rose-200" : item.priority === "low" ? "bg-slate-400/10 text-slate-400" : "bg-cyan-300/10 text-cyan-200"}`}>{added ? "추가됨" : item.priority === "high" ? "높음" : item.priority === "low" ? "낮음" : "보통"}</span></label>; })}</div> : <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">추출할 할 일이 없습니다. 회의록의 후속 작업 항목을 작성해보세요.</p>}
                </section>
                {taskAddMessage && <p className={`rounded-xl border p-3 text-sm ${taskAddStatus === "error" ? "border-rose-300/20 bg-rose-400/10 text-rose-100" : "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"}`}>{taskAddMessage}</p>}
                <div className="flex flex-col-reverse gap-2 border-t border-white/10 pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setAnalysisTarget(null)} disabled={taskAddStatus === "loading"} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/10 disabled:opacity-50">닫기</button><button type="button" onClick={addSelectedTasks} disabled={taskAddStatus === "loading" || !analysisResult.actionItems.some((item) => { const key = actionKey(analysisTarget.id, item.title); return selectedActions.has(key) && !addedActions.has(key); })} className="flex items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-medium text-slate-950 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50">{taskAddStatus === "loading" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{taskAddStatus === "loading" ? "할 일 추가 중..." : "선택한 할 일을 할 일 목록에 추가"}</button></div>
              </div>
            )}
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-slate-950/95 p-5 shadow-2xl"><div className="flex items-start gap-3"><span className="rounded-lg bg-rose-400/10 p-2 text-rose-200"><Trash2 className="h-5 w-5" /></span><div><h3 className="font-semibold text-white">이 회의록을 삭제할까요?</h3><p className="mt-2 text-sm leading-6 text-slate-400">“{deleteTarget.title}” 회의록은 삭제 후 복구할 수 없습니다.</p></div></div>{deleteStatus === "error" && <p className="mt-4 rounded-lg border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-100">{message || "회의록을 삭제하지 못했습니다."}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setDeleteTarget(null)} disabled={deleteStatus === "loading"} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/10 disabled:opacity-50">취소</button><button type="button" onClick={confirmDelete} disabled={deleteStatus === "loading"} className="flex items-center gap-2 rounded-lg bg-rose-400 px-4 py-2.5 text-sm font-medium text-white hover:bg-rose-300 disabled:opacity-60">{deleteStatus === "loading" && <LoaderCircle className="h-4 w-4 animate-spin" />}{deleteStatus === "loading" ? "삭제 중..." : "삭제"}</button></div></div>
        </div>
      )}
    </div>
  );
}
