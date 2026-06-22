import { AuriClient, AuriError, type RawOutputStatusResponse } from "@/lib/auri/client";
import type { CalendarApiEvent } from "@/lib/calendar-api";
import {
  addDemoMedia,
  getDemoCalendarEvent,
  persistDemoStore,
  updateDemoCalendarRobotStatus,
  type DemoMediaInput,
  type DemoMediaItem,
} from "@/lib/demo/demo-store";
import { storeBinaryFile } from "@/lib/demo/media-storage";

export type RawOutputSyncOutcome = "already_synced" | "pending" | "ready" | "failed" | "not_found" | "missing_video_id";

export interface RawOutputSyncResult {
  outcome: RawOutputSyncOutcome;
  httpStatus: number;
  event?: CalendarApiEvent;
  media?: DemoMediaItem[];
  rawOutput?: RawOutputStatusResponse;
  error?: string;
  detail?: string;
  metadata?: Record<string, unknown>;
}

const rawOutputSyncLocks = new Map<string, Promise<RawOutputSyncResult>>();

function statusCodeFor(error: unknown) {
  if (error instanceof AuriError && error.status >= 400 && error.status < 600) return error.status;
  return 502;
}

function isRetryableRawOutputLookupError(error: unknown) {
  return error instanceof AuriError && (error.status === 404 || error.status === 409);
}

export async function syncRawOutputForTask(taskId: string, client = new AuriClient()): Promise<RawOutputSyncResult> {
  const existingSync = rawOutputSyncLocks.get(taskId);
  if (existingSync) return existingSync;

  const sync = syncRawOutputForTaskUnlocked(taskId, client);
  rawOutputSyncLocks.set(taskId, sync);
  try {
    return await sync;
  } finally {
    if (rawOutputSyncLocks.get(taskId) === sync) {
      rawOutputSyncLocks.delete(taskId);
    }
  }
}

function alreadySyncedResult(event: CalendarApiEvent, rawOutput?: RawOutputStatusResponse): RawOutputSyncResult {
  return {
    outcome: "already_synced",
    httpStatus: 200,
    event,
    media: [],
    rawOutput,
    metadata: { provider: "local-demo-store", alreadySynced: true },
  };
}

async function syncRawOutputForTaskUnlocked(taskId: string, client: AuriClient): Promise<RawOutputSyncResult> {
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
    return alreadySyncedResult(event);
  }

  try {
    let rawOutput: RawOutputStatusResponse;
    try {
      rawOutput = await client.fetchRawOutputStatus(videoId);
    } catch (error) {
      if (!isRetryableRawOutputLookupError(error)) throw error;
      const updated = updateDemoCalendarRobotStatus(event.id, {
        status: robot?.status ?? "uploaded",
        rawOutputStatus: "pending",
        rawOutputSyncedAt: new Date().toISOString(),
      });
      await persistDemoStore();
      return {
        outcome: "pending",
        httpStatus: 202,
        event: updated,
        error: "Auri raw output is not ready yet",
        detail: error instanceof Error ? error.message : String(error),
        metadata: { retryable: true },
      };
    }

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

    const latestEvent = getDemoCalendarEvent(taskId);
    if (latestEvent?.robot?.rawOutputMemoryId && latestEvent.robot.rawOutputVideoUrl) {
      return alreadySyncedResult(latestEvent, rawOutput);
    }

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

    const now = new Date().toISOString();
    const updated = updateDemoCalendarRobotStatus(event.id, {
      status: "done",
      rawOutputStatus: "ready",
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
