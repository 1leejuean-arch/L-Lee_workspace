"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, BriefcaseBusiness, CalendarClock, ChevronRight, CreditCard, Pencil, Plus, Search, Trash2, WalletCards } from "lucide-react";

const defaultIncomeCategories = ["알바", "용돈", "중고거래", "프로젝트 수익", "기타"];
const defaultExpenseCategories = ["식비", "교통", "쇼핑", "구독", "개발", "영상/장비", "학교", "여가", "기타"];
const tabs = [
  ["dashboard", "대시보드"],
  ["transactions", "거래내역"],
  ["statistics", "월별 통계"],
  ["work", "알바 급여 계산"],
  ["subscriptions", "정기결제"],
];

function cx(...values) {
  return values.filter(Boolean).join(" ");
}

function todayValue() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function monthValue() {
  return todayValue().slice(0, 7);
}

function emptyTransaction() {
  return { type: "expense", transactionDate: todayValue(), amount: "", title: "", category: "식비", memo: "", paymentMethod: "", status: "paid" };
}

function emptyWorkSession() {
  return { workDate: todayValue(), startTime: "09:00", endTime: "15:00", breakMinutes: "30", hourlyWage: "", status: "expected", memo: "" };
}

function emptySubscription() {
  return { serviceName: "", amount: "", billingCycle: "monthly", nextBillingDate: todayValue(), category: "구독", memo: "", isActive: true };
}

export function formatWon(value, { sign } = {}) {
  const amount = Math.round(Number(value) || 0);
  const prefix = sign === "income" ? "+" : sign === "expense" ? "-" : "";
  return prefix + "₩" + Math.abs(amount).toLocaleString("ko-KR");
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
  categories: [],
  workSessions: [],
  subscriptions: [],
  summary: { totalBalance: 0, monthlyIncome: 0, monthlyExpense: 0, monthlyNet: 0, monthlyDevelopmentExpense: 0, totalIncome: 0, totalExpense: 0 },
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
      setData(await requestJson("/api/assets"));
      setStatus("ready");
      setError("");
    } catch (requestError) {
      setStatus(requestError.code === "ASSET_TABLES_MISSING" ? "missing" : "error");
      setError(requestError.message || "자산관리 데이터를 불러오지 못했습니다.");
    }
  }, [authStatus]);

  useEffect(() => { reload(); }, [reload]);

  const mutate = useCallback(async (url, method, body) => {
    if (savingRef.current) return null;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const result = await requestJson(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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
    data, status, error, saving, reload,
    saveInitialBalance: (initialBalance) => mutate("/api/assets/settings", "PATCH", { initialBalance }),
    saveTransaction: (value, id) => mutate("/api/assets/transactions", id ? "PATCH" : "POST", id ? { id, ...value } : value),
    deleteTransaction: (id) => mutate("/api/assets/transactions", "DELETE", { id }),
    saveCategory: (value) => mutate("/api/assets/categories", "POST", value),
    saveWorkSession: (value, id) => mutate("/api/assets/work-sessions", id ? "PATCH" : "POST", id ? { id, ...value } : value),
    deleteWorkSession: (id) => mutate("/api/assets/work-sessions", "DELETE", { id }),
    saveSubscription: (value, id) => mutate("/api/assets/subscriptions", id ? "PATCH" : "POST", id ? { id, ...value } : value),
    deleteSubscription: (id) => mutate("/api/assets/subscriptions", "DELETE", { id }),
    processSubscription: (subscription) => mutate("/api/assets/subscriptions/process", "POST", { subscriptionId: subscription.id, paymentDate: subscription.nextBillingDate }),
    syncSubscriptionCalendar: (subscription) => mutate("/api/calendar/create", "POST", { subscriptionId: subscription.id, allDay: true }),
  };
}

function SectionCard({ children, className = "" }) {
  return <section className={cx("rounded-xl border border-white/10 bg-white/[0.045] shadow-xl shadow-black/10 backdrop-blur-xl", className)}>{children}</section>;
}

function Field({ label, children, className = "" }) {
  return <label className={cx("block", className)}><span className="mb-2 block text-xs text-slate-400">{label}</span>{children}</label>;
}

const inputClass = "w-full rounded-lg border border-white/10 bg-slate-950/45 px-3 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10";
const primaryButton = "rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton = "rounded-lg border border-white/10 px-4 py-2.5 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50";

function shiftMonth(key, offset) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
}

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  return year + "년 " + month + "월";
}

function getMonthStats(transactions, key) {
  const paid = transactions.filter((item) => item.status !== "expected" && String(item.transactionDate).startsWith(key));
  const income = paid.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expenseItems = paid.filter((item) => item.type === "expense");
  const expense = expenseItems.reduce((sum, item) => sum + item.amount, 0);
  const categories = expenseItems.reduce((result, item) => ({ ...result, [item.category]: (result[item.category] || 0) + item.amount }), {});
  return { income, expense, net: income - expense, categories };
}

