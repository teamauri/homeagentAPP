import { buildFamilyContext } from "@/lib/demo/family-context";
import { AURI_SYSTEM_PROMPT } from "./persona";
import { ChatAIResponse, ChatRequestBody } from "./types";
import { parseJsonObject, validateChatAIResponse } from "./validate";

const cardContract = {
  type: "calendar_draft | reminder | baby_log | lesson_recap | memory | story_draft | text",
  title: "string",
  subtitle: "optional string",
  body: "optional string",
  cta: "optional string",
  targetRoute: "optional string",
  metadata: "optional object",
};
const objectContract = {
  type: "calendar_draft | reminder_draft | baby_log | memory_item | story_draft | lesson_recap",
  payload: "object",
};

const responseContract = {
  handledByTeamMemberId: "auri (always — Auri is the primary voice)",
  handledByName: "Auri",
  intent: "calendar_event | reminder | baby_log | lesson_recap | memory_story | reading | photo_video | general_question | unknown",
  reply: "string (Auri speaking)",
  cards: [cardContract],
  objectsToCreate: [objectContract],
  helper: "optional, only when a helper takes a task: { teamMemberId: iris|lumi|vita|nova, name: string, reply: string, cards: [card], objectsToCreate: [object] }",
  suggestedFollowups: ["string"],
};

function currentTimeLabel(): string {
  // Add 1 minute so "now" reminders fire shortly after creation rather than immediately.
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Shanghai",
  }).format(new Date(Date.now() + 60_000));
}

function buildMessages(request: ChatRequestBody) {
  const nowLabel = currentTimeLabel();
  return [
    {
      role: "system",
      content: [
        AURI_SYSTEM_PROMPT,
        `IMPORTANT — Current time (already 1 minute from now, use as-is for "now"/"现在"/"立刻"/"马上" reminders): ${nowLabel}. Always use exactly "${nowLabel}" when the user means right now. Never infer a time from routine descriptions.`,
        `IMPORTANT — Deduplication: familyContext.existingReminders lists reminders already created today. If the user requests a reminder for the same person with a very similar title on the same day, do NOT create a new one. Instead reply that it is already set and return helper.cards with the existing reminder data (type "reminder", same title/metadata) but helper.objectsToCreate must be empty [].`,
        "Return ONLY valid JSON. No markdown, no code fences, no explanation.",
        "The JSON must match this TypeScript-like contract:",
        JSON.stringify(responseContract),
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({
        familyContext: buildFamilyContext(),
        currentTime: nowLabel,
        request,
      }),
    },
  ];
}

function extractDeepSeekText(json: any): string {
  const text = json?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("DeepSeek response missing choices[0].message.content");
  }
  return text;
}

export async function callDeepSeekChat(request: ChatRequestBody): Promise<{ response: ChatAIResponse; model: string }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is missing");

  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  const apiResponse = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: buildMessages(request),
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });

  if (!apiResponse.ok) {
    const errorText = await apiResponse.text();
    throw new Error(`DeepSeek API failed: ${apiResponse.status} ${errorText.slice(0, 240)}`);
  }

  const json = await apiResponse.json();
  const text = extractDeepSeekText(json);
  return { response: validateChatAIResponse(parseJsonObject(text)), model };
}
