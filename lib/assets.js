export const ASSET_TABLES_MISSING_MESSAGE = "자산관리 테이블이 아직 준비되지 않았습니다. SQL을 실행해주세요.";
export const ASSET_LOAD_ERROR_MESSAGE = "자산관리 데이터를 불러오지 못했습니다.";

export const ASSET_TRANSACTION_COLUMNS =
  "id,type,title,amount,category,memo,transaction_date,hourly_wage,work_hours,break_hours,created_at,updated_at";

export function parseAssetNumber(value, { allowZero = false } = {}) {
  const normalized = typeof value === "string" ? value.replace(/,/g, "").trim() : value;
  const number = Number(normalized);
  if (!Number.isFinite(number) || number > 99999999999999 || number < 0 || (!allowZero && number === 0)) return null;
  return Math.round(number * 100) / 100;
}

export function mapAssetTransaction(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title || "",
    amount: Number(row.amount) || 0,
    category: row.category || "기타",
    memo: row.memo || "",
    transactionDate: row.transaction_date,
    hourlyWage: row.hourly_wage == null ? null : Number(row.hourly_wage),
    workHours: row.work_hours == null ? null : Number(row.work_hours),
    breakHours: row.break_hours == null ? null : Number(row.break_hours),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getKoreaMonthKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(date);
}

export function calculateAssetSummary(initialBalance, transactions, monthKey = getKoreaMonthKey()) {
  const summary = {
    initialBalance: Number(initialBalance) || 0,
    totalIncome: 0,
    totalExpense: 0,
    monthlyIncome: 0,
    monthlyExpense: 0,
  };

  for (const transaction of transactions) {
    const amount = Number(transaction.amount) || 0;
    const isCurrentMonth = String(transaction.transactionDate || "").startsWith(monthKey);
    if (transaction.type === "income") {
      summary.totalIncome += amount;
      if (isCurrentMonth) summary.monthlyIncome += amount;
    } else if (transaction.type === "expense") {
      summary.totalExpense += amount;
      if (isCurrentMonth) summary.monthlyExpense += amount;
    }
  }

  return {
    ...summary,
    totalBalance: summary.initialBalance + summary.totalIncome - summary.totalExpense,
    monthlyNet: summary.monthlyIncome - summary.monthlyExpense,
    monthKey,
  };
}

export function buildAssetTransactionPayload(body, { partial = false } = {}) {
  const payload = {};
  const type = String(body.type || "").trim();
  if (!partial || body.type !== undefined) {
    if (!['income', 'expense'].includes(type)) throw new Error("ASSET_TYPE_INVALID");
    payload.type = type;
  }

  if (!partial || body.title !== undefined) {
    const title = String(body.title || "").trim();
    if (!title) throw new Error("ASSET_TITLE_REQUIRED");
    payload.title = title;
  }

  if (!partial || body.amount !== undefined) {
    const amount = parseAssetNumber(body.amount);
    if (amount == null) throw new Error("ASSET_AMOUNT_INVALID");
    payload.amount = amount;
  }

  if (!partial || body.transactionDate !== undefined) {
    const transactionDate = String(body.transactionDate || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) throw new Error("ASSET_DATE_INVALID");
    payload.transaction_date = transactionDate;
  }

  if (!partial || body.category !== undefined) payload.category = String(body.category || "기타").trim() || "기타";
  if (!partial || body.memo !== undefined) payload.memo = String(body.memo || "").trim();

  for (const [inputKey, column] of [["hourlyWage", "hourly_wage"], ["workHours", "work_hours"], ["breakHours", "break_hours"]]) {
    if (body[inputKey] !== undefined) {
      if (body[inputKey] === null || body[inputKey] === "") {
        payload[column] = null;
      } else {
        const value = parseAssetNumber(body[inputKey], { allowZero: inputKey === "breakHours" });
        if (value == null) throw new Error("ASSET_WORK_VALUE_INVALID");
        payload[column] = value;
      }
    }
  }

  if (body.hourlyWage !== undefined && body.workHours !== undefined) {
    const breakHours = payload.break_hours || 0;
    if (breakHours >= payload.work_hours) throw new Error("ASSET_WORK_VALUE_INVALID");
    payload.amount = Math.round(payload.hourly_wage * (payload.work_hours - breakHours));
  }

  return payload;
}

export function isAssetTableMissingError(error) {
  const message = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return error?.code === "42P01" || message.includes("asset_settings") || message.includes("asset_transactions");
}

export function logAssetError(context, error) {
  console.error(context, {
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
  });
}
