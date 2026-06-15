import { NextResponse } from "next/server";
import { createDemoObjects } from "@/lib/demo/demo-store";
import { createFallbackChatResponse } from "@/lib/demo/fallback-handler";
import { callDeepSeekChat } from "@/lib/chat-server/deepseek";
import { callGeminiChat } from "@/lib/chat-server/gemini";
import { ChatAIResponse, ChatApiResponse, ChatRequestBody } from "@/lib/chat-server/types";

export const runtime = "nodejs";

function normalizeRequestBody(body: unknown): ChatRequestBody {
  const request = body && typeof body === "object" ? (body as ChatRequestBody) : {};
  return {
    familyId: request.familyId || "family_demo",
    userId: request.userId || "mom_demo",
    message: typeof request.message === "string" ? request.message : "",
    attachments: Array.isArray(request.attachments) ? request.attachments : [],
    currentPage: request.currentPage || "chat",
  };
}

function fallbackResponse(chatRequest: ChatRequestBody, reason: string) {
  const fallback = createFallbackChatResponse(chatRequest);
  return NextResponse.json(
    withCreatedObjects(fallback, {
      provider: "fallback",
      fallbackUsed: true,
      fallbackReason: reason,
    })
  );
}

function withCreatedObjects(response: ChatAIResponse, metadata: ChatApiResponse["metadata"]): ChatApiResponse {
  const createdLocalObjects = createDemoObjects(response.objectsToCreate);
  const cards = response.cards.map((card, index) => {
    const created = createdLocalObjects[index];
    return created ? { ...card, targetRoute: created.route } : card;
  });

  return {
    ...response,
    cards,
    createdLocalObjects,
    metadata,
  };
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  const chatRequest = normalizeRequestBody(body);

  if (!chatRequest.message && !chatRequest.attachments?.length) {
    return NextResponse.json({ error: "message or attachments are required" }, { status: 400 });
  }

  if (process.env.DEEPSEEK_API_KEY) {
    try {
      const { response, model } = await callDeepSeekChat(chatRequest);
      return NextResponse.json(withCreatedObjects(response, { provider: "deepseek", fallbackUsed: false, model }));
    } catch (error) {
      console.error("[api/chat] DeepSeek path failed", error);
      if (!process.env.GEMINI_API_KEY) {
        return fallbackResponse(chatRequest, error instanceof Error ? error.message : "DeepSeek path failed");
      }
    }
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      const { response, model } = await callGeminiChat(chatRequest);
      return NextResponse.json(withCreatedObjects(response, { provider: "gemini", fallbackUsed: false, model }));
    } catch (error) {
      console.error("[api/chat] Gemini path failed; using fallback", error);
      return fallbackResponse(chatRequest, error instanceof Error ? error.message : "Gemini path failed");
    }
  }

  return fallbackResponse(chatRequest, "DEEPSEEK_API_KEY and GEMINI_API_KEY are missing");
}
