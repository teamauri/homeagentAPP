import { seedObservations } from "@/lib/family/profile";
import { getChildren } from "@/lib/family/store";
import { listDemoCalendarEvents } from "@/lib/demo/demo-store";

// Rich context for the chat model: the static family/team + each child's
// interests, routines, health notes, and recent observations. This is what lets
// Auri answer "why is my child upset?" with something only a family agent could
// know — never generic advice.
export function buildFamilyContext() {
  // Existing robot reminders — used for deduplication: if the user asks to
  // create the same reminder again, the AI can say it is already set.
  const existingReminders = listDemoCalendarEvents()
    .filter((e) => e.forRobot && e.status !== "done")
    .slice(-20)
    .map((e) => ({ title: e.title, person: e.person, dateLabel: e.dateLabel, timeLabel: e.timeLabel }));

  return {
    ...demoFamilyContext,
    children: getChildren()
      .map((m) => ({
        id: m.id,
        name: m.name,
        ageLabel: m.ageLabel,
        interests: m.interests,
        routines: m.routines,
        health: m.health,
      })),
    recentObservations: seedObservations.map((o) => ({
      child: o.memberId,
      note: o.note,
      source: o.source,
      observedAt: o.observedAt,
    })),
    existingReminders,
  };
}

export const demoFamilyContext = {
  family: {
    name: "Jane’s Family",
    members: [
      { id: "mom", name: "Jane", role: "parent" },
      { id: "dad", name: "Liang", role: "parent" },
      { id: "mia", name: "Mia", role: "child" },
      { id: "leo", name: "Leo", role: "child" },
    ],
  },
  teamMembers: [
    {
      id: "cameraman",
      name: "Cameraman",
      handles: ["family moments", "highlight stories"],
    },
    {
      id: "watcher",
      name: "Observer",
      handles: ["interval room checks", "10-second clips", "activity recognition", "observation timeline"],
    },
    {
      id: "companion",
      name: "Companion",
      handles: ["reading", "learning", "real books", "toys"],
    },
    {
      id: "homekeeper",
      name: "Homekeeper",
      handles: ["reminders", "check-ins", "family routines", "updates"],
    },
    {
      id: "baby_logger",
      name: "Baby Rhythm",
      handles: ["feeds", "sleep", "diapers", "likely next"],
    },
    {
      id: "coach",
      name: "Coach",
      handles: ["workouts", "form cues", "rep counts"],
    },
  ],
  availableLocalActions: [
    "create_reminder_draft",
    "create_calendar_draft",
    "create_memory_draft",
    "create_story_draft",
    "reply_only",
  ],
} as const;
