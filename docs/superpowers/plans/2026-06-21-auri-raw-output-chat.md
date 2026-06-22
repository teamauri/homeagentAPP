# Auri Raw Output Chat Insertion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fetch an already-created Auri Editor raw-output video by `auriVideoId`, store it in Home Agent, and show the recorded video in the Home Agent chat for the originating robot capture task.

**Architecture:** DockKit reports `auriVideoId` through the existing Home Agent robot status callback. Home Agent only consumes Auri Editor raw-output APIs with `GET` and `HEAD`; it must not call `POST /v1/videos/{video_id}/raw-output`. A route-driven sync endpoint performs one poll/download attempt, persists ready artifacts through the demo media/memory store, updates the calendar capture task, and the existing chat stream renders the completed robot event after calendar refresh.

**Tech Stack:** Next.js route handlers, TypeScript, existing `AuriClient`, existing `demo-store`, existing `media-storage`, existing `RobotEventContext` and `ChatView`, script-based smoke tests after `next build`.

---

## File Structure

- Modify `src/lib/auri/client.ts`
  - Remove `createRawOutput(videoId)` because Home Agent must not create raw-output jobs.
  - Keep `fetchRawOutputStatus(videoId)`.
  - Add `headRawOutputVideo(videoId)` and `headRawOutputTranscript(videoId, format)`.
  - Keep `downloadRawOutputVideo(videoId)` and `downloadRawOutputTranscript(videoId, format)`.
- Modify `src/lib/demo/media-storage.ts`
  - Add `storeBinaryFile(bytes, fileName, mimeType)` so downloaded Auri artifacts can be stored without constructing multipart input.
  - Reuse the same local/Vercel Blob behavior as `storeUploadedFile`.
- Modify `src/lib/calendar-api.ts`
  - Extend `CalendarRobotCaptureState` with persisted raw-output artifact fields.
- Modify `src/lib/demo/demo-store.ts`
  - Extend `DemoRobotCaptureStatusInput` and `updateDemoCalendarRobotStatus` to store raw-output artifact fields.
  - Add `getDemoCalendarEvent(id)` for route handlers that need one task.
- Create `src/app/api/robot/capture-tasks/[taskId]/raw-output/sync/route.ts`
  - Performs one Home Agent sync attempt for an existing Auri raw-output job.
- Modify `src/components/RobotEventContext.tsx`
  - Preserve server-side robot metadata in `RobotEvent`.
  - Periodically refresh created calendar events.
  - Trigger sync attempts for raw-output tasks that are pending or processing.
  - Map ready raw-output video URLs into `RobotEvent.result`.
- Optionally modify `src/components/ChatView.tsx`
  - Only if the existing `RobotCompletionRow` copy needs a raw-recording-specific label. The first implementation can avoid touching this file because it already renders `event.result.videoUrl`.
- Modify `scripts/smoke-calendar-api.mjs`
  - Add a local fake Auri Editor HTTP server.
  - Exercise the status callback, raw-output sync route, persisted calendar artifact fields, and generated Memory.
- Modify docs:
  - `docs/KILLER_DEMO_SPEC.md`: mark the relevant Home Agent raw-output path as `video_id` consumer only.
  - `docs/DOCKIT_MEMORY_INTEGRATION.md`: state that raw-output mode does not use `POST /api/ingest/auri-media`.

---

### Task 1: Lock The Auri Raw-Output Client Contract

**Files:**
- Modify: `src/lib/auri/client.ts`
- Test: `scripts/smoke-calendar-api.mjs` in later tasks covers this through the route

- [ ] **Step 1: Remove Home Agent raw-output creation**

Delete this method from `AuriClient`:

```ts
async createRawOutput(videoId: string): Promise<RawOutputStatusResponse> {
  const data = await this.requestJSON<RawRawOutput>(
    "POST",
    this.v1(`/videos/${videoId}/raw-output`),
    {},
    `raw-output-${videoId}`,
  );
  return mapRawOutput(data, videoId);
}
```

Expected reason: Auri Editor or DockKit owns raw-output job creation. Home Agent only reads status and artifacts.

- [ ] **Step 2: Add reusable HEAD metadata type**

Add near `RawOutputStatusResponse`:

```ts
export interface AuriDownloadHeadResponse {
  contentType?: string;
  contentLength?: number;
}
```

- [ ] **Step 3: Add HEAD helpers**

