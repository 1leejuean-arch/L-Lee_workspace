import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { getSupabaseServerClient } from "../../../lib/supabaseServer";

const DEFAULT_PRIORITY = "보통";
const TASK_COLUMNS = "id,user_email,title,description,completed,priority,steps,sort_order,created_at,updated_at";
const STEPS_TASK_COLUMNS = "id,user_email,title,completed,steps,created_at";
const MINIMAL_TASK_COLUMNS = "id,user_email,title,completed,created_at";
const TASKS_SCHEMA_MISSING_MESSAGE = "Supabase tasks 테이블에 필요한 컬럼이 아직 없습니다.";
const MAX_POSTGRES_INTEGER = 2147483647;

function normalizePriority(priority) {
  if (["낮음", "보통", "높음"].includes(priority)) return priority;
  if (priority === "Low") return "낮음";
  if (priority === "High") return "높음";
  return DEFAULT_PRIORITY;
}

function normalizeSteps(steps) {
  if (typeof steps === "string") {
    try {
      return normalizeSteps(JSON.parse(steps));
    } catch {
      return [];
    }
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

function normalizeSortOrder(sortOrder, fallback = 0) {
  const value = Number(sortOrder);
  if (!Number.isFinite(value)) return fallback;
  if (value < 0 || value > MAX_POSTGRES_INTEGER) return fallback;
  return Math.trunc(value);
}

function mapTaskRow(row, index = 0) {
  return {
    id: row.id,
    user_email: row.user_email || null,
    title: row.title || "",
    description: row.description || "",
    completed: Boolean(row.completed),
    priority: normalizePriority(row.priority),
    steps: normalizeSteps(row.steps),
    sort_order: normalizeSortOrder(row.sort_order),
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

async function getUserEmail() {
  const session = await getServerSession(authOptions);
  return session?.user?.email || null;
}

function jsonError(error, status = 500, details) {
  return Response.json({ error, ...(details ? { details } : {}) }, { status });
}

function jsonSchemaMissing(details) {
  return Response.json(
    {
      error: "TASKS_SCHEMA_MISSING",
      message: TASKS_SCHEMA_MISSING_MESSAGE,
      ...(details ? { details } : {}),
    },
    { status: 409 },
  );
}

function getSupabaseErrorCode(error) {
  if (error?.message?.includes("Supabase server environment variables")) {
    return "SUPABASE_NOT_CONFIGURED";
  }

  return "SUPABASE_QUERY_FAILED";
}

function isMissingColumnError(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return error?.code === "42703" || message.includes("column") || message.includes("schema cache");
}

function logSupabaseQueryError(context, error) {
  console.error(context, {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
  });
}

function buildTaskPayload(body, { includeTitle = false } = {}) {
  const payload = {};

  if (includeTitle || body.title !== undefined) {
    const title = String(body.title || "").trim();
    if (title) payload.title = title;
  }
  if (body.description !== undefined) payload.description = String(body.description || "").trim();
  if (body.completed !== undefined) payload.completed = Boolean(body.completed);
  if (body.priority !== undefined) payload.priority = normalizePriority(body.priority);
  if (body.steps !== undefined) payload.steps = normalizeSteps(body.steps);
  if (body.sort_order !== undefined) {
    payload.sort_order = normalizeSortOrder(body.sort_order);
  }

  return payload;
}

function toLegacyPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => ["user_email", "title", "completed"].includes(key)),
  );
}

function toStepsPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => ["user_email", "title", "completed", "steps"].includes(key)),
  );
}

