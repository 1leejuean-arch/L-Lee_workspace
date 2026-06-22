async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get("content-type") || "";
  let data = {};
  let text = "";

  if (contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      throw new Error("서버 응답을 읽지 못했습니다.");
    }
  } else {
    text = await response.text().catch(() => "");
  }

  if (!response.ok) {
    const error = new Error(data.message || data.error || text || "Workspace API 요청에 실패했습니다.");
    error.status = response.status;
    error.code = data.error;
    error.details = data.details;
    throw error;
  }

  return data;
}

const taskPriorityOptions = ["낮음", "보통", "높음"];
const maxPostgresInteger = 2147483647;

function normalizeTaskPriority(priority) {
  if (taskPriorityOptions.includes(priority)) return priority;
  if (priority === "Low") return "낮음";
  if (priority === "High") return "높음";
  return "보통";
}

function normalizeTaskSteps(steps) {
  if (!Array.isArray(steps)) return [];

  return steps
    .map((step, index) => ({
      id: step?.id || `step-${Date.now()}-${index}`,
      title: String(step?.title || "").trim(),
      completed: Boolean(step?.completed),
      priority: normalizeTaskPriority(step?.priority),
      order: Number.isFinite(Number(step?.order)) ? Number(step.order) : index,
    }))
    .filter((step) => step.title)
    .sort((first, second) => first.order - second.order)
    .map((step, index) => ({ ...step, order: index }));
}

function normalizeTaskSortOrder(sortOrder, fallback = 0) {
  const value = Number(sortOrder);
  if (!Number.isFinite(value)) return fallback;
  if (value < 0 || value > maxPostgresInteger) return fallback;
  return Math.trunc(value);
}

export function normalizeWorkspaceTask(task, index = 0) {
  return {
    ...task,
    id: task?.id || `local-${Date.now()}-${index}`,
    user_email: task?.user_email || null,
    title: String(task?.title || "").trim(),
    description: task?.description || "",
    completed: Boolean(task?.completed),
    priority: normalizeTaskPriority(task?.priority),
    steps: normalizeTaskSteps(task?.steps),
    sort_order: normalizeTaskSortOrder(task?.sort_order),
    created_at: task?.created_at || null,
    updated_at: task?.updated_at || null,
  };
}

export function normalizeWorkspaceTasks(tasks) {
  return (Array.isArray(tasks) ? tasks : []).map(normalizeWorkspaceTask);
}

export async function fetchTasksFromSupabase() {
  const data = await requestJson("/api/tasks", { method: "GET" });
  return normalizeWorkspaceTasks(data.tasks || []);
}

export async function createTaskInSupabase(_userEmail, task) {
  const data = await requestJson("/api/tasks", {
    method: "POST",
    body: JSON.stringify({
      title: task.title,
      description: task.description || "",
      completed: task.completed,
      priority: task.priority || "보통",
      steps: task.steps || [],
      sort_order: task.sort_order,
    }),
  });

  return normalizeWorkspaceTask(data.task);
}

export async function updateTaskInSupabase(_userEmail, task) {
  await requestJson("/api/tasks", {
    method: "PATCH",
    body: JSON.stringify({
      id: task.id,
      title: task.title,
      description: task.description || "",
      completed: task.completed,
      priority: task.priority || "보통",
      steps: task.steps || [],
      sort_order: task.sort_order,
    }),
  });
}

export async function deleteTaskFromSupabase(_userEmail, taskId) {
  await requestJson("/api/tasks", {
    method: "DELETE",
    body: JSON.stringify({ id: taskId }),
  });
}

export async function fetchNotesFromSupabase() {
  const data = await requestJson("/api/notes", { method: "GET" });
  return data.notes || [];
}

export async function createNoteInSupabase(_userEmail, note) {
  const data = await requestJson("/api/notes", {
    method: "POST",
    body: JSON.stringify({
      title: note.title,
      content: note.body,
      tag: note.tag || "개인",
    }),
  });

  return data.note;
}

export async function updateNoteInSupabase(_userEmail, note) {
  await requestJson("/api/notes", {
    method: "PATCH",
    body: JSON.stringify({
      id: note.id,
      title: note.title,
      content: note.body,
      tag: note.tag || "개인",
    }),
  });
}

export async function deleteNoteFromSupabase(_userEmail, noteId) {
  await requestJson("/api/notes", {
    method: "DELETE",
    body: JSON.stringify({ id: noteId }),
  });
}
