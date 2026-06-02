import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { logActivity, getTaskActivity } from "@/lib/activity";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const task = db
    .prepare(
      `SELECT t.*, a.name as agent_name, a.role as agent_role, a.avatar as agent_avatar
       FROM tasks t LEFT JOIN agents a ON t.assigned_to = a.id
       WHERE t.id = ?`
    )
    .get(id) as Record<string, unknown> | undefined;

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const activity = getTaskActivity(Number(id));

  return NextResponse.json({
    ...task,
    agent: task.assigned_to
      ? { id: task.assigned_to, name: task.agent_name, role: task.agent_role, avatar: task.agent_avatar }
      : null,
    activity,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const body = await req.json();
  const fields: string[] = [];
  const values: unknown[] = [];

  // Get current task for activity logging
  const current = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!current) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const allowed = ["title", "description", "status", "priority", "assigned_to", "due_date", "position"];
  const changes: string[] = [];

  for (const key of allowed) {
    if (key in body) {
      fields.push(`${key} = ?`);
      values.push(body[key]);
      if (key !== "position" && body[key] !== current[key]) {
        changes.push(`${key}: ${current[key] || "(empty)"} → ${body[key] || "(empty)"}`);
      }
    }
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`).run(...values);

  // Log activity
  if (changes.length > 0) {
    logActivity(Number(id), "Sohan", "updated", changes.join("; "));
  }

  const task = db
    .prepare(
      `SELECT t.*, a.name as agent_name, a.role as agent_role, a.avatar as agent_avatar
       FROM tasks t LEFT JOIN agents a ON t.assigned_to = a.id
       WHERE t.id = ?`
    )
    .get(id);

  return NextResponse.json(task);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const result = db.prepare("DELETE FROM tasks WHERE id = ?").run(id);

  if (result.changes === 0) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
