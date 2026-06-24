"use client";

import { useMemo, useState } from "react";
import type { PersonId } from "@/lib/types";
import { type JobType, type StandingJob, type StandingSchedule } from "@/lib/jobs";
import { parseDateTime } from "@/lib/job-time";
import { teamAgentById, type TeamAgentId } from "@/lib/team";
import { useChildren, useParents } from "./FamilyContext";
import { TeamBadge } from "./TeamBadge";

// The "+ New" (and edit) page: pick what Auri should do, then a minimal config —
// who it's for and when. Each template is owned by the teammate that runs it.
type Template = { type: JobType; agent: TeamAgentId; label: string; blurb: string; sched: "window" | "alarm" };

const TEMPLATES: Template[] = [
  { type: "highlight", agent: "cameraman", label: "Highlight", blurb: "Catch real moments", sched: "window" },
  { type: "watch", agent: "watcher", label: "Home watch", blurb: "Every X minutes", sched: "window" },
  { type: "reading", agent: "companion", label: "Reading", blurb: "Read with your kid", sched: "window" },
  { type: "activity", agent: "companion", label: "Activity", blurb: "A daily activity", sched: "window" },
  { type: "routine", agent: "homekeeper", label: "Routine", blurb: "A checklist to done", sched: "alarm" },
  { type: "checkin", agent: "homekeeper", label: "Check-in", blurb: "Confirm it got done", sched: "alarm" },
  { type: "baby_log", agent: "baby_logger", label: "Baby log", blurb: "Feeding, sleep, diapers", sched: "alarm" },
  { type: "workout", agent: "coach", label: "Workout", blurb: "A home workout", sched: "window" },
];

// Group templates under the teammate that runs them — so "two jobs per agent"
// reads as intentional (Cameraman does Highlight + Home watch) instead of looking
// like duplicate cards. Each job card leads with its own distinct job icon.
const AGENT_ORDER: TeamAgentId[] = ["cameraman", "watcher", "companion", "coach", "homekeeper", "baby_logger"];
const TEMPLATE_GROUPS = AGENT_ORDER.map((agent) => ({ agent, items: TEMPLATES.filter((t) => t.agent === agent) })).filter((g) => g.items.length);

