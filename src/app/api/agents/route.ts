import { NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function GET() {
  const db = getDb();
  const agents = db.prepare("SELECT * FROM agents ORDER BY id ASC").all();
  return NextResponse.json(agents);
}
