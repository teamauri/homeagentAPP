"use client";

import clsx from "clsx";
import { useRef, useState } from "react";
import { DraftInfo } from "@/lib/chat-draft";
import { teamAgentById, type TeamAgentId } from "@/lib/team";
import { DoodleIcon } from "./Icons";
import { RobotEvent, useRobotEvents } from "./RobotEventContext";

export type JobCardPhase = "created" | "running" | "completed";

type JobCardInput = {
  title: string;
  agentId: TeamAgentId;
  dateLabel: string;
  timeLabel: string;
  personLabel?: string;
  note?: string;
  status: RobotEvent["status"];
  result?: RobotEvent["result"];
  highlight?: RobotEvent["highlight"];
  highlightProgress?: RobotEvent["highlightProgress"];
  kept?: boolean;
  eventId?: string;
  startedAtLabel?: string;
  repliedAtLabel?: string;
};

function epochFromIso(value?: string): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function displayDateTimeFromIso(value?: string): string | undefined {
  const time = epochFromIso(value);
  if (!time) return undefined;
  const date = new Date(time);
  const dateLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
  const timeLabel = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(date);
  return `${dateLabel} · ${timeLabel}`;
}

export function phaseForRobotEvent(event: RobotEvent): JobCardPhase {
  if (event.status === "done") return "completed";
  if (event.status === "recording") return "running";
  return "created";
}

export function JobCard({
  event,
  draft,
  phase,
  onOpen,
  className,
}: {
  event?: RobotEvent;
  draft?: DraftInfo;
  phase: JobCardPhase;
  onOpen?: () => void;
  className?: string;
}) {
  const { keepEvent } = useRobotEvents();
  const agentId = event?.agent ?? draft?.agent ?? "homekeeper";
  const personLabel = draft?.personLabel;
  const job: JobCardInput = event
    ? {
        title: event.title,
        agentId,
        dateLabel: event.dateLabel,
        timeLabel: event.timeLabel,
        note: event.note,
        status: event.status,
        result: event.result,
        highlight: event.highlight,
        highlightProgress: event.highlightProgress,
        kept: event.kept,
        eventId: event.id,
        startedAtLabel: displayDateTimeFromIso(event.robot?.startedAt) ?? displayDateTimeFromIso(event.robot?.uploadedAt),
        repliedAtLabel:
          displayDateTimeFromIso(event.robot?.highlightSyncedAt) ??
          displayDateTimeFromIso(event.robot?.rawOutputReadyAt) ??
          displayDateTimeFromIso(event.robot?.uploadedAt),
      }
    : {
        title: draft?.title ?? "Job",
        agentId,
        dateLabel: draft?.dateLabel ?? "Today",
        timeLabel: draft?.timeLabel ?? "",
        personLabel,
        note: draft?.note,
        status: "scheduled",
      };
  const agent = teamAgentById[job.agentId];
  const result = job.result;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const metadata = [agent.name, job.dateLabel, job.timeLabel, job.personLabel, statusLabelForJobPhase(phase)].filter(Boolean).join(" · ");

  const play = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
    }
    setPlaying(true);
  };

  const keep = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (job.eventId) keepEvent(job.eventId);
  };

  const handleMetadata = () => {
    if (result && !result.poster && videoRef.current && !playing) {
      videoRef.current.currentTime = 1;
    }
  };

  return (
    <article
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (!onOpen) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={clsx(
        "w-full overflow-hidden rounded-[15px] border border-line bg-white text-left shadow-[0_8px_18px_rgba(8,8,8,0.04)]",
        onOpen && "cursor-pointer active:opacity-95",
        className
      )}
    >
      <div className="flex items-center gap-2.5 px-3.5 pb-2.5 pt-3">
        <div className="grid h-[30px] w-[30px] shrink-0 place-items-center">
          <DoodleIcon name={agent.icon} className="h-8 w-8" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] leading-4 tracking-[0] text-muted">{metadata}</div>
          <div className="truncate text-[15px] font-semibold leading-5 tracking-[-0.02em] text-ink">{job.title}</div>
        </div>
      </div>

      <div className="border-t border-line/70 px-3.5 py-2">
        <JobStepRow label="Created" done active={phase === "created"} detail={createdDetail(job)} />
        <JobStepRow label="Started" done={phase === "completed"} active={phase === "running"} detail={startedDetail(job, phase)} />
        <JobStepRow label="Replied" done={phase === "completed"} active={phase === "completed"} detail={repliedDetail(job, phase)} />
      </div>

      {phase === "running" && job.highlight ? (
        <div className="border-t border-line/70 px-3.5 pb-3 pt-2">
          <CounterRow label="Clips" done={job.highlightProgress?.clips ?? 0} total={job.highlight.clipTarget} />
          <CounterRow label="Photos" done={job.highlightProgress?.photos ?? 0} total={job.highlight.photoTarget} />
        </div>
      ) : null}

      {job.note && phase !== "completed" ? (
        <p className="border-t border-line/70 px-3.5 py-2.5 text-[13px] leading-[18px] tracking-[0] text-ink/70">“{job.note}”</p>
      ) : null}

      {result ? (
        <div className="border-t border-line/70">
          {result.summary ? (
            <p className="border-b border-line/70 px-3.5 py-3 text-[13px] leading-[19px] tracking-[0] text-ink">{result.summary}</p>
          ) : null}
          <div className="relative bg-[#17181b]" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoRef}
              src={result.videoUrl}
              poster={result.poster}
              playsInline
              preload="metadata"
              controls={playing}
              onLoadedMetadata={handleMetadata}
              onEnded={() => setPlaying(false)}
              onPause={() => setPlaying(false)}
              className="block max-h-64 w-full object-cover"
            />
            {!playing ? (
              <button onClick={play} className="absolute inset-0 grid place-items-center" aria-label="Play clip">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-white/95 text-ink shadow">
                  <svg viewBox="0 0 24 24" className="h-6 w-6 translate-x-[1px]" fill="currentColor" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
                <span className="absolute bottom-2 left-2 rounded-md bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">{result.duration}</span>
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {phase === "completed" ? (
        <div className="flex items-center justify-end gap-2 border-t border-line px-3.5 py-2.5">
          {job.kept ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-gold">
              <DoodleIcon name="heart" className="h-[14px] w-[14px]" />
              Kept
            </span>
          ) : (
            <button onClick={keep} className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-gold active:opacity-60">
              Keep
              <DoodleIcon name="heart" className="h-[14px] w-[14px]" />
            </button>
          )}
        </div>
      ) : null}
    </article>
  );
}

