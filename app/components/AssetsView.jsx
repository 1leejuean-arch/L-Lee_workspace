"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BriefcaseBusiness, Pencil, Search, Trash2, WalletCards } from "lucide-react";

const incomeCategories = ["알바비", "용돈", "환불", "기타 수입"];
const expenseCategories = ["식비", "교통", "구독", "쇼핑", "학교", "취미", "기타 지출"];

function todayValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function emptyTransaction() {
  return { type: "expense", transactionDate: todayValue(), amount: "", title: "", category: "식비", memo: "" };
}

function emptyWorkShift() {
  return { transactionDate: todayValue(), hourlyWage: "", workHours: "", breakHours: "", memo: "" };
}

export function formatWon(value, { sign } = {}) {
  const amount = Math.round(Number(value) || 0);
  const prefix = sign === "income" ? "+ " : sign === "expense" ? "- " : "";
  return `${prefix}${Math.abs(amount).toLocaleString("ko-KR")}원`;
}

async function requestJson(url, options) {
  const response = await fetch(url, { cache: "no-store", ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "자산관리 요청을 처리하지 못했습니다.");
    error.code = data.error;
    throw error;
  }
  return data;
}

const emptyAssetData = {
  initialBalance: 0,
  hasInitialBalance: false,
  transactions: [],
  summary: { totalBalance: 0, monthlyIncome: 0, monthlyExpense: 0, monthlyNet: 0, totalIncome: 0, totalExpense: 0 },
};

export function useAssetManager(authStatus) {
  const [data, setData] = useState(emptyAssetData);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const reload = useCallback(async () => {
    if (authStatus !== "authenticated") {
      setData(emptyAssetData);
      setStatus("idle");
      setError("");
      return;
    }
    setStatus("loading");
    try {
      const nextData = await requestJson("/api/assets");
      setData(nextData);
      setStatus("ready");
      setError("");
    } catch (requestError) {
      setStatus(requestError.code === "ASSET_TABLES_MISSING" ? "missing" : "error");
      setError(requestError.message || "자산관리 데이터를 불러오지 못했습니다.");
    }
  }, [authStatus]);

  useEffect(() => {
    reload();
  }, [reload]);

  const mutate = useCallback(async (url, options) => {
    if (savingRef.current) return null;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const result = await requestJson(url, options);
      await reload();
      return result;
    } catch (requestError) {
      setError(requestError.message || "자산관리 요청을 처리하지 못했습니다.");
      if (requestError.code === "ASSET_TABLES_MISSING") setStatus("missing");
      throw requestError;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [reload]);

  return {
    data,
    status,
    error,
    saving,
    reload,
    saveInitialBalance: (initialBalance) => mutate("/api/assets/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initialBalance }),
    }),
    saveTransaction: (transaction, id) => mutate("/api/assets/transactions", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id, ...transaction } : transaction),
    }),
    deleteTransaction: (id) => mutate("/api/assets/transactions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }),
  };
}

function SectionCard({ children, className = "" }) {
  return <section className={`rounded-xl border border-white/10 bg-white/[0.045] shadow-xl shadow-black/10 backdrop-blur-xl ${className}`}>{children}</section>;
}

function Field({ label, children, className = "" }) {
  return <label className={`block ${className}`}><span className="mb-2 block text-xs text-slate-400">{label}</span>{children}</label>;
}

const inputClass = "w-full rounded-lg border border-white/10 bg-slate-950/45 px-3 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10";