Add inside `AuriClient`, directly before the raw-output download methods:

```ts
private async headDownload(fullUrl: string): Promise<AuriDownloadHeadResponse> {
  const res = await fetch(fullUrl, { method: "HEAD", headers: this.baseHeaders() });
  if (!res.ok) throw this.toError(res.status, await res.text());
  const length = Number(res.headers.get("content-length") || "");
  return {
    contentType: res.headers.get("content-type") || undefined,
    contentLength: Number.isFinite(length) ? length : undefined,
  };
}

async headRawOutputVideo(videoId: string): Promise<AuriDownloadHeadResponse> {
  return this.headDownload(this.v1(`/videos/${videoId}/raw-output/video/download`));
}

async headRawOutputTranscript(videoId: string, format: RawOutputTranscriptFormat): Promise<AuriDownloadHeadResponse> {
  return this.headDownload(this.v1(`/videos/${videoId}/raw-output/transcript/download`, { format }));
}
```

- [ ] **Step 4: Run type/build check**

Run:

```bash
npm run build
```

Expected: build passes and there is no route calling the removed `createRawOutput` method.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auri/client.ts
git commit -m "fix auri raw output client contract"
```

---

### Task 2: Add Binary Artifact Storage

**Files:**
- Modify: `src/lib/demo/media-storage.ts`
- Test: covered by `scripts/smoke-calendar-api.mjs` after the sync route downloads bytes

- [ ] **Step 1: Extract buffer storage helper**

In `src/lib/demo/media-storage.ts`, add:

```ts
async function storeBuffer(buffer: Buffer, fileName: string, mimeType: string): Promise<StoredFile> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    await put(`demo-media/${fileName}`, buffer, {
      access: "private",
      contentType: mimeType,
      addRandomSuffix: false,
    });
    return { url: `/api/media/blob/${fileName}`, fileName, mimeType, size: buffer.byteLength, storage: "blob" };
  }

  await mkdir(MEDIA_DIR, { recursive: true });
  await writeFile(path.join(MEDIA_DIR, fileName), buffer);
  return { url: `${PUBLIC_PREFIX}/${fileName}`, fileName, mimeType, size: buffer.byteLength, storage: "local" };
}
```

- [ ] **Step 2: Refactor uploaded file storage to reuse helper**

Replace the body after `buffer` and `mimeType` are computed in `storeUploadedFile` with:

```ts
return storeBuffer(buffer, fileName, mimeType);
```

- [ ] **Step 3: Add downloaded artifact storage function**

Add:

```ts
export async function storeBinaryFile(bytes: Uint8Array, originalName: string, mimeType: string): Promise<StoredFile> {
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "-") || `${randomUUID()}.bin`;
  const ext = path.extname(safeName);
  const fileName = ext ? `${randomUUID()}${ext}` : `${randomUUID()}.bin`;
  return storeBuffer(Buffer.from(bytes), fileName, mimeType || "application/octet-stream");
}
```

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/demo/media-storage.ts
git commit -m "add binary demo media storage"
```

---

### Task 3: Persist Raw-Output Artifact Fields On Capture Tasks

**Files:**
- Modify: `src/lib/calendar-api.ts`
- Modify: `src/lib/demo/demo-store.ts`
- Test: `scripts/smoke-calendar-api.mjs`

- [ ] **Step 1: Extend `CalendarRobotCaptureState`**

Add these optional fields:

```ts
rawOutputMemoryId?: string;
rawOutputVideoUrl?: string;
transcriptJsonUrl?: string;
transcriptTxtUrl?: string;
rawOutputReadyAt?: string;
rawOutputSyncedAt?: string;
rawOutputError?: string;
```

- [ ] **Step 2: Extend `DemoRobotCaptureStatusInput`**

Add the same optional fields to `DemoRobotCaptureStatusInput`:

```ts
rawOutputMemoryId?: string;
rawOutputVideoUrl?: string;
transcriptJsonUrl?: string;
transcriptTxtUrl?: string;
rawOutputReadyAt?: string;
rawOutputSyncedAt?: string;
rawOutputError?: string;
```

- [ ] **Step 3: Add calendar getter**

Add after `listDemoCalendarEvents()`:

```ts
export function getDemoCalendarEvent(id: string) {
  return store().__auriDemoCalendarEvents?.find((event) => event.id === id);
}
```

