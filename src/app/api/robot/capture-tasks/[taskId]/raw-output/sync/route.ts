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
