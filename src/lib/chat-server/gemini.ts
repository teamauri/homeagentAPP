import { demoFamilyContext } from "@/lib/demo/family-context";
import { chatResponseJsonSchema } from "./response-schema";
import { ChatAIResponse, ChatRequestBody } from "./types";
import { parseJsonObject, validateChatAIResponse } from "./validate";

function buildPrompt(request: ChatRequestBody) {
  return [
    "You are Auri, an app-first family AI operating layer.",
    "Understand the parent input and route work to the best helper.",
    "Return ONLY JSON matching the schema. Do not include markdown.",
    "External integrations are mocked. Create only local draft objects.",
    "Family/team context:",
    JSON.stringify(demoFamilyContext),
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
