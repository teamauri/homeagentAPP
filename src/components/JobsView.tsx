"use client";

import { useEffect, useState } from "react";
import { jobIcon, seedStanding, seedUpcoming, type JobSource, type StandingJob } from "@/lib/jobs";
import { teamAgentById } from "@/lib/team";
import { useChildren } from "./FamilyContext";
import { DoodleIcon } from "./Icons";
import { NewJobView } from "./NewJobView";
import { EventDetailSheet } from "./EventDetailSheet";
import { useRobotEvents } from "./RobotEventContext";

const STATUS_LABEL: Record<string, string> = { scheduled: "Scheduled", recording: "Recording", done: "Done" };

// "Jobs" — everything the family has set Auri to do, in two zones:
//   Upcoming   · one-time + imported calendar events (clears after it runs)
//   Every day  · standing recurring jobs with on/off toggles
// This replaces the old "Inbox / Needs You" surface. No drafts to confirm — just
// what Auri is set to deliver, and the switches that control it.

// One unified row for the Upcoming zone, whether it came from a created event
// (also shown on the calendar) or the mock seed.
type UpcomingItem = {
  id: string;
  eventId?: string; // present when backed by a real event (opens the calendar)
  title: string;
  dateLabel: string;
  timeLabel: string;
  iconName: string;
  meta: string;
  source: JobSource;
  forRobot: boolean;
};

// Every calendar event is a robot task, so the Auri Robot badge shows on all of them.
// A "Today" job whose scheduled time is more than 30 minutes in the past is
// treated as expired and removed from Upcoming (it ran but never got a "done"
// callback, or the user ignored it).
function isExpired(dateLabel: string, timeLabel: string): boolean {
  if (dateLabel !== "Today") return false;
  const m = timeLabel.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return false;
  let hour = parseInt(m[1]);
  const min = parseInt(m[2]);
  const period = m[3].toUpperCase();
  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  const scheduled = new Date();
  scheduled.setHours(hour, min, 0, 0);
  return Date.now() > scheduled.getTime();
}

const SHORT_DAY: Record<string, string> = {
  Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu", Friday: "Fri", Saturday: "Sat", Sunday: "Sun", Tomorrow: "Tmrw",
};
const shortDay = (d: string) => SHORT_DAY[d] ?? d;