- [ ] **Step 4: Persist fields in `updateDemoCalendarRobotStatus`**

Inside the `event.robot = { ... }` object, add:

```ts
rawOutputMemoryId: input.rawOutputMemoryId ?? event.robot?.rawOutputMemoryId,
rawOutputVideoUrl: input.rawOutputVideoUrl ?? event.robot?.rawOutputVideoUrl,
transcriptJsonUrl: input.transcriptJsonUrl ?? event.robot?.transcriptJsonUrl,
transcriptTxtUrl: input.transcriptTxtUrl ?? event.robot?.transcriptTxtUrl,
rawOutputReadyAt: input.rawOutputReadyAt ?? event.robot?.rawOutputReadyAt,
rawOutputSyncedAt: input.rawOutputSyncedAt ?? event.robot?.rawOutputSyncedAt,
rawOutputError: input.rawOutputError ?? event.robot?.rawOutputError,
```

- [ ] **Step 5: Run build**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/calendar-api.ts src/lib/demo/demo-store.ts
git commit -m "store raw output artifact links"
```

---

### Task 4: Add One-Shot Raw-Output Sync Route

**Files:**
- Create: `src/app/api/robot/capture-tasks/[taskId]/raw-output/sync/route.ts`
- Modify: `src/lib/demo/demo-store.ts` only if an import export is missing
- Test: `scripts/smoke-calendar-api.mjs`

- [ ] **Step 1: Write failing smoke expectation**

In `scripts/smoke-calendar-api.mjs`, after the robot status callback assertions and before deleting the event, load the route:

```js
const rawOutputSyncRoute = routeUserland("api/robot/capture-tasks/[taskId]/raw-output/sync");
```

Then call it:

```js
const rawOutputSyncResponse = await postJsonWithParams(
  rawOutputSyncRoute,
  `http://localhost/api/robot/capture-tasks/${encodeURIComponent(createPayload.event.id)}/raw-output/sync`,
  {},
  { taskId: createPayload.event.id }
);
const rawOutputSyncPayload = await jsonFromResponse(rawOutputSyncResponse);
assert(rawOutputSyncResponse.status === 200, "raw output sync: expected 200", { status: rawOutputSyncResponse.status, payload: rawOutputSyncPayload });
assert(rawOutputSyncPayload.event?.robot?.rawOutputStatus === "ready", "raw output sync: expected ready state", rawOutputSyncPayload.event);
assert(rawOutputSyncPayload.event?.robot?.rawOutputVideoUrl, "raw output sync: expected stored video URL", rawOutputSyncPayload.event);
assert(rawOutputSyncPayload.memory?.id, "raw output sync: expected memory", rawOutputSyncPayload);
assert(rawOutputSyncPayload.media?.some((item) => item.mediaType === "video"), "raw output sync: expected video media", rawOutputSyncPayload.media);
```

- [ ] **Step 2: Run red check**

Run:

```bash
npm run build && npm run smoke:calendar
```

Expected: `smoke:calendar` fails with `Missing built route: api/robot/capture-tasks/[taskId]/raw-output/sync`.

- [ ] **Step 3: Create the route**

Create `src/app/api/robot/capture-tasks/[taskId]/raw-output/sync/route.ts`:

```ts
import { NextResponse } from "next/server";
import { AuriClient, AuriError } from "@/lib/auri/client";
import {
  addDemoMedia,
  createDemoMemoryFromMedia,
  getDemoCalendarEvent,
  persistDemoStore,
  updateDemoCalendarRobotStatus,
  type DemoMediaInput,
} from "@/lib/demo/demo-store";
import { storeBinaryFile } from "@/lib/demo/media-storage";
import { ensureHydrated, reloadStore } from "@/lib/demo/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function statusCodeFor(error: unknown) {
  if (error instanceof AuriError && error.status >= 400 && error.status < 600) return error.status;
  return 502;
}

