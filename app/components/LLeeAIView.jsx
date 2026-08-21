"use client";

import { useState } from "react";
import { Bot, Send, Sparkles } from "lucide-react";

const suggestions = [
  "이번 달 내가 얼마 썼어?",
  "이번 달 개발비 알려줘",
  "최근 지출 내역 보여줘",
  "이번 주 일정 정리해줘",
  "다음 달 예상 구독비 알려줘",
];

export default function LLeeAIView() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { id: "welcome", role: "assistant", text: "안녕하세요. Workspace 데이터 연결을 준비하고 있어요." },
  ]);

  function submit(event) {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;
    setMessages((current) => [
      ...current,
      { id: Date.now() + "-user", role: "user", text },
      { id: Date.now() + "-assistant", role: "assistant", text: "L-Lee AI 연결 준비 중입니다." },
    ]);
    setInput("");
  }

  return (
    <section className="mx-auto flex min-h-[620px] max-w-4xl flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.045] shadow-xl shadow-black/10 backdrop-blur-xl">
      <div className="border-b border-white/10 p-5 sm:p-6">
        <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-300/10"><Sparkles className="h-5 w-5 text-cyan-300" /></div><div><h3 className="font-semibold text-slate-100">L-Lee AI</h3><p className="mt-1 text-sm text-slate-400">Workspace의 일정, 자산, 프로젝트와 연결되는 개인 AI Assistant</p></div></div>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-5 workspace-scrollbar sm:p-6">
        {messages.map((message) => <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}><div className={message.role === "user" ? "max-w-[85%] rounded-2xl rounded-br-md bg-cyan-300 px-4 py-3 text-sm text-slate-950" : "max-w-[85%] rounded-2xl rounded-bl-md border border-white/10 bg-slate-950/35 px-4 py-3 text-sm text-slate-300"}>{message.role === "assistant" && <Bot className="mr-2 inline h-4 w-4 text-cyan-300" />}{message.text}</div></div>)}
      </div>
      <div className="border-t border-white/10 p-4 sm:p-5">
        <p className="mb-3 text-xs text-slate-500">추천 명령</p>
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1 workspace-scrollbar">{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => setInput(suggestion)} className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-400 transition hover:border-cyan-300/30 hover:text-cyan-200">{suggestion}</button>)}</div>
        <form onSubmit={submit} className="flex gap-2"><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="L-Lee AI에게 물어보세요" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/50" /><button aria-label="보내기" className="rounded-xl bg-cyan-300 px-4 text-slate-950 transition hover:bg-cyan-200"><Send className="h-4 w-4" /></button></form>
      </div>
    </section>
  );
}
