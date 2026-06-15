export const chatResponseJsonSchema = {
  type: "object",
  properties: {
    handledByTeamMemberId: { type: "string", enum: ["nora", "nina", "milo", "bibi", "mira", "auri"] },
    handledByName: { type: "string" },
    intent: {
      type: "string",
      enum: ["calendar_event", "reminder", "baby_log", "lesson_recap", "memory_story", "reading", "photo_video", "general_question", "unknown"],
    },
    reply: { type: "string" },
    cards: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["calendar_draft", "reminder", "baby_log", "lesson_recap", "memory", "story_draft", "text"] },
          title: { type: "string" },
          subtitle: { type: "string" },
          body: { type: "string" },
          cta: { type: "string" },
          targetRoute: { type: "string" },
          metadata: { type: "object" },
        },
        required: ["type", "title"],
      },
    },
    objectsToCreate: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["calendar_draft", "reminder_draft", "baby_log", "memory_item", "story_draft", "lesson_recap"] },
          payload: { type: "object" },
        },
        required: ["type", "payload"],
      },
    },
    suggestedFollowups: { type: "array", items: { type: "string" } },
  },
  required: ["handledByTeamMemberId", "handledByName", "intent", "reply", "cards", "objectsToCreate", "suggestedFollowups"],
} as const;