const chartColors = ["#22d3ee", "#8b5cf6", "#f472b6", "#f59e0b", "#34d399", "#60a5fa", "#fb7185", "#a3e635"];

function SixMonthChart({ transactions, selectedMonth }) {
  const values = Array.from({ length: 6 }, (_, index) => {
    const key = shiftMonth(selectedMonth, index - 5);
    return { key, ...getMonthStats(transactions, key) };
  });
  const max = Math.max(1, ...values.flatMap((item) => [item.income, item.expense]));
  return (
    <div>
      <div className="mb-4 flex gap-4 text-xs text-slate-400"><span><i className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400" />수입</span><span><i className="mr-2 inline-block h-2 w-2 rounded-full bg-rose-400" />지출</span></div>
      <div className="flex h-52 items-end gap-3 border-b border-white/10">
        {values.map((item) => (
          <div key={item.key} className="flex h-full min-w-0 flex-1 flex-col justify-end">
            <div className="flex h-44 items-end justify-center gap-1">
              <div title={formatWon(item.income)} className="w-3 rounded-t bg-emerald-400/80 sm:w-5" style={{ height: Math.max(2, item.income / max * 100) + "%" }} />
              <div title={formatWon(item.expense)} className="w-3 rounded-t bg-rose-400/80 sm:w-5" style={{ height: Math.max(2, item.expense / max * 100) + "%" }} />
            </div>
            <p className="py-2 text-center text-[10px] text-slate-500 sm:text-xs">{Number(item.key.slice(5))}월</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryDonut({ categories }) {
  const entries = Object.entries(categories).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, entry) => sum + entry[1], 0);
  let cursor = 0;
  const segments = entries.map((entry, index) => {
    const start = cursor;
    cursor += total ? entry[1] / total * 100 : 0;
    return chartColors[index % chartColors.length] + " " + start + "% " + cursor + "%";
  });
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div className="relative h-40 w-40 shrink-0 rounded-full" style={{ background: total ? "conic-gradient(" + segments.join(",") + ")" : "rgba(148,163,184,.12)" }}>
        <div className="absolute inset-7 flex flex-col items-center justify-center rounded-full bg-slate-950/95"><span className="text-xs text-slate-500">총 지출</span><strong className="mt-1 text-sm text-slate-100">{formatWon(total)}</strong></div>
      </div>
      <div className="w-full space-y-2">
        {entries.slice(0, 8).map(([name, amount], index) => (
          <div key={name} className="flex items-center justify-between gap-3 text-xs"><span className="min-w-0 truncate text-slate-300"><i className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: chartColors[index % chartColors.length] }} />{name}</span><span className="shrink-0 text-slate-400">{total ? Math.round(amount / total * 100) : 0}% · {formatWon(amount)}</span></div>
        ))}
        {!entries.length && <p className="text-sm text-slate-500">이 달의 지출 데이터가 없습니다.</p>}
      </div>
    </div>
  );
}

function SummaryCards({ summary }) {
  const cards = [
    ["현재 총 자산", summary.totalBalance, "text-cyan-200", "시작 기준 자산 + 전체 수입 - 전체 지출"],
    ["이번 달 수입", summary.monthlyIncome, "text-emerald-200", ""],
    ["이번 달 지출", summary.monthlyExpense, "text-rose-200", ""],
    ["이번 달 순수익", summary.monthlyNet, summary.monthlyNet >= 0 ? "text-cyan-200" : "text-rose-200", ""],
  ];
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value, tone, helper]) => <SectionCard key={label} className="p-5"><p className="text-xs text-slate-500">{label}</p><p className={cx("mt-3 whitespace-nowrap text-2xl font-semibold", tone)}>{formatWon(value)}</p>{helper && <p className="mt-2 text-[11px] leading-5 text-slate-500">{helper}</p>}</SectionCard>)}</div>;
}

