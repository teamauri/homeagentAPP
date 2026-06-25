import { randomUUID } from "node:crypto";
import { CreatedLocalObject, ObjectToCreate } from "@/lib/chat-server/types";
import {
  CalendarApiEvent,
  CalendarEventInput,
  CalendarJobAgentId,
  CalendarRawOutputStatus,
  CalendarRobotCaptureStatus,
  deriveCalendarEventIcon,
} from "@/lib/calendar-api";
import { scheduledAtFromLabels } from "@/lib/job-time";
import { moments } from "@/lib/mock-data";
import { helperTeamAgentIds, normalizeTeamAgentId } from "@/lib/team";
import { PersonId, SourceType, Status } from "@/lib/types";
import { persistStore, registerStore } from "./persistence";

type StoredObject = CreatedLocalObject & { payload: Record<string, unknown>; createdAt: string };
type DemoObjectAction = "add" | "save" | "send" | "log" | "complete";
type DemoMediaSource = "phone" | "auri";
type DemoMediaType = "photo" | "video" | "clip";
const calendarAgentIds = new Set<CalendarJobAgentId>(helperTeamAgentIds);

export interface DemoMediaInput {
  id?: string;
  title?: string;
  source?: DemoMediaSource;
  sourceType?: SourceType;
  mediaType?: DemoMediaType;
  type?: DemoMediaType;
  url?: string;
  thumbnailUrl?: string;
  capturedAt?: string;
  durationSeconds?: number;
  person?: PersonId;
  body?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface DemoMediaItem {
  id: string;
  title: string;
  source: DemoMediaSource;
  sourceType: SourceType;
  mediaType: DemoMediaType;
  url: string;
  thumbnailUrl?: string;
  capturedAt: string;
  durationSeconds?: number;
  person: PersonId;
  body: string;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DemoMemoryItem {
  id: string;
  title: string;
  body: string;
  sourceLabel: string;
  sourceType: SourceType;
  timeLabel: string;
  person: PersonId;
  status: Status;
  statusLabel: string;
  mediaIds: string[];
  createdAt: string;
  targetRoute: string;
  metadata: Record<string, unknown>;
}

type DemoMemoryOptions = {
  title?: string;
  body?: string;
  status?: Status;
  statusLabel?: string;
  metadata?: Record<string, unknown>;
};

const globalStore = globalThis as typeof globalThis & {
  __auriDemoObjects?: StoredObject[];
  __auriDemoMedia?: DemoMediaItem[];
  __auriDemoMemory?: DemoMemoryItem[];
  __auriDemoCalendarEvents?: CalendarApiEvent[];
  __auriDemoCounter?: number;
  __auriDemoMediaCounter?: number;
  __auriDemoMemoryCounter?: number;
  __auriDemoCalendarCounter?: number;
};

function store() {
  globalStore.__auriDemoObjects ??= [];
  globalStore.__auriDemoMedia ??= [];
  globalStore.__auriDemoMemory ??= [];
  globalStore.__auriDemoCalendarEvents ??= [];
  globalStore.__auriDemoCounter ??= 0;
  globalStore.__auriDemoMediaCounter ??= 0;
  globalStore.__auriDemoMemoryCounter ??= 0;
  globalStore.__auriDemoCalendarCounter ??= 0;
  return globalStore;
}

registerStore({
  key: "demo",
  snapshot: () => {
    const current = store();
    return {
      objects: current.__auriDemoObjects,
      media: current.__auriDemoMedia,
      memory: current.__auriDemoMemory,
      calendarEvents: current.__auriDemoCalendarEvents,
      counter: current.__auriDemoCounter,
      mediaCounter: current.__auriDemoMediaCounter,
      memoryCounter: current.__auriDemoMemoryCounter,
      calendarCounter: current.__auriDemoCalendarCounter,
    };
  },
  restore: (data) => {
    const current = store();
    if (Array.isArray(data.objects)) current.__auriDemoObjects = data.objects as StoredObject[];
    if (Array.isArray(data.media)) current.__auriDemoMedia = data.media as DemoMediaItem[];
    if (Array.isArray(data.memory)) current.__auriDemoMemory = data.memory as DemoMemoryItem[];
    if (Array.isArray(data.calendarEvents)) current.__auriDemoCalendarEvents = data.calendarEvents as CalendarApiEvent[];
    if (typeof data.counter === "number") current.__auriDemoCounter = data.counter;
    if (typeof data.mediaCounter === "number") current.__auriDemoMediaCounter = data.mediaCounter;
    if (typeof data.memoryCounter === "number") current.__auriDemoMemoryCounter = data.memoryCounter;
    if (typeof data.calendarCounter === "number") current.__auriDemoCalendarCounter = data.calendarCounter;
  },
});

/** Persist the demo store (media/memory/objects/counters) after a mutation. */
export function persistDemoStore() {
  return persistStore("demo");
}

/** Delete one Memory and the media it owns. Returns true if it existed. */
export function removeDemoMemory(id: string): boolean {
  const current = store();
  const memory = (current.__auriDemoMemory ?? []).find((m) => m.id === id);
  if (!memory) return false;
  const ownedIds = new Set(memory.mediaIds);
  current.__auriDemoMemory = (current.__auriDemoMemory ?? []).filter((m) => m.id !== id);
  current.__auriDemoMedia = (current.__auriDemoMedia ?? []).filter((m) => !ownedIds.has(m.id));
  return true;
}

/** Wipe all demo content (uploaded/ingested media, Stories, created objects). */
export function resetDemoStore() {
  const current = store();
  current.__auriDemoObjects = [];
  current.__auriDemoMedia = [];
  current.__auriDemoMemory = [];
  current.__auriDemoCalendarEvents = [];
  current.__auriDemoCounter = 0;
  current.__auriDemoMediaCounter = 0;
  current.__auriDemoMemoryCounter = 0;
  current.__auriDemoCalendarCounter = 0;
}

function statusFor(type: ObjectToCreate["type"]): CreatedLocalObject["status"] {
  if (type === "baby_log") return "logged";
  if (type === "memory_item") return "saved";
  if (type === "lesson_recap" || type === "story_draft") return "ready";
  return "draft";
}

function timestampFromCalendarId(id?: string): number | undefined {
  const match = id?.match(/^revent_(\d+)/);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

function scheduledAtFromPayload(payload: Record<string, unknown>, dateLabel: string, timeLabel: string, anchor = Date.now()) {
  if (typeof payload.scheduledAt === "number" && Number.isFinite(payload.scheduledAt)) return payload.scheduledAt;
  const datetime = typeof payload.datetime === "string" ? payload.datetime : typeof payload.dateTime === "string" ? payload.dateTime : undefined;
  if (datetime) {
    const parsed = new Date(datetime).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  return scheduledAtFromLabels(dateLabel, timeLabel, anchor) ?? anchor;
}

function legacyCalendarScheduledAt(event: CalendarApiEvent) {
  if (typeof event.scheduledAt === "number" && Number.isFinite(event.scheduledAt)) return event.scheduledAt;
  const createdAnchor = event.createdAt ? new Date(event.createdAt).getTime() : timestampFromCalendarId(event.id);
  return scheduledAtFromLabels(event.dateLabel, event.timeLabel, createdAnchor) ?? createdAnchor;
}

export function createDemoObjects(objectsToCreate: ObjectToCreate[]): CreatedLocalObject[] {
  const currentStore = store();

  return objectsToCreate.map((object) => {
    // For reminder/calendar drafts, deduplicate against existing pending events.
    // If a matching calendar event already exists, never create a second one.
    if (object.type === "reminder_draft" || object.type === "calendar_draft") {
      const p = object.payload as Record<string, unknown>;
      const title = typeof p.title === "string" && p.title ? p.title : "Reminder";
      const personRaw = p.person ?? p.childId ?? p.recipient ?? p.assignee ?? "family";
      const person = toPersonId(typeof personRaw === "string" ? personRaw : "family");
      const normalizedTitle = title.trim().toLowerCase();

      const existingEvent = (currentStore.__auriDemoCalendarEvents ?? []).find(
        (e) => e.forRobot && e.status !== "done" && e.person === person &&
               e.title.trim().toLowerCase() === normalizedTitle
      );
      if (existingEvent) {
        // Fix stale "now" timeLabel in-place so DockKit sees the actual time.
        if (existingEvent.timeLabel.trim().toLowerCase() === "now") {
          existingEvent.timeLabel = new Intl.DateTimeFormat("en-US", {
            hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Shanghai",
          }).format(new Date(Date.now() + 60_000));
          existingEvent.updatedAt = new Date().toISOString();
        }
        if (!Number.isFinite(existingEvent.scheduledAt)) {
          existingEvent.scheduledAt = legacyCalendarScheduledAt(existingEvent);
          existingEvent.updatedAt = new Date().toISOString();
        }
        const agent = toCalendarJobAgent(p.agent);
        if (agent && existingEvent.agent !== agent) {
          existingEvent.agent = agent;
          existingEvent.updatedAt = new Date().toISOString();
        }
        const recordingMode = toRecordingMode(p.recordingMode);
        if (recordingMode && existingEvent.recordingMode !== recordingMode) {
          existingEvent.recordingMode = recordingMode;
          existingEvent.updatedAt = new Date().toISOString();
        }
        const existingObj = (currentStore.__auriDemoObjects ?? []).find(
          (o) => (o.type === "reminder_draft" || o.type === "calendar_draft") &&
                 typeof o.payload.title === "string" &&
                 o.payload.title.trim().toLowerCase() === normalizedTitle
        );
        if (existingObj) {
          return { id: existingObj.id, type: existingObj.type, route: existingObj.route, status: existingObj.status };
        }
        // Object was lost (Render restart). Create a new object but skip the calendar
        // event — the existing one is the source of truth for DockKit.
        const id = `${object.type}_${Date.now()}`;
        const created: StoredObject = {
          id, type: object.type, route: `/objects/${id}`,
          status: statusFor(object.type), payload: object.payload,
          createdAt: new Date().toISOString(),
        };
        currentStore.__auriDemoObjects?.push(created);
        return { id: created.id, type: created.type, route: created.route, status: created.status };
      }
    }

    // Use a timestamp-based ID so IDs never repeat across server restarts.
    // Counter-based IDs (reminder_draft_0004) recycled on every Render restart,
    // causing previously dismissed cards to appear dismissed again.
    const id = `${object.type}_${Date.now()}`;
    const created: StoredObject = {
      id,
      type: object.type,
      route: `/objects/${id}`,
      status: statusFor(object.type),
      payload: object.payload,
      createdAt: new Date().toISOString(),
    };
    currentStore.__auriDemoObjects?.push(created);

    // Reminder/calendar drafts created by AI chat should also land in the robot
    // calendar so the DockKit app can pick them up.
    if (object.type === "reminder_draft" || object.type === "calendar_draft") {
      const p = object.payload as Record<string, unknown>;
      const title = typeof p.title === "string" && p.title ? p.title : "Reminder";
      // Accept childId/recipient/assignee as aliases for person (model is inconsistent)
      const personRaw = p.person ?? p.childId ?? p.recipient ?? p.assignee ?? "family";
      const person = toPersonId(typeof personRaw === "string" ? personRaw : "family");
      const dateLabel = typeof p.dateLabel === "string" && p.dateLabel ? p.dateLabel : "Today";
      // Accept time as alias for timeLabel; if AI returns "now" substitute actual time.
      const rawTimeLabel = (typeof p.timeLabel === "string" && p.timeLabel) ? p.timeLabel :
                           (typeof p.time === "string" && p.time) ? p.time : "now";
      const timeLabel = rawTimeLabel.trim().toLowerCase() === "now"
        ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Shanghai" }).format(new Date(Date.now() + 60_000))
        : normalizeTimeLabel(rawTimeLabel);
      const scheduledAt = scheduledAtFromPayload(p, dateLabel, timeLabel);
      const note = typeof p.note === "string" ? p.note : typeof p.body === "string" ? p.body : undefined;
      upsertDemoCalendarEvent({
        title,
        person,
        scheduledAt,
        dateLabel,
        timeLabel,
        note,
        forRobot: true,
        agent: toCalendarJobAgent(p.agent),
        recordingMode: toRecordingMode(p.recordingMode),
      });
    }

    return { id: created.id, type: created.type, route: created.route, status: created.status };
  });
}

export function listDemoObjects() {
  return [...(store().__auriDemoObjects ?? [])];
}

export function getDemoObject(id: string) {
  return store().__auriDemoObjects?.find((object) => object.id === id);
}

export function applyDemoObjectAction(id: string, action: DemoObjectAction) {
  const object = getDemoObject(id);
  if (!object) return undefined;

  object.status = action === "send" ? "sent" : action === "log" ? "logged" : action === "save" ? "saved" : "added";
  object.payload = {
    ...object.payload,
    lastAction: action,
    updatedAt: new Date().toISOString(),
  };
  return object;
}

function nextCalendarId(inputId?: string) {
  if (inputId) return inputId;
  const currentStore = store();
  currentStore.__auriDemoCalendarCounter = (currentStore.__auriDemoCalendarCounter ?? 0) + 1;
  return `revent_${Date.now()}_${currentStore.__auriDemoCalendarCounter}`;
}

export function upsertDemoCalendarEvent(input: CalendarEventInput): CalendarApiEvent {
  const currentStore = store();
  const now = new Date().toISOString();
  const existing = input.id ? currentStore.__auriDemoCalendarEvents?.find((event) => event.id === input.id) : undefined;
  const forRobot = Boolean(input.forRobot);
  const scheduledAt =
    input.scheduledAt ??
    existing?.scheduledAt ??
    scheduledAtFromLabels(
      input.dateLabel,
      input.timeLabel,
      existing?.createdAt ? new Date(existing.createdAt).getTime() : Date.now()
    ) ??
    Date.now();
  const event: CalendarApiEvent = {
    ...existing,
    id: nextCalendarId(input.id),
    title: input.title,
    note: input.note,
    body: input.body ?? input.note,
    person: input.person,
    scheduledAt,
    dateLabel: input.dateLabel,
    timeLabel: input.timeLabel,
    icon: input.icon ?? existing?.icon ?? deriveCalendarEventIcon(input.title, input.person),
    agent: input.agent ?? existing?.agent,
    recordingMode: input.recordingMode ?? existing?.recordingMode,
    source: "created",
    forRobot,
    auriClientVideoUuid: forRobot ? (existing?.auriClientVideoUuid ?? randomUUID()) : undefined,
    robot: forRobot ? existing?.robot : undefined,
    photoUrl: input.photoUrl,
    voiceUrl: input.voiceUrl,
    voiceDuration: input.voiceDuration,
    status: existing?.status ?? "scheduled",
    statusLabel: existing?.statusLabel ?? "Scheduled",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  currentStore.__auriDemoCalendarEvents = (currentStore.__auriDemoCalendarEvents ?? []).filter((current) => current.id !== event.id);
  currentStore.__auriDemoCalendarEvents.push(event);
  return event;
}

export function listDemoCalendarEvents() {
  return [...(store().__auriDemoCalendarEvents ?? [])];
}

export function getDemoCalendarEvent(id: string) {
  return store().__auriDemoCalendarEvents?.find((event) => event.id === id);
}

export interface DemoRobotCaptureStatusInput {
  status: CalendarRobotCaptureStatus;
  robotId?: string;
  auriVideoId?: string;
  auriClientVideoUuid?: string;
  recordingMode?: string;
  vlogId?: string;
  durationSeconds?: number;
  highlightVideoUrl?: string;
  highlightMemoryId?: string;
  highlightSyncedAt?: string;
  highlightError?: string;
  startedAt?: string;
  uploadedAt?: string;
  failedAt?: string;
  error?: string;
  rawOutputStatus?: CalendarRawOutputStatus;
  rawOutputMemoryId?: string;
  rawOutputVideoUrl?: string;
  rawOutputPosterUrl?: string;
  rawOutputSummary?: string;
  transcriptJsonUrl?: string;
  transcriptTxtUrl?: string;
  rawOutputReadyAt?: string;
  rawOutputSyncedAt?: string;
  rawOutputError?: string;
}

function statusLabelFromRobotStatus(status: CalendarRobotCaptureStatus) {
  if (status === "recording") return "Recording";
  if (status === "uploading") return "Uploading";
  if (status === "uploaded") return "Uploaded";
  if (status === "done") return "Done";
  if (status === "failed") return "Failed";
  return "Scheduled";
}

function rawOutputStatusFor(input: DemoRobotCaptureStatusInput, existing?: CalendarApiEvent["robot"]): CalendarRawOutputStatus | undefined {
  if (input.rawOutputStatus) return input.rawOutputStatus;
  if (input.status === "failed") return "failed";
  if (input.auriVideoId && input.auriVideoId !== existing?.auriVideoId) return "pending";
  if (existing?.rawOutputStatus) return existing.rawOutputStatus;
  if (input.auriVideoId) return "pending";
  return undefined;
}

export function updateDemoCalendarRobotStatus(taskId: string, input: DemoRobotCaptureStatusInput): CalendarApiEvent | undefined {
  const currentStore = store();
  const events = currentStore.__auriDemoCalendarEvents ?? [];
  const event = events.find((current) => current.id === taskId);
  if (!event || !event.forRobot) return undefined;

  const now = new Date().toISOString();
  const auriClientVideoUuid = input.auriClientVideoUuid ?? event.auriClientVideoUuid ?? event.robot?.auriClientVideoUuid ?? randomUUID();
  event.auriClientVideoUuid = auriClientVideoUuid;
  event.robot = {
    ...event.robot,
    status: input.status,
    robotId: input.robotId ?? event.robot?.robotId,
    auriVideoId: input.auriVideoId ?? event.robot?.auriVideoId,
    auriClientVideoUuid,
    recordingMode: input.recordingMode ?? event.robot?.recordingMode,
    vlogId: input.vlogId ?? event.robot?.vlogId,
    durationSeconds: input.durationSeconds ?? event.robot?.durationSeconds,
    highlightVideoUrl: input.highlightVideoUrl ?? event.robot?.highlightVideoUrl,
    highlightMemoryId: input.highlightMemoryId ?? event.robot?.highlightMemoryId,
    highlightSyncedAt: input.highlightSyncedAt ?? event.robot?.highlightSyncedAt,
    highlightError: input.highlightError ?? event.robot?.highlightError,
    rawOutputStatus: rawOutputStatusFor(input, event.robot),
    rawOutputMemoryId: input.rawOutputMemoryId ?? event.robot?.rawOutputMemoryId,
    rawOutputVideoUrl: input.rawOutputVideoUrl ?? event.robot?.rawOutputVideoUrl,
    rawOutputPosterUrl: input.rawOutputPosterUrl ?? event.robot?.rawOutputPosterUrl,
    rawOutputSummary: input.rawOutputSummary ?? event.robot?.rawOutputSummary,
    transcriptJsonUrl: input.transcriptJsonUrl ?? event.robot?.transcriptJsonUrl,
    transcriptTxtUrl: input.transcriptTxtUrl ?? event.robot?.transcriptTxtUrl,
    rawOutputReadyAt: input.rawOutputReadyAt ?? event.robot?.rawOutputReadyAt,
    rawOutputSyncedAt: input.rawOutputSyncedAt ?? event.robot?.rawOutputSyncedAt,
    rawOutputError: input.rawOutputError ?? event.robot?.rawOutputError,
    startedAt: input.startedAt ?? event.robot?.startedAt,
    uploadedAt: input.uploadedAt ?? (input.status === "uploaded" ? now : event.robot?.uploadedAt),
    failedAt: input.failedAt ?? (input.status === "failed" ? now : event.robot?.failedAt),
    error: input.error ?? event.robot?.error,
    updatedAt: now,
  };
  event.status = input.status;
  event.statusLabel = statusLabelFromRobotStatus(input.status);
  event.updatedAt = now;
  return event;
}

export function removeDemoCalendarEvent(id: string) {
  const currentStore = store();
  const before = currentStore.__auriDemoCalendarEvents?.length ?? 0;
  currentStore.__auriDemoCalendarEvents = (currentStore.__auriDemoCalendarEvents ?? []).filter((event) => event.id !== id);
  return (currentStore.__auriDemoCalendarEvents?.length ?? 0) !== before;
}

function nextId(prefix: string, key: "__auriDemoMediaCounter" | "__auriDemoMemoryCounter") {
  const currentStore = store();
  const counter = (currentStore[key] ?? 0) + 1;
  currentStore[key] = counter;
  return `${prefix}_${counter.toString().padStart(4, "0")}`;
}

function toPersonId(value: unknown): PersonId {
  const person = String(value || "family");
  if (["mia", "leo", "baby", "mom", "dad", "grandma", "family"].includes(person)) return person as PersonId;
  return "family";
}

function toCalendarJobAgent(value: unknown): CalendarJobAgentId | undefined {
  const agent = normalizeTeamAgentId(value);
  return calendarAgentIds.has(agent as CalendarJobAgentId) ? (agent as CalendarJobAgentId) : undefined;
}

function toRecordingMode(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeTimeLabel(value: string): string {
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

function toMediaType(value: unknown): DemoMediaType {
  const type = String(value || "photo");
  if (type === "video" || type === "clip") return type;
  return "photo";
}

function sourceLabel(source: DemoMediaSource) {
  return source === "auri" ? "Auri Robot" : "Phone";
}

const DISPLAY_TIME_ZONE = "Asia/Shanghai";

function zonedDayNumber(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DISPLAY_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return undefined;
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function dateLabelFor(date: Date, now = new Date()) {
  const day = zonedDayNumber(date);
  const today = zonedDayNumber(now);
  if (day !== undefined && today !== undefined) {
    if (day === today) return "Today";
    if (day === today - 1) return "Yesterday";
  }
  const sameYear = new Intl.DateTimeFormat("en-US", { timeZone: DISPLAY_TIME_ZONE, year: "numeric" }).format(date) ===
    new Intl.DateTimeFormat("en-US", { timeZone: DISPLAY_TIME_ZONE, year: "numeric" }).format(now);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: DISPLAY_TIME_ZONE,
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(date);
}

function timeLabel(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Just now";
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: DISPLAY_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
  return `${dateLabelFor(date)} · ${time}`;
}

export function addDemoMedia(inputs: DemoMediaInput[], defaultSource: DemoMediaSource): DemoMediaItem[] {
  const currentStore = store();

  return inputs.map((input) => {
    const source = input.source ?? defaultSource;
    const mediaType = input.mediaType ?? input.type ?? (source === "auri" ? "clip" : "photo");
    const id = input.id || nextId(source === "auri" ? "auri_media" : "phone_media", "__auriDemoMediaCounter");
    const capturedAt = input.capturedAt || new Date().toISOString();
    const item: DemoMediaItem = {
      id,
      title: input.title || (source === "auri" ? "New Auri Robot clip" : "New phone photo"),
      source,
      sourceType: input.sourceType || source,
      mediaType: toMediaType(mediaType),
      url: input.url || `/demo-media/${id}`,
      thumbnailUrl: input.thumbnailUrl,
      capturedAt,
      durationSeconds: input.durationSeconds,
      person: toPersonId(input.person),
      body: input.body || (source === "auri" ? "Captured by Auri Robot." : "Uploaded from phone media."),
      tags: Array.isArray(input.tags) ? input.tags : [],
      metadata: input.metadata ?? {},
      createdAt: new Date().toISOString(),
    };
    currentStore.__auriDemoMedia?.push(item);
    return item;
  });
}

export function createDemoMemoryFromMedia(
  mediaItems: DemoMediaItem[],
  options?: DemoMemoryOptions
) {
  if (!mediaItems.length) return undefined;

  const first = mediaItems[0];
  const hasAuri = mediaItems.some((item) => item.source === "auri");
  const hasPhone = mediaItems.some((item) => item.source === "phone");
  const sourceType: SourceType = hasAuri && hasPhone ? "photos" : first.sourceType;
  const memoryId = nextId("memory", "__auriDemoMemoryCounter");
  const firstMediaMetadata = first.metadata ?? {};
  const memory: DemoMemoryItem = {
    id: memoryId,
    title: options?.title || first.title,
    body: options?.body || first.body,
    sourceLabel: hasAuri && hasPhone ? "Phone + Auri" : sourceLabel(first.source),
    sourceType,
    timeLabel: timeLabel(first.capturedAt),
    person: first.person,
    status: options?.status || "ready",
    statusLabel: options?.statusLabel || "Ready",
    mediaIds: mediaItems.map((item) => item.id),
    createdAt: new Date().toISOString(),
    // [id] in /memory/[id] is the memory id; the detail page joins mediaIds.
    targetRoute: `/memory/${memoryId}`,
    metadata: {
      ...firstMediaMetadata,
      mediaCount: mediaItems.length,
      sources: [...new Set(mediaItems.map((item) => item.source))],
      ...options?.metadata,
    },
  };

  store().__auriDemoMemory?.push(memory);
  return memory;
}

export function listDemoMedia() {
  return [...(store().__auriDemoMedia ?? [])];
}

function memoryFromObject(object: StoredObject): DemoMemoryItem | undefined {
  if (!["memory_item", "story_draft", "lesson_recap"].includes(object.type)) return undefined;

  const payload = object.payload;
  const title = typeof payload.title === "string" ? payload.title : object.type === "story_draft" ? "Story draft" : "Saved family memory";
  const body =
    typeof payload.summary === "string"
      ? payload.summary
      : object.type === "story_draft"
        ? "A local story draft is ready to review."
        : "Saved from Auri chat.";

  return {
    id: object.id,
    title,
    body,
    sourceLabel: object.type === "lesson_recap" ? "Milo" : object.type === "story_draft" ? "Mira" : "Chat",
    sourceType: object.type === "lesson_recap" ? "external" : "reading",
    timeLabel: timeLabel(object.createdAt),
    person: toPersonId(payload.person || payload.child),
    status: object.status === "saved" ? "saved" : object.status === "ready" ? "ready" : "draft",
    statusLabel: object.status === "ready" ? "Ready" : object.status === "saved" ? "Saved" : "Draft",
    mediaIds: [],
    createdAt: object.createdAt,
    targetRoute: object.route,
    metadata: { objectType: object.type, ...payload },
  };
}

export function listDemoMemory() {
  const fixtureMemory: DemoMemoryItem[] = moments.map((moment) => ({
    id: moment.id,
    title: moment.title,
    body: moment.body,
    sourceLabel: moment.sourceLabel,
    sourceType: moment.sourceType,
    timeLabel: moment.timeLabel,
    person: moment.person,
    status: moment.status,
    statusLabel: moment.statusLabel,
    mediaIds: [],
    createdAt: new Date().toISOString(),
    targetRoute: `/memory/${moment.id}`,
    metadata: { fixture: true, icon: moment.icon, imageTone: moment.imageTone },
  }));

  const objectMemory = listDemoObjects().map(memoryFromObject).filter((item): item is DemoMemoryItem => Boolean(item));

  return [...(store().__auriDemoMemory ?? []), ...objectMemory, ...fixtureMemory];
}
