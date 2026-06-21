# HomeAgent Backend Raw Output Poller Implementation Plan

> **2026-06-21 decision note:** This plan is not the current implementation
> path. The current demo keeps the idempotent task-scoped endpoint
> `POST /api/robot/capture-tasks/{taskId}/raw-output/sync` and lets
> `RobotEventContext` find pending robot tasks and call it. A batch
> `/api/robot/raw-output/poll` endpoint is future-only, useful when polling
> coordination moves out of the browser into cron or a server-owned scheduler.
> If it is added later, first reuse the shared one-task sync helper instead of
> duplicating ingestion logic.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make HomeAgent backend, not the browser UI, poll Auri Editor raw-output artifacts for DockKit robot capture tasks and publish the resulting raw video plus transcripts into Memory.

**Architecture:** Keep PR #309 UI as a presentation layer over calendar/capture state. DockKit reports `auriVideoId` through `POST /api/robot/capture-tasks/{taskId}/status`; a backend poll route scans pending raw transcript robot tasks, reuses the existing one-task raw-output sync logic, and Vercel Cron invokes that route on a fixed cadence. The HomeAgent browser only refreshes task state and renders completed Memory results.

**Tech Stack:** Next.js App Router route handlers, TypeScript, Vercel Cron via `vercel.json`, existing `AuriClient`, existing demo persistence/media stores, existing smoke test script after `next build`.

---

## Review Summary

The integration statement is correct with one adjustment: steps 1-5 are already mostly present on current DockKit and HomeAgent branches, but step 6 is still UI-triggered. Current `RobotEventContext.tsx` calls `/api/robot/capture-tasks/{taskId}/raw-output/sync` from a client `useEffect`, so raw-output sync only advances while the HomeAgent UI is open. To satisfy `KILLER_DEMO_SPEC.md`, backend polling must own that advancement.

Do not rework DockKit's Story/Vlog pipeline. Do not route raw transcript mode through `HomeAgentMemorySender`; that sender remains for Story/Vlog multipart Memory ingest only.

## File Structure

- Create `src/lib/robot/raw-output-sync.ts`
  - Owns the reusable server-side implementation for one capture task sync.
  - Does not read HTTP request state and does not return `NextResponse`.
  - Persists calendar/media/memory updates.
- Modify `src/app/api/robot/capture-tasks/[taskId]/raw-output/sync/route.ts`
  - Thin wrapper around `syncRawOutputForTask(taskId)`.
  - Keeps the manual/debug endpoint working.
- Create `src/app/api/robot/raw-output/poll/route.ts`
  - Backend poll endpoint for Vercel Cron.
  - Scans pending/processing robot tasks and calls `syncRawOutputForTask`.
  - Supports `GET` for Vercel Cron and `POST` for local smoke/manual invocation.
- Modify `src/components/RobotEventContext.tsx`
  - Remove the client-side raw-output sync trigger.
  - Keep 5-second refresh from `/api/calendar?source=created` so the UI updates after backend poller progress.
- Modify `vercel.json`
  - Add a cron entry that invokes `/api/robot/raw-output/poll`.
- Modify `scripts/smoke-calendar-api.mjs`
  - Test backend poll route instead of browser-driven sync.
- Modify docs
  - Update `docs/KILLER_DEMO_SPEC.md` status rows and raw-output section.
  - Update `docs/DOCKIT_MEMORY_INTEGRATION.md` with the backend poll ownership boundary.

---

### Task 1: Extract One-Task Raw-Output Sync Into A Server Helper

**Files:**
- Create: `src/lib/robot/raw-output-sync.ts`
- Modify: `src/app/api/robot/capture-tasks/[taskId]/raw-output/sync/route.ts`

- [ ] **Step 1: Create the helper file**

Create `src/lib/robot/raw-output-sync.ts`:

