"use client";

import { useEffect, useMemo, useState } from "react";
import type { PersonId } from "@/lib/types";
import { useRobotEvents } from "@/components/RobotEventContext";
import { EventDetailSheet } from "@/components/EventDetailSheet";
import { JobDetailSheet } from "@/components/JobCard";
import { deriveTimeLabel } from "@/lib/job-time";
import { iconForJobAgent, loadStandingJobs, standingScheduledAtToday, type StandingJob } from "@/lib/jobs";
import type { TeamAgentId } from "@/lib/team";
import { canonicalPersonId, displayNameForPersonId } from "@/lib/family/profile";

// A calendar block — a one-time job the family created, or one instance of a
// standing (Every-day) job projected onto a day. Both carry a real datetime.
type Block = {
  id: string;
  title: string;
  person: PersonId;
  scheduledAt: number;
  robot: boolean;
  eventId?: string;    // backed by a one-time event (deletable)
  standingId?: string; // backed by a standing job (managed from Jobs)
  icon?: string;
  agent?: TeamAgentId;
  note?: string;
  statusLabel?: string;
};

// A Google-Calendar-style day view standing in for the user's real calendar:
// a week date strip, an hourly grid, and solid colored event blocks. The week
// always starts on the real "today", so dates never drift.

const DAY_MS = 24 * 60 * 60 * 1000;
const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function startOfDay(epoch: number): number {
  const d = new Date(epoch);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Google event colors, keyed by whose calendar the event belongs to.
const PERSON_COLOR: Record<PersonId, string> = {
  child1: "#d50000", // Tomato
  child2: "#039be5", // Peacock
  family: "#0b8043", // Basil
  baby: "#8e24aa", // Grape
  mom: "#3f51b5", // Blueberry
  dad: "#f09300", // Banana
  grandma: "#e67c73", // Flamingo
};

function personColor(id: PersonId): string {
  return PERSON_COLOR[canonicalPersonId(id)] ?? PERSON_COLOR.family;
}

function personLabel(id: PersonId): string {
  return displayNameForPersonId(id);
}

// Visible grid window: 7 AM → 9 PM.
const START_HOUR = 7;
const END_HOUR = 21;
const ROW_H = 56; // px per hour

// Fractional hour-of-day for vertical placement.
function hourOfDay(epoch: number): number {
  const d = new Date(epoch);
  return d.getHours() + d.getMinutes() / 60;
}

function hourLabel(h: number): string {
  const ampm = h < 12 || h === 24 ? "AM" : "PM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display} ${ampm}`;
}

export default function CalendarPage() {
  const { events, removeEvent } = useRobotEvents();
  const [standing, setStanding] = useState<StandingJob[]>([]);
  const [selected, setSelected] = useState(0);
  const [sel, setSel] = useState<Block | null>(null);
  const [now] = useState(() => Date.now());

  // Load Every-day jobs from the shared store (same toggles as the Jobs screen).
  useEffect(() => {
    setStanding(loadStandingJobs());
  }, []);

  // The 7-day forward strip starting today, recomputed from the real clock.
  const week = useMemo(() => {
    const today = startOfDay(now);
    return Array.from({ length: 7 }, (_, i) => {
      const dayStart = today + i * DAY_MS;
      const d = new Date(dayStart);
      return { key: i, dow: DOW[d.getDay()], date: d.getDate(), today: i === 0, dayStart };
    });
  }, [now]);

  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(now)),
    [now]
  );

  // All blocks for the week: one-time events + one instance per enabled standing
  // job per day. Each lands in the day column whose date it shares.
  const byDay = useMemo(() => {
    const map: Record<number, Block[]> = {};
    const place = (b: Block) => {
      const day = week.findIndex((w) => startOfDay(b.scheduledAt) === w.dayStart);
      if (day === -1) return; // outside the visible week
      (map[day] ??= []).push(b);
    };
    for (const e of events) {
      const agent = e.agent ?? "homekeeper";
      place({
        id: e.id, eventId: e.id, title: e.title, person: e.person, scheduledAt: e.scheduledAt,
        robot: e.forRobot, icon: iconForJobAgent(agent), agent, note: e.note, statusLabel: STATUS_LABEL[e.status],
      });
    }
    for (const job of standing) {
      if (!job.enabled) continue;
      for (const w of week) {
        const scheduledAt = standingScheduledAtToday(job, w.dayStart);
        place({
          id: `standing-${job.id}-${w.key}`, standingId: job.id, title: job.title,
          person: job.person, scheduledAt, robot: true, icon: iconForJobAgent(job.agent), agent: job.agent,
        });
      }
    }
    return map;
  }, [events, standing, week]);

  // Lay out the day's events, splitting overlapping ones into side-by-side
  // columns the way Google Calendar does.
  const laidOut = useMemo(() => {
    const items = (byDay[selected] ?? [])
      .map((e) => {
        const start = hourOfDay(e.scheduledAt);
        return { e, start, end: start + 1 };
      })
      .sort((a, b) => a.start - b.start);

    const placed: (typeof items[number] & { col: number; cols: number })[] = [];
    let cluster: typeof items = [];
    let clusterEnd = -1;

    const flush = () => {
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
  // Live "now" line, drawn only on today's column.
  const nowTop = (hourOfDay(now) - START_HOUR) * ROW_H;

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
              <h1 className="flex-1 text-[20px] font-medium text-[#3c4043]">{monthLabel}</h1>
              <div className="grid h-8 w-8 place-items-center rounded-full bg-[#1a73e8] text-[13px] font-medium text-white">J</div>
            </div>

            {/* Week date strip */}
            <div className="mt-2 grid grid-cols-7">
              {week.map((d) => {
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

              {/* Now line (today only) */}
              {week[selected]?.today && nowTop >= 0 && nowTop <= (END_HOUR - START_HOUR) * ROW_H ? (
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
                const color = personColor(e.person);
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
                      {deriveTimeLabel(e.scheduledAt)} · {personLabel(e.person)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Tap a block → details. One-time jobs can be deleted; standing jobs are
          managed from the Jobs screen (no delete here). */}
      {sel ? (() => {
        const event = sel.eventId ? events.find((item) => item.id === sel.eventId) : undefined;
        if (event) {
          return (
            <JobDetailSheet
              event={event}
              onDelete={() => {
                removeEvent(event.id);
                setSel(null);
              }}
              onClose={() => setSel(null)}
            />
          );
        }
        const whenLine = [deriveTimeLabel(sel.scheduledAt), personLabel(sel.person)].filter(Boolean).join(" · ");
        return (
          <EventDetailSheet
            detail={{
              title: sel.title,
              icon: sel.icon ?? "calendar",
              agent: sel.agent,
              whenLine,
              note: sel.note,
              quoteNote: !!sel.note,
              statusLabel: sel.statusLabel,
            }}
            onDelete={sel.eventId ? () => { removeEvent(sel.eventId!); setSel(null); } : undefined}
            onClose={() => setSel(null)}
          />
        );
      })() : null}
    </main>
  );
}

const STATUS_LABEL: Record<string, string> = { scheduled: "Scheduled", recording: "Recording", done: "Done" };
