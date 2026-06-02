import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/google-calendar";

export async function GET() {
  try {
    const url = getAuthUrl();
    return new Response(null, {
      status: 302,
      headers: { Location: url },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