export async function POST(_request: Request, { params }: { params: { taskId: string } }) {
  await ensureHydrated();
  await reloadStore("demo");

  const event = getDemoCalendarEvent(params.taskId);
  if (!event || !event.forRobot) return NextResponse.json({ error: "Robot capture task not found" }, { status: 404 });

  const robot = event.robot;
  const videoId = robot?.auriVideoId;
  if (!videoId) return NextResponse.json({ error: "Capture task has no Auri video id" }, { status: 409 });

  if (robot?.rawOutputMemoryId && robot.rawOutputVideoUrl) {
    return NextResponse.json({
      event,
      media: [],
      memory: undefined,
      metadata: { provider: "local-demo-store", alreadySynced: true },
    });
  }

  const client = new AuriClient();

  try {
    const rawOutput = await client.fetchRawOutputStatus(videoId);
    if (rawOutput.status === "failed") {
      const updated = updateDemoCalendarRobotStatus(event.id, {
        status: "failed",
        rawOutputStatus: "failed",
        rawOutputError: typeof rawOutput.error === "string" ? rawOutput.error : "Auri raw output failed",
      });
      await persistDemoStore();
      return NextResponse.json({ event: updated, rawOutput }, { status: 502 });
    }

    if (rawOutput.status !== "ready") {
      const updated = updateDemoCalendarRobotStatus(event.id, {
        status: robot?.status ?? "uploaded",
        rawOutputStatus: rawOutput.status === "processing" ? "processing" : "pending",
        rawOutputSyncedAt: new Date().toISOString(),
      });
      await persistDemoStore();
      return NextResponse.json({ event: updated, rawOutput }, { status: 202 });
    }

    const [videoHead, jsonHead, txtHead] = await Promise.all([
      client.headRawOutputVideo(videoId),
      client.headRawOutputTranscript(videoId, "json"),
      client.headRawOutputTranscript(videoId, "txt"),
    ]);
    const [videoBytes, transcriptJsonBytes, transcriptTxtBytes] = await Promise.all([
      client.downloadRawOutputVideo(videoId),
      client.downloadRawOutputTranscript(videoId, "json"),
      client.downloadRawOutputTranscript(videoId, "txt"),
    ]);

    const [storedVideo, storedTranscriptJson, storedTranscriptTxt] = await Promise.all([
      storeBinaryFile(videoBytes, `${videoId}-raw-output.mp4`, videoHead.contentType || "video/mp4"),
      storeBinaryFile(transcriptJsonBytes, `${videoId}-transcript.json`, jsonHead.contentType || "application/json"),
      storeBinaryFile(transcriptTxtBytes, `${videoId}-transcript.txt`, txtHead.contentType || "text/plain"),
    ]);

    const mediaInput: DemoMediaInput = {
      title: event.title,
      source: "auri",
      sourceType: "auri",
      mediaType: "video",
      url: storedVideo.url,
      capturedAt: robot?.startedAt || event.createdAt || new Date().toISOString(),
      person: event.person,
      body: "A raw Auri Robot recording is ready with transcript.",
      tags: ["auri-robot", "raw-output", "transcript"],
      metadata: {
        ingestMode: "auri-raw-output",
        captureTaskId: event.id,
        auriVideoId: videoId,
        recordingMode: robot?.recordingMode,
        transcriptJsonUrl: storedTranscriptJson.url,
        transcriptTxtUrl: storedTranscriptTxt.url,
        videoSize: storedVideo.size,
        transcriptJsonSize: storedTranscriptJson.size,
        transcriptTxtSize: storedTranscriptTxt.size,
      },
    };

    const media = addDemoMedia([mediaInput], "auri");
    const memory = createDemoMemoryFromMedia(media, {
      title: event.title,
      body: "A raw recording and transcript from Auri Robot are ready.",
      status: "ready",
      statusLabel: "Ready",
    });

    const now = new Date().toISOString();
    const updated = updateDemoCalendarRobotStatus(event.id, {
      status: "done",
      rawOutputStatus: "ready",
      rawOutputMemoryId: memory?.id,
      rawOutputVideoUrl: storedVideo.url,
      transcriptJsonUrl: storedTranscriptJson.url,
      transcriptTxtUrl: storedTranscriptTxt.url,
      rawOutputReadyAt: now,
      rawOutputSyncedAt: now,
    });
    await persistDemoStore();

    return NextResponse.json({
      event: updated,
      media,
      memory,
      rawOutput,
      metadata: { provider: "local-demo-store", storage: storedVideo.storage },
    });
  } catch (error) {
    const updated = updateDemoCalendarRobotStatus(event.id, {
      status: "failed",
      rawOutputStatus: "failed",
      rawOutputError: error instanceof Error ? error.message : "Unable to sync raw output",
    });
    await persistDemoStore();
    return NextResponse.json(
      { error: "Unable to sync raw output", detail: error instanceof Error ? error.message : String(error), event: updated },
      { status: statusCodeFor(error) }
    );
  }
}
```

- [ ] **Step 4: Commit route without faking Auri yet**

Do not commit until Task 5 is green, because this route needs a smoke fake server before it can pass.

---

### Task 5: Add Fake Auri Editor To Calendar Smoke Test

**Files:**
- Modify: `scripts/smoke-calendar-api.mjs`

- [ ] **Step 1: Add local HTTP server imports**

At the top:

```js
import http from "node:http";
```

- [ ] **Step 2: Add fake Auri server helper**

Add after `jsonFromResponse`:

```js
async function withFakeAuriServer(fn) {
  const videoBytes = Buffer.from("fake mp4 bytes");
  const transcriptJson = Buffer.from(JSON.stringify({ text: "Mia read the story." }));
  const transcriptTxt = Buffer.from("Mia read the story.");

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (req.method === "GET" && url.pathname === "/v1/videos/video-smoke-from-auri/raw-output") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ success: true, data: { video_id: "video-smoke-from-auri", status: "ready", progress: 1 } }));
      return;
    }

    if (url.pathname === "/v1/videos/video-smoke-from-auri/raw-output/video/download") {
      res.writeHead(200, { "content-type": "video/mp4", "content-length": String(videoBytes.length) });
      if (req.method === "HEAD") res.end();
      else res.end(videoBytes);
      return;
    }

    if (url.pathname === "/v1/videos/video-smoke-from-auri/raw-output/transcript/download" && url.searchParams.get("format") === "json") {
      res.writeHead(200, { "content-type": "application/json", "content-length": String(transcriptJson.length) });
      if (req.method === "HEAD") res.end();
      else res.end(transcriptJson);
      return;
    }

    if (url.pathname === "/v1/videos/video-smoke-from-auri/raw-output/transcript/download" && url.searchParams.get("format") === "txt") {
      res.writeHead(200, { "content-type": "text/plain", "content-length": String(transcriptTxt.length) });
      if (req.method === "HEAD") res.end();
      else res.end(transcriptTxt);
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const previousHost = process.env.AURI_HOST;
  process.env.AURI_HOST = `http://127.0.0.1:${address.port}`;
  try {
    return await fn();
  } finally {
    if (previousHost === undefined) delete process.env.AURI_HOST;
    else process.env.AURI_HOST = previousHost;
    await new Promise((resolve) => server.close(resolve));
  }
}
```

- [ ] **Step 3: Wrap sync assertions with fake Auri**

Wrap only the raw-output sync call from Task 4:

```js
await withFakeAuriServer(async () => {
  const rawOutputSyncRoute = routeUserland("api/robot/capture-tasks/[taskId]/raw-output/sync");
  const rawOutputSyncResponse = await postJsonWithParams(
    rawOutputSyncRoute,
    `http://localhost/api/robot/capture-tasks/${encodeURIComponent(createPayload.event.id)}/raw-output/sync`,
    {},
    { taskId: createPayload.event.id }
  );
  const rawOutputSyncPayload = await jsonFromResponse(rawOutputSyncResponse);
  assert(rawOutputSyncResponse.status === 200, "raw output sync: expected 200", { status: rawOutputSyncResponse.status, payload: rawOutputSyncPayload });
  assert(rawOutputSyncPayload.event?.robot?.rawOutputStatus === "ready", "raw output sync: expected ready state", rawOutputSyncPayload.event);
  assert(rawOutputSyncPayload.event?.robot?.rawOutputVideoUrl, "raw output sync: expected stored video URL", rawOutputSyncPayload.event);
  assert(rawOutputSyncPayload.event?.robot?.transcriptJsonUrl, "raw output sync: expected JSON transcript URL", rawOutputSyncPayload.event);
  assert(rawOutputSyncPayload.event?.robot?.transcriptTxtUrl, "raw output sync: expected text transcript URL", rawOutputSyncPayload.event);
  assert(rawOutputSyncPayload.memory?.id, "raw output sync: expected memory", rawOutputSyncPayload);
  assert(rawOutputSyncPayload.media?.some((item) => item.mediaType === "video"), "raw output sync: expected video media", rawOutputSyncPayload.media);
});
```

- [ ] **Step 4: Run smoke**

Run:

```bash
npm run build && npm run smoke:calendar
```

Expected: both pass.

- [ ] **Step 5: Commit route and smoke**

```bash
git add scripts/smoke-calendar-api.mjs 'src/app/api/robot/capture-tasks/[taskId]/raw-output/sync/route.ts'
git commit -m "sync raw output artifacts by video id"
```

---

### Task 6: Surface Raw Output In Robot Event Context And Chat

**Files:**
- Modify: `src/components/RobotEventContext.tsx`
- Test: `npm run build`; behavior covered manually and by route smoke

- [ ] **Step 1: Extend `RobotEventResult`**

Add optional fields:

```ts
memoryUrl?: string;
transcriptJsonUrl?: string;
transcriptTxtUrl?: string;
```

- [ ] **Step 2: Add robot metadata to `RobotEvent`**

Add:

```ts
robot?: CalendarApiEvent["robot"];
```

- [ ] **Step 3: Make API events become completed events when raw video exists**

Replace `eventFromApi` with:

```ts
function eventFromApi(event: CalendarApiEvent): RobotEvent {
  const rawVideoUrl = event.robot?.rawOutputVideoUrl;
  return {
    id: event.id,
    title: event.title,
    note: event.note ?? event.body,
    person: event.person,
    dateLabel: event.dateLabel,
    timeLabel: event.timeLabel,
    icon: event.icon,
    forRobot: event.forRobot,
    photoUrl: event.photoUrl,
    voiceUrl: event.voiceUrl,
    voiceDuration: event.voiceDuration,
    robot: event.robot,
    status: rawVideoUrl ? "done" : statusFromApi(event.status),
    completedAtLabel: event.robot?.rawOutputReadyAt ? nowLabelFromIso(event.robot.rawOutputReadyAt) : undefined,
    result: rawVideoUrl
      ? {
          videoUrl: rawVideoUrl,
          duration: "Recorded",
          memoryUrl: event.robot?.rawOutputMemoryId ? `/memory/${event.robot.rawOutputMemoryId}` : undefined,
          transcriptJsonUrl: event.robot?.transcriptJsonUrl,
          transcriptTxtUrl: event.robot?.transcriptTxtUrl,
        }
      : undefined,
  };
}
```

Add helper before `eventFromApi`:

```ts
function nowLabelFromIso(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return nowLabel();
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(date);
}
```

- [ ] **Step 4: Extract calendar refresh into a callback**

Inside `RobotEventProvider`, add:

```ts
const refreshCreatedEvents = useCallback(() => {
  return fetch("/api/calendar?source=created")
    .then((response) => (response.ok ? response.json() : null))
    .then((payload: { items?: CalendarApiEvent[] } | null) => {
      if (!Array.isArray(payload?.items)) return;
      const apiEvents = payload.items.map(eventFromApi);
      setEvents((current) => mergeEvents(current, apiEvents));
      completedCount.current = apiEvents.filter((event) => event.status === "done").length;
    })
    .catch(() => undefined);
}, []);
```

Replace the inline `fetch("/api/calendar?source=created")...` in the hydration effect with:

```ts
void refreshCreatedEvents();
```

- [ ] **Step 5: Add periodic refresh**

Add:

```ts
useEffect(() => {
  if (!ready) return;
  const interval = setInterval(() => {
    void refreshCreatedEvents();
  }, 5000);
  return () => clearInterval(interval);
}, [ready, refreshCreatedEvents]);
```

- [ ] **Step 6: Trigger route-driven raw-output sync**

Add:

```ts
useEffect(() => {
  if (!ready) return;
  const candidates = events.filter(
    (event) =>
      event.forRobot &&
      event.robot?.auriVideoId &&
      event.robot?.recordingMode === "story_tracking_raw_transcript" &&
      (event.robot.rawOutputStatus === "pending" || event.robot.rawOutputStatus === "processing") &&
      !event.robot.rawOutputVideoUrl
  );

  for (const event of candidates) {
    fetch(`/api/robot/capture-tasks/${encodeURIComponent(event.id)}/raw-output/sync`, { method: "POST" })
      .then(() => refreshCreatedEvents())
      .catch(() => undefined);
  }
}, [events, ready, refreshCreatedEvents]);
```

- [ ] **Step 7: Run build**

Run:

```bash
npm run build
```

Expected: build passes. Chat should insert the recorded video because `ChatView` already renders `completions` with `event.result.videoUrl`.

- [ ] **Step 8: Commit**

```bash
git add src/components/RobotEventContext.tsx
git commit -m "show raw output recordings in chat"
```

---

### Task 7: Correct The Docs

**Files:**
- Modify: `docs/KILLER_DEMO_SPEC.md`
- Modify: `docs/DOCKIT_MEMORY_INTEGRATION.md`

- [ ] **Step 1: Update Killer Demo spec**

Add a section:

```md
## Raw + Transcript Home Agent Path

