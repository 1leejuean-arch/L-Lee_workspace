const DEFAULT_PRIORITY = "보통";
const TASK_COLUMNS = "id,user_email,title,description,completed,priority,steps,sort_order,created_at,updated_at";
const STEPS_TASK_COLUMNS = "id,user_email,title,completed,steps,created_at";
const MINIMAL_TASK_COLUMNS = "id,user_email,title,completed,created_at";
const DUPLICATE_TASK_COLUMNS = "id,user_email,title,description,completed,created_at";
const MAX_POSTGRES_INTEGER = 2147483647;

function normalizePriority(priority) {
  if (["낮음", "보통", "높음"].includes(priority)) return priority;
  if (priority === "Low") return "낮음";
  if (priority === "High") return "높음";
  return DEFAULT_PRIORITY;
}

function normalizeSteps(steps) {
  if (typeof steps === "string") {
    try { return normalizeSteps(JSON.parse(steps)); } catch { return []; }
  }
  if (!Array.isArray(steps)) return [];
  return steps
    .map((step, index) => ({
      id: step?.id || `step-${Date.now()}-${index}`,
      title: String(step?.title || "").trim(),
      completed: Boolean(step?.completed),
      priority: normalizePriority(step?.priority),
      order: Number.isFinite(Number(step?.order)) ? Number(step.order) : index,
    }))
    .filter((step) => step.title)
    .sort((first, second) => first.order - second.order)
    .map((step, index) => ({ ...step, order: index }));
}

function normalizeSortOrder(sortOrder) {
  const value = Number(sortOrder);
  if (!Number.isFinite(value) || value < 0 || value > MAX_POSTGRES_INTEGER) return 0;
  return Math.trunc(value);
}

function isMissingColumnError(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return error?.code === "42703" || message.includes("column") || message.includes("schema cache");
}

function toPayload(payload, allowedColumns) {
  return Object.fromEntries(Object.entries(payload).filter(([key]) => allowedColumns.includes(key)));
}

function getMeetingTaskMarker(sourceId) {
  return `[회의록:${sourceId}]`;
}

function visibleDescription(description) {
  return String(description || "")
    .replace(/\s*\[회의록:[^\]\r\n]+\]\s*/gi, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function mapTaskRow(row) {
  return { ...row, description: visibleDescription(row?.description) };
}

function taskCreateError(code, message, status = 500) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

async function findMeetingTaskDuplicate(supabase, userEmail, title, sourceId) {
  let result = await supabase
    .from("tasks")
    .select(DUPLICATE_TASK_COLUMNS)
    .eq("user_email", userEmail)
    .eq("title", title)
    .order("created_at", { ascending: false })
    .limit(20);
  let minimalSchema = false;
  if (result.error && isMissingColumnError(result.error)) {
    minimalSchema = true;
    result = await supabase
      .from("tasks")
      .select(MINIMAL_TASK_COLUMNS)
      .eq("user_email", userEmail)
      .eq("title", title)
      .order("created_at", { ascending: false })
      .limit(1);
  }
  if (result.error) throw result.error;
  if (minimalSchema) return result.data?.[0] || null;
  const marker = getMeetingTaskMarker(sourceId);
  return (result.data || []).find((task) => String(task.description || "").includes(marker)) || null;
}

// A successful result means Supabase returned the insert and the same row was
// subsequently read back using both id and the authenticated user_email.
export async function createTaskForUser({ supabase, userEmail, body = {} }) {
  const title = String(body.title || "").trim();
  if (!title) throw taskCreateError("TASK_TITLE_REQUIRED", "Task title is required", 400);

  let meetingSourceDescription = "";
  if (body.source === "meeting" && body.sourceId) {
    const { data: meeting, error: meetingError } = await supabase
      .from("meeting_minutes")
      .select("id,title")
      .eq("id", body.sourceId)
      .eq("user_email", userEmail)
      .maybeSingle();
    if (meetingError) throw meetingError;
    if (!meeting) throw taskCreateError("MEETING_NOT_FOUND", "Meeting not found", 404);
    const duplicate = await findMeetingTaskDuplicate(supabase, userEmail, title, body.sourceId);
    if (duplicate) return { task: mapTaskRow(duplicate), duplicate: true };
    meetingSourceDescription = `회의록에서 추출됨: ${meeting.title}\n${getMeetingTaskMarker(body.sourceId)}`;
  }

  const payload = {
    user_email: userEmail,
    title,
    description: meetingSourceDescription || String(body.description || "").trim(),
    completed: Boolean(body.completed),
    priority: normalizePriority(body.priority),
    steps: normalizeSteps(body.steps),
    sort_order: normalizeSortOrder(body.sort_order),
  };

  let selectedColumns = TASK_COLUMNS;
  let result = await supabase.from("tasks").insert(payload).select(selectedColumns).single();
  if (result.error && isMissingColumnError(result.error)) {
    selectedColumns = STEPS_TASK_COLUMNS;
    result = await supabase
      .from("tasks")
      .insert(toPayload(payload, ["user_email", "title", "completed", "steps"]))
      .select(selectedColumns)
      .single();
  }
  if (result.error && isMissingColumnError(result.error)) {
    selectedColumns = MINIMAL_TASK_COLUMNS;
    result = await supabase
      .from("tasks")
      .insert(toPayload(payload, ["user_email", "title", "completed"]))
      .select(selectedColumns)
      .single();
  }
  if (result.error) throw result.error;
  if (!result.data?.id) throw taskCreateError("TASK_INSERT_NOT_RETURNED", "Inserted task row was not returned");

  const verification = await supabase
    .from("tasks")
    .select(selectedColumns)
    .eq("id", result.data.id)
    .eq("user_email", userEmail)
    .maybeSingle();
  if (verification.error) throw verification.error;
  if (!verification.data) {
    throw taskCreateError("TASK_PERSISTENCE_VERIFICATION_FAILED", "Inserted task could not be read back");
  }

  return { task: mapTaskRow(verification.data), duplicate: false };
}
