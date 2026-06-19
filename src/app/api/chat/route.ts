import { NextResponse } from "next/server";
import { createDemoObjects, persistDemoStore } from "@/lib/demo/demo-store";
import { ensureHydrated } from "@/lib/demo/persistence";
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

async function fallbackResponse(chatRequest: ChatRequestBody, reason: string) {
  const fallback = createFallbackChatResponse(chatRequest);
  return NextResponse.json(
    await withCreatedObjects(fallback, {
      provider: "fallback",
      fallbackUsed: true,
      fallbackReason: reason,
    })
  );
}

async function withCreatedObjects(response: ChatAIResponse, metadata: ChatApiResponse["metadata"]): Promise<ChatApiResponse> {
  const createdLocalObjects = createDemoObjects(response.objectsToCreate);
  if (createdLocalObjects.length) await persistDemoStore();
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
  await ensureHydrated();
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
      return NextResponse.json(await withCreatedObjects(response, { provider: "deepseek", fallbackUsed: false, model }));
    } catch (error) {
      console.error("[api/chat] DeepSeek path failed", error);
      if (!process.env.GEMINI_API_KEY) {
        return await fallbackResponse(chatRequest, error instanceof Error ? error.message : "DeepSeek path failed");
      }
    }
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      const { response, model } = await callGeminiChat(chatRequest);
      return NextResponse.json(await withCreatedObjects(response, { provider: "gemini", fallbackUsed: false, model }));
    } catch (error) {
      console.error("[api/chat] Gemini path failed; using fallback", error);
      return await fallbackResponse(chatRequest, error instanceof Error ? error.message : "Gemini path failed");
    }
  }

  return await fallbackResponse(chatRequest, "DEEPSEEK_API_KEY and GEMINI_API_KEY are missing");
}