For the Story Tracking `Raw + Transcript` mode, Home Agent does not create the
raw-output job and does not call Auri Story/Vlog APIs. DockKit reports the
canonical `auriVideoId` to Home Agent through the robot status callback. Home
Agent then polls existing Auri Editor raw-output state with:

- `GET /v1/videos/{video_id}/raw-output`
- `HEAD /v1/videos/{video_id}/raw-output/video/download`
- `GET /v1/videos/{video_id}/raw-output/video/download`
- `HEAD /v1/videos/{video_id}/raw-output/transcript/download?format=json|txt`
- `GET /v1/videos/{video_id}/raw-output/transcript/download?format=json|txt`

When the raw output is ready, Home Agent stores the video and transcripts,
creates a Memory, links it back to the capture task, and the chat renders the
recorded video from the completed robot event.
```

- [ ] **Step 2: Update DockKit memory integration doc**

Add a section:

```md
## Raw + Transcript Mode

The `Raw + Transcript` mode is not the existing Story/Vlog ingest path. Home
Agent does not receive a multipart Story upload for this mode. It receives only
the `auriVideoId` through the robot status callback, then downloads existing
raw-output artifacts from Auri Editor by `video_id`.
```

- [ ] **Step 3: Run docs grep**

Run:

```bash
rg -n "POST /v1/videos/.*/raw-output|createRawOutput|Raw \\+ Transcript|raw-output" docs src
```

Expected:
- No Home Agent plan/doc says Home Agent calls `POST /v1/videos/{video_id}/raw-output`.
- `createRawOutput` is absent from `src/lib/auri/client.ts`.

- [ ] **Step 4: Commit**

```bash
git add docs/KILLER_DEMO_SPEC.md docs/DOCKIT_MEMORY_INTEGRATION.md
git commit -m "document raw output pull path"
```

---

### Task 8: Final Verification

**Files:**
- No file changes expected

- [ ] **Step 1: Run final checks**

Run:

```bash
npm run build
npm run smoke:calendar
```

Expected: both pass.

- [ ] **Step 2: Check broader MVP smoke only as informational**

Run:

```bash
npm run smoke:mvp
```

Expected: if model keys are still missing, this may fail in the existing chat fallback path. Do not block this feature on that unrelated failure; record the exact failure in the PR.

- [ ] **Step 3: Review the diff**

Run:

```bash
git diff main...HEAD --stat
git diff main...HEAD -- src/lib/auri/client.ts src/app/api/robot src/components/RobotEventContext.tsx scripts/smoke-calendar-api.mjs docs
```

Expected:
- No `POST /v1/videos/{video_id}/raw-output` usage.
- Raw-output sync route calls only `fetchRawOutputStatus`, HEAD helpers, and download helpers.
- Chat insertion uses existing `RobotCompletionRow`.

- [ ] **Step 4: Push and update PR**

```bash
git push
```

Update the existing draft PR with:

```md
## Summary
- Consume existing Auri raw-output artifacts by `video_id`
- Store raw recording video/transcripts into Home Agent media and Memory
- Surface completed raw recordings in chat through robot event completions

## Test Plan
- `npm run build`
- `npm run smoke:calendar`
- `npm run smoke:mvp` informational: note any unrelated missing-key fallback failure
```

---

## Self-Review

- Spec coverage: The plan covers only Home Agent consumption of `GET` and `HEAD` raw-output APIs, status linkage by `auriVideoId`, local storage, Memory creation, and Chat insertion.
- Excluded by design: No Home Agent `POST /v1/videos/{video_id}/raw-output`; no `/vlogs`; no `POST /api/ingest/auri-media` for this mode.
- Type consistency: `CalendarRobotCaptureState`, `DemoRobotCaptureStatusInput`, route response, and `RobotEvent.result` use the same artifact field names.
