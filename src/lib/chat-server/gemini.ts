import { buildFamilyContext } from "@/lib/demo/family-context";
import { immediateScheduledAt, timeLabelInZone } from "@/lib/job-time";
import { AURI_SYSTEM_PROMPT } from "./persona";
import { chatResponseJsonSchema } from "./response-schema";
import { ChatAIResponse, ChatRequestBody } from "./types";
import { parseJsonObject, validateChatAIResponse } from "./validate";

function currentTimeLabel(): string {
  return timeLabelInZone(immediateScheduledAt());
}

function buildPrompt(request: ChatRequestBody) {
  const nowLabel = currentTimeLabel();
  return [
    AURI_SYSTEM_PROMPT,
    `IMPORTANT — Current time: ${nowLabel}. When the user says "now", "现在", "立刻", or "马上", always use exactly "${nowLabel}" as the reminder/event time. Never infer a time from routine descriptions — use the current time literally.`,
    "Return ONLY JSON matching the schema. No markdown, no code fences.",
    "Family context (use it to ground every answer):",
    JSON.stringify({ ...buildFamilyContext(), currentTime: nowLabel }),
    "User request:",
    JSON.stringify(request),
  ].join("\n\n");
}

function extractGeminiText(json: any): string {
  const parts = json?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) throw new Error("Gemini response missing candidates[0].content.parts");
  const text = parts.map((part) => part?.text).filter(Boolean).join("\n");
  if (!text) throw new Error("Gemini response did not contain text");
  return text;
}

export async function callGeminiChat(request: ChatRequestBody): Promise<{ response: ChatAIResponse; model: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing");

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const apiResponse = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: buildPrompt(request) }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: chatResponseJsonSchema,
      },
    }),
  });

  if (!apiResponse.ok) {
    const errorText = await apiResponse.text();
    throw new Error(`Gemini API failed: ${apiResponse.status} ${errorText.slice(0, 240)}`);
  }

  const json = await apiResponse.json();
  const text = extractGeminiText(json);
  return { response: validateChatAIResponse(parseJsonObject(text)), model };
}