export function JobDetailSheet({ event, onDelete, onClose }: { event: RobotEvent; onDelete: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 md:items-center" onClick={onClose}>
      <div
        className="max-h-[88dvh] w-full max-w-[430px] overflow-y-auto rounded-t-[22px] bg-white p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:rounded-[22px]"
        onClick={(e) => e.stopPropagation()}
      >
        <JobCard event={event} phase={phaseForRobotEvent(event)} />
        <div className="mt-4 flex gap-2.5">
          <button onClick={onDelete} className="flex-1 rounded-full bg-[#d93025] py-2.5 text-[14px] font-semibold text-white">
            Delete job
          </button>
          <button onClick={onClose} className="rounded-full border border-line px-5 py-2.5 text-[14px] font-medium text-ink">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function CounterRow({ label, done, total }: { label: string; done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between text-[13px] leading-4">
        <span className="text-ink/80">{label}</span>
        <span className="font-semibold text-ink">
          {done} <span className="font-normal text-muted">/ {total}</span>
        </span>
      </div>
      <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-[#efece6]">
        <div className="h-full rounded-full bg-[#C0492C] transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function statusLabelForJobPhase(phase: JobCardPhase) {
  if (phase === "completed") return "Done";
  if (phase === "running") return "Running";
  return "Created";
}

function createdDetail(job: JobCardInput) {
  return [job.dateLabel, job.timeLabel].filter(Boolean).join(" · ");
}

function startedDetail(job: JobCardInput, phase: JobCardPhase) {
  if (phase === "completed") return job.startedAtLabel ?? "Started";
  if (phase === "running") return job.startedAtLabel ?? "Starting now";
  return "Waiting for start";
}

function repliedDetail(job: JobCardInput, phase: JobCardPhase) {
  if (phase === "completed") return job.repliedAtLabel ?? "Replied";
  return "Waiting for reply";
}

function JobStepRow({ label, detail, done, active }: { label: string; detail: string; done: boolean; active?: boolean }) {
  return (
    <div className={clsx("flex items-center gap-2.5 py-1.5", active && !done && "-mx-1 rounded-[10px] bg-[#C0492C]/10 px-1")}>
      <span
        className={clsx(
          "grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border text-[11px] font-semibold",
          done ? "border-[#2f9d5b] bg-[#2f9d5b] text-white" : active ? "border-[#C0492C] text-[#C0492C]" : "border-line text-transparent"
        )}
      >
        {done ? "✓" : active ? <span className="h-[6px] w-[6px] animate-pulse rounded-full bg-current" /> : ""}
      </span>
      <span className={clsx("min-w-0 flex-1 truncate text-[13px] leading-4", done ? "font-medium text-ink" : active ? "font-medium text-[#C0492C]" : "text-ink/65")}>
        {label}
      </span>
      <span className="max-w-[45%] shrink-0 truncate text-right text-[12px] leading-4 text-muted">{detail}</span>
    </div>
  );
}
