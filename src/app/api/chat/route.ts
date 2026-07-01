import { NextResponse } from "next/server";
import { createDemoObjects, persistDemoStore } from "@/lib/demo/demo-store";
import { ensureHydrated, reloadStore } from "@/lib/demo/persistence";
import { createFallbackChatResponse } from "@/lib/demo/fallback-handler";
import { callDeepSeekChat } from "@/lib/chat-server/deepseek";
import { callGeminiChat } from "@/lib/chat-server/gemini";
import { ChatAIResponse, ChatApiResponse, ChatRequestBody, ChatResponseCard, ObjectToCreate, type TeamMemberId } from "@/lib/chat-server/types";
import { getChildren, getFamily } from "@/lib/family/store";
import { immediateScheduledAt, timeLabelInZone } from "@/lib/job-time";
import { helperTeamAgentIds, normalizeTeamAgentId, teamAgentById, type HelperTeamAgentId } from "@/lib/team";

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
  if (wantsWatcherObservation(request)) return false;
  return /拍摄|拍一下|拍一段|拍[^\s，。,.!?]*|录像|录视频|录下|记录下|视频记录|拍照|film|record|video|capture|photo/.test(requestText(request));
}

function wantsWatcherObservation(request: ChatRequestBody) {
  return /每\s*\d+\s*(分钟|分)|每隔|定时看|定期看|看一下.*在干嘛|观察|监控|watch|watcher|monitor|check.*every|every\s+\d+\s+(min|minute|minutes)|10s|10 seconds/.test(requestText(request));
}

function wantsExplicitCareLog(request: ChatRequestBody) {
  const text = requestText(request);
  return /记录|记一下|记下|log|logged|刚刚|刚才|已经|喝了|吃了|睡了|尿布|diaper|nap|slept|feed|fed|drank|temperature|体温/.test(text);
}

function wantsHomekeeperReminder(request: ChatRequestBody) {
  const text = requestText(request);
  if (wantsCameraCapture(request) || wantsExplicitCareLog(request)) return false;
  return /提醒|记得|叫|让|该|去吃|去喝|吃水果|喝水|吃药|remind|reminder|should|time to|water|fruit|medicine|meds/.test(text);
}

function inferPersonFromRequest(request: ChatRequestBody) {
  const text = requestText(request);
  if (/mike|michael|leo|里奥|麦克/.test(text)) return "child2";
  if (/sophie|sofi|sophy|mia|阿丽塔|alita|索菲/.test(text)) return "child1";
  if (/mom|妈妈/.test(text)) return "mom";
  if (/dad|爸爸/.test(text)) return "dad";
  return "family";
}

type CameraSubject = {
  explicit: boolean;
  personId: string;
  replySubject: string;
};