function fmtTime(hhmm: string) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return m === 0 ? `${h12} ${ap}` : `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

export function NewJobView({
  editJob,
  onClose,
  onSubmitStanding,
  onSubmitOnce,
  onDelete,
}: {
  editJob?: StandingJob;
  onClose: () => void;
  onSubmitStanding: (job: StandingJob, isEdit: boolean) => void;
  onSubmitOnce: (input: { title: string; person: PersonId; scheduledAt: number; forRobot: boolean; agent?: TeamAgentId; recordingMode?: string }) => void;
  onDelete?: (id: string) => void;
}) {
  const isEdit = !!editJob;
  const children = useChildren();
  const parents = useParents();
  const people = useMemo(() => [
    { id: "family", label: "Family" },
    ...children.map((c) => ({ id: c.id, label: c.name })),
    ...parents.map((p) => ({ id: p.id, label: p.name })),
  ], [children, parents]);
  const editWindow = editJob?.schedule.kind === "window" ? editJob.schedule : undefined;
  const editAlarm = editJob?.schedule.kind === "alarm" ? editJob.schedule : undefined;
  const [type, setType] = useState<JobType | null>(editJob?.type ?? null);
  const [title, setTitle] = useState(editJob?.title ?? "");
  const [person, setPerson] = useState<PersonId>(editJob?.person ?? "family");
  const [repeat, setRepeat] = useState<"everyday" | "once">("everyday");
  const [start, setStart] = useState(editWindow?.start ?? "17:00");
  const [end, setEnd] = useState(editWindow?.end ?? "20:00");
  const [alarm, setAlarm] = useState(editAlarm?.alarm ?? "07:30");
  const [onceDate, setOnceDate] = useState("");
  const [onceTime, setOnceTime] = useState("15:00");

  const tpl = TEMPLATES.find((t) => t.type === type) ?? null;

  const pick = (t: Template) => {
    setType(t.type);
    if (!title) setTitle(t.label);
  };

  const submit = () => {
    if (!tpl) return;
    const personLabel = people.find((p) => p.id === person)?.label ?? person;
    if (repeat === "once") {
      onSubmitOnce({
        title: title || tpl.label,
        person,
        // Canonical datetime from the date + time pickers (local time).
        scheduledAt: parseDateTime(onceDate, onceTime),
        // Every calendar event is a robot task.
        forRobot: true,
        agent: tpl.agent,
        recordingMode: tpl.type === "highlight" ? "cameraman_highlight" : tpl.type === "watch" ? "watcher_interval" : undefined,
      });
      return;
    }
    const schedule: StandingSchedule =
      tpl.sched === "window" ? { kind: "window", start, end } : { kind: "alarm", alarm };
    const trigger =
      tpl.sched === "window"
        ? `${fmtTime(start)}–${fmtTime(end)} · ${personLabel}`
        : `Alarm ${fmtTime(alarm)}`;
    onSubmitStanding(
      {
        id: editJob?.id ?? `job_${Date.now()}`,
        type: tpl.type,
        agent: tpl.agent,
        title: title || tpl.label,
        trigger,
        person,
        schedule,
        enabled: editJob?.enabled ?? true,
      },
      isEdit
    );
  };

  return (
    <div className="pb-6">
      <div className="mb-5 flex items-center justify-between">
        <button onClick={onClose} className="flex items-center gap-1 text-[15px] font-medium text-ink">
          <span className="text-[24px] font-light leading-none">‹</span> Back
        </button>
        <span className="font-display text-[20px] leading-none tracking-[-0.01em] text-ink">{isEdit ? "Edit job" : "New job"}</span>
        {isEdit && onDelete ? (
          <button onClick={() => onDelete(editJob!.id)} className="text-[14px] font-medium text-[#A32D2D]">Delete</button>
        ) : (
          <span className="w-[44px]" />
        )}
      </div>

      <h2 className="mb-3 px-1 text-[16px] font-medium text-ink">What should Auri do?</h2>
      {isEdit && tpl ? (
        <div className="mb-6 rounded-[16px] border border-line bg-white px-3.5 py-3 shadow-[0_2px_10px_rgba(8,8,8,0.035)]">
          <div className="text-[15px] font-semibold text-ink">{tpl.label}</div>
          <div className="mt-0.5 text-[13px] text-muted">{teamAgentById[tpl.agent].name} · {tpl.blurb}</div>
        </div>
      ) : (
        <div className="mb-3">
          {TEMPLATE_GROUPS.map((group) => {
            const a = teamAgentById[group.agent];
            return (
              <div key={group.agent} className="mb-5">
                <div className="mb-2 flex items-center gap-2.5 px-1">
                  <span className="shrink-0">
                    <TeamBadge agentId={group.agent} size="sm" />
                  </span>
                  <div className="text-[14px] leading-4">
                    <span className="font-semibold text-ink">{a.name}</span> <span className="text-muted">· {a.shortRole}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {group.items.map((t) => {
                    const active = type === t.type;
                    return (
                      <button
                        key={t.type}
                        onClick={() => pick(t)}
                        className={`rounded-[14px] border bg-white px-3.5 py-3 text-left ${active ? "border-ink shadow-[0_2px_10px_rgba(8,8,8,0.06)]" : "border-line"}`}
                      >
                        <div className="text-[15px] font-semibold leading-5 text-ink">{t.label}</div>
                        <div className="mt-1 text-[13px] leading-[17px] text-muted">{t.blurb}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tpl ? (
        <div className="space-y-5">
          {!isEdit ? (
            <Field label="Repeat">
              <div className="inline-flex rounded-full bg-[#ece5da] p-0.5">
                {(["everyday", "once"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRepeat(r)}
                    className={`rounded-full px-4 py-1.5 text-[13px] font-semibold ${repeat === r ? "bg-white text-ink shadow-[0_1px_3px_rgba(8,8,8,0.06)]" : "text-muted"}`}
                  >
                    {r === "everyday" ? "Every day" : "One time"}
                  </button>
                ))}
              </div>
            </Field>
          ) : null}

          <Field label="Name">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tpl.label} className="w-full rounded-[12px] border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none focus:border-ink" />
          </Field>

          <Field label="For">
            <div className="flex flex-wrap gap-2">
              {people.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPerson(p.id)}
                  className={`rounded-full border px-3.5 py-1.5 text-[13px] ${person === p.id ? "border-ink bg-ink font-semibold text-white" : "border-line text-muted"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="When">
            {repeat === "once" ? (
              <div className="flex gap-2">
                <input type="date" value={onceDate} onChange={(e) => setOnceDate(e.target.value)} className="flex-1 rounded-[12px] border border-line bg-white px-3 py-2.5 text-[15px] text-ink outline-none focus:border-ink" />
                <input type="time" value={onceTime} onChange={(e) => setOnceTime(e.target.value)} className="w-[120px] rounded-[12px] border border-line bg-white px-3 py-2.5 text-[15px] text-ink outline-none focus:border-ink" />
              </div>
            ) : tpl.sched === "window" ? (
              <div className="flex items-center gap-2">
                <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="flex-1 rounded-[12px] border border-line bg-white px-3 py-2.5 text-[15px] text-ink outline-none focus:border-ink" />
                <span className="text-[15px] text-muted">to</span>
                <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="flex-1 rounded-[12px] border border-line bg-white px-3 py-2.5 text-[15px] text-ink outline-none focus:border-ink" />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[15px] text-muted">Alarm at</span>
                <input type="time" value={alarm} onChange={(e) => setAlarm(e.target.value)} className="w-[140px] rounded-[12px] border border-line bg-white px-3 py-2.5 text-[15px] text-ink outline-none focus:border-ink" />
              </div>
            )}
          </Field>

          <button onClick={submit} className="w-full rounded-full bg-ink py-3 text-[15px] font-semibold text-white">
            {isEdit ? "Save changes" : "Add job"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 px-1 text-[13px] font-medium leading-4 text-muted">{label}</div>
      {children}
    </div>
  );
}
