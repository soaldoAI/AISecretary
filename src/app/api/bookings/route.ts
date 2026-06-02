import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getCalendarClient, isCalendarConnected, getBookingSettings } from "@/lib/google-calendar";

export async function GET() {
  const db = getDb();
  const bookings = db.prepare(
    "SELECT * FROM bookings ORDER BY start_time DESC LIMIT 50"
  ).all();
  return NextResponse.json(bookings);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { guestName, guestEmail, startTime, endTime, notes } = body;

  if (!guestName || !guestEmail || !startTime || !endTime) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const db = getDb();
  const settings = getBookingSettings();
  let calendarEventId: string | null = null;

  // Create Google Calendar event if connected
  if (isCalendarConnected()) {
    try {
      const calendar = getCalendarClient();
      const event = await calendar.events.insert({
        calendarId: "primary",
        requestBody: {
          summary: `Meeting with ${guestName}`,
          description: `Booked via Launchdesk\n\nGuest: ${guestName}\nEmail: ${guestEmail}${notes ? "\nNotes: " + notes : ""}`,
          start: { dateTime: startTime, timeZone: settings.timezone },
          end: { dateTime: endTime, timeZone: settings.timezone },
          attendees: [{ email: guestEmail }],
          reminders: { useDefault: true },
        },
        sendUpdates: "all",
      });
      calendarEventId = event.data.id || null;
    } catch (e) {
      console.error("Failed to create calendar event:", e);
    }
  }

  const result = db.prepare(
    "INSERT INTO bookings (guest_name, guest_email, start_time, end_time, notes, calendar_event_id) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(guestName, guestEmail, startTime, endTime, notes || "", calendarEventId);

  return NextResponse.json({ id: result.lastInsertRowid, calendarEventId }, { status: 201 });
}
