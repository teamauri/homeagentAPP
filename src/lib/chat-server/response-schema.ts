const voiceProps = {
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
} as const;

export const chatResponseJsonSchema = {
  type: "object",
  properties: {
    // The primary voice is always Auri (the home agent that frames/answers).
    handledByTeamMemberId: { type: "string", enum: ["cameraman", "companion", "homekeeper", "nova", "auri"] },
    handledByName: { type: "string" },
    intent: {
      type: "string",
      enum: ["calendar_event", "reminder", "baby_log", "lesson_recap", "memory_story", "reading", "photo_video", "general_question", "unknown"],
    },
    reply: { type: "string" },
    ...voiceProps,
    // Present ONLY when a helper takes actionable work; the helper is the second
    // voice that "takes the task". Omit for pure advice/emotional answers.
    helper: {
      type: "object",
      properties: {
        teamMemberId: { type: "string", enum: ["cameraman", "companion", "homekeeper", "nova"] },
        name: { type: "string" },
        reply: { type: "string" },
        ...voiceProps,
      },
      required: ["teamMemberId", "name", "reply", "cards", "objectsToCreate"],
    },
    suggestedFollowups: { type: "array", items: { type: "string" } },
  },
  required: ["handledByTeamMemberId", "handledByName", "intent", "reply", "cards", "objectsToCreate", "suggestedFollowups"],
} as const;