export async function GET() {
  try {
    const userEmail = await getUserEmail();
    if (!userEmail) return jsonError("UNAUTHORIZED", 401);

    const supabase = getSupabaseServerClient();
    let result = await supabase
      .from("tasks")
      .select(TASK_COLUMNS)
      .eq("user_email", userEmail)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (result.error && isMissingColumnError(result.error)) {
      result = await supabase
        .from("tasks")
        .select(STEPS_TASK_COLUMNS)
        .eq("user_email", userEmail)
        .order("created_at", { ascending: false });
    }

    if (result.error && isMissingColumnError(result.error)) {
      result = await supabase
        .from("tasks")
        .select(MINIMAL_TASK_COLUMNS)
        .eq("user_email", userEmail)
        .order("created_at", { ascending: false });
    }

    if (result.error) throw result.error;
    return Response.json({ tasks: (result.data || []).map(mapTaskRow) });
  } catch (error) {
    logSupabaseQueryError("Tasks GET failed", error);
    return jsonError(getSupabaseErrorCode(error), 500);
  }
}

export async function POST(request) {
  try {
    const userEmail = await getUserEmail();
    if (!userEmail) return jsonError("UNAUTHORIZED", 401);

    const body = await request.json().catch(() => ({}));
    const title = String(body.title || "").trim();
    if (!title) return jsonError("TASK_TITLE_REQUIRED", 400);

    const supabase = getSupabaseServerClient();
    const payload = {
      user_email: userEmail,
      title,
      description: String(body.description || "").trim(),
      completed: Boolean(body.completed),
      priority: normalizePriority(body.priority),
      steps: normalizeSteps(body.steps),
      sort_order: normalizeSortOrder(body.sort_order),
    };

    let result = await supabase.from("tasks").insert(payload).select(TASK_COLUMNS).single();

    if (result.error && isMissingColumnError(result.error)) {
      result = await supabase.from("tasks").insert(toStepsPayload(payload)).select(STEPS_TASK_COLUMNS).single();
    }

    if (result.error && isMissingColumnError(result.error)) {
      result = await supabase.from("tasks").insert(toLegacyPayload(payload)).select(MINIMAL_TASK_COLUMNS).single();
    }

    if (result.error) throw result.error;
    return Response.json({ task: mapTaskRow(result.data) });
  } catch (error) {
    logSupabaseQueryError("Tasks POST failed", error);
    return jsonError(getSupabaseErrorCode(error), 500);
  }
}

export async function PATCH(request) {
  try {
    const userEmail = await getUserEmail();
    if (!userEmail) return jsonError("UNAUTHORIZED", 401);

    const body = await request.json().catch(() => ({}));
    if (!body.id) return jsonError("TASK_ID_REQUIRED", 400);

    const supabase = getSupabaseServerClient();
    const payload = {
      ...buildTaskPayload(body),
      updated_at: new Date().toISOString(),
    };

    let result = await supabase
      .from("tasks")
      .update(payload)
      .eq("id", body.id)
      .eq("user_email", userEmail)
      .select(TASK_COLUMNS)
      .single();

    if (result.error && isMissingColumnError(result.error)) {
      const stepsPayload = toStepsPayload(payload);
      if (Object.prototype.hasOwnProperty.call(stepsPayload, "steps")) {
        result = await supabase
          .from("tasks")
          .update(stepsPayload)
          .eq("id", body.id)
          .eq("user_email", userEmail)
          .select(STEPS_TASK_COLUMNS)
          .single();
      }
    }

    if (result.error && isMissingColumnError(result.error)) {
      logSupabaseQueryError("Tasks PATCH schema missing", result.error);
      return jsonSchemaMissing({ missingColumns: ["description", "steps", "sort_order", "priority"] });
    }

    if (result.error) throw result.error;
    return Response.json({ ok: true, task: mapTaskRow(result.data) });
  } catch (error) {
    logSupabaseQueryError("Tasks PATCH failed", error);
    return jsonError(getSupabaseErrorCode(error), 500);
  }
}

export async function DELETE(request) {
  try {
    const userEmail = await getUserEmail();
    if (!userEmail) return jsonError("UNAUTHORIZED", 401);

    const body = await request.json().catch(() => ({}));
    if (!body.id) return jsonError("TASK_ID_REQUIRED", 400);

    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", body.id)
      .eq("user_email", userEmail);

    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    logSupabaseQueryError("Tasks DELETE failed", error);
    return jsonError(getSupabaseErrorCode(error), 500);
  }
}
