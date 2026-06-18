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
    {
      id: "sera",
      name: "Sera the calm",
      handles: ["breathing", "a hard day", "pointing you to a real person"],
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
