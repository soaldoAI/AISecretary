import { NextResponse } from "next/server";
import { loadAgents } from "@/lib/agent-loader";

export async function GET() {
  const agents = loadAgents();
  return NextResponse.json(agents);
}