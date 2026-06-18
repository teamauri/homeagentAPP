import { ChatAIResponse, ChatRequestBody } from "@/lib/chat-server/types";

function lowerInput(request: ChatRequestBody) {
  const attachmentText = request.attachments?.map((attachment) => `${attachment.type ?? ""} ${attachment.name ?? ""}`).join(" ") ?? "";
  return `${request.message ?? ""} ${attachmentText}`.toLowerCase();
}

// Keyword fallback used only when no model key is configured. Routes to the
// AURI-site teammates: Vita (keeper), Lumi (reads), Iris (films/album).
export function createFallbackChatResponse(request: ChatRequestBody): ChatAIResponse {
  const input = lowerInput(request);

  if (input.includes("remind") || input.includes("medicine") || input.includes("meds") || input.includes("drink") || input.includes("water bottle")) {
    return {
      handledByTeamMemberId: "vita",
      handledByName: "Vita the keeper",
      intent: "reminder",
      reply: "Done — I set the reminder. When it’s time, whoever’s home can film a quick video receipt.",
      cards: [
        {
          type: "reminder",
          title: "Mia’s 2pm medicine",
          subtitle: "Daily · 2:00 PM · video receipt",
          body: "Reminder draft ready for review.",
          cta: "Edit",
          targetRoute: "/objects/medicine-reminder-demo",
          metadata: { due: "2:00 PM", person: "mia", wantsReceipt: true },
        },
      ],
      objectsToCreate: [
        {
          type: "reminder_draft",
          payload: { title: "Mia’s 2pm medicine", dueLabel: "Daily · 2:00 PM", person: "mia", wantsReceipt: true },
        },
      ],
      suggestedFollowups: ["Move it earlier", "Who should film it?", "Add a second dose"],
    };
  }

  if (input.includes("calendar") || input.includes("basketball") || input.includes("friday") || input.includes("appointment") || input.includes("5:30")) {
    return {
      handledByTeamMemberId: "vita",
      handledByName: "Vita the keeper",
      intent: "calendar_event",
      reply: "I created a calendar draft for the whole family to confirm.",
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
      ],
      objectsToCreate: [
        {
          type: "calendar_draft",
          payload: { title: "Basketball game", person: "leo", dateLabel: "Friday", timeLabel: "5:30 PM", notes: "Bring water bottle." },
        },
      ],
      suggestedFollowups: ["Add Dad as pickup", "Add a reminder", "Add location"],
    };
  }

  if (input.includes("read") || input.includes("reading") || input.includes("book") || input.includes("dinosaur")) {
    return {
      handledByTeamMemberId: "lumi",
      handledByName: "Lumi the companion",
      intent: "reading",
      reply: "I saved this as a reading moment. Mia seems especially curious about dinosaurs and volcanoes.",
      cards: [
        {
          type: "memory",
          title: "Reading moment",
          subtitle: "Dinosaur Day",
          body: "Saved to Memory",
          cta: "View",
          targetRoute: "/objects/reading-memory-demo",
          metadata: { child: "mia", topic: "dinosaurs and volcanoes", source: "reading" },
        },
      ],
      objectsToCreate: [
        {
          type: "memory_item",
          payload: { person: "mia", title: "Dinosaur Day", sourceType: "reading", topics: ["dinosaurs", "volcanoes"] },
        },
      ],
      suggestedFollowups: ["Find another volcano book", "Make a reading note", "Add to Memory"],
    };
  }

  if (input.includes("photo") || input.includes("album") || input.includes("video") || input.includes("clip") || input.includes("grandma")) {
    return {
      handledByTeamMemberId: "iris",
      handledByName: "Iris the eye",
      intent: "memory_story",
      reply: "I pulled together the best moments and made a warm draft to share.",
      cards: [
        {
          type: "story_draft",
          title: "Family album draft",
          subtitle: "2 clips · 14 photos · warm caption",
          body: "A warm update is ready to review before sharing.",
          cta: "Open draft",
          targetRoute: "/objects/family-album-demo",
          metadata: { clips: 2, photos: 14, tone: "warm" },
        },
      ],
      objectsToCreate: [
        {
          type: "story_draft",
          payload: { audience: "family", clips: 2, photos: 14, tone: "warm", title: "This week with the kids" },
        },
      ],
      suggestedFollowups: ["Make it shorter", "Add the soccer clip", "Preview before sharing"],
    };
  }

  return {
    handledByTeamMemberId: "auri",
    handledByName: "Auri",
    intent: "general_question",
    reply: "I can turn that into a reminder, a calendar event, a family album, or a reading note. What would you like me to do?",
    cards: [
      {
        type: "text",
        title: "Auri can help",
        body: "Try a reminder, a calendar event, organizing your photos, or a reading note.",
        cta: "Try an example",
        metadata: { mode: "fallback" },
      },
    ],
    objectsToCreate: [],
    suggestedFollowups: ["Set a reminder", "Organize my photos", "Add a calendar event"],
  };
}
