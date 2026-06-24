import { AuriClient, AuriError } from "@/lib/auri/client";
import { ingestRenderedVlog } from "@/lib/auri/ingest";
import type { CalendarApiEvent } from "@/lib/calendar-api";
import {
  getDemoCalendarEvent,
  persistDemoStore,
  updateDemoCalendarRobotStatus,
  type DemoMediaItem,
} from "@/lib/demo/demo-store";

export type HighlightSyncOutcome = "already_synced" | "ready" | "pending" | "failed" | "not_found" | "not_cameraman" | "missing_ids";

export interface HighlightSyncResult {
  outcome: HighlightSyncOutcome;
  httpStatus: number;
  event?: CalendarApiEvent;
  media?: DemoMediaItem[];
  memoryId?: string;
  mediaUrl?: string;
  error?: string;
  detail?: string;
  metadata?: Record<string, unknown>;
}

const highlightSyncLocks = new Map<string, Promise<HighlightSyncResult>>();

function statusCodeFor(error: unknown) {
  if (error instanceof AuriError && error.status >= 400 && error.status < 600) return error.status;
  return 502;
}

function isRetryableHighlightLookupError(error: unknown) {
  return error instanceof AuriError && (error.status === 404 || error.status === 409 || error.status === 504);
}

function isCameramanEvent(event: CalendarApiEvent) {
  return event.recordingMode === "cameraman_highlight" || event.robot?.recordingMode === "cameraman_highlight";
}

function alreadySyncedResult(event: CalendarApiEvent): HighlightSyncResult {
  return {
    outcome: "already_synced",
    httpStatus: 200,
    event,
    media: [],
    memoryId: event.robot?.highlightMemoryId,
    mediaUrl: event.robot?.highlightVideoUrl,
    metadata: { provider: "local-demo-store", alreadySynced: true },
  };
}

async function resolveVlogIdForHighlight(event: CalendarApiEvent, videoId: string, client: AuriClient) {
  const storedVlogId = event.robot?.vlogId;
  if (storedVlogId) return { vlogId: storedVlogId, event, recovered: false };

  const vlogs = await client.listVlogs(videoId, { limit: 20 });
  const ready = vlogs.find((vlog) => vlog.status === "READY" && vlog.vlogId.trim());
  if (!ready) return { vlogId: undefined, event, recovered: false };

  const updated = updateDemoCalendarRobotStatus(event.id, {
    status: event.robot?.status ?? "uploaded",
    auriVideoId: videoId,
    auriClientVideoUuid: event.robot?.auriClientVideoUuid ?? event.auriClientVideoUuid,
    recordingMode: "cameraman_highlight",
    vlogId: ready.vlogId,
    durationSeconds: event.robot?.durationSeconds ?? ready.storyBudgetSeconds,
    startedAt: event.robot?.startedAt,
    uploadedAt: event.robot?.uploadedAt ?? new Date().toISOString(),
  });
  await persistDemoStore();

  return { vlogId: ready.vlogId, event: updated ?? event, recovered: true };
}

export async function syncHighlightForTask(taskId: string, client = new AuriClient()): Promise<HighlightSyncResult> {
  const existingSync = highlightSyncLocks.get(taskId);
  if (existingSync) return existingSync;

  const sync = syncHighlightForTaskUnlocked(taskId, client);
  highlightSyncLocks.set(taskId, sync);
  try {
    return await sync;
  } finally {
    if (highlightSyncLocks.get(taskId) === sync) {
      highlightSyncLocks.delete(taskId);
    }
  }
}

async function syncHighlightForTaskUnlocked(taskId: string, client: AuriClient): Promise<HighlightSyncResult> {
  const event = getDemoCalendarEvent(taskId);
  if (!event || !event.forRobot) {
    return { outcome: "not_found", httpStatus: 404, error: "Robot capture task not found" };
  }
  if (!isCameramanEvent(event)) {
    return { outcome: "not_cameraman", httpStatus: 409, event, error: "Capture task is not a cameraman highlight job" };
  }

  let robot = event.robot;
  const videoId = robot?.auriVideoId;
  if (!videoId) {
    return { outcome: "missing_ids", httpStatus: 409, event, error: "Capture task has no Auri video id" };
  }
  if (robot?.highlightMemoryId && robot.highlightVideoUrl) {
    return alreadySyncedResult(event);
  }

  try {
    const resolved = await resolveVlogIdForHighlight(event, videoId, client);
    const vlogId = resolved.vlogId;
    const syncEvent = resolved.event;
    robot = syncEvent.robot;
    if (!vlogId) {
      const updated = updateDemoCalendarRobotStatus(event.id, {
        status: robot?.status ?? "uploaded",
        highlightError: "Auri cameraman highlight is not ready yet",
        highlightSyncedAt: new Date().toISOString(),
      });
      await persistDemoStore();

      return {
        outcome: "pending",
        httpStatus: 202,
        event: updated ?? syncEvent,
        error: "Auri cameraman highlight is not ready yet",
        metadata: { provider: "local-demo-store", missingVlogId: true },
      };
    }

    const result = await ingestRenderedVlog({
      videoId,
      vlogId,
      durationSeconds: robot?.durationSeconds,
      title: syncEvent.title,
      person: syncEvent.person,
      body: "An Auri Cameraman highlight is ready.",
      tags: ["auri-cameraman", "highlight"],
      ingestMode: "auri-cameraman",
      metadata: {
        captureTaskId: syncEvent.id,
        recordingMode: robot?.recordingMode,
      },
      client,
    });

    const now = new Date().toISOString();
    const updated = updateDemoCalendarRobotStatus(syncEvent.id, {
      status: "done",
      highlightMemoryId: result.memoryId,
      highlightVideoUrl: result.mediaUrl,
      highlightSyncedAt: now,
      highlightError: "",
    });
    await persistDemoStore();

    return {
      outcome: "ready",
      httpStatus: 200,
      event: updated,
      media: result.media,
      memoryId: result.memoryId,
      mediaUrl: result.mediaUrl,
      metadata: { provider: "local-demo-store", recoveredVlogId: resolved.recovered },
    };
  } catch (error) {
    const retryable = isRetryableHighlightLookupError(error);
    const updated = updateDemoCalendarRobotStatus(event.id, {
      status: retryable ? (robot?.status ?? "uploaded") : "failed",
      highlightError: error instanceof Error ? error.message : "Unable to sync cameraman highlight",
      highlightSyncedAt: new Date().toISOString(),
    });
    await persistDemoStore();

    return {
      outcome: retryable ? "pending" : "failed",
      httpStatus: retryable ? 202 : statusCodeFor(error),
      error: retryable ? "Auri cameraman highlight is not ready yet" : "Unable to sync cameraman highlight",
      detail: error instanceof Error ? error.message : String(error),
      event: updated,
      metadata: { retryable },
    };
  }
}
