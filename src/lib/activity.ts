import getDb from "./db";

export function logActivity(taskId: number, actor: string, action: string, detail: string = "") {
  const db = getDb();
  db.prepare(
    "INSERT INTO task_activity (task_id, actor, action, detail) VALUES (?, ?, ?, ?)"
  ).run(taskId, actor, action, detail);
}

export function getTaskActivity(taskId: number, limit = 50) {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM task_activity WHERE task_id = ? ORDER BY created_at DESC LIMIT ?"
  ).all(taskId, limit);
}
