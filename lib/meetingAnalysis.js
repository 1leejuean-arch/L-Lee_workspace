const ACTION_KEYWORDS = ["해야 함", "해야함", "준비", "확인", "작성", "정리", "배치", "점검", "제출", "공유", "연락", "예약"];

export function analyzeMeetingLocally(meeting) {
  const rawContent = String(meeting?.content || "");
  const content = cleanText(rawContent);
  const decisions = splitDecisionItems(meeting?.decisions);
  let actionItems = splitActionItems(meeting?.actionItems);
  if (!actionItems.length) actionItems = extractActionsFromContent(rawContent);

  return {
    summary: summarizeContent(content, decisions, actionItems),
    decisions,
    actionItems: actionItems.map((title) => ({ title, priority: inferPriority(title) })),
    mode: "local",
  };
}

export function normalizeAnalysisResult(value, fallback) {
  const summary = cleanText(value?.summary).slice(0, 1200) || fallback.summary;
  const decisions = normalizeStringArray(value?.decisions, 20);
  const rawActions = Array.isArray(value?.actionItems) ? value.actionItems : [];
  const actionItems = uniqueStrings(rawActions.map((item) => cleanText(typeof item === "string" ? item : item?.title)))
    .slice(0, 20)
    .map((title) => {
      const source = rawActions.find((item) => cleanText(typeof item === "string" ? item : item?.title) === title);
      return { title, priority: normalizePriority(typeof source === "object" ? source?.priority : "normal") };
    });
  return {
    summary,
    decisions: decisions.length ? decisions : fallback.decisions,
    actionItems: actionItems.length ? actionItems : fallback.actionItems,
    mode: "gemini",
  };
}

function summarizeContent(content, decisions, actionItems) {
  if (content) {
    const sentences = content.split(/(?<=[.!?。！？])\s+|\r?\n+/).map(cleanText).filter(Boolean);
    const summary = sentences.slice(0, 2).join(" ");
    return summary.length > 300 ? `${summary.slice(0, 297).trim()}...` : summary;
  }
  if (decisions.length) return `회의에서 ${decisions.slice(0, 2).join(", ")} 등을 결정했습니다.`;
  if (actionItems.length) return `회의 후 ${actionItems.slice(0, 2).join(", ")} 등의 후속 작업이 필요합니다.`;
  return "기록된 회의 내용이 없습니다.";
}

function splitDecisionItems(value) {
  return splitItems(value, { splitComma: false });
}

function splitActionItems(value) {
  return splitItems(value, { splitComma: true });
}

function splitItems(value, { splitComma }) {
  const text = String(value || "")
    .replace(/\r/g, "\n")
    .replace(/(?:^|\n)\s*(?:[-*•☐✅]|\[[ xX]\])\s*/g, "\n")
    .replace(/(?:^|\n|\s)\d+[.)]\s*/g, "\n");
  const separator = splitComma ? /\n+|[,;；]+/ : /\n+|[;；]+/;
  return uniqueStrings(text.split(separator).map((item) => cleanText(item).replace(/^(?:할\s*일|후속\s*작업|결정\s*사항)\s*[:：]\s*/i, ""))).slice(0, 20);
}

function extractActionsFromContent(content) {
  if (!content) return [];
  const candidates = content.split(/(?<=[.!?。！？])\s+|\r?\n+|[;；]+/).map(cleanText).filter(Boolean);
  return uniqueStrings(candidates.filter((sentence) => ACTION_KEYWORDS.some((keyword) => sentence.includes(keyword)))).slice(0, 12);
}

function inferPriority(title) {
  if (/(긴급|필수|최우선|즉시|오늘|마감|급함)/.test(title)) return "high";
  if (/(나중|여유|선택|가능하면)/.test(title)) return "low";
  return "normal";
}

function normalizePriority(value) {
  const priority = String(value || "").toLowerCase();
  if (["high", "높음", "urgent"].includes(priority)) return "high";
  if (["low", "낮음"].includes(priority)) return "low";
  return "normal";
}

function normalizeStringArray(value, limit) {
  if (!Array.isArray(value)) return [];
  return uniqueStrings(value.map((item) => cleanText(typeof item === "string" ? item : item?.title))).slice(0, limit);
}

function uniqueStrings(items) {
  const seen = new Set();
  return items.filter((item) => {
    const text = cleanText(item);
    const key = text.toLocaleLowerCase();
    if (!text || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(cleanText);
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
