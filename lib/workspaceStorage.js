import { supabase } from "./supabaseClient";

function mapTaskRow(row) {
  return {
    id: row.id,
    title: row.title,
    completed: Boolean(row.completed),
    priority: row.priority || "보통",
  };
}

function mapNoteRow(row) {
  return {
    id: row.id,
    title: row.title || "메모",
    body: row.content || "",
    tag: row.tag || "개인",
  };
}

export async function fetchTasksFromSupabase(userEmail) {
  if (!supabase || !userEmail) throw new Error("Supabase is not configured");

  const { data, error } = await supabase
    .from("tasks")
    .select("id,title,completed,priority,created_at,updated_at")
    .eq("user_email", userEmail)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data.map(mapTaskRow);
}

export async function createTaskInSupabase(userEmail, task) {
  if (!supabase || !userEmail) throw new Error("Supabase is not configured");

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_email: userEmail,
      title: task.title,
      completed: task.completed,
      priority: task.priority || "보통",
    })
    .select("id,title,completed,priority,created_at,updated_at")
    .single();

  if (error) throw error;
  return mapTaskRow(data);
}

export async function updateTaskInSupabase(userEmail, task) {
  if (!supabase || !userEmail) throw new Error("Supabase is not configured");

  const { error } = await supabase
    .from("tasks")
    .update({
      title: task.title,
      completed: task.completed,
      priority: task.priority || "보통",
      updated_at: new Date().toISOString(),
    })
    .eq("id", task.id)
    .eq("user_email", userEmail);

  if (error) throw error;
}

export async function deleteTaskFromSupabase(userEmail, taskId) {
  if (!supabase || !userEmail) throw new Error("Supabase is not configured");

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("user_email", userEmail);

  if (error) throw error;
}

export async function fetchNotesFromSupabase(userEmail) {
  if (!supabase || !userEmail) throw new Error("Supabase is not configured");

  const { data, error } = await supabase
    .from("notes")
    .select("id,title,content,tag,created_at,updated_at")
    .eq("user_email", userEmail)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data.map(mapNoteRow);
}

export async function createNoteInSupabase(userEmail, note) {
  if (!supabase || !userEmail) throw new Error("Supabase is not configured");

  const { data, error } = await supabase
    .from("notes")
    .insert({
      user_email: userEmail,
      title: note.title,
      content: note.body,
      tag: note.tag || "개인",
    })
    .select("id,title,content,tag,created_at,updated_at")
    .single();

  if (error) throw error;
  return mapNoteRow(data);
}

export async function updateNoteInSupabase(userEmail, note) {
  if (!supabase || !userEmail) throw new Error("Supabase is not configured");

  const { error } = await supabase
    .from("notes")
    .update({
      title: note.title,
      content: note.body,
      tag: note.tag || "개인",
      updated_at: new Date().toISOString(),
    })
    .eq("id", note.id)
    .eq("user_email", userEmail);

  if (error) throw error;
}

export async function deleteNoteFromSupabase(userEmail, noteId) {
  if (!supabase || !userEmail) throw new Error("Supabase is not configured");

  const { error } = await supabase
    .from("notes")
    .delete()
    .eq("id", noteId)
    .eq("user_email", userEmail);

  if (error) throw error;
}
