"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, LoaderCircle, LockKeyhole, Send, Sparkles, User } from "lucide-react";

const suggestions = ["이번 달 지출 알려줘", "오늘 일정 알려줘", "남은 할 일 알려줘", "현재 자산 알려줘"];

export default function LLeeAIView() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [answerMode, setAnswerMode] = useState("unknown");
  const [messages, setMessages] = useState([{
    id: "welcome", role: "assistant", text: "안녕하세요. 자산, 일정, 할 일, 회의록에 관해 궁금한 내용을 물어보세요.",
  }]);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, loading]);

  async function ask(rawMessage) {
    const message = String(rawMessage ?? input).trim();
    if (!message || loading) return;
    const requestId = `${Date.now()}-${Math.random()}`;
    setMessages((current) => [...current, { id: `${requestId}-user`, role: "user", text: message }]);
    setInput("");
    setLoading(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }),
      });
      const data = await response.json().catch(() => ({}));
      if (data.mode) setAnswerMode(data.mode);
      setMessages((current) => [...current, {
        id: `${requestId}-assistant`, role: "assistant",
        text: data.answer || "답변을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.", error: !response.ok,
      }]);
    } catch {
      setMessages((current) => [...current, {
        id: `${requestId}-assistant`, role: "assistant", text: "L-Lee AI에 연결하지 못했습니다. 네트워크 상태를 확인해주세요.", error: true,
      }]);
    } finally {
      setLoading(false);
    }
  }

  function submit(event) { event.preventDefault(); ask(); }

  return (
    <section className="mx-auto flex min-h-[650px] max-w-5xl flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.045] shadow-xl shadow-black/10 backdrop-blur-xl">
      <div className="border-b border-white/10 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-300/10"><Sparkles className="h-5 w-5 text-cyan-300" /></div>
            <div>
              <h3 className="text-lg font-semibold text-slate-100">L-Lee AI</h3>
              <p className="mt-1 text-sm leading-6 text-slate-400">워크스페이스 데이터를 읽고 일정, 자산, 할 일, 회의록을 요약해드립니다.</p>
            </div>
          </div>
          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs text-emerald-200 sm:flex"><LockKeyhole className="h-3.5 w-3.5" /> 읽기 전용</span>
        </div>
      </div>

      {answerMode === "local" && (
        <div className="border-b border-cyan-300/15 bg-cyan-300/[0.06] px-5 py-3 text-xs leading-5 text-cyan-100 sm:px-6">
          무료 로컬 모드로 답변 중입니다. Gemini API 키를 설정하면 더 자연스러운 답변을 사용할 수 있습니다.
        </div>
      )}

      <div className="workspace-scrollbar flex-1 space-y-5 overflow-y-auto p-5 sm:p-6" aria-live="polite">
        {messages.map((message) => (
          <div key={message.id} className={`flex items-start gap-2.5 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            {message.role === "assistant" && <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-300/10 text-cyan-300"><Bot className="h-4 w-4" /></span>}
            <div className={message.role === "user"
              ? "max-w-[82%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-cyan-300 px-4 py-3 text-sm leading-6 text-slate-950"
              : `max-w-[82%] whitespace-pre-wrap rounded-2xl rounded-bl-md border px-4 py-3 text-sm leading-6 ${message.error ? "border-rose-300/20 bg-rose-400/10 text-rose-100" : "border-white/10 bg-slate-950/35 text-slate-300"}`}>
              {message.text}
            </div>
            {message.role === "user" && <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-slate-400"><User className="h-4 w-4" /></span>}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2.5 text-sm text-slate-400">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-300/10 text-cyan-300"><Bot className="h-4 w-4" /></span>
            <span className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-white/10 bg-slate-950/35 px-4 py-3"><LoaderCircle className="h-4 w-4 animate-spin" /> 워크스페이스 데이터를 확인하고 있어요.</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-white/10 p-4 sm:p-5">
        <p className="mb-3 text-xs font-medium text-slate-500">추천 질문</p>
        <div className="workspace-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">
          {suggestions.map((suggestion) => (
            <button key={suggestion} type="button" onClick={() => ask(suggestion)} disabled={loading}
              className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-400 transition hover:border-cyan-300/30 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50">
              {suggestion}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="flex gap-2">
          <input value={input} onChange={(event) => setInput(event.target.value)} disabled={loading} maxLength={1000}
            placeholder="예: 이번 달 내가 얼마 썼어?"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/50 disabled:opacity-60" />
          <button type="submit" aria-label="보내기" disabled={loading || !input.trim()}
            className="rounded-xl bg-cyan-300 px-4 text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
        <p className="mt-3 text-center text-[11px] text-slate-500">Gemini 키 없이도 무료 로컬 모드로 동작합니다. 메모는 분석하지 않으며, 데이터 추가·수정·삭제는 수행하지 않습니다.</p>
      </div>
    </section>
  );
}
