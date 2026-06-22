import { NextResponse } from "next/server";
import { createDemoObjects, persistDemoStore } from "@/lib/demo/demo-store";
import { ensureHydrated, reloadStore } from "@/lib/demo/persistence";
import { createFallbackChatResponse } from "@/lib/demo/fallback-handler";
import { callDeepSeekChat } from "@/lib/chat-server/deepseek";
import { callGeminiChat } from "@/lib/chat-server/gemini";
import { ChatAIResponse, ChatApiResponse, ChatRequestBody, ChatResponseCard, ObjectToCreate } from "@/lib/chat-server/types";

export const runtime = "nodejs";
// Real model calls (DeepSeek/Gemini) can exceed the 10s default; raise it
// (Vercel Hobby caps at 60s, Pro at 300s).
export const maxDuration = 60;

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

// When the AI omits cards but did create objects, synthesize minimal cards so
// the client can render the draft confirmation UI.
function synthesizeCardsFromObjects(objects: ObjectToCreate[] | undefined): ChatResponseCard[] {
  if (!objects?.length) return [];
  const out: ChatResponseCard[] = [];
  for (const obj of objects) {
    const p = (obj.payload ?? {}) as Record<string, unknown>;
    const title = typeof p.title === "string" && p.title ? p.title : undefined;
    if (!title) continue;
    if (obj.type === "reminder_draft") out.push({ type: "reminder", title });
    else if (obj.type === "calendar_draft") out.push({ type: "calendar_draft", title });
  }
  return out;
}

function attachRoutes<T extends { targetRoute?: string }>(cards: T[], objects: ChatAIResponse["objectsToCreate"]) {
  const created = createDemoObjects(objects);
  const withRoutes = cards.map((card, index) => (created[index] ? { ...card, targetRoute: created[index].route } : card));
  return { created, cards: withRoutes };
}

async function withCreatedObjects(response: ChatAIResponse, metadata: ChatApiResponse["metadata"]): Promise<ChatApiResponse> {
  // If this turn creates objects, build on the latest demo store so we don't
  // overwrite uploads/Stories another warm instance just wrote.
  if (response.objectsToCreate?.length || response.helper?.objectsToCreate?.length) {
    await reloadStore("demo");
  }
  const top = attachRoutes(response.cards, response.objectsToCreate);

  // The helper (second voice) carries the actual task → create its objects too.
  let helper = response.helper;
  let helperCreated: typeof top.created = [];
  if (helper) {
    // Synthesize cards if the AI forgot to include them but did create objects.
    const helperCards = helper.cards?.length ? helper.cards : synthesizeCardsFromObjects(helper.objectsToCreate);
    const h = attachRoutes(helperCards, helper.objectsToCreate);
    helperCreated = h.created;
    helper = { ...helper, cards: h.cards };
  }

  const createdLocalObjects = [...top.created, ...helperCreated];
  if (createdLocalObjects.length) await persistDemoStore();

  return {
    ...response,
    cards: top.cards,
    helper,
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
