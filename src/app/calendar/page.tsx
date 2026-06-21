"use client";

import { useEffect, useMemo, useState } from "react";
import { upcoming } from "@/lib/mock-data";
import type { PersonId } from "@/lib/types";
import { useRobotEvents } from "@/components/RobotEventContext";
import { EventDetailSheet } from "@/components/EventDetailSheet";

const HIDDEN_KEY = "auri.hiddenCalIds.v1";

// A calendar block — either a mock upcoming event or one the family created
// (which may or may not be handed to the robot).
type Block = { id: string; title: string; person: PersonId; timeLabel: string; robot: boolean };

// A Google-Calendar-style day view. This screen stands in for the user's real
// Google Calendar, so it deliberately mimics GCal: a week date strip, an hourly
// time grid, and solid colored event blocks in Google's event palette.

// The 7-day forward strip starting "today" (2026-06-19 is a Friday).
const WEEK: { key: string; dow: string; date: number; today?: boolean }[] = [
  { key: "fri", dow: "FRI", date: 19, today: true },
  { key: "sat", dow: "SAT", date: 20 },
  { key: "sun", dow: "SUN", date: 21 },
  { key: "mon", dow: "MON", date: 22 },
  { key: "tue", dow: "TUE", date: 23 },
  { key: "wed", dow: "WED", date: 24 },
  { key: "thu", dow: "THU", date: 25 },
];

// Which day each event lands on (dateLabel → strip key). "Today" is Friday the
// 19th in this demo week.
const DAY_OF: Record<string, string> = {
  Today: "fri",
  Friday: "fri",
  Tomorrow: "sat",
  Saturday: "sat",
  Sunday: "sun",
  Monday: "mon",
  Tuesday: "tue",
  Wednesday: "wed",
  Thursday: "thu",
};

// Google event colors, keyed by whose calendar the event belongs to.
const PERSON_COLOR: Record<PersonId, string> = {
  mia: "#d50000", // Tomato
  leo: "#039be5", // Peacock
  family: "#0b8043", // Basil
  baby: "#8e24aa", // Grape
  mom: "#3f51b5", // Blueberry
  dad: "#f09300", // Banana
  grandma: "#e67c73", // Flamingo
};

const PERSON_LABEL: Record<PersonId, string> = {
  mia: "Mia",
  leo: "Leo",
  family: "Family",
  baby: "Baby",
  mom: "Mom",
  dad: "Dad",
  grandma: "Grandma",
};

// Visible grid window: 7 AM → 9 PM.
const START_HOUR = 7;
const END_HOUR = 21;
const ROW_H = 56; // px per hour

function parseHour(timeLabel: string): number {
  const m = timeLabel.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return START_HOUR;
  let h = parseInt(m[1], 10) % 12;
  if (/pm/i.test(m[3])) h += 12;
  return h + parseInt(m[2], 10) / 60;
}

function hourLabel(h: number): string {
  const ampm = h < 12 || h === 24 ? "AM" : "PM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display} ${ampm}`;
}