```ts
import { AuriClient, AuriError, type RawOutputStatusResponse } from "@/lib/auri/client";
import {
  addDemoMedia,
  createDemoMemoryFromMedia,
  getDemoCalendarEvent,
  persistDemoStore,
  updateDemoCalendarRobotStatus,
  type DemoMediaInput,
  type DemoMediaItem,
  type DemoMemoryItem,
} from "@/lib/demo/demo-store";
import { storeBinaryFile } from "@/lib/demo/media-storage";
import type { CalendarApiEvent } from "@/lib/calendar-api";

export type RawOutputSyncOutcome = "already_synced" | "pending" | "ready" | "failed" | "not_found" | "missing_video_id";

export interface RawOutputSyncResult {
  outcome: RawOutputSyncOutcome;
  httpStatus: number;
  event?: CalendarApiEvent;
  media?: DemoMediaItem[];
  memory?: DemoMemoryItem;
  rawOutput?: RawOutputStatusResponse;
  error?: string;
  detail?: string;
  metadata?: Record<string, unknown>;
}

function statusCodeFor(error: unknown) {
  if (error instanceof AuriError && error.status >= 400 && error.status < 600) return error.status;
  return 502;
}

export async function syncRawOutputForTask(taskId: string, client = new AuriClient()): Promise<RawOutputSyncResult> {
  const event = getDemoCalendarEvent(taskId);
  if (!event || !event.forRobot) {
    return { outcome: "not_found", httpStatus: 404, error: "Robot capture task not found" };
  }

  const robot = event.robot;
  const videoId = robot?.auriVideoId;
  if (!videoId) {
    return { outcome: "missing_video_id", httpStatus: 409, event, error: "Capture task has no Auri video id" };
  }

  if (robot?.rawOutputMemoryId && robot.rawOutputVideoUrl) {
    return {
      outcome: "already_synced",
      httpStatus: 200,
      event,
      media: [],
      metadata: { provider: "local-demo-store", alreadySynced: true },
    };
  }

  try {
    const rawOutput = await client.fetchRawOutputStatus(videoId);
    if (rawOutput.status === "failed") {
      const updated = updateDemoCalendarRobotStatus(event.id, {
        status: "failed",
        rawOutputStatus: "failed",
        rawOutputError: typeof rawOutput.error === "string" ? rawOutput.error : "Auri raw output failed",
      });
      await persistDemoStore();
      return { outcome: "failed", httpStatus: 502, event: updated, rawOutput };
    }

    if (rawOutput.status !== "ready") {
      const updated = updateDemoCalendarRobotStatus(event.id, {
        status: robot?.status ?? "uploaded",
        rawOutputStatus: rawOutput.status === "processing" ? "processing" : "pending",
        rawOutputSyncedAt: new Date().toISOString(),
      });
      await persistDemoStore();
      return { outcome: "pending", httpStatus: 202, event: updated, rawOutput };
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

    return {
      outcome: "ready",
      httpStatus: 200,
      event: updated,
      media,
      memory,
      rawOutput,
      metadata: { provider: "local-demo-store", storage: storedVideo.storage },
    };
  } catch (error) {
    const updated = updateDemoCalendarRobotStatus(event.id, {
      status: "failed",
      rawOutputStatus: "failed",
      rawOutputError: error instanceof Error ? error.message : "Unable to sync raw output",
    });
    await persistDemoStore();
    return {
      outcome: "failed",
      httpStatus: statusCodeFor(error),
      error: "Unable to sync raw output",
      detail: error instanceof Error ? error.message : String(error),
      event: updated,
    };
  }
}
```

- [ ] **Step 2: Replace route body with helper call**

Replace `src/app/api/robot/capture-tasks/[taskId]/raw-output/sync/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { syncRawOutputForTask } from "@/lib/robot/raw-output-sync";
import { ensureHydrated, reloadStore } from "@/lib/demo/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: { taskId: string } }) {
  await ensureHydrated();
  await reloadStore("demo");
  const { httpStatus, ...body } = await syncRawOutputForTask(params.taskId);
  return NextResponse.json(body, { status: httpStatus });
}
```

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 4: Commit**

```bash
git add src/lib/robot/raw-output-sync.ts 'src/app/api/robot/capture-tasks/[taskId]/raw-output/sync/route.ts'
git commit -m "extract robot raw output sync helper"
```

---

### Task 2: Add Backend Poll Route

**Files:**
- Create: `src/app/api/robot/raw-output/poll/route.ts`

- [ ] **Step 1: Create poll route**

Create `src/app/api/robot/raw-output/poll/route.ts`:

