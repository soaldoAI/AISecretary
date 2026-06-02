import { NextRequest, NextResponse } from "next/server";
import { handleCallback } from "@/lib/google-calendar";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "No code provided" }, { status: 400 });
  }
  try {
    await handleCallback(code);
    // Use the host from the request to build redirect, fallback to env
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3001";
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const redirectUrl = `${proto}://${host}/calendar`;
    return new Response(null, {
      status: 302,
      headers: { Location: redirectUrl },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
