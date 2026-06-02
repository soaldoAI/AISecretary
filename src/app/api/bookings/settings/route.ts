import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getBookingSettings, isCalendarConnected } from "@/lib/google-calendar";

export async function GET() {
  const settings = getBookingSettings();
  return NextResponse.json({ ...settings, calendarConnected: isCalendarConnected() });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const db = getDb();
  const upsert = db.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')"
  );

  const allowed: Record<string, string> = {
    slotDuration: "booking_slot_duration",
    startHour: "booking_start_hour",
    endHour: "booking_end_hour",
    timezone: "booking_timezone",
    daysAvailable: "booking_days",
    bufferMinutes: "booking_buffer",
    bookingName: "booking_name",
    bookingTitle: "booking_title",
  };

  for (const [key, dbKey] of Object.entries(allowed)) {
    if (body[key] !== undefined) {
      const val = typeof body[key] === "object" ? JSON.stringify(body[key]) : String(body[key]);
      upsert.run(dbKey, val);
    }
  }

  return NextResponse.json({ success: true });
}