```ts
import { NextResponse } from "next/server";
import type { CalendarApiEvent } from "@/lib/calendar-api";
import { listDemoCalendarEvents } from "@/lib/demo/demo-store";
import { ensureHydrated, reloadStore } from "@/lib/demo/persistence";
import { syncRawOutputForTask } from "@/lib/robot/raw-output-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 5;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function shouldSyncRawOutput(event: CalendarApiEvent) {
  const robot = event.robot;
  if (!event.forRobot || !robot?.auriVideoId) return false;
  if (robot.recordingMode !== "story_tracking_raw_transcript") return false;
  if (robot.rawOutputVideoUrl || robot.rawOutputMemoryId) return false;
  if (event.status === "done" || event.status === "failed") return false;
  return robot.rawOutputStatus === "pending" || robot.rawOutputStatus === "processing";
}

function pollLimit(request: Request) {
  const url = new URL(request.url);
  const raw = Number(url.searchParams.get("limit") || process.env.ROBOT_RAW_OUTPUT_POLL_LIMIT || DEFAULT_LIMIT);
  if (!Number.isFinite(raw)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.floor(raw), 1), 20);
}

async function runPoll(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureHydrated();
  await reloadStore("demo");

  const candidates = listDemoCalendarEvents().filter(shouldSyncRawOutput);
  const selected = candidates.slice(0, pollLimit(request));
  const results = [];

  for (const event of selected) {
    const { httpStatus, ...body } = await syncRawOutputForTask(event.id);
    results.push({
      taskId: event.id,
      httpStatus,
      outcome: body.outcome,
      auriVideoId: body.event?.robot?.auriVideoId ?? event.robot?.auriVideoId,
      rawOutputStatus: body.event?.robot?.rawOutputStatus ?? event.robot?.rawOutputStatus,
      rawOutputMemoryId: body.event?.robot?.rawOutputMemoryId,
      error: body.error,
      detail: body.detail,
    });
  }

  return NextResponse.json({
    ok: true,
    scanned: candidates.length,
    attempted: selected.length,
    results,
  });
}

export function GET(request: Request) {
  return runPoll(request);
}

export function POST(request: Request) {
  return runPoll(request);
}
```

- [ ] **Step 2: Run build**

Run:

```bash
npm run build
```

Expected: build passes and route list includes `/api/robot/raw-output/poll`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/robot/raw-output/poll/route.ts
git commit -m "add robot raw output backend poll route"
```

---

### Task 3: Move Poll Ownership Out Of The UI

**Files:**
- Modify: `src/components/RobotEventContext.tsx`

- [ ] **Step 1: Remove sync-in-progress ref**

Delete:

```ts
const syncingTasks = useRef<Set<string>>(new Set());
```

- [ ] **Step 2: Remove client-side raw-output sync effect**

Delete the `useEffect` that filters pending raw-output candidates and calls:

```ts
fetch(`/api/robot/capture-tasks/${encodeURIComponent(event.id)}/raw-output/sync`, { method: "POST" })
```

Keep the existing refresh interval:

```ts
useEffect(() => {
  if (!ready) return;
  const interval = setInterval(() => {
    void refreshCreatedEvents();
  }, 5000);
  return () => clearInterval(interval);
}, [ready, refreshCreatedEvents]);
```

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: build passes. The UI still refreshes created events but no longer owns raw-output sync.

- [ ] **Step 4: Commit**

```bash
git add src/components/RobotEventContext.tsx
git commit -m "stop browser-owned raw output sync"
```

---

### Task 4: Wire Vercel Cron

**Files:**
- Modify: `vercel.json`
- Optional docs/env note: `docs/DEPLOY.md`

Reference: Vercel Cron invokes the configured `path` with an HTTP `GET` request from production, and `vercel.json` supports a `crons` array with `path` and `schedule`. Vercel documents that Hobby plans are limited to once-daily cron, so the once-per-minute demo schedule requires a plan/scope that supports higher frequency or an external scheduler.

- [ ] **Step 1: Add cron config**

Replace `vercel.json` with:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "crons": [
    {
      "path": "/api/robot/raw-output/poll",
      "schedule": "*/1 * * * *"
    }
  ]
}
```

This requires a Vercel plan/scope that permits once-per-minute cron. If deployment rejects the schedule because the project is on a Hobby plan, use a production-safe external scheduler that sends `GET https://homeagentapp.onrender.com/api/robot/raw-output/poll` with `Authorization: Bearer $CRON_SECRET`, or move the Vercel schedule to the highest cadence the plan supports for non-demo environments.

