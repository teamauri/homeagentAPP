import { seedObservations } from "@/lib/family/profile";
import { getChildren } from "@/lib/family/store";

// Rich context for the chat model: the static family/team + each child's
// interests, routines, health notes, and recent observations. This is what lets
// Auri answer "why is my child upset?" with something only a family agent could
// know — never generic advice.
export function buildFamilyContext() {
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
  };
}

export const demoFamilyContext = {
  family: {
    name: "Jane’s Family",
    members: [
      { id: "mom", name: "Jane", role: "parent" },
      { id: "dad", name: "Marcus", role: "parent" },
      { id: "mia", name: "Mia", role: "child" },
      { id: "leo", name: "Leo", role: "child" },
    ],
  },
  teamMembers: [
    {
      id: "iris",
      name: "Iris the eye",
      handles: ["films firsts", "robot clips", "family album", "photo highlights", "video receipts"],
    },
    {
      id: "lumi",
      name: "Lumi the companion",
      handles: ["reading", "books", "questions", "reading moments"],
    },
    {
      id: "vita",
      name: "Vita the keeper",
      handles: ["calendar", "reminders", "school emails", "logs", "meds", "naps", "appointments", "family logistics"],
    },
    {
      id: "nova",
      name: "Nova the coach",
      handles: ["home workout", "quick sets", "form", "reps"],
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
