// JSON schema (Gemini responseSchema subset) for the album analysis response.
export const albumAnalysisSchema = {
  type: "object",
  properties: {
    photos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          keep: { type: "boolean" },
          reason: {
            type: "string",
            enum: ["screenshot", "receipt", "meme", "document", "blurry", "duplicate", "not_family"],
          },
          childId: { type: "string" },
          mediaKind: { type: "string", enum: ["photo", "video"] },
          isFirst: { type: "boolean" },
          firstLabel: { type: "string" },
        },
        required: ["index", "keep", "mediaKind", "isFirst"],
      },
    },
    dayCaptions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          date: { type: "string" },
          caption: { type: "string" },
        },
        required: ["date", "caption"],
      },
    },
    session: {
      type: "object",
      properties: {
        nowSummary: { type: "string" },
        suggestions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              icon: { type: "string" },
              text: { type: "string" },
            },
            required: ["icon", "text"],
          },
        },
      },
      required: ["nowSummary", "suggestions"],
    },
  },
  required: ["photos", "dayCaptions", "session"],
} as const;
