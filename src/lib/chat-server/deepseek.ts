import { demoFamilyContext } from "@/lib/demo/family-context";
import { ChatAIResponse, ChatRequestBody } from "./types";
import { parseJsonObject, validateChatAIResponse } from "./validate";

const responseContract = {
  handledByTeamMemberId: "nora | nina | milo | bibi | mira | auri",
  handledByName: "string",
  intent: "calendar_event | reminder | baby_log | lesson_recap | memory_story | reading | photo_video | general_question | unknown",
  reply: "string",
  cards: [
    {
      type: "calendar_draft | reminder | baby_log | lesson_recap | memory | story_draft | text",
      title: "string",
      subtitle: "optional string",
      body: "optional string",
      cta: "optional string",
      targetRoute: "optional string",
      metadata: "optional object",
    },
  ],
  objectsToCreate: [
    {
      type: "calendar_draft | reminder_draft | baby_log | memory_item | story_draft | lesson_recap",
      payload: "object",
    },
  ],
  suggestedFollowups: ["string"],
};

function buildMessages(request: ChatRequestBody) {
  return [
    {
      role: "system",
      content: [
        "You are Auri, an app-first family AI operating layer for a 5-day mobile web demo.",
        "Understand free-form family input, route it to the best helper, and create local draft objects only.",
        "Do not claim real external integrations were completed. Calendar, reminders, photos, caregiver notifications, and Grandma sending are mocked.",
        "Return ONLY valid JSON. No markdown, no code fences, no explanation.",
        "The JSON must match this TypeScript-like contract:",
        JSON.stringify(responseContract),
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({
        familyContext: demoFamilyContext,
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
