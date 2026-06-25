"use client";

import { useMemo, useState } from "react";
import { getMockNeeds, getMockUpcoming } from "@/lib/mock-data";
import { teamAgentById, teamAgents, teamAgentByName } from "@/lib/team";
import type { CalendarEvent, NeedItem } from "@/lib/types";
import { StatusPill } from "./calendar-ui";
import { DoodleIcon } from "./Icons";
import { TeamBadge } from "./TeamBadge";
import { RobotEventComposer } from "./RobotEventComposer";
import { RobotEvent, useRobotEvents } from "./RobotEventContext";
import { useChildren } from "./FamilyContext";

export function TodayView() {
  const { events, addEvent, runEvent } = useRobotEvents();
  const [composerOpen, setComposerOpen] = useState(false);
  const children = useChildren();
  const needs = useMemo(() => getMockNeeds(children), [children]);
  const upcoming = useMemo(() => getMockUpcoming(children), [children]);
  const personLabel = useMemo(() => {
    const m: Record<string, string> = { family: "Family" };
    children.forEach((c) => { m[c.id] = c.name; });
    return (id: string) => m[id] ?? id;
  }, [children]);

  const robotOnly = events.filter((event) => event.forRobot);
  const liveEvents = robotOnly.filter((event) => event.status !== "done");
  const doneEvents = robotOnly.filter((event) => event.status === "done");
  const robotEvents = [...liveEvents, ...doneEvents];
  const recordingNow = events.some((event) => event.forRobot && event.status === "recording");

  return (
    <div className="pb-4">
      <button className="mb-6 mt-1 flex min-h-[70px] w-full items-center gap-3 rounded-[18px] border border-line bg-white px-4 text-left shadow-[0_2px_10px_rgba(8,8,8,0.035)]">
        <div className="grid h-[46px] w-[46px] shrink-0 place-items-center">
          <DoodleIcon name="robot" className="h-11 w-11" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[20px] font-semibold leading-6 text-ink">Auri Robot</h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[13px] leading-5 text-muted">
            <span>Living Room</span>
            <span className="h-2 w-2 rounded-full bg-[#62ad57]" aria-hidden="true" />
            {recordingNow ? <span className="font-medium text-[#c9621f]">recording now</span> : <span>Ready</span>}
          </p>
        </div>
        <span className="text-[34px] font-light leading-none text-ink/45">›</span>
      </button>

      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="font-display text-[24px] font-normal leading-none tracking-[-0.02em] text-ink">On Auri Robot</h2>
          <button onClick={() => setComposerOpen(true)} className="flex items-center gap-1 text-[13px] font-semibold leading-5 text-ink">
            <span className="text-[17px] leading-none">+</span> New event
          </button>
        </div>
        {robotEvents.length ? (
          <div className="space-y-2.5">
            {robotEvents.map((event) => (
              <RobotEventRow key={event.id} event={event} onRun={() => runEvent(event.id)} />
            ))}
          </div>
        ) : (
          <p className="text-[13px] leading-5 text-muted">No events yet — tap “New event” to plan one. The robot shows a reminder, then brings back the moment.</p>
        )}
      </section>

      <section className="mb-6">
        <h2 className="text-[15px] font-semibold leading-5 text-ink">Needs You</h2>
        <div className="mt-3 space-y-2.5">
          {needs.map((item) => (
            <NeedRow key={item.id} item={item} />
          ))}
        </div>
      </section>

      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold leading-5 text-ink">Your team</h2>
          <button className="text-[12px] font-semibold leading-5 text-ink">View all</button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {teamAgents.filter((agent) => agent.id !== "auri").map((agent) => (
            <button key={agent.id} className="min-w-0 text-center">
              <TeamBadge agentId={agent.id} size="md" />
              <span className="mt-1 block truncate text-[12px] font-semibold leading-4 text-ink">{agent.name}</span>
              <span className="block truncate text-[9px] leading-3 text-muted">{agent.shortRole}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="pb-2">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-[15px] font-semibold leading-5 text-ink">Up Next</h2>
          <a href="/calendar" className="text-[12px] font-semibold leading-5 text-ink">View calendar</a>
        </div>
        <div className="space-y-2.5">
          {upcoming.slice(0, 3).map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </div>
      </section>

      <RobotEventComposer open={composerOpen} onClose={() => setComposerOpen(false)} onCreate={addEvent} />
    </div>
  );
}

const robotStatusMeta: Record<RobotEvent["status"], { label: string; className: string }> = {
  scheduled: { label: "Scheduled", className: "bg-[#c08a2b]/[0.14] text-[#9a7a1e]" },
  recording: { label: "● Recording", className: "bg-[#e07a2f]/[0.16] text-[#c9621f]" },
  done: { label: "✓ Done", className: "bg-[#2f9d5b]/[0.12] text-[#2E7B5B]" },
};

function RobotEventRow({ event, onRun }: { event: RobotEvent; onRun: () => void }) {
  const rowChildren = useChildren();
  const personLabel = (id: string) => rowChildren.find((c) => c.id === id)?.name ?? (id === "family" ? "Family" : id);
  const meta = robotStatusMeta[event.status];
  const agentId = event.agent ?? "homekeeper";
  const agent = teamAgentById[agentId];
  return (
    <article className="flex min-h-[72px] items-center gap-3 rounded-[16px] border border-line/85 bg-white px-3.5 py-2.5 shadow-[0_1px_4px_rgba(8,8,8,0.03)]">
      <div className="grid h-[42px] w-[42px] shrink-0 place-items-center">
        <DoodleIcon name={agent.icon} className="h-9 w-9" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-semibold leading-[17px] text-ink">{event.title}</h3>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 truncate text-[13px] leading-[16px] text-muted">
          <span className="inline-flex items-center gap-1 pr-0.5 text-ink/80">
            <TeamBadge agentId={agentId} size="xs" />
            <span>{agent.name}</span>
          </span>
          <span>·</span>
          <span>{personLabel(event.person)}</span>
          <span>·</span>
          <span>{event.dateLabel} · {event.timeLabel}</span>
          {event.photoUrl ? <PhotoDot /> : null}
          {event.voiceUrl ? <VoiceDot /> : null}
        </p>
      </div>
      {event.status === "scheduled" ? (
        <button onClick={onRun} className="shrink-0 whitespace-nowrap rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink">
          Run now
        </button>
      ) : (
        <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold leading-4 ${meta.className}`}>{meta.label}</span>
      )}
    </article>
  );
}

function PhotoDot() {
  return (
    <span className="inline-flex items-center text-muted/70" aria-label="has photo" title="Photo attached">
      <svg viewBox="0 0 24 24" className="h-[13px] w-[13px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <circle cx="8.5" cy="10" r="1.4" />
        <path d="m4 17 5-4 4 3 3-2 4 3" />
      </svg>
    </span>
  );
}

function VoiceDot() {
  return (
    <span className="inline-flex items-center text-muted/70" aria-label="has voice note" title="Voice note attached">
      <svg viewBox="0 0 24 24" className="h-[13px] w-[13px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 4a2.5 2.5 0 0 0-2.5 2.5v5a2.5 2.5 0 0 0 5 0v-5A2.5 2.5 0 0 0 12 4Z" />
        <path d="M6 11v.5a6 6 0 0 0 12 0V11M12 18v3" />
      </svg>
    </span>
  );
}

function NeedRow({ item }: { item: NeedItem }) {
  const helper = teamAgentByName[item.helper];
  return (
    <article className="flex min-h-[72px] items-center gap-3 rounded-[16px] border border-line/85 bg-white px-3.5 py-2.5 shadow-[0_1px_4px_rgba(8,8,8,0.03)]">
      <div className="grid h-[42px] w-[42px] shrink-0 place-items-center">
        <DoodleIcon name={helper?.icon ?? item.icon} className="h-9 w-9" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold leading-[17px] text-ink">{item.title}</h3>
        <p className="mt-0.5 text-[13px] leading-[16px] text-muted">{item.body}</p>
      </div>
      <button className="shrink-0 whitespace-nowrap text-right text-[13px] font-semibold text-ink">{item.actionLabel}</button>
      <span className="text-[30px] font-light leading-none text-ink/45">›</span>
    </article>
  );
}

function EventRow({ event }: { event: CalendarEvent }) {
  const rowChildren = useChildren();
  const personLabel = (id: string) => rowChildren.find((c) => c.id === id)?.name ?? (id === "family" ? "Family" : id);
  return (
    <button className="flex w-full items-center gap-3 py-1 text-left">
      <div className="grid h-[40px] w-[40px] shrink-0 place-items-center">
        <DoodleIcon name={event.icon} className="h-9 w-9" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[15px] font-semibold leading-5 text-ink">{event.title}</span>
          <StatusPill status={event.status} label={event.statusLabel} />
        </div>
        <p className="mt-0.5 truncate text-[13px] leading-5 text-muted">
          {personLabel(event.person)} · {event.dateLabel} · {event.timeLabel}
        </p>
      </div>
      <span className="text-[28px] font-light leading-none text-ink/40">›</span>
    </button>
  );
}
