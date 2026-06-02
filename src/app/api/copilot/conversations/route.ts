import { NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function GET() {
  const db = getDb();
  const conversations = db
    .prepare(
      "SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC"
    )
    .all();
  return NextResponse.json(conversations);
}

export async function POST() {
  const db = getDb();
  const result = db
    .prepare("INSERT INTO conversations (title) VALUES ('New conversation')")
    .run();
  const conv = db
    .prepare("SELECT id, title, created_at, updated_at FROM conversations WHERE id = ?")
    .get(result.lastInsertRowid);
  return NextResponse.json(conv, { status: 201 });
}
