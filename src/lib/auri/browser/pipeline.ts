/**
 * Browser-side Auri Cut pipeline: preprocess in the page (ffmpeg.wasm) and drive
 * the auri-editor API directly (CORS is open). No home-agent server work — this
 * is the Vercel-friendly path. Result is the rendered ≤30s mp4 as a Blob, which
 * the caller hands to /api/ingest/auri-media to land as a Memory.
 */

import SparkMD5 from "spark-md5";
import { AuriClient, AuriError } from "../client";
import { chunkCount, extractChunk, extractClip, loadFFmpeg, mountInput, SEG_SECONDS } from "./ffmpeg-wasm";

// commit / clip-upload require a 32-char checksum_md5 (Pydantic min length).
function md5(bytes: Uint8Array): string {
  const buf =
    bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
      ? bytes.buffer
      : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return SparkMD5.ArrayBuffer.hash(buf as ArrayBuffer);
}

export type EditStage = "uploading" | "analyzing" | "rendering";
export type BrowserEditProgress = (p: { stage: EditStage; progress: number }) => void;
// The phone doesn't download the rendered mp4 — it returns the ids so the server
// fetches it from auri-editor and stores it (avoids a phone→Blob roundtrip).
export interface BrowserEditResult {
  videoId: string;
  vlogId: string;
  durationSeconds: number;
}

function probeDuration(file: Blob): Promise<number> {
  return new Promise((res) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); res(v.duration || 0); };
    v.onerror = () => res(0);
    v.src = URL.createObjectURL(file);
  });
}

async function createVlogWhenReady(client: AuriClient, videoId: string, attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await client.createVlog(videoId, { sourceMode: "uploaded_clips", renderProfile: "legacy_story_v1_fast" });
    } catch (e) {
      if (e instanceof AuriError && e.retryable && i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      throw e;
    }
  }
  throw new AuriError("timeline never became ready", 504, "TIMELINE_NOT_READY", true);
}

export async function editToShortInBrowser(file: File, onProgress?: BrowserEditProgress): Promise<BrowserEditResult> {
  const client = new AuriClient();

  onProgress?.({ stage: "uploading", progress: 0.02 });
  await loadFFmpeg();
  const duration = await probeDuration(file);
  const inputPath = await mountInput(file);
  const n = chunkCount(duration);

  const video = await client.createVideo({
    clientVideoUuid: crypto.randomUUID(),
    title: "Memory film",
    expectedChunks: n,
    chunkDurationTarget: 30,
    estimatedDurationSeconds: Math.round(duration) || undefined,
  });

  // Upload one chunk at a time (extract → upload → free; memory ≈ one chunk).
  for (let i = 0; i < n; i++) {
    const bytes = await extractChunk(inputPath, i);
    const segDur = Math.min(SEG_SECONDS, Math.max(1, Math.round(duration - i * SEG_SECONDS)));
    const prep = await client.prepareChunk(video.videoId, i, segDur, bytes.length);
    await client.uploadChunk(prep.uploadContract, bytes);
    await client.commitChunk(video.videoId, prep.chunkId, bytes.length, md5(bytes));
    onProgress?.({ stage: "uploading", progress: 0.05 + (0.3 * (i + 1)) / n });
  }

  await client.completeUpload(video.videoId);
  onProgress?.({ stage: "analyzing", progress: 0.4 });

  const vlog = await createVlogWhenReady(client, video.videoId);
  const planned = await client.waitForUploadContracts(video.videoId, vlog.vlogId);
  onProgress?.({ stage: "analyzing", progress: 0.5 });

  const contracts = planned.uploadContracts;
  for (let i = 0; i < contracts.length; i++) {
    const c = contracts[i];
    const clip = await extractClip(inputPath, c.startTimeOriginal, c.endTimeOriginal, String(c.segmentIndex));
    await client.uploadVlogClip(video.videoId, vlog.vlogId, c.segmentIndex, clip, md5(clip));
    onProgress?.({ stage: "analyzing", progress: 0.5 + (0.1 * (i + 1)) / contracts.length });
  }

  await client.completeVlogUpload(video.videoId, vlog.vlogId);
  onProgress?.({ stage: "rendering", progress: 0.62 });

  await client.renderVlog(video.videoId, vlog.vlogId);
  const done = await client.pollUntilVlogFinished(video.videoId, vlog.vlogId, (s) =>
    onProgress?.({ stage: "rendering", progress: Math.min(0.95, 0.62 + (s.progress ?? 0) * 0.33) }),
  );

  // The server downloads the rendered mp4 from auri-editor + stores it; the phone
  // just hands back the ids (no big download/upload on the phone).
  return { videoId: video.videoId, vlogId: done.vlogId, durationSeconds: Math.round(done.storyBudgetSeconds ?? 0) };
}
