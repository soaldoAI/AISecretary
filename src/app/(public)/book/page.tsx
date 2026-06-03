"use client";

import { useState, useEffect, useCallback } from "react";

interface Slot { start: string; end: string }
interface SlotSettings { slotDuration: number; bookingName: string; bookingTitle: string }

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export default function BookPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotSettings, setSlotSettings] = useState<SlotSettings>({ slotDuration: 30, bookingName: "", bookingTitle: "" });
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"date" | "time" | "form" | "done">("date");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const fetchSlots = useCallback(async (date: string) => {
    setLoading(true);
    const res = await fetch("/api/bookings/available?date=" + date);
    const data = await res.json();
    setSlots(data.slots || []);
    if (data.settings) setSlotSettings(data.settings);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (selectedDate) fetchSlots(selectedDate);
  }, [selectedDate, fetchSlots]);

  // Load settings on mount
  useEffect(() => {
    fetch("/api/bookings/settings").then(r => r.json()).then(d => {
      setSlotSettings({ slotDuration: d.slotDuration, bookingName: d.bookingName, bookingTitle: d.bookingTitle });
    }).catch(() => {});
  }, []);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isPast = (day: number) => {
    const d = new Date(year, month, day);
    return d < today;
  };

  const isWeekend = (day: number) => {
    const d = new Date(year, month, day);
    const dow = d.getDay();
    return dow === 0 || dow === 6;
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true });

  const handleBook = async () => {
    if (!selectedSlot || !name || !email) return;
    setSubmitting(true);
    await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guestName: name,
        guestEmail: email,
        startTime: selectedSlot.start,
        endTime: selectedSlot.end,
        notes,
      }),
    });
    setSubmitting(false);
    setStep("done");
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-16">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-2xl mx-auto mb-3">
          {slotSettings.bookingName ? slotSettings.bookingName[0]?.toUpperCase() : "S"}
        </div>
        <h1 className="text-xl font-bold">{slotSettings.bookingName || "Book a Meeting"}</h1>
        <p className="text-gray-400 text-sm mt-1">{slotSettings.bookingTitle || "Select a time"}</p>
        <p className="text-gray-600 text-xs mt-1">⏱ {slotSettings.slotDuration} min</p>
      </div>

      {step === "done" && (
        <div className="text-center py-12 bg-gray-900 rounded-2xl border border-gray-800">
          <span className="text-4xl">✅</span>
          <h2 className="text-lg font-semibold mt-4">You're booked!</h2>
          <p className="text-gray-400 text-sm mt-2">
            {selectedDate && new Date(selectedDate + "T12:00:00").toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}
            {selectedSlot && " at " + formatTime(selectedSlot.start)}
          </p>
          <p className="text-gray-500 text-xs mt-2">A calendar invitation has been sent to {email}</p>
        </div>
      )}

      {step !== "done" && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          {/* Back button */}
          {step !== "date" && (
            <button
              onClick={() => setStep(step === "form" ? "time" : "date")}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white"
            >
              ← Back
            </button>
          )}

          {step === "date" && (
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
                  className="text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800">←</button>
                <h2 className="text-sm font-semibold">{MONTHS[month]} {year}</h2>
                <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
                  className="text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800">→</button>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-1">
                {DAYS.map((d) => (
                  <div key={d} className="text-center text-[10px] text-gray-500 py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, i) => {
                  if (day === null) return <div key={i} />;
                  const disabled = isPast(day) || isWeekend(day);
                  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const selected = selectedDate === dateStr;

                  return (
                    <button
                      key={i}
                      disabled={disabled}
                      onClick={() => { setSelectedDate(dateStr); setStep("time"); }}
                      className={"aspect-square rounded-lg text-sm transition-colors " +
                        (disabled ? "text-gray-700 cursor-not-allowed" :
                         selected ? "bg-blue-600 text-white" :
                         "text-gray-300 hover:bg-gray-800")}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === "time" && (
            <div className="p-4 sm:p-6">
              <h3 className="text-sm font-medium text-gray-300 mb-3">
                {selectedDate && new Date(selectedDate + "T12:00:00").toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}
              </h3>
              {loading ? (
                <p className="text-gray-500 text-sm py-8 text-center">Loading available times...</p>
              ) : slots.length === 0 ? (
                <p className="text-gray-500 text-sm py-8 text-center">No available times for this day</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-80 overflow-y-auto">
                  {slots.map((slot) => (
                    <button
                      key={slot.start}
                      onClick={() => { setSelectedSlot(slot); setStep("form"); }}
                      className="border border-gray-700 hover:border-blue-500 hover:bg-blue-600/10 rounded-lg px-3 py-2.5 text-sm text-center transition-colors"
                    >
                      {formatTime(slot.start)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === "form" && selectedSlot && (
            <div className="p-4 sm:p-6 space-y-4">
              <div className="bg-gray-800/60 rounded-lg p-3 text-sm">
                <p className="text-gray-300">
                  {selectedDate && new Date(selectedDate + "T12:00:00").toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}
                </p>
                <p className="text-white font-medium">{formatTime(selectedSlot.start)} – {formatTime(selectedSlot.end)}</p>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Your Name *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="John Doe" />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Email *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="john@example.com" />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes (optional)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  placeholder="What would you like to discuss?" />
              </div>

              <button
                onClick={handleBook}
                disabled={submitting || !name || !email}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-3 rounded-lg font-medium text-sm transition-colors"
              >
                {submitting ? "Booking..." : "Confirm Booking"}
              </button>
            </div>
          )}
        </div>
      )}

      <p className="text-center text-gray-700 text-xs mt-6">Powered by AISecretary</p>
    </div>
  );
}