const memberAliases: Record<string, string[]> = {
  child1: ["sophie", "sofi", "sophy", "索菲", "child1", "mia", "阿丽塔", "alita"],
  child2: ["mike", "michael", "麦克", "child2", "leo", "里奥"],
  mom: ["mom", "妈妈", "jane"],
  dad: ["dad", "爸爸", "liang"],
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function subjectWasMentioned(text: string, phrases: string[]) {
  return phrases.some((phrase) => {
    const trimmed = phrase.trim();
    if (!trimmed) return false;
    const escaped = escapeRegExp(trimmed.toLowerCase());
    if (/^[a-z0-9 ]+$/i.test(trimmed)) return new RegExp(`\\b${escaped}\\b`, "i").test(text);
    return text.includes(trimmed.toLowerCase());
  });
}

function inferCameraSubject(request: ChatRequestBody): CameraSubject {
  const text = requestText(request);
  const family = getFamily();

  for (const member of family) {
    const aliases = [member.name, ...(memberAliases[member.id] ?? [])];
    if (subjectWasMentioned(text, aliases)) {
      return { explicit: true, personId: member.id, replySubject: member.name };
    }
  }

  const properName = request.message
    ?.match(/\b(?:film|record|capture|shoot|take|video|photo)\b(?:\s+(?:a|an|the|some))?(?:\s+(?:video|clip|photo|story))?(?:\s+of)?\s+([A-Z][a-z]+)(?:'s)?\b/i)?.[1]
    ?.replace(/'s$/, "");
  if (properName && !/^(please|now|today|tonight|family|cameraman)$/i.test(properName)) {
    return { explicit: true, personId: "family", replySubject: properName };
  }

  const children = getChildren();
  const primary = children[0];
  if (!primary) return { explicit: false, personId: "family", replySubject: "the family" };

  const others = children.slice(1).map((child) => child.name);
  const otherClause = others.length ? `, and ${others.join(" and ")}` : "";
  const pronoun = primary.avatar === "girl" ? "she" : primary.avatar === "boy" ? "he" : "they";
  return {
    explicit: false,
    personId: primary.id,
    replySubject: `the family, primarily ${primary.name} if ${pronoun} is there${otherClause}`,
  };
}

function cameraHelperReply(request: ChatRequestBody) {
  const subject = inferCameraSubject(request);
  return `Got it. I'll film ${subject.replySubject}${subject.explicit ? " and" : ", and"} edit them into a short story.`;
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

function nowScheduleFields() {
  const scheduledAt = immediateScheduledAt();
  return {
    scheduledAt,
    timeLabel: timeLabelInZone(scheduledAt),
    dateLabel: "Today",
  };
}

function cameraCaptureTitle(request: ChatRequestBody) {
  const raw = request.message?.trim() || "视频拍摄请求";
  return raw
    .replace(/给我|现在|立刻|马上|today|tonight|now/gi, "")
    .replace(/\s+/g, " ")
    .trim() || "视频拍摄请求";
}

function reminderTitle(request: ChatRequestBody) {
  const raw = request.message?.trim() || "Reminder";
  return raw
    .replace(/^(请)?(帮我)?(提醒|记得|叫|让)\s*/i, "")
    .replace(/\s+/g, " ")
    .trim() || "Reminder";
}

function cameraDraftObject(request: ChatRequestBody): ObjectToCreate {
  const now = nowScheduleFields();
  const immediate = /现在|立刻|马上|\bnow\b/i.test(request.message ?? "");
  const subject = inferCameraSubject(request);
  return {
    type: "reminder_draft",
    payload: {
      title: cameraCaptureTitle(request),
      timeLabel: immediate ? now.timeLabel : "8:00 PM",
      dateLabel: now.dateLabel,
      ...(immediate ? { scheduledAt: now.scheduledAt } : {}),
      person: subject.personId,
      subject: subject.replySubject,
      agent: "cameraman",
      recordingMode: "cameraman_highlight",
      note: request.message,
    },
  };
}

function withCameraSubject(objects: ObjectToCreate[], request: ChatRequestBody) {
  const subject = inferCameraSubject(request);
  return objects.map((object) => {
    if (object.type !== "reminder_draft" && object.type !== "calendar_draft") return object;
    return {
      ...object,
      payload: {
        ...object.payload,
        person: subject.personId,
        subject: subject.replySubject,
      },
    };
  });
}

function homekeeperReminderObject(request: ChatRequestBody): ObjectToCreate {
  const now = nowScheduleFields();
  return {
    type: "reminder_draft",
    payload: {
      title: reminderTitle(request),
      scheduledAt: now.scheduledAt,
      timeLabel: now.timeLabel,
      dateLabel: now.dateLabel,
      person: inferPersonFromRequest(request),
      agent: "homekeeper",
      note: request.message,
    },
  };
}

function watcherObject(request: ChatRequestBody): ObjectToCreate {
  const now = nowScheduleFields();
  return {
    type: "reminder_draft",
    payload: {
      title: cameraCaptureTitle(request) || "Home watch",
      scheduledAt: now.scheduledAt,
      timeLabel: now.timeLabel,
      dateLabel: now.dateLabel,
      person: inferPersonFromRequest(request),
      agent: "watcher",
      recordingMode: "watcher_interval",
      note: request.message,
    },
  };
}

function babyLogObject(request: ChatRequestBody): ObjectToCreate {
  return {
    type: "baby_log",
    payload: {
      childId: inferPersonFromRequest(request),
      type: "care",
      description: request.message?.trim() || "Baby care log",
      timestamp: new Date().toISOString(),
    },
  };
}

function hasDraftObject(objects: ObjectToCreate[] | undefined) {
  return Boolean(objects?.some((object) => object.type === "reminder_draft" || object.type === "calendar_draft"));
}

function forceHelperAgent(response: ChatAIResponse, agent: HelperTeamAgentId): ChatAIResponse {
  const helperName = teamAgentById[agent].name;
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
    reply: cameraHelperReply(request),
    cards: [],
    objectsToCreate: [],
  };
  const objectsToCreate = hasDraftObject(helper.objectsToCreate)
    ? objectsWithAgent(helper.objectsToCreate, "cameraman")
    : [cameraDraftObject(request), ...objectsWithAgent(helper.objectsToCreate, "cameraman")];
  const cameraObjects = withCameraSubject(objectsToCreate, request);
  const cards = synthesizeCardsFromObjects(cameraObjects);

  return {
    ...response,
    intent: "photo_video",
    helper: {
      ...helper,
      teamMemberId: "cameraman",
      name: "Cameraman",
      reply: cameraHelperReply(request),
      cards,
      objectsToCreate: cameraObjects,
    },
  };
}

function normalizeRouting(response: ChatAIResponse, request: ChatRequestBody): ChatAIResponse {
  if (wantsWatcherObservation(request)) return ensureWatcherJob(forceHelperAgent(response, "watcher"), request);
  if (wantsCameraCapture(request)) return ensureCameraCaptureJob(forceHelperAgent(response, "cameraman"), request);
  if (wantsExplicitCareLog(request)) return ensureBabyLoggerJob(response, request);
  if (wantsHomekeeperReminder(request)) return ensureHomekeeperReminderJob(response, request);
  return response;
}

function emptyAuriResponse(intent: ChatAIResponse["intent"]): ChatAIResponse {
  return {
    handledByTeamMemberId: "auri",
    handledByName: "Auri",
    intent,
    reply: "",
    cards: [],
    objectsToCreate: [],
    suggestedFollowups: [],
  };
}

function fastRouteResponse(request: ChatRequestBody): ChatAIResponse | undefined {
  if (wantsWatcherObservation(request)) return normalizeRouting(emptyAuriResponse("photo_video"), request);
  if (wantsCameraCapture(request)) return normalizeRouting(emptyAuriResponse("photo_video"), request);
  if (wantsHomekeeperReminder(request)) return normalizeRouting(emptyAuriResponse("reminder"), request);
  return undefined;
}

function ensureWatcherJob(response: ChatAIResponse, request: ChatRequestBody): ChatAIResponse {
  const helper = response.helper ?? {
    teamMemberId: "watcher" as TeamMemberId,
    name: "Observer",
    reply: "收到，我会按间隔观察并记录家里的状态。",
    cards: [],
    objectsToCreate: [],
  };
  const objectsToCreate = hasDraftObject(helper.objectsToCreate)
    ? objectsWithAgent(helper.objectsToCreate, "watcher")
    : [watcherObject(request), ...objectsWithAgent(helper.objectsToCreate, "watcher")];

  return {
    ...response,
    intent: "photo_video",
    helper: {
      ...helper,
      teamMemberId: "watcher",
      name: "Observer",
      cards: synthesizeCardsFromObjects(objectsToCreate),
      objectsToCreate,
    },
  };
}

function ensureBabyLoggerJob(response: ChatAIResponse, request: ChatRequestBody): ChatAIResponse {
  const helper = response.helper ?? {
    teamMemberId: "baby_logger" as TeamMemberId,
    name: "Baby Rhythm",
    reply: "已记录这条宝宝照护日志。",
    cards: [],
    objectsToCreate: [],
  };
  const objectsToCreate = helper.objectsToCreate.some((object) => object.type === "baby_log")
    ? helper.objectsToCreate
    : [babyLogObject(request), ...helper.objectsToCreate];

  return {
    ...response,
    intent: "baby_log",
    cards: [],
    objectsToCreate: [],
    helper: {
      ...helper,
      teamMemberId: "baby_logger",
      name: "Baby Rhythm",
      cards: helper.cards?.length ? helper.cards : synthesizeCardsFromObjects(objectsToCreate),
      objectsToCreate,
    },
  };
}

function ensureHomekeeperReminderJob(response: ChatAIResponse, request: ChatRequestBody): ChatAIResponse {
  const helper = response.helper ?? {
    teamMemberId: "homekeeper" as TeamMemberId,
    name: "Homekeeper",
    reply: "收到，我会把这个作为提醒来处理。",
    cards: [],
    objectsToCreate: [],
  };
  const draftObjects = helper.objectsToCreate.filter((object) => object.type === "reminder_draft" || object.type === "calendar_draft");
  const objectsToCreate = draftObjects.length
    ? objectsWithAgent(draftObjects, "homekeeper")
    : [homekeeperReminderObject(request)];

  return {
    ...response,
    intent: "reminder",
    cards: [],
    objectsToCreate: [],
    helper: {
      ...helper,
      teamMemberId: "homekeeper",
      name: "Homekeeper",
      cards: synthesizeCardsFromObjects(objectsToCreate),
      objectsToCreate,
    },
  };
}

async function fallbackResponse(chatRequest: ChatRequestBody, reason: string) {
  const fallback = normalizeRouting(createFallbackChatResponse(chatRequest), chatRequest);
  const isGenericFallback =
    fallback.intent === "general_question" &&
    !fallback.helper &&
    fallback.cards.length === 0 &&
    fallback.objectsToCreate.length === 0;

  if (isGenericFallback) {
    return NextResponse.json(
      {
        error: "Model response unavailable",
        detail: reason,
        metadata: {
          provider: "fallback",
          fallbackUsed: true,
          fallbackReason: reason,
        },
      },
      { status: 503 }
    );
  }

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
    if (obj.type === "baby_log") {
      out.push({ type: "baby_log", title: title ?? "Baby care log", body: typeof p.description === "string" ? p.description : undefined });
      continue;
    }
    if (!title) continue;
    if (obj.type === "reminder_draft") out.push({ type: "reminder", title });
    else if (obj.type === "calendar_draft") out.push({ type: "calendar_draft", title });
  }
  return out;
}

function objectsWithAgent(objects: ChatAIResponse["objectsToCreate"], agent?: TeamMemberId) {
  const helperAgent = normalizeAgentId(agent);
  if (!helperAgent || helperAgent === "auri") return objects;
  return objects.map((object) => {
    if (object.type !== "reminder_draft" && object.type !== "calendar_draft") return object;
    const normalizedAgent = normalizeAgentId(object.payload.agent) ?? helperAgent;
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
  const agent = normalizeTeamAgentId(value);
  return agent && helperTeamAgentIds.includes(agent as HelperTeamAgentId) ? agent : undefined;
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

  const fastResponse = fastRouteResponse(chatRequest);
  if (fastResponse) {
    return NextResponse.json(await withCreatedObjects(fastResponse, { provider: "local", fallbackUsed: false, model: "deterministic-router" }));
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
