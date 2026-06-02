import { NextRequest, NextResponse } from "next/server";
import { getCalendarClient, isCalendarConnected, getBookingSettings } from "@/lib/google-calendar";

export async function GET(req: NextRequest) {
  const dateStr = req.nextUrl.searchParams.get("date");
  if (!dateStr) {
    return NextResponse.json({ error: "date parameter required (YYYY-MM-DD)" }, { status: 400 });
  }

  const settings = getBookingSettings();
  const { slotDuration, startHour, endHour, timezone, daysAvailable, bufferMinutes } = settings;

  // Check if the requested day is available
  const requestedDate = new Date(dateStr + "T12:00:00");
  const dayOfWeek = requestedDate.getDay();
  if (!daysAvailable.includes(dayOfWeek)) {
    return NextResponse.json({ slots: [] });
  }

  // Build all possible slots for the day
  const dayStart = new Date(`${dateStr}T${String(startHour).padStart(2, "0")}:00:00`);
  const dayEnd = new Date(`${dateStr}T${String(endHour).padStart(2, "0")}:00:00`);

  const allSlots: { start: string; end: string }[] = [];
  const cursor = new Date(dayStart);
  while (cursor < dayEnd) {
    const slotEnd = new Date(cursor.getTime() + slotDuration * 60 * 1000);
    if (slotEnd <= dayEnd) {
      allSlots.push({
        start: cursor.toISOString(),
        end: slotEnd.toISOString(),
      });
    }
    cursor.setMinutes(cursor.getMinutes() + slotDuration);
  }

  // If Google Calendar is connected, filter out busy times
  if (isCalendarConnected()) {
    try {
      const calendar = getCalendarClient();
      const busy = await calendar.freebusy.query({
        requestBody: {
          timeMin: dayStart.toISOString(),
          timeMax: dayEnd.toISOString(),
          timeZone: timezone,
          items: [{ id: "primary" }],
        },
      });

      const busyPeriods = busy.data.calendars?.primary?.busy || [];

      const availableSlots = allSlots.filter((slot) => {
        const slotStart = new Date(slot.start).getTime() - bufferMinutes * 60 * 1000;
        const slotEnd = new Date(slot.end).getTime() + bufferMinutes * 60 * 1000;

        return !busyPeriods.some((period) => {
          const busyStart = new Date(period.start!).getTime();
          const busyEnd = new Date(period.end!).getTime();
          return slotStart < busyEnd && slotEnd > busyStart;
        });
      });

      // Filter out past slots
      const now = Date.now();
      return NextResponse.json({
        slots: availableSlots.filter((s) => new Date(s.start).getTime() > now),
        timezone,
        settings: { slotDuration, bookingName: settings.bookingName, bookingTitle: settings.bookingTitle },
      });
    } catch (e) {
      console.error("Freebusy query failed:", e);
    }
  }

  // If not connected, return all slots (minus past)
  const now = Date.now();
  return NextResponse.json({
    slots: allSlots.filter((s) => new Date(s.start).getTime() > now),
    timezone,
    settings: { slotDuration, bookingName: settings.bookingName, bookingTitle: settings.bookingTitle },
  });
}
