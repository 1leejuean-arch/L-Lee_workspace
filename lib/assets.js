export const ASSET_TABLES_MISSING_MESSAGE = "자산관리 테이블이 아직 준비되지 않았습니다. supabase/finance.sql을 실행해주세요.";
export const ASSET_LOAD_ERROR_MESSAGE = "자산관리 데이터를 불러오지 못했습니다.";

export const ASSET_TRANSACTION_COLUMNS = "id,type,title,amount,category,memo,payment_method,status,transaction_date,work_session_id,created_at,updated_at";
export const WORK_SESSION_COLUMNS = "id,work_date,start_time,end_time,break_minutes,hourly_wage,actual_minutes,expected_wage,status,transaction_id,memo,created_at,updated_at";
export const SUBSCRIPTION_COLUMNS = "id,service_name,amount,billing_cycle,next_billing_date,category,memo,is_active,created_at,updated_at";
export const CATEGORY_COLUMNS = "id,type,name,created_at";

export function parseAssetNumber(value, { allowZero = false } = {}) {
  const normalized = typeof value === "string" ? value.replace(/,/g, "").trim() : value;
  const number = Number(normalized);
  if (!Number.isFinite(number) || number > 99999999999999 || number < 0 || (!allowZero && number === 0)) return null;
  return Math.round(number * 100) / 100;
}

export function mapAssetTransaction(row) {
  return { id: row.id, type: row.type, title: row.title || "", amount: Number(row.amount) || 0, category: row.category || "기타", memo: row.memo || "", paymentMethod: row.payment_method || "", status: row.status || "paid", transactionDate: row.transaction_date, workSessionId: row.work_session_id || null, createdAt: row.created_at, updatedAt: row.updated_at };
}

export function mapWorkSession(row) {
  return { id: row.id, workDate: row.work_date, startTime: String(row.start_time || "").slice(0, 5), endTime: String(row.end_time || "").slice(0, 5), breakMinutes: Number(row.break_minutes) || 0, hourlyWage: Number(row.hourly_wage) || 0, actualMinutes: Number(row.actual_minutes) || 0, expectedWage: Number(row.expected_wage) || 0, status: row.status || "expected", transactionId: row.transaction_id || null, memo: row.memo || "", createdAt: row.created_at, updatedAt: row.updated_at };
}

export function mapSubscription(row) {
  return { id: row.id, serviceName: row.service_name || "", amount: Number(row.amount) || 0, billingCycle: row.billing_cycle || "monthly", nextBillingDate: row.next_billing_date, category: row.category || "구독", memo: row.memo || "", isActive: row.is_active !== false, createdAt: row.created_at, updatedAt: row.updated_at };
}

export function getKoreaMonthKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "Asia/Seoul" }).format(date);
}

export function calculateAssetSummary(initialBalance, transactions, monthKey = getKoreaMonthKey()) {
  const summary = { initialBalance: Number(initialBalance) || 0, totalIncome: 0, totalExpense: 0, monthlyIncome: 0, monthlyExpense: 0, monthlyDevelopmentExpense: 0 };
  for (const transaction of transactions) {
    if (transaction.status === "expected") continue;
    const amount = Number(transaction.amount) || 0;
    const current = String(transaction.transactionDate || "").startsWith(monthKey);
    if (transaction.type === "income") { summary.totalIncome += amount; if (current) summary.monthlyIncome += amount; }
    if (transaction.type === "expense") { summary.totalExpense += amount; if (current) { summary.monthlyExpense += amount; if (transaction.category === "개발") summary.monthlyDevelopmentExpense += amount; } }
  }
  return { ...summary, totalBalance: summary.initialBalance + summary.totalIncome - summary.totalExpense, monthlyNet: summary.monthlyIncome - summary.monthlyExpense, monthKey };
}

function requiredText(value, code, maxLength = 120) {
  const text = String(value || "").trim();
  if (!text || text.length > maxLength) throw new Error(code);
  return text;
}

function dateValue(value, code) {
  const date = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(code);
  return date;
}

