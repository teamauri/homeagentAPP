export const demoFamilyContext = {
  family: {
    name: "Sophie’s Family",
    members: [
      { id: "mom", name: "Mom", role: "parent" },
      { id: "dad", name: "Dad", role: "parent" },
      { id: "sophie", name: "Sophie", role: "child" },
      { id: "leo", name: "Leo", role: "child" },
      { id: "baby", name: "Baby", role: "baby" },
      { id: "grandma", name: "Grandma", role: "extended_family" },
    ],
  },
  teamMembers: [
    {
      id: "nora",
      name: "Nora the Home Coordinator",
      handles: ["calendar", "school emails", "reminders", "sports", "family logistics"],
    },
    {
      id: "nina",
      name: "Nina the Baby Care Advisor",
      handles: ["feeds", "sleep", "diapers", "growth", "baby care logs", "caregiver handoffs"],
    },
    {
      id: "milo",
      name: "Milo the Piano Coach",
      handles: ["piano lessons", "teacher notes", "practice plans", "lesson recordings"],
    },
    {
      id: "bibi",
      name: "Bibi the Book Buddy",
      handles: ["reading", "books", "questions", "reading moments"],
    },
    {
      id: "mira",
      name: "Mira the Memory Keeper",
      handles: ["photos", "videos", "Auri Robot clips", "stories", "Grandma updates"],
    },
  ],
  availableLocalActions: [
    "create_calendar_draft",
    "create_reminder_draft",
    "create_baby_log",
    "create_memory_draft",
    "create_story_draft",
    "create_lesson_recap",
    "reply_only",
  ],
} as const;
