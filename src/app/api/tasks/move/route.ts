import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function POST(req: NextRequest) {
  const db = getDb();
  const { taskId, newStatus, newPosition } = await req.json();

  const update = db.transaction(() => {
    // Shift tasks in the target column to make room
    db.prepare(
      "UPDATE tasks SET position = position + 1 WHERE status = ? AND position >= ?"
    ).run(newStatus, newPosition);

    // Move the task
    db.prepare(
      "UPDATE tasks SET status = ?, position = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(newStatus, newPosition, taskId);
  });

  update();

  return NextResponse.json({ success: true });
}
