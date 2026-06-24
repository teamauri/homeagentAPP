import { NextResponse } from "next/server";
import { createDemoObjects, persistDemoStore } from "@/lib/demo/demo-store";
import { ensureHydrated, reloadStore } from "@/lib/demo/persistence";
import { createFallbackChatResponse } from "@/lib/demo/fallback-handler";
import { callDeepSeekChat } from "@/lib/chat-server/deepseek";
import { callGeminiChat } from "@/lib/chat-server/gemini";
import { ChatAIResponse, ChatApiResponse, ChatRequestBody, ChatResponseCard, ObjectToCreate, type TeamMemberId } from "@/lib/chat-server/types";

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

function requestText(request: ChatRequestBody) {
  const attachments = request.attachments?.map((a) => `${a.type ?? ""} ${a.name ?? ""}`).join(" ") ?? "";
  return `${request.message ?? ""} ${attachments}`.toLowerCase();
}

function wantsCameraCapture(request: ChatRequestBody) {
  return /拍摄|拍一下|拍一段|拍[^\s，。,.!?]*|录像|录视频|录下|记录下|视频记录|拍照|film|record|video|capture|photo/.test(requestText(request));
}

function normalizeTimeLabel(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  const friendly = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (friendly) {
    const h = parseInt(friendly[1], 10);
    const period = friendly[3].toUpperCase();
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${h12}:${friendly[2]} ${period}`;
  }
  const twentyFour = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFour) {
    const h = parseInt(twentyFour[1], 10);
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${twentyFour[2]} ${period}`;
  }
  return trimmed;
}

function nowTimeLabel() {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Shanghai",
  }).format(new Date(Date.now() + 60_000));
}

function cameraCaptureTitle(request: ChatRequestBody) {
  const raw = request.message?.trim() || "视频拍摄请求";
  return raw
    .replace(/给我|现在|立刻|马上|today|tonight|now/gi, "")
    .replace(/\s+/g, " ")
    .trim() || "视频拍摄请求";
}

function cameraDraftObject(request: ChatRequestBody): ObjectToCreate {
  const timeLabel = /现在|立刻|马上|\bnow\b/i.test(request.message ?? "") ? nowTimeLabel() : "8:00 PM";
  return {
    type: "reminder_draft",
    payload: {
      title: cameraCaptureTitle(request),
      timeLabel,
      dateLabel: "Today",
      person: "mia",
      agent: "cameraman",
      recordingMode: "cameraman_highlight",
      note: request.message,
    },
  };
}

function hasDraftObject(objects: ObjectToCreate[] | undefined) {
  return Boolean(objects?.some((object) => object.type === "reminder_draft" || object.type === "calendar_draft"));
}

function forceHelperAgent(response: ChatAIResponse, agent: Extract<TeamMemberId, "cameraman" | "companion" | "homekeeper">): ChatAIResponse {
  const helperName = agent === "cameraman" ? "Cameraman" : agent === "companion" ? "Companion" : "Homekeeper";
  if (!response.helper) return response;
  return {
    ...response,
    intent: agent === "cameraman" ? "photo_video" : response.intent,
    helper: {
      ...response.helper,
      teamMemberId: agent,
      name: helperName,
      objectsToCreate: objectsWithAgent(response.helper.objectsToCreate, agent),
      cards: response.helper.cards.map((card) => ({ ...card, metadata: { ...card.metadata, agent } })),
    },
  };
}

function ensureCameraCaptureJob(response: ChatAIResponse, request: ChatRequestBody): ChatAIResponse {
  const helper = response.helper ?? {
    teamMemberId: "cameraman" as TeamMemberId,
    name: "Cameraman",
    reply: "收到，我这就去拍一段视频，马上发给你。",
    cards: [],
    objectsToCreate: [],
  };
  const objectsToCreate = hasDraftObject(helper.objectsToCreate)
    ? objectsWithAgent(helper.objectsToCreate, "cameraman")
    : [cameraDraftObject(request), ...objectsWithAgent(helper.objectsToCreate, "cameraman")];
  const cards = synthesizeCardsFromObjects(objectsToCreate);

  return {
    ...response,
    intent: "photo_video",
    helper: {
      ...helper,
      teamMemberId: "cameraman",
      name: "Cameraman",
      cards,
      objectsToCreate,
    },
  };
}

function normalizeRouting(response: ChatAIResponse, request: ChatRequestBody): ChatAIResponse {
  if (wantsCameraCapture(request)) return ensureCameraCaptureJob(forceHelperAgent(response, "cameraman"), request);
  return response;
}

async function fallbackResponse(chatRequest: ChatRequestBody, reason: string) {
  const fallback = normalizeRouting(createFallbackChatResponse(chatRequest), chatRequest);
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

function objectsWithAgent(objects: ChatAIResponse["objectsToCreate"], agent?: TeamMemberId) {
  if (!agent || !["cameraman", "companion", "homekeeper"].includes(agent)) return objects;
  return objects.map((object) => {
    if (object.type !== "reminder_draft" && object.type !== "calendar_draft") return object;
    const normalizedAgent = normalizeAgentId(object.payload.agent) ?? agent;
    return {
      ...object,
      payload: {
        ...object.payload,
        timeLabel: normalizeTimeLabel(object.payload.timeLabel),
        time: normalizeTimeLabel(object.payload.time),
        agent: normalizedAgent,
        recordingMode: typeof object.payload.recordingMode === "string" && object.payload.recordingMode.trim()
          ? object.payload.recordingMode.trim()
          : normalizedAgent === "cameraman"
            ? "cameraman_highlight"
            : undefined,
      },
    };
  });
}

function normalizeAgentId(value: unknown): TeamMemberId | undefined {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "iris") return "cameraman";
  if (raw === "lumi") return "companion";
  if (raw === "vita" || raw === "reminder") return "homekeeper";
  if (["cameraman", "companion", "homekeeper"].includes(raw)) return raw as TeamMemberId;
  return undefined;
}

function attachRoutes<T extends { targetRoute?: string }>(cards: T[], objects: ChatAIResponse["objectsToCreate"], agent?: TeamMemberId) {
  const created = createDemoObjects(objectsWithAgent(objects, agent));
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
    const helperObjects = objectsWithAgent(helper.objectsToCreate, helper.teamMemberId);
    const h = attachRoutes(helperCards, helperObjects);
    helperCreated = h.created;
    helper = { ...helper, cards: h.cards, objectsToCreate: helperObjects };
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
      return NextResponse.json(await withCreatedObjects(normalizeRouting(response, chatRequest), { provider: "deepseek", fallbackUsed: false, model }));
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
      return NextResponse.json(await withCreatedObjects(normalizeRouting(response, chatRequest), { provider: "gemini", fallbackUsed: false, model }));
    } catch (error) {
      console.error("[api/chat] Gemini path failed; using fallback", error);
      return await fallbackResponse(chatRequest, error instanceof Error ? error.message : "Gemini path failed");
    }
  }

  return await fallbackResponse(chatRequest, "DEEPSEEK_API_KEY and GEMINI_API_KEY are missing");
}
