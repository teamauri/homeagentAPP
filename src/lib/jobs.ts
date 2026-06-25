import type { PersonId } from "./types";
import { normalizeTeamAgentId, teamAgentById, type TeamAgentId } from "./team";
import { todayAt } from "./job-time";

// A "job" is something the family has set Auri to do. Two shapes:
//  - A one-time, dated job (an event in the shared store). Shows in the
//    "Upcoming" zone and on the calendar; clears itself once its time passes.
//  - StandingJob: a recurring job that runs every day on a schedule/alarm. Shows
//    in the "Every day" zone with an on/off toggle, and — when enabled —
//    projects one instance per day onto Upcoming and the calendar.
// Both map onto the same underlying Session model (see docs/REPOSITION_DESIGN.md).

// Each job type maps to the teammate that runs it. `activity` and `checkin` remain
// for older saved demo data, but new routines expose one fixed capability per agent.
export type JobType = "highlight" | "watch" | "reading" | "activity" | "routine" | "checkin" | "baby_log" | "workout" | "nudge";
export type JobSource = "auri" | "todo" | "gcal";

// A standing job's recurrence: a daily window (start–end) or a single alarm.
// Times are "HH:MM" 24h so a real datetime can be derived for any day.
export type StandingSchedule =
  | { kind: "window"; start: string; end: string }
  | { kind: "alarm"; alarm: string };

export interface StandingJob {
  id: string;
  type: JobType;
  agent: TeamAgentId; // the teammate responsible — shown as avatar + name
  title: string;
  trigger: string; // human label, e.g. "5–8 PM · Family" — derived from schedule
  person: PersonId;
  schedule: StandingSchedule;
  enabled: boolean;
}

// localStorage key for the Every-day list (toggle states + user-added jobs).
// Shared by the Jobs screen and the Calendar route so both reflect one source.
export const STANDING_KEY = "auri.standing.v1";

// Read the saved Every-day list, falling back to seed on first run. Client-only.
export function loadStandingJobs(): StandingJob[] {
  try {
    const raw = localStorage.getItem(STANDING_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length) {
      const migrated = parsed.map((job) => ({
        ...job,
        agent: normalizeTeamAgentId(job.agent) ?? agentForJobType(job.type),
      })) as StandingJob[];
      const sorted = sortStandingJobs(migrated);
      localStorage.setItem(STANDING_KEY, JSON.stringify(sorted));
      return sorted;
    }
  } catch {
    // ignore malformed storage
  }
  return sortStandingJobs(seedStanding);
}

export function agentForJobType(type: JobType): TeamAgentId {
  if (type === "highlight") return "cameraman";
  if (type === "watch") return "watcher";
  if (type === "reading" || type === "activity") return "companion";
  if (type === "workout") return "coach";
  if (type === "baby_log") return "baby_logger";
  return "homekeeper";
}

export function iconForJobAgent(agent: TeamAgentId): string {
  return teamAgentById[agent]?.icon ?? "calendar";
}

// The time a standing job's daily instance starts (window start, or the alarm).
export function standingStartHHMM(job: StandingJob): string {
  return job.schedule.kind === "window" ? job.schedule.start : job.schedule.alarm;
}

function standingStartMinutes(job: StandingJob): number {
  const [hours, minutes] = standingStartHHMM(job).split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return Number.MAX_SAFE_INTEGER;
  return hours * 60 + minutes;
}

export function sortStandingJobs(jobs: StandingJob[]): StandingJob[] {
  return [...jobs].sort((a, b) => {
    const timeDiff = standingStartMinutes(a) - standingStartMinutes(b);
    if (timeDiff !== 0) return timeDiff;
    return a.title.localeCompare(b.title);
  });
}

// Today's real datetime for a standing job's instance (epoch ms).
export function standingScheduledAtToday(job: StandingJob, now: number = Date.now()): number {
  return todayAt(standingStartHHMM(job), now);
}

// One default standing routine per helper agent.
export const seedStanding: StandingJob[] = [
  {
    id: "evening-highlights",
    type: "highlight",
    agent: "cameraman",
    title: "Evening highlights",
    trigger: "5–8 PM · Family",
    person: "family",
    schedule: { kind: "window", start: "17:00", end: "20:00" },
    enabled: true,
  },
  {
    id: "home-watch",
    type: "watch",
    agent: "watcher",
    title: "Home watch",
    trigger: "8 AM–8 PM · Family",
    person: "family",
    schedule: { kind: "window", start: "08:00", end: "20:00" },
    enabled: true,
  },
  {
    id: "bedtime-reading",
    type: "reading",
    agent: "companion",
    title: "Bedtime reading",
    trigger: "6:30 PM · Leo",
    person: "leo",
    schedule: { kind: "window", start: "18:30", end: "19:00" },
    enabled: true,
  },
  {
    id: "morning-routine",
    type: "routine",
    agent: "homekeeper",
    title: "Morning routine",
    trigger: "Alarm 7:30 AM",
    person: "family",
    schedule: { kind: "alarm", alarm: "07:30" },
    enabled: true,
  },
  {
    id: "baby-routine-log",
    type: "baby_log",
    agent: "baby_logger",
    title: "Baby routine log",
    trigger: "Alarm 9 PM · Mia",
    person: "mia",
    schedule: { kind: "alarm", alarm: "21:00" },
    enabled: true,
  },
  {
    id: "home-workout",
    type: "workout",
    agent: "coach",
    title: "Home workout",
    trigger: "7 AM · Mom",
    person: "mom",
    schedule: { kind: "window", start: "07:00", end: "08:00" },
    enabled: true,
  },
];
