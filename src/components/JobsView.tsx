"use client";

import { useEffect, useState } from "react";
import { jobIcon, loadStandingJobs, seedStanding, standingScheduledAtToday, STANDING_KEY, type StandingJob } from "@/lib/jobs";
import { deriveDateLabel, deriveTimeLabel } from "@/lib/job-time";
import { teamAgentById } from "@/lib/team";
import { useChildren } from "./FamilyContext";
import { DoodleIcon } from "./Icons";
import { NewJobView } from "./NewJobView";
import { EventDetailSheet } from "./EventDetailSheet";
import { useRobotEvents } from "./RobotEventContext";
import { TeamBadge } from "./TeamBadge";
import type { TeamAgentId } from "@/lib/team";

const STATUS_LABEL: Record<string, string> = { scheduled: "Scheduled", recording: "Recording", done: "Done" };
const DAY_MS = 24 * 60 * 60 * 1000;

// "Jobs" — everything the family has set Auri to do, in two zones:
//   Upcoming   · the next occurrence of each job, soonest first (clears once run)
//   Every day  · standing recurring jobs with on/off toggles
// One job is one card. Upcoming shows future one-time jobs PLUS the next instance
// of every enabled standing job — flip a toggle off and it leaves both Upcoming
// and the calendar.

// One unified row for the Upcoming zone.
type UpcomingItem = {
  id: string;
  eventId?: string;    // backed by a real one-time event (opens the detail sheet)
  standingId?: string; // backed by a standing job (opens its editor)
  title: string;
  scheduledAt: number; // canonical time — drives ordering + the derived labels
  iconName: string;
  agent: TeamAgentId;
  meta: string;
  forRobot: boolean;
};

const SHORT_DAY: Record<string, string> = {
  Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu", Friday: "Fri", Saturday: "Sat", Sunday: "Sun", Tomorrow: "Tmrw",
};
const shortDay = (d: string) => SHORT_DAY[d] ?? d;

export function JobsView({ onRunActivity, onSubpageChange }: { onRunActivity?: () => void; onSubpageChange?: (open: boolean) => void } = {}) {
  const { events, addEvent, removeEvent, startHighlight } = useRobotEvents();
  const children = useChildren();
  const personLabel = (id: string) => children.find((c) => c.id === id)?.name ?? (id === "family" ? "Family" : id);
  const [standing, setStanding] = useState<StandingJob[]>(seedStanding);
  const [standingReady, setStandingReady] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editJob, setEditJob] = useState<StandingJob | null>(null);
  const [sel, setSel] = useState<UpcomingItem | null>(null);

  // Load the saved Every-day list once; fall back to seed on first run.
  useEffect(() => {
    setStanding(loadStandingJobs());
    setStandingReady(true);
  }, []);

  // Persist after first load so toggles + added jobs stick across reloads/builds.
  useEffect(() => {
    if (!standingReady) return;
    try {
      localStorage.setItem(STANDING_KEY, JSON.stringify(standing));
    } catch {
      // ignore quota failures
    }
  }, [standing, standingReady]);

  const now = Date.now();

  // The next time a standing job runs: today if its start is still ahead,
  // otherwise tomorrow. Keeps Upcoming showing a live "next occurrence".
  const standingNextOccurrence = (job: StandingJob) => {
    const todayStart = standingScheduledAtToday(job, now);
    return todayStart > now ? todayStart : todayStart + DAY_MS;
  };

  // Upcoming = future one-time jobs (status not done) + the next instance of
  // each enabled standing job, all sorted soonest-first.
  const upcomingItems: UpcomingItem[] = [
    ...events
      .filter((e) => !e.kind && e.status !== "done" && e.scheduledAt > now)
      .map<UpcomingItem>((e) => ({
        id: e.id,
        eventId: e.id,
        title: e.title,
        scheduledAt: e.scheduledAt,
        iconName: e.icon,
        agent: e.agent ?? "homekeeper",
        meta: personLabel(e.person),
        forRobot: true,
      })),
    ...standing
      .filter((job) => job.enabled)
      .map<UpcomingItem>((job) => ({
        id: `standing-${job.id}`,
        standingId: job.id,
        title: job.title,
        scheduledAt: standingNextOccurrence(job),
        iconName: jobIcon[job.type],
        agent: job.agent,
        meta: personLabel(job.person),
        forRobot: true,
      })),
  ].sort((a, b) => a.scheduledAt - b.scheduledAt);

  // Tell the shell to drop its "Jobs" header while the New/Edit page is open —
  // that page has its own "‹ Back · New job" header, so the global one is noise.
  const onSubpage = creating || !!editJob;
  useEffect(() => {
    onSubpageChange?.(onSubpage);
  }, [onSubpage, onSubpageChange]);

  const toggle = (id: string) =>
    setStanding((cur) => cur.map((job) => (job.id === id ? { ...job, enabled: !job.enabled } : job)));

  // A one-time job opens the detail sheet; a standing instance opens its editor.
  const selectItem = (item: UpcomingItem) => {
    if (item.standingId) {
      const job = standing.find((j) => j.id === item.standingId);
      if (job) setEditJob(job);
      return;
    }
    setSel(item);
  };

  // Run a highlight job now: it starts capturing for real and the live counter
  // card shows up in the Home stream, so jump there to watch it.
  const run = (job: StandingJob) => {
    if (job.type === "highlight") startHighlight({ title: job.title, person: job.person });
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
            upcomingItems.map((item, i) => <UpcomingRow key={item.id} item={item} first={i === 0} onSelect={() => selectItem(item)} />)
          ) : (
            <p className="px-4 py-5 text-[13px] leading-5 text-muted">Nothing scheduled yet. Tap “New” to set Auri a job.</p>
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

      {/* Tap a one-time job → the shared detail sheet (can be deleted). Standing
          jobs route to their editor instead (handled in selectItem). */}
      {sel ? (() => {
        const created = sel.eventId ? events.find((e) => e.id === sel.eventId) : undefined;
        const whenLine = [deriveDateLabel(sel.scheduledAt), deriveTimeLabel(sel.scheduledAt), created ? personLabel(created.person) : ""].filter(Boolean).join(" · ");
        return (
          <EventDetailSheet
            detail={{
              title: sel.title,
              icon: sel.iconName,
              agent: created?.agent ?? sel.agent,
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

function AgentLabel({ agentId }: { agentId: TeamAgentId }) {
  const agent = teamAgentById[agentId];
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#e3f3f3] px-1.5 py-0.5 text-[10.5px] font-semibold leading-3 text-[#0a7d7d]">
      <TeamBadge agentId={agentId} size="xs" /> {agent.name}
    </span>
  );
}

function UpcomingRow({ item, first, onSelect }: { item: UpcomingItem; first: boolean; onSelect: () => void }) {
  return (
    <button onClick={onSelect} className={`flex w-full items-center gap-3 px-3.5 py-3 text-left ${first ? "" : "border-t border-line/70"}`}>
      <div className="w-[40px] shrink-0 text-center">
        <div className="text-[11px] leading-4 text-muted">{shortDay(deriveDateLabel(item.scheduledAt))}</div>
        <div className="text-[14px] font-semibold leading-4 text-ink">{deriveTimeLabel(item.scheduledAt).replace(/\s?[AP]M$/i, "")}</div>
      </div>
      <span className="h-8 w-px shrink-0 bg-line" aria-hidden="true" />
      <TeamBadge agentId={item.agent} size="sm" />
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold leading-[19px] tracking-[-0.02em] text-ink">{item.title}</h3>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          {item.forRobot ? <AgentLabel agentId={item.agent} /> : null}
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
