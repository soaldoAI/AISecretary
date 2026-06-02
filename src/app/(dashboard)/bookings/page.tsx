"use client";

import { useEffect, useState, useCallback } from "react";

interface Booking {
  id: number;
  guest_name: string;
  guest_email: string;
  start_time: string;
  end_time: string;
  notes: string;
  status: string;
  created_at: string;
}

interface Settings {
  slotDuration: number;
  startHour: number;
  endHour: number;
  timezone: string;
  daysAvailable: number[];
  bufferMinutes: number;
  bookingName: string;
  bookingTitle: string;
  calendarConnected: boolean;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [tab, setTab] = useState<"upcoming" | "settings">("upcoming");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchBookings = useCallback(async () => {
    const res = await fetch("/api/bookings");
    setBookings(await res.json());
  }, []);

  const fetchSettings = useCallback(async () => {
    const res = await fetch("/api/bookings/settings");
    setSettings(await res.json());
  }, []);

  useEffect(() => {
    fetchBookings();
    fetchSettings();
  }, [fetchBookings, fetchSettings]);

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    await fetch("/api/bookings/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
  };

  const toggleDay = (day: number) => {
    if (!settings) return;
    const days = settings.daysAvailable.includes(day)
      ? settings.daysAvailable.filter((d) => d !== day)
      : [...settings.daysAvailable, day].sort();
    setSettings({ ...settings, daysAvailable: days });
  };

  const bookingUrl = typeof window !== "undefined"
    ? window.location.origin + "/book"
    : "";

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("en-AU", {
      weekday: "short", day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  };

  const upcoming = bookings.filter(
    (b) => b.status === "confirmed" && new Date(b.start_time) >= new Date()
  );
  const past = bookings.filter(
    (b) => b.status !== "confirmed" || new Date(b.start_time) < new Date()
  );

  return (
    <>
      <header className="shrink-0 border-b border-gray-800/60 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight">Bookings</h1>
            <p className="text-[11px] sm:text-sm text-gray-500">Manage your availability</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { navigator.clipboard.writeText(bookingUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded-lg text-sm transition-colors"
            >
              {copied ? "Copied!" : "Copy Booking Link"}
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        {/* Tabs */}
        <div className="border-b border-gray-800/40 px-4 sm:px-6">
          <div className="flex gap-4">
            <button
              onClick={() => setTab("upcoming")}
              className={"py-3 text-sm font-medium border-b-2 transition-colors " +
                (tab === "upcoming" ? "border-blue-500 text-white" : "border-transparent text-gray-500 hover:text-gray-300")}
            >
              Upcoming ({upcoming.length})
            </button>
            <button
              onClick={() => setTab("settings")}
              className={"py-3 text-sm font-medium border-b-2 transition-colors " +
                (tab === "settings" ? "border-blue-500 text-white" : "border-transparent text-gray-500 hover:text-gray-300")}
            >
              Settings
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {tab === "upcoming" && (
            <div className="space-y-3 max-w-2xl">
              {upcoming.length === 0 && (
                <div className="text-center py-12 text-gray-600">
                  <p className="text-3xl mb-2">🗓️</p>
                  <p className="text-sm">No upcoming bookings</p>
                  <p className="text-xs mt-1">Share your booking link to get started</p>
                </div>
              )}
              {upcoming.map((b) => (
                <div key={b.id} className="bg-gray-800/60 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{b.guest_name}</p>
                      <p className="text-xs text-gray-400">{b.guest_email}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-800">
                      Confirmed
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 mt-2">
                    {formatDateTime(b.start_time)} – {new Date(b.end_time).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true })}
                  </p>
                  {b.notes && <p className="text-xs text-gray-500 mt-1">{b.notes}</p>}
                </div>
              ))}

              {past.length > 0 && (
                <>
                  <h3 className="text-xs text-gray-500 font-medium pt-4">Past / Cancelled</h3>
                  {past.map((b) => (
                    <div key={b.id} className="bg-gray-800/30 rounded-lg p-4 opacity-60">
                      <p className="font-medium text-sm">{b.guest_name}</p>
                      <p className="text-xs text-gray-400">{formatDateTime(b.start_time)}</p>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {tab === "settings" && settings && (
            <div className="max-w-lg space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Your Name</label>
                <input
                  type="text" value={settings.bookingName}
                  onChange={(e) => setSettings({ ...settings, bookingName: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Meeting Title</label>
                <input
                  type="text" value={settings.bookingTitle}
                  onChange={(e) => setSettings({ ...settings, bookingTitle: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Slot Duration (min)</label>
                  <select value={settings.slotDuration}
                    onChange={(e) => setSettings({ ...settings, slotDuration: Number(e.target.value) })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>60 min</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Buffer (min)</label>
                  <select value={settings.bufferMinutes}
                    onChange={(e) => setSettings({ ...settings, bufferMinutes: Number(e.target.value) })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                    <option value={0}>None</option>
                    <option value={5}>5 min</option>
                    <option value={10}>10 min</option>
                    <option value={15}>15 min</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Start Hour</label>
                  <select value={settings.startHour}
                    onChange={(e) => setSettings({ ...settings, startHour: Number(e.target.value) })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">End Hour</label>
                  <select value={settings.endHour}
                    onChange={(e) => setSettings({ ...settings, endHour: Number(e.target.value) })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Available Days</label>
                <div className="flex gap-2">
                  {DAY_NAMES.map((name, i) => (
                    <button key={i} onClick={() => toggleDay(i)}
                      className={"flex-1 py-2 rounded-lg text-xs font-medium transition-colors " +
                        (settings.daysAvailable.includes(i)
                          ? "bg-blue-600 text-white"
                          : "bg-gray-800 text-gray-500 hover:bg-gray-700")}>
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Timezone</label>
                <input
                  type="text" value={settings.timezone}
                  onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-3">
                <button onClick={saveSettings} disabled={saving}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
                  {saving ? "Saving..." : "Save Settings"}
                </button>
                {!settings.calendarConnected && (
                  <a href="/api/calendar/auth"
                    className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                    Connect Google Calendar
                  </a>
                )}
                {settings.calendarConnected && (
                  <span className="text-xs text-green-400">✓ Google Calendar connected</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
