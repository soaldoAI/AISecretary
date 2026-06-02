import { NextRequest, NextResponse } from "next/server";
import { getCalendarClient, isCalendarConnected } from "@/lib/google-calendar";

export async function GET(req: NextRequest) {
  if (!isCalendarConnected()) {
    return NextResponse.json({ connected: false, events: [] });
  }

  const timeMin = req.nextUrl.searchParams.get("timeMin") || new Date().toISOString();
  const timeMax = req.nextUrl.searchParams.get("timeMax") ||
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const calendar = getCalendarClient();
    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 100,
    });

    return NextResponse.json({
      connected: true,
      events: (res.data.items || []).map((e) => ({
        id: e.id,
        title: e.summary || "(No title)",
        start: e.start?.dateTime || e.start?.date,
        end: e.end?.dateTime || e.end?.date,
        allDay: !e.start?.dateTime,
        location: e.location,
        description: e.description,
        htmlLink: e.htmlLink,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
