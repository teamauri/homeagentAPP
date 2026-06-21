import type { PersonId } from "./types";
import type { TeamAgentId } from "./team";

// A "job" is something the family has set Auri to do. Two shapes:
//  - UpcomingJob: a one-time, dated job (or an imported calendar event). Shows in
//    the "Upcoming" zone and clears itself after it runs.
//  - StandingJob: a recurring job that runs every day on a schedule/alarm. Shows
//    in the "Every day" zone with an on/off toggle.
// Both map onto the same underlying Session model (see docs/REPOSITION_DESIGN.md).

// Each job type maps to the teammate that runs it: Iris (the eye) captures and
// watches, Lumi (the companion) reads and runs activities, Vita (the keeper)
// runs routines and check-ins, Nova (the coach) runs workouts.
export type JobType = "highlight" | "watch" | "reading" | "activity" | "routine" | "checkin" | "workout" | "nudge";
export type JobSource = "auri" | "todo" | "gcal";

// DoodleIcon name per job type — reuse the existing hand-drawn set.
export const jobIcon: Record<JobType, string> = {
  highlight: "camera-note",
  watch: "home",
  reading: "book",
  activity: "pencil",
  routine: "backpack",
  checkin: "bell",
  workout: "soccer",
  nudge: "shield",
};

export interface StandingJob {
  id: string;
  type: JobType;
  agent: TeamAgentId; // the teammate responsible — shown as avatar + name
  title: string;
  trigger: string; // e.g. "Daily 5–8 PM · Family"
  enabled: boolean;
}

export interface UpcomingJob {
  id: string;
  type: JobType;
  agent: TeamAgentId;
  title: string;
  subtitle: string; // e.g. "Iris · one-time highlight · Leo"
  dateLabel: string; // e.g. "Tue"
  timeLabel: string; // e.g. "3:00 PM"
  source: JobSource;
}

export const seedUpcoming: UpcomingJob[] = [
  {
    id: "recital",
    type: "highlight",
    agent: "iris",
    title: "Piano recital · capture 30s",
    subtitle: "Iris · one-time highlight · Leo",
    dateLabel: "Tue",
    timeLabel: "3:00 PM",
    source: "auri",
  },
  {
    id: "vaccination",
    type: "nudge",
    agent: "vita",
    title: "Vaccination · bring booklet",
    subtitle: "Vita · nudge",
    dateLabel: "Sat",
    timeLabel: "9:00 AM",
    source: "gcal",
  },
];

// One standing job per teammate (at least). Iris ×2 (capture + watch),
// Lumi ×2 (reading + activity), Vita ×2 (routine + check-in), Nova ×1 (workout).
export const seedStanding: StandingJob[] = [
  {
    id: "evening-highlights",
    type: "highlight",
    agent: "iris",
    title: "Evening highlights",
    trigger: "5–8 PM",
    enabled: true,
  },
  {
    id: "home-watch",
    type: "watch",
    agent: "iris",
    title: "Home watch",
    trigger: "8 AM–8 PM",
    enabled: true,
  },
  {
    id: "bedtime-reading",
    type: "reading",
    agent: "lumi",
    title: "Bedtime reading",
    trigger: "6:30 PM · Leo",
    enabled: true,
  },
  {
    id: "afternoon-activity",
    type: "activity",
    agent: "lumi",
    title: "Afternoon activity",
    trigger: "4 PM · Mia",
    enabled: true,
  },
  {
    id: "morning-routine",
    type: "routine",
    agent: "vita",
    title: "Morning routine",
    trigger: "Alarm 7:30 AM",
    enabled: true,
  },
  {
    id: "midday-meds",
    type: "checkin",
    agent: "vita",
    title: "Midday meds",
    trigger: "Alarm 12 PM · Grandma",
    enabled: false,
  },
  {
    id: "home-workout",
    type: "workout",
    agent: "nova",
    title: "Home workout",
    trigger: "7 AM · Mom",
    enabled: true,
  },
];

// Map a one-off event created in the composer into an Upcoming job.
export function upcomingFromInput(input: { title: string; person: PersonId; dateLabel: string; timeLabel: string; forRobot: boolean }, personLabel: string, id: string): UpcomingJob {
  const isCapture = input.forRobot;
  return {
    id,
    type: isCapture ? "highlight" : "nudge",
    agent: isCapture ? "iris" : "vita",
    title: input.title,
    subtitle: isCapture ? `Iris · one-time highlight · ${personLabel}` : "Vita · nudge",
    dateLabel: input.dateLabel,
    timeLabel: input.timeLabel,
    source: "auri",
  };
}