export default function AssetsView({ manager, authStatus }) {
  const { data, status, error, saving, reload, saveInitialBalance, saveTransaction, deleteTransaction } = manager;
  const [initialBalance, setInitialBalance] = useState("");
  const [formMode, setFormMode] = useState("transaction");
  const [transactionDraft, setTransactionDraft] = useState(emptyTransaction);
  const [workDraft, setWorkDraft] = useState(emptyWorkShift);
  const [editingId, setEditingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (data.hasInitialBalance) setInitialBalance(String(data.initialBalance));
  }, [data.hasInitialBalance, data.initialBalance]);

  const actualWorkHours = Math.max(0, (Number(workDraft.workHours) || 0) - (Number(workDraft.breakHours) || 0));
  const expectedWage = Math.round((Number(workDraft.hourlyWage) || 0) * actualWorkHours);

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonth = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`;
    const normalizedQuery = query.trim().toLowerCase();
    return data.transactions.filter((transaction) => {
      if (filter === "income" && transaction.type !== "income") return false;
      if (filter === "expense" && transaction.type !== "expense") return false;
      if (filter === "wage" && transaction.category !== "알바비") return false;
      if (filter === "current" && !transaction.transactionDate.startsWith(currentMonth)) return false;
      if (filter === "previous" && !transaction.transactionDate.startsWith(previousMonth)) return false;
      if (!normalizedQuery) return true;
      return `${transaction.title} ${transaction.memo} ${transaction.category}`.toLowerCase().includes(normalizedQuery);
    });
  }, [data.transactions, filter, query]);

  async function submitInitialBalance(event) {
    event.preventDefault();
    setMessage("");
    try {
      await saveInitialBalance(initialBalance);
      setMessage("초기 자산을 저장했습니다.");
    } catch {}
  }

  async function submitTransaction(event) {
    event.preventDefault();
    setMessage("");
    try {
      await saveTransaction(transactionDraft, editingId);
      setTransactionDraft(emptyTransaction());
      setEditingId(null);
      setMessage(editingId ? "거래 내역을 수정했습니다." : "거래 내역을 추가했습니다.");
    } catch {}
  }

  async function addWorkIncome(event) {
    event.preventDefault();
    if (expectedWage <= 0 || actualWorkHours <= 0) {
      setMessage("시급과 실제 근무 시간을 올바르게 입력해주세요.");
      return;
    }
    const breakHours = Number(workDraft.breakHours) || 0;
    const memoParts = [`시급 ${formatWon(workDraft.hourlyWage)}`, `근무 ${Number(workDraft.workHours)}시간`, `휴게 ${breakHours}시간`];
    if (workDraft.memo.trim()) memoParts.push(workDraft.memo.trim());
    try {
      await saveTransaction({
        type: "income",
        title: "알바비",
        amount: expectedWage,
        category: "알바비",
        memo: memoParts.join(" · "),
        transactionDate: workDraft.transactionDate,
        hourlyWage: Number(workDraft.hourlyWage),
        workHours: Number(workDraft.workHours),
        breakHours,
      });
      setWorkDraft(emptyWorkShift());
      setMessage("알바비를 수입으로 추가했습니다.");
    } catch {}
  }

  function startEdit(transaction) {
    setFormMode("transaction");
    setEditingId(transaction.id);
    setTransactionDraft({
      type: transaction.type,
      transactionDate: transaction.transactionDate,
      amount: String(transaction.amount),
      title: transaction.title,
      category: transaction.category,
      memo: transaction.memo || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function confirmDelete() {
    if (!deleteTarget?.id) return;
    try {
      await deleteTransaction(deleteTarget.id);
      setDeleteTarget(null);
      setMessage("거래 내역을 삭제했습니다.");
    } catch {}
  }

  if (authStatus !== "authenticated") {
    return <SectionCard className="p-6"><p className="text-sm text-slate-300">Google 계정을 연결하면 자산 데이터를 안전하게 저장할 수 있습니다.</p></SectionCard>;
  }

  return (
    <div className="space-y-5">
      {(error || message) && <div className={`rounded-lg border px-4 py-3 text-sm ${error ? "border-rose-300/20 bg-rose-400/10 text-rose-100" : "border-emerald-300/20 bg-emerald-400/10 text-emerald-100"}`}>{error || message}</div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["현재 총 자산", data.summary.totalBalance, "text-cyan-200"],
          ["이번 달 수입", data.summary.monthlyIncome, "text-emerald-200"],
          ["이번 달 지출", data.summary.monthlyExpense, "text-rose-200"],
          ["이번 달 순이익", data.summary.monthlyNet, data.summary.monthlyNet >= 0 ? "text-cyan-200" : "text-rose-200"],
        ].map(([label, value, tone]) => (
          <SectionCard key={label} className="p-5"><p className="text-xs text-slate-500">{label}</p><p className={`mt-3 text-2xl font-semibold ${tone}`}>{formatWon(value)}</p></SectionCard>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <SectionCard className="p-5 xl:col-span-4">
          <div className="flex items-center gap-3"><WalletCards className="h-5 w-5 text-cyan-300"/><h3 className="font-semibold text-slate-100">초기 자산</h3></div>
          <p className="mt-2 text-sm leading-6 text-slate-400">현재 가지고 있는 돈을 기준 금액으로 설정합니다. 언제든 수정할 수 있습니다.</p>
          <form onSubmit={submitInitialBalance} className="mt-5 space-y-3">
            <Field label="현재 가지고 있는 돈"><input type="number" min="0" step="1" required value={initialBalance} onChange={(event) => setInitialBalance(event.target.value)} className={inputClass} placeholder="0" /></Field>
            <button disabled={saving || status === "missing"} className="w-full rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "저장 중..." : data.hasInitialBalance ? "초기 자산 수정" : "초기 자산 저장"}</button>
          </form>
        </SectionCard>

        <SectionCard className="xl:col-span-8">
          <div className="flex border-b border-white/10 p-2">
            {[["transaction", editingId ? "거래 수정" : "거래 추가"], ["work", "알바 계산"]].map(([key, label]) => <button key={key} type="button" onClick={() => setFormMode(key)} className={`rounded-lg px-4 py-2 text-sm transition ${formMode === key ? "bg-cyan-300 text-slate-950" : "text-slate-400 hover:bg-white/10 hover:text-white"}`}>{label}</button>)}
          </div>
          {formMode === "transaction" ? (
            <form onSubmit={submitTransaction} className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="유형"><select value={transactionDraft.type} onChange={(event) => setTransactionDraft((draft) => ({ ...draft, type: event.target.value, category: event.target.value === "income" ? "알바비" : "식비" }))} className={inputClass}><option value="income">수입</option><option value="expense">지출</option></select></Field>
              <Field label="날짜"><input type="date" required value={transactionDraft.transactionDate} onChange={(event) => setTransactionDraft((draft) => ({ ...draft, transactionDate: event.target.value }))} className={inputClass}/></Field>
              <Field label="금액"><input type="number" min="1" step="1" required value={transactionDraft.amount} onChange={(event) => setTransactionDraft((draft) => ({ ...draft, amount: event.target.value }))} className={inputClass} placeholder="0"/></Field>
              <Field label="제목 또는 내용"><input required maxLength={120} value={transactionDraft.title} onChange={(event) => setTransactionDraft((draft) => ({ ...draft, title: event.target.value }))} className={inputClass} placeholder="거래 내용을 입력하세요"/></Field>
              <Field label="카테고리"><select value={transactionDraft.category} onChange={(event) => setTransactionDraft((draft) => ({ ...draft, category: event.target.value }))} className={inputClass}>{(transactionDraft.type === "income" ? incomeCategories : expenseCategories).map((category) => <option key={category}>{category}</option>)}</select></Field>
              <Field label="메모 (선택)"><input maxLength={500} value={transactionDraft.memo} onChange={(event) => setTransactionDraft((draft) => ({ ...draft, memo: event.target.value }))} className={inputClass} placeholder="선택 사항"/></Field>
              <div className="flex gap-2 sm:col-span-2"><button disabled={saving || status === "missing"} className="rounded-lg bg-cyan-300 px-5 py-2.5 text-sm font-medium text-slate-950 disabled:opacity-50">{saving ? "저장 중..." : editingId ? "수정 저장" : "거래 추가"}</button>{editingId && <button type="button" onClick={() => { setEditingId(null); setTransactionDraft(emptyTransaction()); }} className="rounded-lg border border-white/10 px-5 py-2.5 text-sm text-slate-300">취소</button>}</div>
            </form>
          ) : (
            <form onSubmit={addWorkIncome} className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="날짜"><input type="date" required value={workDraft.transactionDate} onChange={(event) => setWorkDraft((draft) => ({ ...draft, transactionDate: event.target.value }))} className={inputClass}/></Field>
              <Field label="시급"><input type="number" min="1" step="1" required value={workDraft.hourlyWage} onChange={(event) => setWorkDraft((draft) => ({ ...draft, hourlyWage: event.target.value }))} className={inputClass} placeholder="시급"/></Field>
              <Field label="일한 시간"><input type="number" min="0.1" step="0.1" required value={workDraft.workHours} onChange={(event) => setWorkDraft((draft) => ({ ...draft, workHours: event.target.value }))} className={inputClass} placeholder="예: 6"/></Field>
              <Field label="휴게시간 (선택)"><input type="number" min="0" step="0.1" value={workDraft.breakHours} onChange={(event) => setWorkDraft((draft) => ({ ...draft, breakHours: event.target.value }))} className={inputClass} placeholder="예: 0.5"/></Field>
              <Field label="메모 (선택)" className="sm:col-span-2"><input maxLength={500} value={workDraft.memo} onChange={(event) => setWorkDraft((draft) => ({ ...draft, memo: event.target.value }))} className={inputClass} placeholder="근무 내용"/></Field>
              <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/[0.07] p-4 sm:col-span-2"><p className="text-xs text-slate-400">실제 근무 시간 {actualWorkHours.toLocaleString("ko-KR")}시간</p><p className="mt-2 text-xl font-semibold text-cyan-200">예상 알바비: {formatWon(expectedWage)}</p></div>
              <button disabled={saving || expectedWage <= 0 || actualWorkHours <= 0 || status === "missing"} className="rounded-lg bg-cyan-300 px-5 py-2.5 text-sm font-medium text-slate-950 disabled:opacity-50 sm:col-span-2"><BriefcaseBusiness className="mr-2 inline h-4 w-4"/>{saving ? "저장 중..." : "수입으로 추가"}</button>
            </form>
          )}
        </SectionCard>
      </div>

      <SectionCard>
        <div className="flex flex-col gap-3 border-b border-white/10 p-5 lg:flex-row lg:items-center lg:justify-between"><div><h3 className="font-semibold text-slate-100">거래 내역</h3><p className="mt-1 text-xs text-slate-500">최신 거래부터 표시합니다.</p></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"/><input value={query} onChange={(event) => setQuery(event.target.value)} className={`${inputClass} pl-9 sm:w-64`} placeholder="제목, 메모, 카테고리 검색"/></div><select value={filter} onChange={(event) => setFilter(event.target.value)} className={inputClass}><option value="all">전체</option><option value="income">수입</option><option value="expense">지출</option><option value="wage">알바비</option><option value="current">이번 달</option><option value="previous">지난 달</option></select><button type="button" onClick={reload} disabled={status === "loading"} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 disabled:opacity-50">새로고침</button></div></div>
        <div className="divide-y divide-white/10">
          {filteredTransactions.map((transaction) => <div key={transaction.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-[11px] ${transaction.type === "income" ? "bg-emerald-400/10 text-emerald-200" : "bg-rose-400/10 text-rose-200"}`}>{transaction.type === "income" ? "수입" : "지출"}</span><p className="font-medium text-slate-100">{transaction.title}</p><span className="text-xs text-slate-500">{transaction.category}</span></div><p className="mt-2 text-xs text-slate-500">{transaction.transactionDate}{transaction.memo ? ` · ${transaction.memo}` : ""}</p></div><p className={`text-lg font-semibold ${transaction.type === "income" ? "text-emerald-200" : "text-rose-200"}`}>{formatWon(transaction.amount, { sign: transaction.type })}</p><div className="flex gap-2"><button type="button" onClick={() => startEdit(transaction)} disabled={saving} title="수정" className="rounded-lg border border-white/10 p-2 text-slate-400 hover:text-white disabled:opacity-40"><Pencil className="h-4 w-4"/></button><button type="button" onClick={() => setDeleteTarget(transaction)} disabled={saving} title="삭제" className="rounded-lg border border-white/10 p-2 text-slate-400 hover:text-rose-200 disabled:opacity-40"><Trash2 className="h-4 w-4"/></button></div></div>)}
          {status === "loading" && <p className="p-5 text-sm text-slate-500">자산관리 데이터를 불러오는 중...</p>}
          {status !== "loading" && filteredTransactions.length === 0 && <p className="p-5 text-sm text-slate-500">조건에 맞는 거래 내역이 없습니다.</p>}
        </div>
      </SectionCard>

      {deleteTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"><div className="w-full max-w-sm rounded-xl border border-white/10 bg-slate-900 p-6 shadow-2xl"><h3 className="text-lg font-semibold text-white">이 거래 내역을 삭제할까요?</h3><p className="mt-2 text-sm text-slate-400">{deleteTarget.title} · {formatWon(deleteTarget.amount)}</p><div className="mt-6 flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => setDeleteTarget(null)} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300">취소</button><button type="button" disabled={saving} onClick={confirmDelete} className="rounded-lg bg-rose-400 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-50">{saving ? "삭제 중..." : "삭제"}</button></div></div></div>}
    </div>
  );
}
