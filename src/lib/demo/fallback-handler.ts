import { ChatAIResponse, ChatRequestBody } from "@/lib/chat-server/types";

function lowerInput(request: ChatRequestBody) {
  const attachmentText = request.attachments?.map((attachment) => `${attachment.type ?? ""} ${attachment.name ?? ""}`).join(" ") ?? "";
  return `${request.message ?? ""} ${attachmentText}`.toLowerCase();
}

export function createFallbackChatResponse(request: ChatRequestBody): ChatAIResponse {
  const input = lowerInput(request);

  if (input.includes("baby") && (input.includes("ml") || input.includes("feed") || input.includes("drank") || input.includes("bottle"))) {
    return {
      handledByTeamMemberId: "nina",
      handledByName: "Nina the Baby Care Advisor",
      intent: "baby_log",
      reply: "Logged. I’ll include this in today’s caregiver handoff.",
      cards: [
        {
          type: "baby_log",
          title: "Care log",
          subtitle: "Bottle · 120ml · 8:30 AM",
          body: "Next feed estimate: 11:15 AM",
          cta: "View log",
          targetRoute: "/objects/baby-log-demo",
          metadata: { amountMl: 120, time: "8:30 AM", nextFeedEstimate: "11:15 AM" },
        },
      ],
      objectsToCreate: [
        {
          type: "baby_log",
          payload: { child: "baby", kind: "bottle", amountMl: 120, timeLabel: "8:30 AM", nextFeedEstimate: "11:15 AM" },
        },
      ],
      suggestedFollowups: ["Add a diaper note", "Set next feed reminder", "Show today’s care log"],
    };
  }

  if (input.includes("piano") || input.includes("lesson video") || input.includes("lesson recording") || input.includes("video")) {
    return {
      handledByTeamMemberId: "milo",
      handledByName: "Milo the Piano Coach",
      intent: "lesson_recap",
      reply: "I summarized the lesson recording and pulled out 3 tiny practice steps.",
      cards: [
        {
          type: "lesson_recap",
          title: "Lesson recap",
          subtitle: "Teacher notes · 12s demo · practice plan",
          body: "3 tiny practice steps are ready for Sophie.",
          cta: "View recap",
          targetRoute: "/objects/lesson-recap-demo",
          metadata: { child: "sophie", source: "sample lesson video", steps: 3 },
        },
      ],
      objectsToCreate: [
        {
          type: "lesson_recap",
          payload: {
            child: "sophie",
            sourceLabel: "Piano lesson video",
            summary: "Teacher emphasized slow left-hand practice and relaxed wrists.",
            steps: ["Warm up hands", "Practice left hand slowly", "Play the phrase twice without stopping"],
          },
        },
      ],
      suggestedFollowups: ["Shorten to 5 minutes", "Send to Dad", "Add to tomorrow"],
    };
  }

  if (input.includes("grandma") || input.includes("sunday update") || input.includes("story")) {
    return {
      handledByTeamMemberId: "mira",
      handledByName: "Mira the Memory Keeper",
      intent: "memory_story",
      reply: "I found 2 Auri Robot clips and 14 phone photos. I made a warm draft for Sunday.",
      cards: [
        {
          type: "story_draft",
          title: "Grandma update draft",
          subtitle: "2 clips · 14 photos · warm caption",
          body: "A warm Sunday note is ready to review before sending.",
          cta: "Open draft",
          targetRoute: "/objects/grandma-update-demo",
          metadata: { clips: 2, photos: 14, tone: "warm", audience: "grandma" },
        },
      ],
      objectsToCreate: [
        {
          type: "story_draft",
          payload: { audience: "grandma", clips: 2, photos: 14, tone: "warm", title: "Sunday update for Grandma" },
        },
      ],
      suggestedFollowups: ["Make it shorter", "Add soccer clip", "Preview before sending"],
    };
  }

  if (input.includes("read") || input.includes("reading") || input.includes("book") || input.includes("dinosaur")) {
    return {
      handledByTeamMemberId: "bibi",
      handledByName: "Bibi the Book Buddy",
      intent: "reading",
      reply: "I saved this as a reading moment. Sophie seems especially curious about dinosaurs and volcanoes.",
      cards: [
        {
          type: "memory",
          title: "Reading moment",
          subtitle: "Dinosaur Day",
          body: "Saved to Memory",
          cta: "View",
          targetRoute: "/objects/reading-memory-demo",
          metadata: { child: "sophie", topic: "dinosaurs and volcanoes", source: "reading" },
        },
      ],
      objectsToCreate: [
        {
          type: "memory_item",
          payload: { person: "sophie", title: "Dinosaur Day", sourceType: "reading", topics: ["dinosaurs", "volcanoes"] },
        },
      ],
      suggestedFollowups: ["Find another volcano book", "Make a reading note", "Add to Memory"],
    };
  }

  if (input.includes("basketball") || input.includes("friday") || input.includes("5:30") || input.includes("water bottle")) {
    return {
      handledByTeamMemberId: "nora",
      handledByName: "Nora the Home Coordinator",
      intent: "calendar_event",
      reply: "I created a calendar draft and a reminder.",
      cards: [
        {
          type: "calendar_draft",
          title: "Basketball game",
          subtitle: "Friday · 5:30 PM · Leo",
          body: "Calendar draft ready for review.",
          cta: "Review event",
          targetRoute: "/objects/basketball-calendar-demo",
          metadata: { person: "leo", date: "Friday", time: "5:30 PM", source: "chat" },
        },
        {
          type: "reminder",
          title: "Bring water bottle",
          subtitle: "Friday · 4:30 PM",
          body: "Reminder draft ready before the game.",
          cta: "Edit",
          targetRoute: "/objects/water-reminder-demo",
          metadata: { due: "Friday 4:30 PM", assignee: "family" },
        },
      ],
      objectsToCreate: [
        {
          type: "calendar_draft",
          payload: { title: "Basketball game", person: "leo", dateLabel: "Friday", timeLabel: "5:30 PM", notes: "Bring water bottle." },
        },
        {
          type: "reminder_draft",
          payload: { title: "Bring water bottle", dueLabel: "Friday · 4:30 PM", person: "leo" },
        },
      ],
      suggestedFollowups: ["Add Dad as pickup", "Move reminder earlier", "Add location"],
    };
  }

  return {
    handledByTeamMemberId: "auri",
    handledByName: "Auri",
    intent: "general_question",
    reply: "I can help turn that into a family plan, reminder, memory, or draft. What would you like me to do with it?",
    cards: [
      {
        type: "text",
        title: "Auri can help",
        body: "Try a calendar event, baby log, piano recap, reading note, or Grandma update.",
        cta: "Try an example",
        metadata: { mode: "fallback" },
      },
    ],
    objectsToCreate: [],
    suggestedFollowups: ["Add a calendar event", "Log baby care", "Make a Grandma update"],
  };
}
