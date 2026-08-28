import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const assetsSource = await readFile(new URL("../lib/assets.js", import.meta.url), "utf8");
const { advanceRecurringDate, calculateAssetSummary, isSubscriptionDue } = await import(`data:text/javascript;base64,${Buffer.from(assetsSource).toString("base64")}`);
const workspacePageSource = await readFile(new URL("../app/page.jsx", import.meta.url), "utf8");

test("monthly recurring dates keep the day and clamp at month end", () => {
  assert.equal(advanceRecurringDate("2026-08-27", "monthly"), "2026-09-27");
  assert.equal(advanceRecurringDate("2026-01-31", "monthly"), "2026-02-28");
});

test("weekly and leap-day yearly recurring dates advance safely", () => {
  assert.equal(advanceRecurringDate("2026-08-27", "weekly"), "2026-09-03");
  assert.equal(advanceRecurringDate("2024-02-29", "yearly"), "2025-02-28");
});

test("only active, unprocessed subscriptions due on or before today are actionable", () => {
  const base = { isActive: true, nextBillingDate: "2026-08-27", lastProcessedDate: null };
  assert.equal(isSubscriptionDue(base, "2026-08-27"), true);
  assert.equal(isSubscriptionDue({ ...base, nextBillingDate: "2026-08-26" }, "2026-08-27"), true);
  assert.equal(isSubscriptionDue({ ...base, isActive: false }, "2026-08-27"), false);
  assert.equal(isSubscriptionDue({ ...base, lastProcessedDate: "2026-08-27" }, "2026-08-27"), false);
});

test("a confirmed subscription expense affects balance and monthly expense once", () => {
  const transaction = { type: "expense", amount: 29000, status: "paid", transactionDate: "2026-08-27", category: "구독" };
  const summary = calculateAssetSummary(100000, [transaction], "2026-08");
  assert.equal(summary.totalBalance, 71000);
  assert.equal(summary.monthlyExpense, 29000);
});

test("subscription notification copy omits the duplicated fee suffix", () => {
  assert.equal(workspacePageSource.includes("구독료"), false);
  assert.match(workspacePageSource, /오늘 \$\{subscription\.serviceName\} 결제일입니다\./);
  assert.match(workspacePageSource, /\$\{formatWon\(subscription\.amount\)\}을 지출로 등록할까요\?/);
});
