"use client";

import { CalendarDays, Check, LoaderCircle, Plus, X } from "lucide-react";

const LABELS = {
  title: "제목",
  date: "날짜",
  time: "시간",
  startTime: "시작 시간",
  endTime: "종료 시간",
  priority: "우선순위",
  description: "설명",
  content: "내용",
  tag: "태그",
  transactionType: "유형",
  amount: "금액",
  category: "카테고리",
  calculation: "계산",
  attendees: "참석자",
  decisions: "결정 사항",
  actionItems: "후속 작업",
  notice: "안내",
};

function displayValue(key, value) {
  if (value === null || value === undefined || value === "") return "비어 있음";
  if (key === "amount") return `₩${Math.round(Number(value) || 0).toLocaleString("ko-KR")}`;
  if (key === "date" && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const [year, month, day] = String(value).split("-").map(Number);
    return `${year}년 ${month}월 ${day}일`;
  }
  return String(value);
}

export default function AssistantActionCard({ action, status = "pending", resultMessage = "", onConfirm, onCancel, compact = false }) {
  const entries = Object.entries(action.preview || {}).filter(([key]) => key !== "typeLabel");
  const pending = status === "pending";
  const loading = status === "loading";

  return (
    <div className={`mt-3 overflow-hidden rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.055] ${compact ? "text-xs" : "text-sm"}`}>
      <div className="flex items-center gap-2 border-b border-cyan-300/15 px-4 py-3">
        <span className="rounded-lg bg-cyan-300/10 p-2 text-cyan-200"><CalendarDays className="h-4 w-4" /></span>
        <div><p className="font-semibold text-slate-100">{action.preview?.typeLabel || "데이터 추가"}</p><p className="mt-0.5 text-[11px] text-slate-500">저장 전 내용을 확인해주세요.</p></div>
      </div>
      <dl className="divide-y divide-white/[0.06] px-4">
        {entries.map(([key, value]) => (
          <div key={key} className={`grid gap-1 py-2.5 ${compact ? "grid-cols-[72px_1fr]" : "grid-cols-[96px_1fr]"}`}>
            <dt className="text-slate-500">{LABELS[key] || key}</dt>
            <dd className="whitespace-pre-wrap break-words text-slate-200">{displayValue(key, value)}</dd>
          </div>
        ))}
      </dl>
      {(pending || loading) && (
        <div className="flex gap-2 border-t border-white/10 p-3">
          <button type="button" onClick={onCancel} disabled={loading} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2.5 text-slate-300 transition hover:bg-white/10 disabled:opacity-50"><X className="h-3.5 w-3.5" />취소</button>
          <button type="button" onClick={onConfirm} disabled={loading} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-cyan-300 px-3 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50">{loading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}{loading ? "추가 중..." : "추가하기"}</button>
        </div>
      )}
      {status === "success" && <p className="flex items-center gap-2 border-t border-emerald-300/15 bg-emerald-300/[0.06] px-4 py-3 text-emerald-200"><Check className="h-4 w-4" />{resultMessage}</p>}
      {status === "cancelled" && <p className="border-t border-white/10 px-4 py-3 text-slate-500">추가를 취소했습니다.</p>}
      {status === "error" && <p className="border-t border-rose-300/15 bg-rose-400/[0.06] px-4 py-3 text-rose-200">{resultMessage || "저장하지 못했습니다. 잠시 후 다시 시도해주세요."}</p>}
    </div>
  );
}
