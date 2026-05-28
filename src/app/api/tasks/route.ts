import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT t.*, a.name as agent_name, a.role as agent_role, a.avatar as agent_avatar
       FROM tasks t
       LEFT JOIN agents a ON t.assigned_to = a.id
       ORDER BY t.position ASC`
    )
    .all() as Record<string, unknown>[];

  const tasks = rows.map((row) => ({
    ...row,
    agent: row.assigned_to
      ? { id: row.assigned_to, name: row.agent_name, role: row.agent_role, avatar: row.agent_avatar }
      : null,
  }));

  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { title, description, status, priority, assigned_to, due_date } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const maxPos = db
    .prepare("SELECT COALESCE(MAX(position), -1) + 1 as next FROM tasks WHERE status = ?")
    .get(status || "backlog") as { next: number };

  const result = db
    .prepare(
      `INSERT INTO tasks (title, description, status, priority, assigned_to, due_date, position)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      title.trim(),
      description || "",
      status || "backlog",
      priority || "medium",
      assigned_to || null,
      due_date || null,
      maxPos.next
    );

  const task = db
    .prepare(
      `SELECT t.*, a.name as agent_name, a.role as agent_role, a.avatar as agent_avatar
       FROM tasks t LEFT JOIN agents a ON t.assigned_to = a.id
       WHERE t.id = ?`
    )
    .get(result.lastInsertRowid);

  return NextResponse.json(task, { status: 201 });
}
