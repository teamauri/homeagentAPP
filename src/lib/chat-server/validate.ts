import { ChatAIResponse } from "./types";

const teamMemberIds = new Set(["nora", "nina", "milo", "bibi", "mira", "auri"]);
const intents = new Set(["calendar_event", "reminder", "baby_log", "lesson_recap", "memory_story", "reading", "photo_video", "general_question", "unknown"]);
const cardTypes = new Set(["calendar_draft", "reminder", "baby_log", "lesson_recap", "memory", "story_draft", "text"]);
const objectTypes = new Set(["calendar_draft", "reminder_draft", "baby_log", "memory_item", "story_draft", "lesson_recap"]);

export function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Model response did not contain JSON");
    return JSON.parse(match[0]);
  }
}

export function validateChatAIResponse(value: unknown): ChatAIResponse {
  if (!value || typeof value !== "object") throw new Error("AI response is not an object");
  const response = value as Partial<ChatAIResponse>;

  if (!teamMemberIds.has(String(response.handledByTeamMemberId))) throw new Error("Invalid handledByTeamMemberId");
  if (typeof response.handledByName !== "string") throw new Error("Invalid handledByName");
  if (!intents.has(String(response.intent))) throw new Error("Invalid intent");
  if (typeof response.reply !== "string") throw new Error("Invalid reply");
  if (!Array.isArray(response.cards)) throw new Error("Invalid cards");
  if (!Array.isArray(response.objectsToCreate)) throw new Error("Invalid objectsToCreate");
  if (!Array.isArray(response.suggestedFollowups)) throw new Error("Invalid suggestedFollowups");

  response.cards.forEach((card) => {
    if (!cardTypes.has(String(card.type))) throw new Error("Invalid card type");
    if (typeof card.title !== "string") throw new Error("Invalid card title");
  });

  response.objectsToCreate.forEach((object) => {
    if (!objectTypes.has(String(object.type))) throw new Error("Invalid object type");
    if (!object.payload || typeof object.payload !== "object") throw new Error("Invalid object payload");
  });

  return response as ChatAIResponse;
}