function TransactionForm({ draft, setDraft, categories, saving, editingId, onSubmit, onCancel, onAddCategory }) {
  const list = categories[draft.type];
  return (
    <SectionCard>
      <div className="border-b border-white/10 p-5"><h3 className="font-semibold text-slate-100">{editingId ? "거래 수정" : "수입 / 지출 등록"}</h3></div>
      <form onSubmit={onSubmit} className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
        <Field label="유형"><select value={draft.type} onChange={(event) => setDraft((value) => ({ ...value, type: event.target.value, category: event.target.value === "income" ? "알바" : "식비" }))} className={inputClass}><option value="income">수입</option><option value="expense">지출</option></select></Field>
        <Field label="금액"><input required type="number" min="1" step="1" value={draft.amount} onChange={(event) => setDraft((value) => ({ ...value, amount: event.target.value }))} className={inputClass} placeholder="0" /></Field>
        <Field label="날짜"><input required type="date" value={draft.transactionDate} onChange={(event) => setDraft((value) => ({ ...value, transactionDate: event.target.value }))} className={inputClass} /></Field>
        <Field label="카테고리"><div className="flex gap-2"><select value={draft.category} onChange={(event) => setDraft((value) => ({ ...value, category: event.target.value }))} className={inputClass}>{list.map((name) => <option key={name}>{name}</option>)}</select><button type="button" onClick={() => onAddCategory(draft.type)} title="카테고리 추가" className={secondaryButton}><Plus className="h-4 w-4" /></button></div></Field>
        <Field label="내용"><input required maxLength={120} value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} className={inputClass} placeholder="거래 내용" /></Field>
        <Field label="결제수단 (선택)"><input maxLength={80} value={draft.paymentMethod} onChange={(event) => setDraft((value) => ({ ...value, paymentMethod: event.target.value }))} className={inputClass} placeholder="카드, 현금, 계좌이체 등" /></Field>
        <Field label="메모" className="sm:col-span-2 xl:col-span-3"><textarea rows={2} maxLength={1000} value={draft.memo} onChange={(event) => setDraft((value) => ({ ...value, memo: event.target.value }))} className={inputClass} placeholder="선택 사항" /></Field>
        <div className="flex gap-2 sm:col-span-2 xl:col-span-3"><button disabled={saving} className={primaryButton}>{saving ? "저장 중..." : editingId ? "수정 저장" : "거래 등록"}</button>{editingId && <button type="button" onClick={onCancel} className={secondaryButton}>취소</button>}</div>
      </form>
    </SectionCard>
  );
}

function TransactionsTable({ transactions, saving, onEdit, onDelete }) {
  return (
    <div className="overflow-x-auto workspace-scrollbar">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-white/10 text-xs text-slate-500"><tr>{["날짜", "유형", "카테고리", "내용", "금액", "결제수단", ""].map((name) => <th key={name} className="px-4 py-3 font-medium">{name}</th>)}</tr></thead>
        <tbody className="divide-y divide-white/10">
          {transactions.map((item) => <tr key={item.id} className="hover:bg-white/[0.03]"><td className="whitespace-nowrap px-4 py-3 text-slate-400">{item.transactionDate}</td><td className="px-4 py-3"><span className={cx("rounded-full px-2 py-1 text-[11px]", item.type === "income" ? "bg-emerald-400/10 text-emerald-200" : "bg-rose-400/10 text-rose-200")}>{item.type === "income" ? "수입" : "지출"}</span></td><td className="px-4 py-3 text-slate-400">{item.category}</td><td className="max-w-[240px] px-4 py-3"><p className="truncate text-slate-100">{item.title}</p>{item.memo && <p className="mt-1 truncate text-xs text-slate-500">{item.memo}</p>}</td><td className={cx("whitespace-nowrap px-4 py-3 font-semibold", item.type === "income" ? "text-emerald-200" : "text-rose-200")}>{formatWon(item.amount, { sign: item.type })}</td><td className="px-4 py-3 text-slate-400">{item.paymentMethod || "-"}</td><td className="px-4 py-3"><div className="flex gap-1"><button disabled={saving} onClick={() => onEdit(item)} title="수정" className="rounded-lg p-2 text-slate-500 hover:bg-white/10 hover:text-white"><Pencil className="h-4 w-4" /></button><button disabled={saving} onClick={() => onDelete(item)} title="삭제" className="rounded-lg p-2 text-slate-500 hover:bg-rose-400/10 hover:text-rose-200"><Trash2 className="h-4 w-4" /></button></div></td></tr>)}
        </tbody>
      </table>
      {!transactions.length && <p className="p-6 text-sm text-slate-500">조건에 맞는 거래 내역이 없습니다.</p>}
    </div>
  );
}

