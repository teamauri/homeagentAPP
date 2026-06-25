"use client";

import { useEffect, useMemo, useState } from "react";
import { loadStandingJobs, seedStanding, sortStandingJobs, standingScheduledAtToday, STANDING_KEY, type StandingJob } from "@/lib/jobs";
import { deriveDateLabel, deriveTimeLabel } from "@/lib/job-time";
import { helperTeamAgentIds, teamAgentById, type TeamAgent } from "@/lib/team";
import { useChildren } from "./FamilyContext";
import { DoodleIcon } from "./Icons";
import { NewJobView } from "./NewJobView";
import { EventDetailSheet } from "./EventDetailSheet";
import { useRobotEvents } from "./RobotEventContext";
import type { TeamAgentId } from "@/lib/team";

const STATUS_LABEL: Record<string, string> = { scheduled: "Scheduled", recording: "Recording", done: "Done" };
const DAY_MS = 24 * 60 * 60 * 1000;
const AGENT_PROFILE_KEY = "auri.agentProfiles.v2";
const LEGACY_AGENT_PROFILE_KEY = "auri.agentProfiles.v1";
const SECTION_TITLE_CLASS = "font-display text-[22px] font-normal leading-none tracking-[-0.01em] text-ink";
const STACKED_SECTION_CLASS = "mt-8 pb-2";

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
  agent: TeamAgentId;
  meta: string;
  forRobot: boolean;
};

type AgentProfile = Omit<TeamAgent, "id"> & {
  id: string;
  enabled: boolean;
  custom?: boolean;
};

type AgentProfilePatch = Partial<Pick<AgentProfile, "enabled">>;
type StoredAgentProfiles = {
  patches?: Record<string, Partial<AgentProfile>>;
  custom?: AgentProfile[];
};

function sanitizeBuiltInPatches(patches?: Record<string, Partial<AgentProfile>>): Record<string, AgentProfilePatch> {
  if (!patches) return {};
  return Object.fromEntries(
    Object.entries(patches)
      .map(([id, patch]) => [id, typeof patch.enabled === "boolean" ? { enabled: patch.enabled } : {}] as const)
      .filter(([, patch]) => typeof patch.enabled === "boolean")
  );
}

const SHORT_DAY: Record<string, string> = {
  Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu", Friday: "Fri", Saturday: "Sat", Sunday: "Sun", Tomorrow: "Tmrw",
};
const shortDay = (d: string) => SHORT_DAY[d] ?? d;

