"use client";

import { useEffect, useState, useCallback, useMemo } from "react";

interface CalEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  description?: string;
  htmlLink?: string;
}

type View = "day" | "week" | "month";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function dateFmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

function sameDay(a: string, b: string) {
  return a.slice(0, 10) === b.slice(0, 10);
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatDateLong(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

// Color palette for events
const COLORS = [
  "bg-blue-600/30 border-blue-500 text-blue-200",
  "bg-purple-600/30 border-purple-500 text-purple-200",
  "bg-green-600/30 border-green-500 text-green-200",
  "bg-amber-600/30 border-amber-500 text-amber-200",
  "bg-pink-600/30 border-pink-500 text-pink-200",
  "bg-cyan-600/30 border-cyan-500 text-cyan-200",
];

function eventColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function CalendarPage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<View>("week");
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);

  // Compute fetch range based on view
  const { fetchStart, fetchEnd } = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const d = currentDate.getDate();
    if (view === "month") {
      return { fetchStart: new Date(y, m, 1), fetchEnd: new Date(y, m + 1, 0, 23, 59, 59) };
    } else if (view === "week") {
      const dow = currentDate.getDay();
      const start = new Date(y, m, d - dow);
      const end = new Date(y, m, d - dow + 6, 23, 59, 59);
      return { fetchStart: start, fetchEnd: end };
    } else {
      return { fetchStart: new Date(y, m, d), fetchEnd: new Date(y, m, d, 23, 59, 59) };
    }
  }, [currentDate, view]);

  const fetchEvents = useCallback(async () => {
    const res = await fetch(
      "/api/calendar/events?timeMin=" + fetchStart.toISOString() + "&timeMax=" + fetchEnd.toISOString()
    );
    const data = await res.json();
    setConnected(data.connected ?? false);
    setEvents(data.events || []);
  }, [fetchStart, fetchEnd]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const today = new Date();
  const todayStr = dateFmt(today);

  // Navigation
  const navigate = (dir: number) => {
    const d = new Date(currentDate);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    else if (view === "week") d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setCurrentDate(d);
  };

  const goToday = () => setCurrentDate(new Date());

  // Title text
  const title = useMemo(() => {
    if (view === "month") return `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    if (view === "day") return formatDateLong(dateFmt(currentDate));
    // week
    const dow = currentDate.getDay();
    const start = new Date(currentDate);
    start.setDate(start.getDate() - dow);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const sm = start.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
    const em = end.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
    return `${sm} – ${em}`;
  }, [currentDate, view]);

  // Week days array
  const weekDays = useMemo(() => {
    const dow = currentDate.getDay();
    const start = new Date(currentDate);
    start.setDate(start.getDate() - dow);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [currentDate]);

  // Month grid
  const monthDays = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let i = 1; i <= daysInMonth; i++) cells.push(new Date(y, m, i));
    return cells;
  }, [currentDate]);

  const getEventsForDate = (dateStr: string) =>
    events.filter((e) => sameDay(e.start, dateStr));

  // Position an event in the time grid (returns top% and height%)
  const eventPosition = (evt: CalEvent) => {
    const start = new Date(evt.start);
    const end = new Date(evt.end);
    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMin = end.getHours() * 60 + end.getMinutes();
    const top = (startMin / (24 * 60)) * 100;
    const height = Math.max(((endMin - startMin) / (24 * 60)) * 100, 1.5);
    return { top: `${top}%`, height: `${height}%` };
  };

  // Time grid column component
  const TimeColumn = ({ dateStr, className }: { dateStr: string; className?: string }) => {
    const dayEvents = getEventsForDate(dateStr).filter((e) => !e.allDay);
    return (
      <div className={"relative border-r border-gray-800/40 " + (className || "")}>
        {HOURS.map((h) => (
          <div key={h} className="h-14 border-b border-gray-800/20" />
        ))}
        {dayEvents.map((evt) => {
          const pos = eventPosition(evt);
          const color = eventColor(evt.id);
          return (
            <button
              key={evt.id}
              onClick={() => setSelectedEvent(evt)}
              className={"absolute left-0.5 right-1 rounded px-1.5 py-0.5 text-[11px] leading-tight border-l-2 truncate cursor-pointer hover:brightness-125 transition-all " + color}
              style={{ top: pos.top, height: pos.height, minHeight: "20px" }}
            >
              <span className="font-medium">{evt.title}</span>
              <br />
              <span className="opacity-70">{formatTime(evt.start)}</span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {/* Header */}
      <header className="shrink-0 border-b border-gray-800/60 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            {connected === false && (
              <a href="/api/calendar/auth"
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors">
                Connect Google Calendar
              </a>
            )}
            {connected && (
              <>
                <button onClick={goToday}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300">
                  Today
                </button>
                <div className="flex items-center rounded-lg bg-gray-800 overflow-hidden">
                  <button onClick={() => navigate(-1)} className="px-2 py-1.5 text-gray-400 hover:text-white hover:bg-gray-700">←</button>
                  <button onClick={() => navigate(1)} className="px-2 py-1.5 text-gray-400 hover:text-white hover:bg-gray-700">→</button>
                </div>
                <div className="flex items-center rounded-lg bg-gray-800 overflow-hidden text-xs">
                  {(["day", "week", "month"] as View[]).map((v) => (
                    <button key={v} onClick={() => setView(v)}
                      className={"px-2.5 py-1.5 capitalize transition-colors " +
                        (view === v ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-700")}>
                      {v}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex">
        {/* Main calendar area */}
        <div className="flex-1 overflow-auto">

          {/* === MONTH VIEW === */}
          {view === "month" && (
            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-7 gap-px mb-1">
                {DAYS.map((d) => (
                  <div key={d} className="text-center text-xs text-gray-500 py-1 font-medium">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px">
                {monthDays.map((day, i) => {
                  if (!day) return <div key={i} className="aspect-square" />;
                  const dateStr = dateFmt(day);
                  const dayEvents = getEventsForDate(dateStr);
                  const isToday = dateStr === todayStr;

                  return (
                    <button
                      key={i}
                      onClick={() => { setCurrentDate(day); setView("day"); }}
                      className={"aspect-square p-1 rounded-lg text-sm relative transition-colors hover:bg-gray-800/60 " +
                        (isToday ? "bg-gray-800" : "")}
                    >
                      <span className={"text-xs " + (isToday ? "text-blue-400 font-bold" : "text-gray-300")}>
                        {day.getDate()}
                      </span>
                      {dayEvents.length > 0 && (
                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                          {dayEvents.slice(0, 3).map((e, j) => (
                            <span key={j} className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                          ))}
                          {dayEvents.length > 3 && <span className="text-[8px] text-gray-500">+{dayEvents.length - 3}</span>}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* === WEEK VIEW === */}
          {view === "week" && (
            <div className="flex flex-col h-full">
              {/* Day headers */}
              <div className="flex shrink-0 border-b border-gray-800/60">
                <div className="w-14 shrink-0" />
                {weekDays.map((d) => {
                  const dateStr = dateFmt(d);
                  const isToday = dateStr === todayStr;
                  return (
                    <div key={dateStr}
                      className={"flex-1 text-center py-2 cursor-pointer hover:bg-gray-800/40 transition-colors " +
                        (isToday ? "bg-blue-600/10" : "")}
                      onClick={() => { setCurrentDate(d); setView("day"); }}
                    >
                      <div className="text-[10px] text-gray-500">{DAYS[d.getDay()]}</div>
                      <div className={"text-sm font-medium " + (isToday ? "text-blue-400" : "text-gray-300")}>{d.getDate()}</div>
                    </div>
                  );
                })}
              </div>
              {/* Time grid */}
              <div className="flex-1 overflow-auto">
                <div className="flex min-h-0">
                  {/* Hour labels */}
                  <div className="w-14 shrink-0">
                    {HOURS.map((h) => (
                      <div key={h} className="h-14 flex items-start justify-end pr-2 -mt-2">
                        <span className="text-[10px] text-gray-600">{h === 0 ? "" : String(h).padStart(2, "0") + ":00"}</span>
                      </div>
                    ))}
                  </div>
                  {/* Day columns */}
                  {weekDays.map((d) => (
                    <TimeColumn key={dateFmt(d)} dateStr={dateFmt(d)} className="flex-1" />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* === DAY VIEW === */}
          {view === "day" && (
            <div className="flex flex-col h-full">
              {/* All-day events */}
              {getEventsForDate(dateFmt(currentDate)).filter((e) => e.allDay).length > 0 && (
                <div className="shrink-0 border-b border-gray-800/40 px-4 py-2 flex gap-2 flex-wrap">
                  {getEventsForDate(dateFmt(currentDate)).filter((e) => e.allDay).map((evt) => (
                    <button key={evt.id} onClick={() => setSelectedEvent(evt)}
                      className={"px-2 py-1 rounded text-xs border-l-2 " + eventColor(evt.id)}>
                      {evt.title}
                    </button>
                  ))}
                </div>
              )}
              {/* Time grid */}
              <div className="flex-1 overflow-auto">
                <div className="flex">
                  <div className="w-14 shrink-0">
                    {HOURS.map((h) => (
                      <div key={h} className="h-16 flex items-start justify-end pr-2 -mt-2">
                        <span className="text-[10px] text-gray-600">{h === 0 ? "" : String(h).padStart(2, "0") + ":00"}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex-1">
                    <TimeColumn dateStr={dateFmt(currentDate)} className="min-h-full" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Event detail panel */}
        {selectedEvent && (
          <div className="w-80 shrink-0 border-l border-gray-800/60 bg-gray-900/80 overflow-y-auto">
            <div className="p-4">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-base font-semibold pr-2">{selectedEvent.title}</h3>
                <button onClick={() => setSelectedEvent(null)}
                  className="text-gray-500 hover:text-white text-lg leading-none shrink-0">×</button>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-500 text-xs mb-0.5">When</p>
                  <p className="text-gray-200">
                    {selectedEvent.allDay
                      ? formatDateLong(selectedEvent.start)
                      : <>
                          {formatDateLong(selectedEvent.start.slice(0, 10))}
                          <br />
                          <span className="text-gray-400">{formatTime(selectedEvent.start)} – {formatTime(selectedEvent.end)}</span>
                        </>
                    }
                  </p>
                </div>

                {selectedEvent.location && (
                  <div>
                    <p className="text-gray-500 text-xs mb-0.5">Location</p>
                    <p className="text-gray-200">{selectedEvent.location}</p>
                  </div>
                )}

                {selectedEvent.description && (
                  <div>
                    <p className="text-gray-500 text-xs mb-0.5">Description</p>
                    <p className="text-gray-300 text-xs whitespace-pre-wrap leading-relaxed">{selectedEvent.description}</p>
                  </div>
                )}

                {selectedEvent.htmlLink && (
                  <a href={selectedEvent.htmlLink} target="_blank" rel="noopener noreferrer"
                    className="inline-block text-xs text-blue-400 hover:text-blue-300 mt-2">
                    Open in Google Calendar ↗
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