export default function AssetsView({ manager, authStatus, onCalendarChanged }) {
  const { data, status, error, saving, reload, saveInitialBalance, saveTransaction, deleteTransaction, saveCategory, saveWorkSession, deleteWorkSession, saveSubscription, deleteSubscription, processSubscription, syncSubscriptionCalendar } = manager;
  const [activeTab, setActiveTab] = useState("dashboard");
  const [initialBalance, setInitialBalance] = useState("");
  const [transactionDraft, setTransactionDraft] = useState(emptyTransaction);
  const [editingTransactionId, setEditingTransactionId] = useState(null);
  const [workDraft, setWorkDraft] = useState(emptyWorkSession);
  const [subscriptionDraft, setSubscriptionDraft] = useState(emptySubscription);
  const [editingSubscriptionId, setEditingSubscriptionId] = useState(null);
  const [message, setMessage] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(monthValue);
  const [filters, setFilters] = useState({ from: "", to: "", type: "all", category: "all", query: "", sort: "newest" });

  useEffect(() => { if (data.hasInitialBalance) setInitialBalance(String(data.initialBalance)); }, [data.hasInitialBalance, data.initialBalance]);

  const categories = useMemo(() => {
    const custom = { income: [], expense: [] };
    data.categories.forEach((item) => { if (custom[item.type]) custom[item.type].push(item.name); });
    return { income: [...new Set([...defaultIncomeCategories, ...custom.income])], expense: [...new Set([...defaultExpenseCategories, ...custom.expense])] };
  }, [data.categories]);

  const filteredTransactions = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return data.transactions.filter((item) => {
      if (filters.from && item.transactionDate < filters.from) return false;
      if (filters.to && item.transactionDate > filters.to) return false;
      if (filters.type !== "all" && item.type !== filters.type) return false;
      if (filters.category !== "all" && item.category !== filters.category) return false;
      return !query || [item.title, item.memo, item.category, item.paymentMethod].join(" ").toLowerCase().includes(query);
    }).sort((a, b) => filters.sort === "oldest" ? a.transactionDate.localeCompare(b.transactionDate) : b.transactionDate.localeCompare(a.transactionDate));
  }, [data.transactions, filters]);

  const selectedStats = useMemo(() => getMonthStats(data.transactions, selectedMonth), [data.transactions, selectedMonth]);
  const actualMinutes = useMemo(() => {
    if (!workDraft.startTime || !workDraft.endTime) return 0;
    const [sh, sm] = workDraft.startTime.split(":").map(Number);
    const [eh, em] = workDraft.endTime.split(":").map(Number);
    let value = eh * 60 + em - sh * 60 - sm;
    if (value <= 0) value += 1440;
    return Math.max(0, value - (Number(workDraft.breakMinutes) || 0));
  }, [workDraft]);
  const expectedWage = Math.round(actualMinutes / 60 * (Number(workDraft.hourlyWage) || 0));

  const expectedSubscriptionCost = useMemo(() => data.subscriptions.filter((item) => item.isActive && String(item.nextBillingDate).startsWith(monthValue())).reduce((sum, item) => sum + item.amount, 0), [data.subscriptions]);
  const nextSubscriptions = useMemo(() => data.subscriptions.filter((item) => item.isActive && item.nextBillingDate >= todayValue()).slice().sort((a, b) => a.nextBillingDate.localeCompare(b.nextBillingDate)).slice(0, 3), [data.subscriptions]);

  async function safeAction(action, success) {
    setMessage("");
    try { await action(); setMessage(success); } catch {}
  }

  async function submitSubscription(event) {
    event.preventDefault();
    const edited = editingSubscriptionId;
    setMessage("");
    try {
      const result = await saveSubscription(subscriptionDraft, edited);
      setEditingSubscriptionId(null);
      setSubscriptionDraft(emptySubscription());
      if (edited) {
        setMessage("정기결제를 수정했습니다.");
        return;
      }
      try {
        const calendarResult = await syncSubscriptionCalendar(result.subscription);
        setMessage(calendarResult?.message || "정기결제를 등록하고 캘린더에 추가했습니다.");
        await onCalendarChanged?.();
      } catch (calendarError) {
        setMessage(calendarError?.message || "정기결제는 등록했지만 캘린더 일정은 추가하지 못했습니다.");
      }
    } catch {}
  }

  async function confirmSubscriptionExpense(subscription) {
    setMessage("");
    try {
      const result = await processSubscription(subscription);
      setMessage(result?.calendarWarning || result?.message || "정기결제를 지출로 등록했습니다.");
      if (result?.calendarSynced) await onCalendarChanged?.();
    } catch {}
  }

  async function addSubscriptionToCalendar(subscription) {
    setMessage("");
    try {
      const result = await syncSubscriptionCalendar(subscription);
      setMessage(result?.message || "정기결제 일정을 캘린더에 추가했습니다.");
      await onCalendarChanged?.();
    } catch (calendarError) {
      setMessage(calendarError?.message || "정기결제는 등록했지만 캘린더 일정은 추가하지 못했습니다.");
    }
  }

  function editTransaction(item) {
    setTransactionDraft({ type: item.type, transactionDate: item.transactionDate, amount: String(item.amount), title: item.title, category: item.category, memo: item.memo || "", paymentMethod: item.paymentMethod || "", status: item.status || "paid" });
    setEditingTransactionId(item.id);
    setActiveTab("transactions");
  }

  async function addCategory(type) {
    const name = window.prompt("새 카테고리 이름을 입력하세요.");
    if (!name?.trim()) return;
    await safeAction(() => saveCategory({ type, name: name.trim() }), "카테고리를 추가했습니다.");
    setTransactionDraft((value) => ({ ...value, category: name.trim() }));
  }

  if (authStatus !== "authenticated") return <SectionCard className="p-6"><p className="text-sm text-slate-300">Google 계정을 연결하면 사용자별 자산 데이터를 안전하게 저장할 수 있습니다.</p></SectionCard>;

  return (
    <div className="space-y-5">
      {(error || message) && <div className={cx("rounded-lg border px-4 py-3 text-sm", error ? "border-rose-300/20 bg-rose-400/10 text-rose-100" : "border-emerald-300/20 bg-emerald-400/10 text-emerald-100")}>{error || message}</div>}
      {status === "missing" && <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-200">Supabase SQL Editor에서 supabase/finance.sql을 먼저 실행해주세요.</div>}

      <SummaryCards summary={data.summary} />

      <div className="overflow-x-auto workspace-scrollbar"><div className="flex min-w-max gap-1 rounded-xl border border-white/10 bg-white/[0.035] p-1.5">{tabs.map(([key, label]) => <button key={key} type="button" onClick={() => setActiveTab(key)} className={cx("rounded-lg px-4 py-2.5 text-sm transition", activeTab === key ? "bg-cyan-300 text-slate-950" : "text-slate-400 hover:bg-white/10 hover:text-white")}>{label}</button>)}</div></div>

      {activeTab === "dashboard" && (
        <div className="grid gap-5 xl:grid-cols-12">
          <SectionCard className="p-5 xl:col-span-4">
            <div className="flex items-center gap-3"><WalletCards className="h-5 w-5 text-cyan-300" /><h3 className="font-semibold text-slate-100">시작 기준 자산</h3></div>
            <p className="mt-2 text-sm leading-6 text-slate-400">거래 기록을 시작하기 전 보유 자산입니다.</p>
            <form onSubmit={(event) => { event.preventDefault(); safeAction(() => saveInitialBalance(initialBalance), "시작 기준 자산을 저장했습니다."); }} className="mt-5 space-y-3"><Field label="시작 기준 자산"><input required type="number" min="0" value={initialBalance} onChange={(event) => setInitialBalance(event.target.value)} className={inputClass} placeholder="0" /></Field><button disabled={saving || status === "missing"} className={cx(primaryButton, "w-full")}>{saving ? "저장 중..." : "시작 기준 자산 저장"}</button></form>
          </SectionCard>
          <SectionCard className="p-5 xl:col-span-8"><div className="flex items-center justify-between"><div><h3 className="font-semibold text-slate-100">최근 6개월 흐름</h3><p className="mt-1 text-xs text-slate-500">지급완료된 거래 기준</p></div><BarChart3 className="h-5 w-5 text-cyan-300" /></div><div className="mt-5"><SixMonthChart transactions={data.transactions} selectedMonth={monthValue()} /></div></SectionCard>
          <SectionCard className="p-5 xl:col-span-5"><h3 className="font-semibold text-slate-100">이번 달 지출 비율</h3><div className="mt-5"><CategoryDonut categories={getMonthStats(data.transactions, monthValue()).categories} /></div></SectionCard>
          <SectionCard className="p-5 xl:col-span-7">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-slate-950/30 p-4"><p className="text-xs text-slate-500">이번 달 개발비</p><p className="mt-2 text-xl font-semibold text-violet-200">{formatWon(data.summary.monthlyDevelopmentExpense)}</p></div>
              <div className="rounded-lg border border-white/10 bg-slate-950/30 p-4"><p className="text-xs text-slate-500">예상 구독비</p><p className="mt-2 text-xl font-semibold text-amber-200">{formatWon(expectedSubscriptionCost)}</p></div>
              <div className="rounded-lg border border-white/10 bg-slate-950/30 p-4"><p className="text-xs text-slate-500">미지급 예상 급여</p><p className="mt-2 text-xl font-semibold text-emerald-200">{formatWon(data.workSessions.filter((item) => item.status === "expected").reduce((sum, item) => sum + item.expectedWage, 0))}</p></div>
            </div>
            <div className="mt-5 flex items-center justify-between"><div><h3 className="font-semibold text-slate-100">다음 결제 예정</h3><p className="mt-1 text-xs text-slate-500">가까운 정기결제 3건</p></div><button onClick={() => setActiveTab("subscriptions")} className="text-xs text-cyan-300">전체 보기 <ChevronRight className="inline h-3 w-3" /></button></div>
            <div className="mt-3 divide-y divide-white/10">{nextSubscriptions.map((item) => <div key={item.id} className="flex items-center justify-between py-3 text-sm"><span className="text-slate-300">{item.serviceName}<small className="ml-2 text-slate-500">{item.nextBillingDate}</small></span><strong className="text-slate-100">{formatWon(item.amount)}</strong></div>)}{!nextSubscriptions.length && <p className="py-4 text-sm text-slate-500">예정된 정기결제가 없습니다.</p>}</div>
          </SectionCard>
        </div>
      )}

      {activeTab === "transactions" && (
        <div className="space-y-5">
          <TransactionForm draft={transactionDraft} setDraft={setTransactionDraft} categories={categories} saving={saving || status === "missing"} editingId={editingTransactionId} onAddCategory={addCategory} onCancel={() => { setEditingTransactionId(null); setTransactionDraft(emptyTransaction()); }} onSubmit={(event) => { event.preventDefault(); const edited = editingTransactionId; safeAction(async () => { await saveTransaction(transactionDraft, edited); setEditingTransactionId(null); setTransactionDraft(emptyTransaction()); }, edited ? "거래를 수정했습니다." : "거래를 등록했습니다."); }} />
          <SectionCard>
            <div className="grid gap-3 border-b border-white/10 p-5 md:grid-cols-2 xl:grid-cols-7">
              <div className="relative md:col-span-2"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={filters.query} onChange={(event) => setFilters((value) => ({ ...value, query: event.target.value }))} className={cx(inputClass, "pl-9")} placeholder="내용, 메모, 결제수단 검색" /></div>
              <input type="date" aria-label="시작일" value={filters.from} onChange={(event) => setFilters((value) => ({ ...value, from: event.target.value }))} className={inputClass} />
              <input type="date" aria-label="종료일" value={filters.to} onChange={(event) => setFilters((value) => ({ ...value, to: event.target.value }))} className={inputClass} />
              <select value={filters.type} onChange={(event) => setFilters((value) => ({ ...value, type: event.target.value }))} className={inputClass}><option value="all">수입/지출 전체</option><option value="income">수입</option><option value="expense">지출</option></select>
              <select value={filters.category} onChange={(event) => setFilters((value) => ({ ...value, category: event.target.value }))} className={inputClass}><option value="all">카테고리 전체</option>{[...new Set([...categories.income, ...categories.expense])].map((name) => <option key={name}>{name}</option>)}</select>
              <select value={filters.sort} onChange={(event) => setFilters((value) => ({ ...value, sort: event.target.value }))} className={inputClass}><option value="newest">최신순</option><option value="oldest">오래된순</option></select>
            </div>
            <TransactionsTable transactions={filteredTransactions} saving={saving} onEdit={editTransaction} onDelete={(item) => { if (window.confirm("이 거래를 삭제할까요?")) safeAction(() => deleteTransaction(item.id), "거래를 삭제했습니다."); }} />
          </SectionCard>
        </div>
      )}

      {activeTab === "statistics" && (
        <div className="space-y-5">
          <SectionCard className="p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h3 className="font-semibold text-slate-100">월별 통계</h3><p className="mt-1 text-xs text-slate-500">지급완료된 거래만 집계합니다.</p></div><input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} className={cx(inputClass, "sm:w-48")} /></div><div className="mt-5 grid gap-3 sm:grid-cols-3">{[["총수입", selectedStats.income, "text-emerald-200"], ["총지출", selectedStats.expense, "text-rose-200"], ["순수익", selectedStats.net, selectedStats.net >= 0 ? "text-cyan-200" : "text-rose-200"]].map(([label, value, tone]) => <div key={label} className="rounded-lg border border-white/10 bg-slate-950/30 p-4"><p className="text-xs text-slate-500">{monthLabel(selectedMonth)} {label}</p><p className={cx("mt-2 text-xl font-semibold", tone)}>{formatWon(value)}</p></div>)}</div></SectionCard>
          <div className="grid gap-5 xl:grid-cols-2"><SectionCard className="p-5"><h3 className="font-semibold text-slate-100">최근 6개월 수입 / 지출</h3><div className="mt-5"><SixMonthChart transactions={data.transactions} selectedMonth={selectedMonth} /></div></SectionCard><SectionCard className="p-5"><h3 className="font-semibold text-slate-100">{monthLabel(selectedMonth)} 지출 카테고리</h3><div className="mt-5"><CategoryDonut categories={selectedStats.categories} /></div></SectionCard></div>
        </div>
      )}

      {activeTab === "work" && (
        <div className="grid gap-5 xl:grid-cols-12">
          <SectionCard className="xl:col-span-5"><div className="border-b border-white/10 p-5"><div className="flex items-center gap-3"><BriefcaseBusiness className="h-5 w-5 text-cyan-300" /><h3 className="font-semibold text-slate-100">알바 급여 계산</h3></div></div><form onSubmit={(event) => { event.preventDefault(); safeAction(async () => { await saveWorkSession(workDraft); setWorkDraft(emptyWorkSession()); }, workDraft.status === "paid" ? "급여를 수입으로 등록했습니다." : "예상 급여를 저장했습니다."); }} className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="근무 날짜" className="sm:col-span-2"><input required type="date" value={workDraft.workDate} onChange={(event) => setWorkDraft((value) => ({ ...value, workDate: event.target.value }))} className={inputClass} /></Field>
            <Field label="출근 시간"><input required type="time" value={workDraft.startTime} onChange={(event) => setWorkDraft((value) => ({ ...value, startTime: event.target.value }))} className={inputClass} /></Field>
            <Field label="퇴근 시간"><input required type="time" value={workDraft.endTime} onChange={(event) => setWorkDraft((value) => ({ ...value, endTime: event.target.value }))} className={inputClass} /></Field>
            <Field label="휴게 시간 (분)"><input required type="number" min="0" value={workDraft.breakMinutes} onChange={(event) => setWorkDraft((value) => ({ ...value, breakMinutes: event.target.value }))} className={inputClass} /></Field>
            <Field label="시급"><input required type="number" min="1" value={workDraft.hourlyWage} onChange={(event) => setWorkDraft((value) => ({ ...value, hourlyWage: event.target.value }))} className={inputClass} placeholder="10,030" /></Field>
            <Field label="상태" className="sm:col-span-2"><select value={workDraft.status} onChange={(event) => setWorkDraft((value) => ({ ...value, status: event.target.value }))} className={inputClass}><option value="expected">예상 (자산 미반영)</option><option value="paid">지급완료 (수입 반영)</option></select></Field>
            <Field label="메모" className="sm:col-span-2"><input value={workDraft.memo} onChange={(event) => setWorkDraft((value) => ({ ...value, memo: event.target.value }))} className={inputClass} placeholder="근무 내용" /></Field>
            <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/[0.07] p-4 sm:col-span-2"><p className="text-xs text-slate-400">실근무시간 {(actualMinutes / 60).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}시간</p><p className="mt-2 text-xl font-semibold text-cyan-200">예상급여 {formatWon(expectedWage)}</p></div>
            <button disabled={saving || expectedWage <= 0 || status === "missing"} className={cx(primaryButton, "sm:col-span-2")}>{workDraft.status === "paid" ? "수입으로 등록" : "예상 급여 저장"}</button>
          </form></SectionCard>
          <SectionCard className="xl:col-span-7"><div className="border-b border-white/10 p-5"><h3 className="font-semibold text-slate-100">근무 기록</h3></div><div className="divide-y divide-white/10">{data.workSessions.map((item) => <div key={item.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={cx("rounded-full px-2 py-1 text-[11px]", item.status === "paid" ? "bg-emerald-400/10 text-emerald-200" : "bg-amber-300/10 text-amber-200")}>{item.status === "paid" ? "지급완료" : "예상"}</span><strong className="text-slate-100">{item.workDate}</strong><span className="text-xs text-slate-500">{item.startTime}~{item.endTime} · {(item.actualMinutes / 60).toFixed(1)}시간</span></div><p className="mt-2 text-lg font-semibold text-cyan-200">{formatWon(item.expectedWage)}</p></div>{item.status === "expected" && <button disabled={saving} onClick={() => safeAction(() => saveWorkSession({ status: "paid" }, item.id), "지급완료 처리하고 수입에 반영했습니다.")} className={primaryButton}>지급완료</button>}<button disabled={saving} onClick={() => { if (window.confirm("근무 기록을 삭제할까요?")) safeAction(() => deleteWorkSession(item.id), "근무 기록을 삭제했습니다."); }} className={secondaryButton}><Trash2 className="h-4 w-4" /></button></div>)}{!data.workSessions.length && <p className="p-5 text-sm text-slate-500">저장된 근무 기록이 없습니다.</p>}</div></SectionCard>
        </div>
      )}

      {activeTab === "subscriptions" && (
        <div className="grid gap-5 xl:grid-cols-12">
          <SectionCard className="xl:col-span-5"><div className="border-b border-white/10 p-5"><div className="flex items-center gap-3"><CreditCard className="h-5 w-5 text-cyan-300" /><h3 className="font-semibold text-slate-100">{editingSubscriptionId ? "정기결제 수정" : "정기결제 등록"}</h3></div></div><form onSubmit={submitSubscription} className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="서비스명" className="sm:col-span-2"><input required value={subscriptionDraft.serviceName} onChange={(event) => setSubscriptionDraft((value) => ({ ...value, serviceName: event.target.value }))} className={inputClass} placeholder="예: Supabase" /></Field>
            <Field label="금액"><input required type="number" min="1" value={subscriptionDraft.amount} onChange={(event) => setSubscriptionDraft((value) => ({ ...value, amount: event.target.value }))} className={inputClass} /></Field>
            <Field label="결제 주기"><select value={subscriptionDraft.billingCycle} onChange={(event) => setSubscriptionDraft((value) => ({ ...value, billingCycle: event.target.value }))} className={inputClass}><option value="monthly">매월</option><option value="yearly">매년</option><option value="weekly">매주</option></select></Field>
            <Field label="다음 결제일"><input required type="date" value={subscriptionDraft.nextBillingDate} onChange={(event) => setSubscriptionDraft((value) => ({ ...value, nextBillingDate: event.target.value }))} className={inputClass} /></Field>
            <Field label="카테고리"><input required value={subscriptionDraft.category} onChange={(event) => setSubscriptionDraft((value) => ({ ...value, category: event.target.value }))} className={inputClass} /></Field>
            <Field label="메모" className="sm:col-span-2"><input value={subscriptionDraft.memo} onChange={(event) => setSubscriptionDraft((value) => ({ ...value, memo: event.target.value }))} className={inputClass} /></Field>
            <div className="flex gap-2 sm:col-span-2"><button disabled={saving || status === "missing"} className={primaryButton}>{editingSubscriptionId ? "수정 저장" : "정기결제 등록"}</button>{editingSubscriptionId && <button type="button" onClick={() => { setEditingSubscriptionId(null); setSubscriptionDraft(emptySubscription()); }} className={secondaryButton}>취소</button>}</div>
          </form></SectionCard>
          <div className="space-y-5 xl:col-span-7"><div className="grid gap-4 sm:grid-cols-2"><SectionCard className="p-5"><p className="text-xs text-slate-500">이번 달 예상 구독비</p><p className="mt-2 text-2xl font-semibold text-amber-200">{formatWon(expectedSubscriptionCost)}</p></SectionCard><SectionCard className="p-5"><p className="text-xs text-slate-500">활성 정기결제</p><p className="mt-2 text-2xl font-semibold text-cyan-200">{data.subscriptions.filter((item) => item.isActive).length}개</p></SectionCard></div><SectionCard><div className="border-b border-white/10 p-5"><h3 className="font-semibold text-slate-100">정기결제 목록</h3></div><div className="divide-y divide-white/10">{data.subscriptions.map((item) => { const due = item.isActive && item.nextBillingDate <= todayValue() && item.lastProcessedDate !== item.nextBillingDate; return <div key={item.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center"><CalendarClock className={cx("h-5 w-5 shrink-0", due ? "text-amber-300" : "text-cyan-300")} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-slate-100">{item.serviceName}</strong><span className="rounded-full bg-white/[0.06] px-2 py-1 text-[11px] text-slate-400">{item.billingCycle === "monthly" ? "매월" : item.billingCycle === "yearly" ? "매년" : "매주"}</span><span className="text-xs text-slate-500">{item.category}</span>{due && <span className="rounded-full bg-amber-300/10 px-2 py-1 text-[11px] text-amber-200">결제 필요</span>}</div><p className="mt-1 text-xs text-slate-500">{due ? `결제 예정일 ${item.nextBillingDate}` : `다음 결제 ${item.nextBillingDate}`}{item.memo ? " · " + item.memo : ""}</p></div><strong className="text-amber-200">{formatWon(item.amount)}</strong>{due && <button disabled={saving} onClick={() => confirmSubscriptionExpense(item)} className={primaryButton}>지출로 등록</button>}{!item.calendarEventId && <button disabled={saving} onClick={() => addSubscriptionToCalendar(item)} className={secondaryButton}>캘린더에 추가</button>}<button onClick={() => { setEditingSubscriptionId(item.id); setSubscriptionDraft({ serviceName: item.serviceName, amount: String(item.amount), billingCycle: item.billingCycle, nextBillingDate: item.nextBillingDate, category: item.category, memo: item.memo, isActive: item.isActive }); }} className={secondaryButton}><Pencil className="h-4 w-4" /></button><button onClick={() => { if (window.confirm("정기결제를 삭제할까요?")) safeAction(() => deleteSubscription(item.id), "정기결제를 삭제했습니다."); }} className={secondaryButton}><Trash2 className="h-4 w-4" /></button></div>; })}{!data.subscriptions.length && <p className="p-5 text-sm text-slate-500">등록된 정기결제가 없습니다.</p>}</div></SectionCard></div>
        </div>
      )}

      {status === "loading" && <p className="text-center text-sm text-slate-500">자산 데이터를 동기화하는 중...</p>}
      <div className="flex justify-end"><button type="button" onClick={reload} disabled={status === "loading"} className={secondaryButton}>새로고침</button></div>
    </div>
  );
}
