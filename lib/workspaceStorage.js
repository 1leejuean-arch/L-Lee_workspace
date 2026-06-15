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
    throw new Error(data.error || text || "Workspace API 요청에 실패했습니다.");
  }

  return data;
}

export async function fetchTasksFromSupabase() {
  const data = await requestJson("/api/tasks", { method: "GET" });
  return data.tasks || [];
}

export async function createTaskInSupabase(_userEmail, task) {
  const data = await requestJson("/api/tasks", {
    method: "POST",
    body: JSON.stringify({
      title: task.title,
      completed: task.completed,
      priority: task.priority || "보통",
    }),
  });

  return data.task;
}

export async function updateTaskInSupabase(_userEmail, task) {
  await requestJson("/api/tasks", {
    method: "PATCH",
    body: JSON.stringify({
      id: task.id,
      title: task.title,
      completed: task.completed,
      priority: task.priority || "보통",
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