export function buildAssetTransactionPayload(body, { partial = false } = {}) {
  const payload = {};
  if (!partial || body.type !== undefined) { const type = String(body.type || ""); if (!["income", "expense"].includes(type)) throw new Error("ASSET_TYPE_INVALID"); payload.type = type; }
  if (!partial || body.title !== undefined) payload.title = requiredText(body.title, "ASSET_TITLE_REQUIRED");
  if (!partial || body.amount !== undefined) { const amount = parseAssetNumber(body.amount); if (amount == null) throw new Error("ASSET_AMOUNT_INVALID"); payload.amount = amount; }
  if (!partial || body.transactionDate !== undefined) payload.transaction_date = dateValue(body.transactionDate, "ASSET_DATE_INVALID");
  if (!partial || body.category !== undefined) payload.category = requiredText(body.category || "기타", "ASSET_CATEGORY_REQUIRED", 60);
  if (!partial || body.memo !== undefined) payload.memo = String(body.memo || "").trim().slice(0, 1000);
  if (!partial || body.paymentMethod !== undefined) payload.payment_method = String(body.paymentMethod || "").trim().slice(0, 80);
  if (!partial || body.status !== undefined) { const status = String(body.status || "paid"); if (!["expected", "paid"].includes(status)) throw new Error("ASSET_STATUS_INVALID"); payload.status = status; }
  return payload;
}

export function buildWorkSessionPayload(body, { partial = false } = {}) {
  const payload = {};
  if (!partial || body.workDate !== undefined) payload.work_date = dateValue(body.workDate, "WORK_DATE_INVALID");
  for (const [key, column] of [["startTime", "start_time"], ["endTime", "end_time"]]) if (!partial || body[key] !== undefined) { const time = String(body[key] || ""); if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("WORK_TIME_INVALID"); payload[column] = time; }
  if (!partial || body.breakMinutes !== undefined) { const value = parseAssetNumber(body.breakMinutes, { allowZero: true }); if (value == null || value > 1440) throw new Error("WORK_BREAK_INVALID"); payload.break_minutes = Math.round(value); }
  if (!partial || body.hourlyWage !== undefined) { const value = parseAssetNumber(body.hourlyWage); if (value == null) throw new Error("WORK_WAGE_INVALID"); payload.hourly_wage = value; }
  if (!partial || body.status !== undefined) { const status = String(body.status || "expected"); if (!["expected", "paid"].includes(status)) throw new Error("WORK_STATUS_INVALID"); payload.status = status; }
  if (!partial || body.memo !== undefined) payload.memo = String(body.memo || "").trim().slice(0, 1000);
  return payload;
}

export function calculateWorkSession(startTime, endTime, breakMinutes, hourlyWage) {
  const [sh, sm] = String(startTime).split(":").map(Number); const [eh, em] = String(endTime).split(":").map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm); if (minutes <= 0) minutes += 1440; minutes -= Number(breakMinutes) || 0;
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 1440) throw new Error("WORK_DURATION_INVALID");
  return { actualMinutes: Math.round(minutes), expectedWage: Math.round((minutes / 60) * Number(hourlyWage)) };
}

export function buildSubscriptionPayload(body, { partial = false } = {}) {
  const payload = {};
  if (!partial || body.serviceName !== undefined) payload.service_name = requiredText(body.serviceName, "SUBSCRIPTION_NAME_REQUIRED");
  if (!partial || body.amount !== undefined) { const value = parseAssetNumber(body.amount); if (value == null) throw new Error("SUBSCRIPTION_AMOUNT_INVALID"); payload.amount = value; }
  if (!partial || body.billingCycle !== undefined) { const cycle = String(body.billingCycle || "monthly"); if (!["monthly", "yearly", "weekly"].includes(cycle)) throw new Error("SUBSCRIPTION_CYCLE_INVALID"); payload.billing_cycle = cycle; }
  if (!partial || body.nextBillingDate !== undefined) payload.next_billing_date = dateValue(body.nextBillingDate, "SUBSCRIPTION_DATE_INVALID");
  if (!partial || body.category !== undefined) payload.category = requiredText(body.category || "구독", "SUBSCRIPTION_CATEGORY_REQUIRED", 60);
  if (!partial || body.memo !== undefined) payload.memo = String(body.memo || "").trim().slice(0, 1000);
  if (!partial || body.isActive !== undefined) payload.is_active = body.isActive !== false;
  return payload;
}

export function isAssetTableMissingError(error) {
  const message = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return error?.code === "42P01" || ["finance_settings", "finance_transactions", "finance_categories", "work_sessions", "subscriptions"].some((name) => message.includes(name));
}

export function logAssetError(context, error) { console.error(context, { code: error?.code, message: error?.message, details: error?.details, hint: error?.hint }); }