- [ ] **Step 2: Document cron secret**

Append to `docs/DEPLOY.md`:

```md
## Robot raw-output poller

The killer demo requires backend-owned raw-output polling. Configure:

- `AURI_HOST=https://auriedit.onrender.com`
- `AURI_APP_ID=<HomeAgent Auri app id>`
- `AURI_AUTH_TOKEN=<if required by deployed Auri Editor>`
- `CRON_SECRET=<random 16+ character secret>`

Vercel Cron calls `GET /api/robot/raw-output/poll`. When `CRON_SECRET` is set, the route requires `Authorization: Bearer $CRON_SECRET`.
```

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 4: Commit**

```bash
git add vercel.json docs/DEPLOY.md
git commit -m "wire robot raw output cron"
```

---

### Task 5: Update Smoke Coverage For Backend Polling

**Files:**
- Modify: `scripts/smoke-calendar-api.mjs`

- [ ] **Step 1: Load the poll route**

After loading the status route, add:

```js
const rawOutputPollRoute = routeUserland("api/robot/raw-output/poll");
```

- [ ] **Step 2: Use poll route inside fake Auri server**

Replace the direct `rawOutputSyncRoute` invocation with:

```js
const rawOutputPollResponse = await rawOutputPollRoute.GET(new Request("http://localhost/api/robot/raw-output/poll?limit=5"));
const rawOutputPollPayload = await jsonFromResponse(rawOutputPollResponse);
assert(rawOutputPollResponse.status === 200, "raw output poll: expected 200", {
  status: rawOutputPollResponse.status,
  payload: rawOutputPollPayload,
});
assert(rawOutputPollPayload.attempted >= 1, "raw output poll: expected at least one attempted task", rawOutputPollPayload);
assert(
  rawOutputPollPayload.results.some((item) => item.taskId === createPayload.event.id && item.outcome === "ready"),
  "raw output poll: expected ready sync result for created robot event",
  rawOutputPollPayload.results
);
```

- [ ] **Step 3: Keep persisted result assertions**

Keep the existing assertions that verify:

```js
assert(rawOutputSyncPayload.event?.robot?.rawOutputStatus === "ready", "raw output sync: expected ready state", rawOutputSyncPayload.event);
assert(rawOutputSyncPayload.event?.robot?.rawOutputVideoUrl, "raw output sync: expected stored video URL", rawOutputSyncPayload.event);
assert(rawOutputSyncPayload.event?.robot?.transcriptJsonUrl, "raw output sync: expected JSON transcript URL", rawOutputSyncPayload.event);
assert(rawOutputSyncPayload.event?.robot?.transcriptTxtUrl, "raw output sync: expected text transcript URL", rawOutputSyncPayload.event);
assert(rawOutputSyncPayload.memory?.id, "raw output sync: expected memory", rawOutputSyncPayload);
```

Update variable names so they read from a fresh calendar lookup after the poll:

```js
const afterPollResponse = await calendarRoute.GET(new Request("http://localhost/api/calendar?robot=true"));
const afterPollPayload = await jsonFromResponse(afterPollResponse);
const syncedRobotTask = afterPollPayload.items.find((item) => item.id === createPayload.event.id);
assert(syncedRobotTask?.robot?.rawOutputStatus === "ready", "raw output poll: expected ready state", syncedRobotTask);
assert(syncedRobotTask?.robot?.rawOutputVideoUrl, "raw output poll: expected stored video URL", syncedRobotTask);
assert(syncedRobotTask?.robot?.transcriptJsonUrl, "raw output poll: expected JSON transcript URL", syncedRobotTask);
assert(syncedRobotTask?.robot?.transcriptTxtUrl, "raw output poll: expected text transcript URL", syncedRobotTask);
```

- [ ] **Step 4: Run smoke**

Run:

```bash
npm run build
npm run smoke:calendar
```

Expected: build passes and smoke prints `{ "ok": true, ... }`.

- [ ] **Step 5: Commit**

```bash
git add scripts/smoke-calendar-api.mjs
git commit -m "test backend raw output poller"
```

---

### Task 6: Update Demo Spec And Integration Docs

**Files:**
- Modify: `docs/KILLER_DEMO_SPEC.md`
- Modify: `docs/DOCKIT_MEMORY_INTEGRATION.md`

- [ ] **Step 1: Update `KILLER_DEMO_SPEC.md` status table**

Change the relevant rows to reflect current ownership:

```md
| ② DockKit fetches schedule | Home Agent exposes API · DockKit consumes | ✅ Home Agent exposes `GET /api/calendar?robot=true`; DockKit polls it through `HomeAgentRobotClient`. |
| ③ auto-start at event time | DockKit (iOS) | ✅ DockKit maps due HomeAgent tasks into the #309 reminder UI and starts Story Tracking Raw Recording Mode after countdown. |
| ④ upload raw video → Auri | DockKit · Auri | ✅ DockKit uploads live chunks and requests Auri raw-output artifacts; it reports canonical `auriVideoId` to HomeAgent. |
| ⑤ Auri → Home Agent ingest + store | Auri · Home Agent | ✅ HomeAgent backend poller fetches raw-output video plus transcripts by `auriVideoId`, stores artifacts, and links Memory to the task. |
```

- [ ] **Step 2: Clarify raw-output boundary**

Add:

```md
For Raw + Transcript mode, HomeAgent backend polling is the owner of Auri artifact ingestion. Browser UI refreshes display state only; it does not create raw-output jobs and does not own polling.
```

- [ ] **Step 3: Update DockKit Memory doc**

In `docs/DOCKIT_MEMORY_INTEGRATION.md`, add:

```md
## Raw + Transcript mode