export function JobsView({ onSubpageChange }: { onSubpageChange?: (open: boolean) => void } = {}) {
  const { events, addEvent, removeEvent } = useRobotEvents();
  const children = useChildren();
  const personLabel = (id: string) => children.find((c) => c.id === id)?.name ?? (id === "family" ? "Family" : id);
  const [standing, setStanding] = useState<StandingJob[]>(() => sortStandingJobs(seedStanding));
  const [standingReady, setStandingReady] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editJob, setEditJob] = useState<StandingJob | null>(null);
  const [sel, setSel] = useState<UpcomingItem | null>(null);
  const [agentPatches, setAgentPatches] = useState<Record<string, AgentProfilePatch>>({});
  const [customAgents, setCustomAgents] = useState<AgentProfile[]>([]);
  const [agentProfilesReady, setAgentProfilesReady] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [creatingAgent, setCreatingAgent] = useState(false);

  // Load the saved Every-day list once; fall back to seed on first run.
  useEffect(() => {
    setStanding(loadStandingJobs());
    setStandingReady(true);
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(AGENT_PROFILE_KEY) ?? localStorage.getItem(LEGACY_AGENT_PROFILE_KEY) ?? "{}";
      const parsed = JSON.parse(stored) as StoredAgentProfiles;
      setAgentPatches(sanitizeBuiltInPatches(parsed.patches));
      setCustomAgents(Array.isArray(parsed.custom) ? parsed.custom : []);
      localStorage.removeItem(LEGACY_AGENT_PROFILE_KEY);
    } catch {
      setAgentPatches({});
      setCustomAgents([]);
    }
    setAgentProfilesReady(true);
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

  useEffect(() => {
    if (!agentProfilesReady) return;
    try {
      localStorage.setItem(AGENT_PROFILE_KEY, JSON.stringify({ patches: agentPatches, custom: customAgents }));
    } catch {
      // ignore quota failures
    }
  }, [agentPatches, customAgents, agentProfilesReady]);

  const agentProfiles = useMemo<AgentProfile[]>(() => {
    const builtIns = helperTeamAgentIds.map((id) => {
      const base = teamAgentById[id];
      return { ...base, enabled: agentPatches[id]?.enabled ?? true };
    });
    return [...builtIns, ...customAgents];
  }, [agentPatches, customAgents]);

  const now = Date.now();

  // The next time a standing job runs: today if its start is still ahead,
  // otherwise tomorrow. Keeps Upcoming showing a live "next occurrence".
  const standingNextOccurrence = (job: StandingJob) => {
    const todayStart = standingScheduledAtToday(job, now);
    return todayStart > now ? todayStart : todayStart + DAY_MS;
  };
  const agentProfileById = useMemo<Record<string, AgentProfile>>(
    () => Object.fromEntries(agentProfiles.map((agent) => [agent.id, agent])),
    [agentProfiles]
  );


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
        agent: job.agent,
        meta: personLabel(job.person),
        forRobot: true,
      })),
  ].sort((a, b) => a.scheduledAt - b.scheduledAt);

  // Tell the shell to drop its "Jobs" header while the New/Edit page is open —
  // that page has its own "‹ Back · New job" header, so the global one is noise.
  const onSubpage = creating || !!editJob || !!editingAgentId || creatingAgent;
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

  const closeForm = () => {
    setCreating(false);
    setEditJob(null);
    setEditingAgentId(null);
    setCreatingAgent(false);
  };

  const saveAgentProfile = (profile: AgentProfile) => {
    if (profile.custom) {
      setCustomAgents((cur) => {
        const exists = cur.some((agent) => agent.id === profile.id);
        return exists ? cur.map((agent) => (agent.id === profile.id ? profile : agent)) : [...cur, profile];
      });
    } else {
      setAgentPatches((cur) => ({
        ...cur,
        [profile.id]: { enabled: profile.enabled },
      }));
    }
    closeForm();
  };

  const deleteCustomAgent = (id: string) => {
    setCustomAgents((cur) => cur.filter((agent) => agent.id !== id));
    closeForm();
  };

  if (creating || editJob) {
    return (
      <NewJobView
        editJob={editJob ?? undefined}
        onClose={closeForm}
        onSubmitStanding={(job, isEdit) => {
          setStanding((cur) => sortStandingJobs(isEdit ? cur.map((j) => (j.id === job.id ? job : j)) : [...cur, job]));
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

  if (editingAgentId || creatingAgent) {
    const existing = editingAgentId ? agentProfiles.find((agent) => agent.id === editingAgentId) : undefined;
    return (
        <AgentProfileView
          agent={existing}
          onClose={closeForm}
          onSave={saveAgentProfile}
          onDelete={existing?.custom ? () => deleteCustomAgent(existing.id) : undefined}
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
          <h2 className={SECTION_TITLE_CLASS}>Upcoming</h2>
          <span className="text-[12px] leading-4 text-muted">clears after it runs</span>
        </div>
        <div className="overflow-hidden rounded-[18px] border border-line bg-white shadow-[0_2px_10px_rgba(8,8,8,0.035)]">
          {upcomingItems.length ? (
            upcomingItems.map((item, i) => <UpcomingRow key={item.id} item={item} agentProfiles={agentProfileById} first={i === 0} onSelect={() => selectItem(item)} />)
          ) : (
            <p className="px-4 py-5 text-[13px] leading-5 text-muted">Nothing scheduled yet. Tap “New” to set Auri a job.</p>
          )}
        </div>
      </section>

      <section className={STACKED_SECTION_CLASS}>
        <div className="mb-2.5 flex items-baseline justify-between px-1">
          <h2 className={SECTION_TITLE_CLASS}>Routines</h2>
          <button onClick={() => setCreating(true)} className="flex items-center gap-1 text-[13px] font-semibold leading-4 text-auri">
            <span className="text-[15px] leading-none">+</span> New Routine
          </button>
        </div>
        <div className="overflow-hidden rounded-[18px] border border-line bg-white shadow-[0_2px_10px_rgba(8,8,8,0.035)]">
          {standing.map((job, i) => (
            <StandingRow
              key={job.id}
              job={job}
              agentProfiles={agentProfileById}
              first={i === 0}
              onToggle={() => toggle(job.id)}
              onEdit={() => setEditJob(job)}
            />
          ))}
        </div>
      </section>

      <section className={STACKED_SECTION_CLASS}>
        <div className="mb-2.5 flex items-baseline justify-between px-1">
          <h2 className={SECTION_TITLE_CLASS}>Your agents</h2>
          <button onClick={() => setCreatingAgent(true)} className="flex items-center gap-1 text-[13px] font-semibold leading-4 text-auri">
            <span className="text-[15px] leading-none">+</span> New agent
          </button>
        </div>
        <div className="space-y-3">
          {agentProfiles.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onOpen={() => setEditingAgentId(agent.id)}
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
              icon: agentProfileById[sel.agent]?.icon ?? teamAgentById[sel.agent]?.icon ?? "calendar",
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

function AgentCard({ agent, onOpen }: { agent: AgentProfile; onOpen: () => void }) {
  return (
    <article className="overflow-hidden rounded-[8px] border border-line bg-white shadow-[0_2px_10px_rgba(8,8,8,0.035)]">
      <div className="aspect-[4/3] bg-[#eee7dc]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={agent.portrait} alt="" className="h-full w-full object-contain" style={{ objectPosition: agent.portraitPosition }} />
      </div>
      <div className="border-t border-line px-3.5 py-3">
        <button
          type="button"
          onClick={onOpen}
          className="w-full rounded-[8px] bg-ink px-4 py-2.5 text-center text-[13px] font-semibold leading-4 text-white shadow-[0_1px_2px_rgba(8,8,8,0.16)]"
        >
          Configure
        </button>
      </div>
    </article>
  );
}

function AgentProfileView({
  agent,
  onClose,
  onSave,
  onDelete,
}: {
  agent?: AgentProfile;
  onClose: () => void;
  onSave: (agent: AgentProfile) => void;
  onDelete?: () => void;
}) {
  const fallback: AgentProfile = agent ?? {
    id: `custom_${Date.now()}`,
    name: "New Agent",
    role: "Describe what this agent helps with",
    shortRole: "Custom",
    summary: "A custom agent profile for a future capability.",
    responsibilities: ["New responsibility"],
    portrait: "/agents/auri-app-cover.png",
    portraitPosition: "50% 50%",
    icon: "robot",
    tone: "bg-[#E7E0D6]",
    accent: "text-ink",
    scope: "group",
    enabled: true,
    custom: true,
  };
  const [draft, setDraft] = useState<AgentProfile>(fallback);
  const responsibilities = draft.responsibilities.join(", ");
  const builtIn = agent && !agent.custom;

  return (
    <div className="pb-6">
      <div className="mb-5 flex items-center justify-between">
        <button onClick={onClose} className="flex items-center gap-1 text-[15px] font-medium text-ink">
          <span className="text-[24px] font-light leading-none">‹</span> Back
        </button>
        <span className="font-display text-[20px] leading-none tracking-[-0.01em] text-ink">{builtIn ? "Configure" : agent ? "Edit agent" : "New agent"}</span>
        {onDelete ? <button onClick={onDelete} className="text-[14px] font-medium text-[#A32D2D]">Delete</button> : <span className="w-[44px]" />}
      </div>

      <div className="mb-5 overflow-hidden rounded-[8px] border border-line bg-white">
        {builtIn ? (
          <AgentConfigurePanel agent={draft} onToggle={() => setDraft((cur) => ({ ...cur, enabled: !cur.enabled }))} />
        ) : (
          <>
            <div className="h-[210px] bg-[#eee7dc]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={draft.portrait} alt="" className="h-full w-full object-cover" style={{ objectPosition: draft.portraitPosition }} />
            </div>
            <div className="space-y-3 px-3.5 py-3.5">
              <LabeledInput label="Name" value={draft.name} onChange={(name) => setDraft((cur) => ({ ...cur, name }))} />
              <LabeledInput label="Short role" value={draft.shortRole} onChange={(shortRole) => setDraft((cur) => ({ ...cur, shortRole }))} />
              <LabeledTextarea label="Role" value={draft.role} onChange={(role) => setDraft((cur) => ({ ...cur, role }))} />
              <LabeledTextarea label="Description" value={draft.summary} onChange={(summary) => setDraft((cur) => ({ ...cur, summary }))} />
              <LabeledTextarea
                label="Responsibilities"
                value={responsibilities}
                onChange={(value) => setDraft((cur) => ({ ...cur, responsibilities: value.split(",").map((item) => item.trim()).filter(Boolean) }))}
              />
              <label className="flex items-center justify-between border-t border-line pt-3 text-[14px] font-semibold text-ink">
                Enabled
                <Toggle on={draft.enabled} onClick={() => setDraft((cur) => ({ ...cur, enabled: !cur.enabled }))} label={`Turn ${draft.name} ${draft.enabled ? "off" : "on"}`} />
              </label>
            </div>
          </>
        )}
      </div>

      {agent?.custom ? (
        <p className="mb-5 px-1 text-[12.5px] leading-5 text-muted">Custom agents are saved as profiles here. Wire them into routing when the capability is ready.</p>
      ) : null}

      <button onClick={() => onSave(draft)} className="w-full rounded-full bg-ink px-4 py-3 text-[15px] font-semibold text-white">{builtIn ? "Save preferences" : "Save agent"}</button>
    </div>
  );
}

function AgentConfigurePanel({ agent, onToggle }: { agent: AgentProfile; onToggle: () => void }) {
  return (
    <>
      <div className="aspect-[4/3] bg-[#eee7dc]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={agent.portrait} alt="" className="h-full w-full object-contain" style={{ objectPosition: agent.portraitPosition }} />
      </div>
      <div className="space-y-4 px-3.5 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[22px] font-semibold leading-[26px] text-ink">{agent.name}</h3>
            <p className="mt-1 text-[13px] font-semibold leading-5 text-ink/70">{agent.shortRole}</p>
          </div>
          <Toggle on={agent.enabled} onClick={onToggle} label={`Turn ${agent.name} ${agent.enabled ? "off" : "on"}`} />
        </div>
        <div className="border-t border-line pt-4">
          <p className="text-[14px] leading-5 text-ink">{agent.role}</p>
          <p className="mt-2 text-[13px] leading-5 text-muted">{agent.summary}</p>
        </div>
        <div className="border-t border-line pt-4">
          <div className="mb-2 text-[12px] font-semibold uppercase leading-4 tracking-[0.12em] text-muted">Focus</div>
          <div className="flex flex-wrap gap-2">
            {agent.responsibilities.map((item) => (
              <span key={item} className="rounded-full border border-line bg-soft px-3 py-1.5 text-[12px] font-semibold leading-4 text-ink/70">
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function LabeledInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold leading-4 text-muted">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-[8px] border border-line bg-white px-3 py-2 text-[14px] text-ink outline-none focus:border-ink/50" />
    </label>
  );
}

function LabeledTextarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold leading-4 text-muted">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} className="w-full resize-none rounded-[8px] border border-line bg-white px-3 py-2 text-[14px] leading-5 text-ink outline-none focus:border-ink/50" />
    </label>
  );
}

function UpcomingRow({
  item,
  agentProfiles,
  first,
  onSelect,
}: {
  item: UpcomingItem;
  agentProfiles: Record<string, AgentProfile>;
  first: boolean;
  onSelect: () => void;
}) {
  const agent = agentProfiles[item.agent] ?? teamAgentById[item.agent];
  return (
    <button onClick={onSelect} className={`flex w-full items-center gap-3 px-3.5 py-3 text-left ${first ? "" : "border-t border-line/70"}`}>
      <div className="w-[52px] shrink-0 text-center">
        <div className="text-[11px] leading-4 text-muted">{shortDay(deriveDateLabel(item.scheduledAt))}</div>
        <div className="text-[13px] font-semibold leading-4 text-ink">{deriveTimeLabel(item.scheduledAt)}</div>
      </div>
      <span className="h-8 w-px shrink-0 bg-line" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold leading-[19px] tracking-[-0.02em] text-ink">{item.title}</h3>
        <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] leading-[18px] tracking-[0] text-muted">
          <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border border-line/70 bg-white text-[11px]" aria-hidden="true">
            <DoodleIcon name={agent?.icon ?? "calendar"} className="h-[14px] w-[14px]" />
          </span>
          <span><span className="font-semibold text-ink/75">{agent?.name}</span> {item.meta}</span>
        </div>
      </div>
      <span className="text-[26px] font-light leading-none text-ink/40">›</span>
    </button>
  );
}

function StandingRow({
  job,
  agentProfiles,
  first,
  onToggle,
  onEdit,
}: {
  job: StandingJob;
  agentProfiles: Record<string, AgentProfile>;
  first: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const agent = agentProfiles[job.agent] ?? teamAgentById[job.agent];
  return (
    <div className={`flex items-center gap-2 px-3.5 py-3 ${first ? "" : "border-t border-line/70"} ${job.enabled ? "" : "opacity-60"}`}>
      <div className="grid h-[40px] w-[40px] shrink-0 place-items-center">
        <DoodleIcon name={agent?.icon ?? "calendar"} className="h-8 w-8" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold leading-[19px] tracking-[-0.02em] text-ink">{job.title}</h3>
        <div className="mt-0.5 flex items-center gap-2 text-[12.5px] leading-[18px] tracking-[0] text-muted">
          <span><span className="font-semibold text-ink/75">{agent?.name}</span> · {job.trigger}</span>
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