export function JobsView({ onRunActivity, onSubpageChange }: { onRunActivity?: () => void; onSubpageChange?: (open: boolean) => void } = {}) {
  const { events, addEvent, removeEvent, startHighlight } = useRobotEvents();
  const children = useChildren();
  const personLabel = (id: string) => children.find((c) => c.id === id)?.name ?? (id === "family" ? "Family" : id);
  const [standing, setStanding] = useState<StandingJob[]>(seedStanding);
  const [creating, setCreating] = useState(false);
  const [editJob, setEditJob] = useState<StandingJob | null>(null);
  const [sel, setSel] = useState<UpcomingItem | null>(null);

  // Upcoming = one-time events the family created (live in the shared store, so
  // they also appear on the calendar) + the mock seed. "Done" events clear out.
  const upcomingItems: UpcomingItem[] = [
    ...events
      .filter((e) => !e.kind && e.status !== "done" && !isExpired(e.dateLabel, e.timeLabel))
      .map<UpcomingItem>((e) => ({
        id: e.id,
        eventId: e.id,
        title: e.title,
        dateLabel: e.dateLabel,
        timeLabel: e.timeLabel,
        iconName: e.icon,
        meta: personLabel(e.person),
        source: "auri",
        forRobot: true,
      })),
    ...seedUpcoming.map<UpcomingItem>((j) => ({
      id: j.id,
      title: j.title,
      dateLabel: j.dateLabel,
      timeLabel: j.timeLabel,
      iconName: jobIcon[j.type],
      meta: j.subtitle,
      source: j.source,
      forRobot: true,
    })),
  ];

  // Tell the shell to drop its "Jobs" header while the New/Edit page is open —
  // that page has its own "‹ Back · New job" header, so the global one is noise.
  const onSubpage = creating || !!editJob;
  useEffect(() => {
    onSubpageChange?.(onSubpage);
  }, [onSubpage, onSubpageChange]);

  const toggle = (id: string) =>
    setStanding((cur) => cur.map((job) => (job.id === id ? { ...job, enabled: !job.enabled } : job)));

  // Run a highlight job now: it starts capturing for real and the live counter
  // card shows up in the Home stream, so jump there to watch it.
  const run = (job: StandingJob) => {
    if (job.type === "highlight") startHighlight({ title: job.title, person: "family" });
    onRunActivity?.();
  };

  const closeForm = () => {
    setCreating(false);
    setEditJob(null);
  };

  if (creating || editJob) {
    return (
      <NewJobView
        editJob={editJob ?? undefined}
        onClose={closeForm}
        onSubmitStanding={(job, isEdit) => {
          setStanding((cur) => (isEdit ? cur.map((j) => (j.id === job.id ? job : j)) : [...cur, job]));
          closeForm();
        }}
        onSubmitOnce={(input) => {
          // A one-time job IS an event — store it so it shows here AND on the calendar.
          addEvent(input);
          closeForm();
        }}
        onDelete={(id) => {
          setStanding((cur) => cur.filter((j) => j.id !== id));
          closeForm();
        }}
      />
    );
  }

  return (
    <div className="pb-4">
      <div className="mb-5 flex justify-end">
        <div className="inline-flex rounded-full bg-[#ece5da] p-0.5">
          <span className="rounded-full bg-white px-3.5 py-1 text-[12.5px] font-semibold text-ink shadow-[0_1px_3px_rgba(8,8,8,0.06)]">List</span>
          <a href="/calendar" className="px-3.5 py-1 text-[12.5px] font-semibold text-muted">Calendar</a>
        </div>
      </div>

      <section className="mb-7">
        <div className="mb-2.5 flex items-baseline justify-between px-1">
          <h2 className="text-[16px] font-medium text-ink">Upcoming</h2>
          <span className="text-[12px] leading-4 text-muted">clears after it runs</span>
        </div>
        <div className="overflow-hidden rounded-[18px] border border-line bg-white shadow-[0_2px_10px_rgba(8,8,8,0.035)]">
          {upcomingItems.length ? (
            upcomingItems.map((item, i) => <UpcomingRow key={item.id} item={item} first={i === 0} onSelect={() => setSel(item)} />)
          ) : (
            <p className="px-4 py-5 text-[13px] leading-5 text-muted">Nothing one-time yet. Tap “New”, choose “One time”, and it lands here.</p>
          )}
        </div>
      </section>

      <section className="pb-2">
        <div className="mb-2.5 flex items-baseline justify-between px-1">
          <h2 className="text-[16px] font-medium text-ink">Every day</h2>
          <button onClick={() => setCreating(true)} className="flex items-center gap-1 text-[13px] font-semibold leading-4 text-auri">
            <span className="text-[15px] leading-none">+</span> New
          </button>
        </div>
        <div className="overflow-hidden rounded-[18px] border border-line bg-white shadow-[0_2px_10px_rgba(8,8,8,0.035)]">
          {standing.map((job, i) => (
            <StandingRow
              key={job.id}
              job={job}
              first={i === 0}
              onToggle={() => toggle(job.id)}
              onEdit={() => setEditJob(job)}
              onRun={job.type === "highlight" ? () => run(job) : undefined}
            />
          ))}
        </div>
      </section>

      {/* Tap a row → the shared event detail sheet (created events can be deleted). */}
      {sel ? (() => {
        const created = sel.eventId ? events.find((e) => e.id === sel.eventId) : undefined;
        const whenLine = [sel.dateLabel, sel.timeLabel, created ? personLabel(created.person) : ""].filter(Boolean).join(" · ");
        return (
          <EventDetailSheet
            detail={{
              title: sel.title,
              icon: sel.iconName,
              whenLine,
              note: created?.note,
              quoteNote: !!created,
              statusLabel: created ? STATUS_LABEL[created.status] : undefined,
              hasPhoto: !!created?.photoUrl,
              hasVoice: !!created?.voiceUrl,
            }}
            onDelete={created ? () => { removeEvent(sel.eventId!); setSel(null); } : undefined}
            onClose={() => setSel(null)}
          />
        );
      })() : null}
    </div>
  );
}

function RobotBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#e3f3f3] px-1.5 py-0.5 text-[10.5px] font-semibold leading-3 text-[#0a7d7d]">
      <DoodleIcon name="robot" className="h-3 w-3" /> Auri Robot
    </span>
  );
}

function UpcomingRow({ item, first, onSelect }: { item: UpcomingItem; first: boolean; onSelect: () => void }) {
  return (
    <button onClick={onSelect} className={`flex w-full items-center gap-3 px-3.5 py-3 text-left ${first ? "" : "border-t border-line/70"}`}>
      <div className="w-[40px] shrink-0 text-center">
        <div className="text-[11px] leading-4 text-muted">{shortDay(item.dateLabel)}</div>
        <div className="text-[14px] font-semibold leading-4 text-ink">{item.timeLabel.replace(/\s?[AP]M$/i, "")}</div>
      </div>
      <span className="h-8 w-px shrink-0 bg-line" aria-hidden="true" />
      <div className="grid h-[40px] w-[40px] shrink-0 place-items-center">
        <DoodleIcon name={item.iconName} className="h-8 w-8" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold leading-[19px] tracking-[-0.02em] text-ink">{item.title}</h3>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          {item.forRobot ? <RobotBadge /> : null}
          {item.source === "gcal" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#2e7dd1]/10 px-1.5 py-0.5 text-[10.5px] font-semibold leading-3 text-[#2e7dd1]">
              <DoodleIcon name="calendar" className="h-3 w-3" /> Google
            </span>
          ) : null}
          <span className="text-[12.5px] leading-[18px] tracking-[0] text-muted">{item.meta}</span>
        </div>
      </div>
      <span className="text-[26px] font-light leading-none text-ink/40">›</span>
    </button>
  );
}

function StandingRow({ job, first, onToggle, onEdit, onRun }: { job: StandingJob; first: boolean; onToggle: () => void; onEdit: () => void; onRun?: () => void }) {
  const agent = teamAgentById[job.agent];
  return (
    <div className={`flex items-center gap-2 px-3.5 py-3 ${first ? "" : "border-t border-line/70"} ${job.enabled ? "" : "opacity-60"}`}>
      <div className="grid h-[40px] w-[40px] shrink-0 place-items-center">
        <DoodleIcon name={jobIcon[job.type]} className="h-8 w-8" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold leading-[19px] tracking-[-0.02em] text-ink">{job.title}</h3>
        <div className="mt-0.5 flex items-center gap-2 text-[12.5px] leading-[18px] tracking-[0] text-muted">
          <span><span className="font-semibold text-ink/75">{agent?.name}</span> · {job.trigger}</span>
          {onRun && job.enabled ? (
            <button
              onClick={onRun}
              aria-label={`Run ${job.title} now`}
              className="inline-grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border border-line text-ink"
            >
              <svg viewBox="0 0 24 24" className="h-[10px] w-[10px] translate-x-[0.5px]" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>
      <Toggle on={job.enabled} onClick={onToggle} label={`Turn ${job.enabled ? "off" : "on"} ${job.title}`} />
      <button onClick={onEdit} aria-label={`Edit ${job.title}`} className="grid h-8 w-8 shrink-0 place-items-center text-muted/70">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
        </svg>
      </button>
    </div>
  );
}


function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`relative h-[23px] w-[39px] shrink-0 rounded-full transition-colors ${on ? "bg-[#2f9d5b]" : "bg-[#e0d9cd]"}`}
    >
      <span className={`absolute top-[2px] h-[19px] w-[19px] rounded-full bg-white shadow-sm transition-all ${on ? "left-[18px]" : "left-[2px]"}`} />
    </button>
  );
}