Story/Vlog Memory delivery still uses `POST /api/ingest/auri-media`.

Story Tracking Raw + Transcript does not use multipart Story ingest. DockKit reports the canonical Auri video id to `POST /api/robot/capture-tasks/{taskId}/status` with `recordingMode=story_tracking_raw_transcript`. HomeAgent backend polling then downloads `/v1/videos/{video_id}/raw-output` artifacts and creates the Memory record.
```

- [ ] **Step 4: Commit**

```bash
git add docs/KILLER_DEMO_SPEC.md docs/DOCKIT_MEMORY_INTEGRATION.md
git commit -m "document robot raw output poll ownership"
```

---

### Task 7: Final Verification

**Files:** no code changes unless verification exposes a bug.

- [ ] **Step 1: Run HomeAgent verification**

```bash
npm run build
npm run smoke:calendar
```

Expected:
- `npm run build` passes.
- `npm run smoke:calendar` prints `{ "ok": true, ... }`.

- [ ] **Step 2: Run live route shape check after deployment**

```bash
curl -fsS -D - https://homeagentapp.onrender.com/api/robot/raw-output/poll -o /tmp/homeagent-raw-poll.json
cat /tmp/homeagent-raw-poll.json
```

Expected:
- `200` when no `CRON_SECRET` is configured, or `401` when `CRON_SECRET` is configured and no Authorization header is supplied.
- With a valid cron header, response JSON includes `ok`, `scanned`, `attempted`, and `results`.

- [ ] **Step 3: Confirm DockKit still builds**

From `/Users/liang/dev/auri/DockkitDemo`:

```bash
swift test --filter HomeAgentRobotClientTests
xcodebuild -workspace DockKitCamera.xcworkspace -scheme DockKitCamera -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

Expected:
- HomeAgent client tests pass.
- Xcode build succeeds.

- [ ] **Step 4: Confirm Auri raw-output tests still pass**

From `/Users/liang/dev/auri/auri-editor-main`:

```bash
./.venv/bin/python -m pytest tests/story/test_raw_output_api.py tests/workers/test_raw_output_worker.py -q
```

Expected: 5 tests pass.

---

## Spec Coverage Checklist

- #309 UI remains presentation layer: Task 3 keeps UI refresh but removes sync ownership.
- Hardcoded demo state remains fallback only: already covered by current DockKit; no HomeAgent backend changes needed.
- `camera.toggleRecording()` is not used for raw mode: already covered by current DockKit `startHomeAgentRawRecording` and `stopHomeAgentRawRecording`.
- DockKit reports real video id and raw transcript recording mode: already covered by current DockKit `HomeAgentRobotClient`.
- `HomeAgentMemorySender` is not used for raw mode: preserved by this plan.
- HomeAgent backend owns raw-output sync: Tasks 1, 2, 4, and 5 implement and verify this.
- Memory/Journey renders result: existing Memory creation remains in helper; smoke verifies stored artifact fields.
