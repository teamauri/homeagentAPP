import { CreatedLocalObject, ObjectToCreate } from "@/lib/chat-server/types";
import { moments } from "@/lib/mock-data";
import { PersonId, SourceType, Status } from "@/lib/types";

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
  __auriDemoCounter?: number;
  __auriDemoMediaCounter?: number;
  __auriDemoMemoryCounter?: number;
};

function store() {
  globalStore.__auriDemoObjects ??= [];
  globalStore.__auriDemoMedia ??= [];
  globalStore.__auriDemoMemory ??= [];
  globalStore.__auriDemoCounter ??= 0;
  globalStore.__auriDemoMediaCounter ??= 0;
  globalStore.__auriDemoMemoryCounter ??= 0;
  return globalStore;
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

function nextId(prefix: string, key: "__auriDemoMediaCounter" | "__auriDemoMemoryCounter") {
  const currentStore = store();
  const counter = (currentStore[key] ?? 0) + 1;
  currentStore[key] = counter;
  return `${prefix}_${counter.toString().padStart(4, "0")}`;
}

function toPersonId(value: unknown): PersonId {
  const person = String(value || "family");
  if (["sophie", "leo", "baby", "mom", "dad", "grandma", "family"].includes(person)) return person as PersonId;
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
