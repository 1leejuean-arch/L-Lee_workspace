"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { LoaderCircle, LockKeyhole, LogIn, LogOut, ShieldX } from "lucide-react";

const shellClass = "relative flex min-h-screen items-center justify-center overflow-hidden bg-[#07111f] px-4 py-10 text-slate-100";
const cardClass = "relative w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/70 p-7 text-center shadow-2xl shadow-black/40 backdrop-blur-2xl sm:p-9";

function BackgroundGlow() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
      <div className="absolute -right-20 bottom-1/4 h-80 w-80 rounded-full bg-blue-600/15 blur-3xl" />
    </div>
  );
}

function BrandIcon() {
  return (
    <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-cyan-300/20 bg-cyan-300/10 shadow-lg shadow-cyan-500/10">
      <img src="/l-lee-icon.png" alt="L-Lee Workspace" className="h-full w-full object-cover" />
    </div>
  );
}

function LoadingGate() {
  return (
    <main className={shellClass}>
      <BackgroundGlow />
      <div className={cardClass}>
        <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-cyan-300" />
        <p className="mt-4 text-sm text-slate-400">로그인 상태를 확인하는 중...</p>
      </div>
    </main>
  );
}

function LoginGate() {
  return (
    <main className={shellClass}>
      <BackgroundGlow />
      <section className={cardClass}>
        <BrandIcon />
        <div className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
          <LockKeyhole className="h-3.5 w-3.5" /> Private workspace
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">L-Lee Workspace</h1>
        <p className="mt-3 text-base text-slate-300">개인 OS에 로그인하세요.</p>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">Google 계정으로 로그인하면 워크스페이스를 사용할 수 있습니다.</p>
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
        >
          <LogIn className="h-4 w-4" /> Google로 로그인
        </button>
        <p className="mt-6 text-xs text-slate-600">이 워크스페이스는 개인용으로 보호되어 있습니다.</p>
      </section>
    </main>
  );
}

function AccessDenied({ email }) {
  return (
    <main className={shellClass}>
      <BackgroundGlow />
      <section className={cardClass}>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-300/20 bg-rose-400/10 text-rose-200">
          <ShieldX className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-white">접근할 수 없는 계정입니다.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">이 워크스페이스는 소유자 계정만 사용할 수 있습니다.</p>
        <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="text-xs text-slate-500">현재 로그인된 이메일</p>
          <p className="mt-1 break-all text-sm font-medium text-slate-200">{email || "확인할 수 없음"}</p>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
        >
          <LogOut className="h-4 w-4" /> 로그아웃
        </button>
      </section>
    </main>
  );
}

export default function WorkspaceAuthGate({ children }) {
  const { data: session, status } = useSession();

  if (status === "loading") return <LoadingGate />;
  if (status === "unauthenticated" || !session?.user) return <LoginGate />;
  if (session.user.isWorkspaceOwner !== true) return <AccessDenied email={session.user.email} />;
  return children;
}
