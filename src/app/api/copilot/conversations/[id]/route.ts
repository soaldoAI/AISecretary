import { NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const db = getDb();

  const conversation = db
    .prepare("SELECT id, title, created_at, updated_at FROM conversations WHERE id = ?")
    .get(id);
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const messages = db
    .prepare(
      "SELECT id, role, content, meta, created_at FROM messages WHERE conversation_id = ? ORDER BY id"
    )
    .all(id);

  return NextResponse.json({ conversation, messages });
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const db = getDb();

  const conv = db
    .prepare("SELECT id FROM conversations WHERE id = ?")
    .get(id);
  if (!conv) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