export default function CalendarPage() {
  const [selected, setSelected] = useState("fri");
  const { events, removeEvent } = useRobotEvents();
  const [sel, setSel] = useState<Block | null>(null);
  // Mock seed events can't be removed from source, so deleting one just hides
  // its id (persisted). Created events are removed from the shared store.
  const [hidden, setHidden] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HIDDEN_KEY);
      if (raw) setHidden(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  const deleteBlock = (b: Block) => {
    if (b.id.startsWith("revent_")) {
      removeEvent(b.id);
    } else {
      setHidden((cur) => {
        const next = cur.includes(b.id) ? cur : [...cur, b.id];
        try {
          localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    }
    setSel(null);
  };

  const byDay = useMemo(() => {
    const map: Record<string, Block[]> = {};
    const push = (b: Block, dateLabel: string) => {
      if (hidden.includes(b.id)) return;
      const day = DAY_OF[dateLabel];
      if (!day) return;
      (map[day] ??= []).push(b);
    };
    // Every calendar event is a robot task, so all blocks get the robot marker.
    for (const e of upcoming) {
      push({ id: e.id, title: e.title, person: e.person, timeLabel: e.timeLabel, robot: true }, e.dateLabel);
    }
    for (const e of events) {
      push({ id: e.id, title: e.title, person: e.person, timeLabel: e.timeLabel, robot: true }, e.dateLabel);
    }
    return map;
  }, [events, hidden]);

  // Lay out the day's events, splitting overlapping ones into side-by-side
  // columns the way Google Calendar does.
  const laidOut = useMemo(() => {
    const items = (byDay[selected] ?? [])
      .map((e) => {
        const start = parseHour(e.timeLabel);
        return { e, start, end: start + 1 };
      })
      .sort((a, b) => a.start - b.start);

    const placed: (typeof items[number] & { col: number; cols: number })[] = [];
    let cluster: typeof items = [];
    let clusterEnd = -1;

    const flush = () => {
      // Greedy column assignment within a cluster of mutually-overlapping events.
      const colEnds: number[] = [];
      const withCol = cluster.map((it) => {
        let col = colEnds.findIndex((end) => it.start >= end);
        if (col === -1) {
          col = colEnds.length;
          colEnds.push(it.end);
        } else {
          colEnds[col] = it.end;
        }
        return { ...it, col };
      });
      withCol.forEach((it) => placed.push({ ...it, cols: colEnds.length }));
      cluster = [];
      clusterEnd = -1;
    };

    for (const it of items) {
      if (cluster.length && it.start >= clusterEnd) flush();
      cluster.push(it);
      clusterEnd = Math.max(clusterEnd, it.end);
    }
    flush();
    return placed;
  }, [byDay, selected]);

  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
  // Static "now" line (mock) — only drawn on today.
  const nowTop = (13.4 - START_HOUR) * ROW_H;

  return (
    <main className="min-h-screen bg-[#e9ecef] px-3 py-4 font-body md:grid md:place-items-center md:px-10">
      <div className="phone-shell mx-auto w-full max-w-[430px] overflow-hidden bg-white">
        <div className="relative flex h-[min(900px,calc(100dvh-2rem))] min-h-[760px] flex-col overflow-hidden bg-white">
          {/* Google top bar */}
          <div className="relative shrink-0 px-4 pt-[18px]">
            <div className="pointer-events-none absolute left-1/2 top-[12px] h-[30px] w-[112px] -translate-x-1/2 rounded-full bg-black" />
            <div className="flex items-center gap-3 pt-7">
              <a href="/" aria-label="Back" className="-ml-1 grid h-9 w-9 place-items-center rounded-full text-[#5f6368] hover:bg-black/5">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor"><path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4-4.6-4.6z" /></svg>
              </a>
              <h1 className="flex-1 text-[20px] font-medium text-[#3c4043]">June 2026</h1>
              <div className="grid h-8 w-8 place-items-center rounded-full bg-[#1a73e8] text-[13px] font-medium text-white">J</div>
            </div>

            {/* Week date strip */}
            <div className="mt-2 grid grid-cols-7">
              {WEEK.map((d) => {
                const active = selected === d.key;
                const hasEvents = (byDay[d.key]?.length ?? 0) > 0;
                return (
                  <button key={d.key} onClick={() => setSelected(d.key)} className="flex flex-col items-center gap-1 py-1.5">
                    <span className={`text-[11px] font-medium tracking-wide ${active ? "text-[#1a73e8]" : "text-[#70757a]"}`}>{d.dow}</span>
                    <span
                      className={`grid h-8 w-8 place-items-center rounded-full text-[15px] ${
                        active && d.today
                          ? "bg-[#1a73e8] font-medium text-white"
                          : active
                            ? "bg-[#e8f0fe] font-medium text-[#1a73e8]"
                            : d.today
                              ? "font-medium text-[#1a73e8]"
                              : "text-[#3c4043]"
                      }`}
                    >
                      {d.date}
                    </span>
                    <span className={`h-1 w-1 rounded-full ${hasEvents ? "bg-[#70757a]" : "bg-transparent"}`} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px w-full bg-[#dadce0]" />

          {/* Time grid */}
          <div className="no-scrollbar flex-1 overflow-y-auto">
            <div className="relative" style={{ height: (END_HOUR - START_HOUR) * ROW_H + 24 }}>
              {/* Hour lines + labels */}
              {hours.map((h, i) => (
                <div key={h} className="absolute left-0 right-0 flex items-start" style={{ top: i * ROW_H + 12 }}>
                  <span className="-mt-1.5 w-[52px] pr-2 text-right text-[11px] text-[#70757a]">{hourLabel(h)}</span>
                  <span className="mt-[1px] h-px flex-1 bg-[#e4e6e9]" />
                </div>
              ))}

              {/* Now line (mock, today only) */}
              {selected === "fri" ? (
                <div className="absolute left-[52px] right-0 z-10" style={{ top: nowTop + 12 }}>
                  <div className="relative">
                    <span className="absolute -left-1 -top-[5px] h-2.5 w-2.5 rounded-full bg-[#ea4335]" />
                    <span className="block h-[2px] w-full bg-[#ea4335]" />
                  </div>
                </div>
              ) : null}

              {/* Event blocks */}
              {laidOut.map(({ e, start, col, cols }) => {
                const top = (start - START_HOUR) * ROW_H + 12;
                const color = PERSON_COLOR[e.person];
                // Column geometry within the area between the time gutter (58px) and right edge (12px).
                const left = `calc(58px + (100% - 70px) * ${col} / ${cols})`;
                const width = `calc((100% - 70px) / ${cols} - 3px)`;
                return (
                  <button
                    key={e.id}
                    onClick={() => setSel(e)}
                    className="absolute z-20 overflow-hidden rounded-[6px] px-2.5 py-1.5 text-left text-white shadow-sm"
                    style={{ top, left, width, height: ROW_H - 6, backgroundColor: color }}
                  >
                    <div className="flex items-center gap-1">
                      {e.robot ? (
                        <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Auri Robot">
                          <rect x="5" y="8" width="14" height="10" rx="2" />
                          <path d="M12 8V5M9 13h.01M15 13h.01M2 12v2M22 12v2" />
                        </svg>
                      ) : null}
                      <span className="truncate text-[13px] font-medium leading-4">{e.title}</span>
                    </div>
                    <div className="truncate text-[11px] leading-4 text-white/85">
                      {e.timeLabel} · {PERSON_LABEL[e.person]}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Tap an event → full details + delete (shared with Jobs). */}
      {sel ? (() => {
        const created = sel.id.startsWith("revent_") ? events.find((e) => e.id === sel.id) : undefined;
        const mock = created ? undefined : upcoming.find((e) => e.id === sel.id);
        const dateLabel = created?.dateLabel ?? mock?.dateLabel ?? "";
        const whenLine = [dateLabel, sel.timeLabel, PERSON_LABEL[sel.person]].filter(Boolean).join(" · ");
        return (
          <EventDetailSheet
            detail={{
              title: sel.title,
              icon: created?.icon ?? mock?.icon ?? "calendar",
              whenLine,
              note: created?.note ?? mock?.body,
              quoteNote: !!created,
              statusLabel: created ? STATUS_LABEL[created.status] : undefined,
              hasPhoto: !!created?.photoUrl,
              hasVoice: !!created?.voiceUrl,
            }}
            onDelete={() => deleteBlock(sel)}
            onClose={() => setSel(null)}
          />
        );
      })() : null}
    </main>
  );
}

const STATUS_LABEL: Record<string, string> = { scheduled: "Scheduled", recording: "Recording", done: "Done" };
