import { randomUUID } from "node:crypto";
import { CreatedLocalObject, ObjectToCreate } from "@/lib/chat-server/types";
import {
  CalendarApiEvent,
  CalendarEventInput,
  CalendarRawOutputStatus,
  CalendarRobotCaptureStatus,
  deriveCalendarEventIcon,
} from "@/lib/calendar-api";
import { moments } from "@/lib/mock-data";
import { PersonId, SourceType, Status } from "@/lib/types";
import { persistStore, registerStore } from "./persistence";

type StoredObject = CreatedLocalObject & { payload: Record<string, unknown>; createdAt: string };
type DemoObjectAction = "add" | "save" | "send" | "log" | "complete";
type DemoMediaSource = "phone" | "auri";
type DemoMediaType = "photo" | "video" | "clip";

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

export function createDemoObjects(objectsToCreate: ObjectToCreate[]): CreatedLocalObject[] {
  const currentStore = store();

  return objectsToCreate.map((object) => {
    currentStore.__auriDemoCounter = (currentStore.__auriDemoCounter ?? 0) + 1;
    const id = `${object.type}_${currentStore.__auriDemoCounter.toString().padStart(4, "0")}`;
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
      const person = toPersonId(typeof p.person === "string" ? p.person : "family");
      const dateLabel = typeof p.dateLabel === "string" && p.dateLabel ? p.dateLabel : "Today";
      const timeLabel = typeof p.timeLabel === "string" && p.timeLabel ? p.timeLabel : "now";
      const note = typeof p.note === "string" ? p.note : typeof p.body === "string" ? p.body : undefined;
      upsertDemoCalendarEvent({ title, person, dateLabel, timeLabel, note, forRobot: true });
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
  const event: CalendarApiEvent = {
    ...existing,
    id: nextCalendarId(input.id),
    title: input.title,
    note: input.note,
    body: input.body ?? input.note,
    person: input.person,
    dateLabel: input.dateLabel,
    timeLabel: input.timeLabel,
    icon: existing?.icon ?? deriveCalendarEventIcon(input.title, input.person),
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
  startedAt?: string;
  uploadedAt?: string;
  failedAt?: string;
  error?: string;
  rawOutputStatus?: CalendarRawOutputStatus;
  rawOutputMemoryId?: string;
  rawOutputVideoUrl?: string;
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
    rawOutputStatus: rawOutputStatusFor(input, event.robot),
    rawOutputMemoryId: input.rawOutputMemoryId ?? event.robot?.rawOutputMemoryId,
    rawOutputVideoUrl: input.rawOutputVideoUrl ?? event.robot?.rawOutputVideoUrl,
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

function toMediaType(value: unknown): DemoMediaType {
  const type = String(value || "photo");
  if (type === "video" || type === "clip") return type;
  return "photo";
}

function sourceLabel(source: DemoMediaSource) {
  return source === "auri" ? "Auri Robot" : "Phone";
}

function timeLabel(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Just now";
  return `Today · ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
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
  options?: { title?: string; body?: string; status?: Status; statusLabel?: string }
) {
  if (!mediaItems.length) return undefined;

  const first = mediaItems[0];
  const hasAuri = mediaItems.some((item) => item.source === "auri");
  const hasPhone = mediaItems.some((item) => item.source === "phone");
  const sourceType: SourceType = hasAuri && hasPhone ? "photos" : first.sourceType;
  const memoryId = nextId("memory", "__auriDemoMemoryCounter");
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
      mediaCount: mediaItems.length,
      sources: [...new Set(mediaItems.map((item) => item.source))],
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
