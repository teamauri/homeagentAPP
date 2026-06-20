/**
 * Editor abstraction for the Auri Cut pipeline.
 *
 * - AuriEditor: real backend (`source_mode="full_video"`) via client.ts + ffmpeg.
 * - LocalEditor: no-backend fallback — ffmpeg-trims the source to ≤30s so the
 *   whole feature works end-to-end in the demo today. Swap to AuriEditor by
 *   setting AURI_HOST (and unsetting AURI_MOCK). See MEMORY_AUTO_EDIT_DESIGN.md.
 */

import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { AuriClient, AuriError } from "./client";
import { extractClip, fileMd5, probeDurationSeconds, splitIntoSegments } from "./ffmpeg";

const execFileP = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const TARGET_SECONDS = 28; // keep ≤30 after keyframe overshoot

export type EditStage = "uploading" | "analyzing" | "rendering";
export type EditProgress = (p: { stage: EditStage; progress: number }) => void;
export interface EditResult {
  videoPath: string;
  durationSeconds: number;
}
export interface Editor {
  editToShort(sourcePath: string, workDir: string, onProgress?: EditProgress): Promise<EditResult>;
}

/**
 * Real Auri backend, `uploaded_clips` mode (the cloud backend rejects full_video):
 * split → upload chunks → compose → createVlog → wait for planner contracts →
 * extract+upload one HQ clip per contract → complete → render → download.
 */
export class AuriEditor implements Editor {
  constructor(private readonly client = new AuriClient()) {}

  async editToShort(sourcePath: string, workDir: string, onProgress?: EditProgress): Promise<EditResult> {
    onProgress?.({ stage: "uploading", progress: 0.05 });
    const segments = await splitIntoSegments(sourcePath, path.join(workDir, "segments"), TARGET_SECONDS);
    const totalDuration = await probeDurationSeconds(sourcePath);

    const video = await this.client.createVideo({
      clientVideoUuid: randomUUID(),
      title: "Memory film",
      expectedChunks: segments.length,
      chunkDurationTarget: 30,
      estimatedDurationSeconds: totalDuration,
    });

    for (const seg of segments) {
      const prep = await this.client.prepareChunk(video.videoId, seg.index, Math.min(seg.durationSeconds, 30), seg.sizeBytes, seg.md5);
      await this.client.uploadChunk(prep.uploadContract, await fs.readFile(seg.path));
      await this.client.commitChunk(video.videoId, prep.chunkId, seg.sizeBytes, seg.md5);
      onProgress?.({ stage: "uploading", progress: 0.05 + (0.3 * (seg.index + 1)) / segments.length });
    }

    await this.client.completeUpload(video.videoId);
    onProgress?.({ stage: "analyzing", progress: 0.4 });

    // createVlog 409s with TIMELINE_NOT_READY until compose finishes — retry.
    const vlog = await this.createVlogWhenReady(video.videoId);
    // Planner emits one upload contract per chosen segment.
    const planned = await this.client.waitForUploadContracts(video.videoId, vlog.vlogId);
    onProgress?.({ stage: "analyzing", progress: 0.5 });

    const clipDir = path.join(workDir, "clips");
    await fs.mkdir(clipDir, { recursive: true });
    const contracts = planned.uploadContracts;
    for (let i = 0; i < contracts.length; i++) {
      const c = contracts[i];
      const out = path.join(clipDir, `clip_${c.segmentIndex}.mp4`);
      await extractClip(sourcePath, c.startTimeOriginal, c.endTimeOriginal, out);
      const bytes = await fs.readFile(out);
      await this.client.uploadVlogClip(video.videoId, vlog.vlogId, c.segmentIndex, new Uint8Array(bytes), await fileMd5(out));
      onProgress?.({ stage: "analyzing", progress: 0.5 + (0.1 * (i + 1)) / contracts.length });
    }

    await this.client.completeVlogUpload(video.videoId, vlog.vlogId);
    onProgress?.({ stage: "rendering", progress: 0.62 });

    await this.client.renderVlog(video.videoId, vlog.vlogId);
    const done = await this.client.pollUntilVlogFinished(video.videoId, vlog.vlogId, (s) =>
      onProgress?.({ stage: "rendering", progress: Math.min(0.95, 0.62 + (s.progress ?? 0) * 0.33) }),
    );

    const bytes = await this.client.downloadVlog(video.videoId, done.vlogId);
    const outPath = path.join(workDir, "result.mp4");
    await fs.writeFile(outPath, new Uint8Array(bytes));
    return { videoPath: outPath, durationSeconds: await probeDurationSeconds(outPath) };
  }

  // createVlog 409s with TIMELINE_NOT_READY until compose finishes — retry.
  private async createVlogWhenReady(videoId: string, attempts = 60) {
    for (let i = 0; i < attempts; i++) {
      try {
        return await this.client.createVlog(videoId, { sourceMode: "uploaded_clips", renderProfile: "legacy_story_v1_fast" });
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
}

/** No-backend fallback: trim the source to ≤30s with local ffmpeg. */
export class LocalEditor implements Editor {
  async editToShort(sourcePath: string, workDir: string, onProgress?: EditProgress): Promise<EditResult> {
    onProgress?.({ stage: "uploading", progress: 0.15 });
    const duration = await probeDurationSeconds(sourcePath);
    const target = Math.min(duration || TARGET_SECONDS, TARGET_SECONDS);
    onProgress?.({ stage: "analyzing", progress: 0.4 });

    const outPath = path.join(workDir, "result.mp4");
    onProgress?.({ stage: "rendering", progress: 0.65 });
    await execFileP(FFMPEG, [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", sourcePath,
      "-t", String(target),
      "-c:v", "libx264", "-preset", "veryfast",
      "-c:a", "aac",
      "-movflags", "+faststart",
      outPath,
    ]);
    onProgress?.({ stage: "rendering", progress: 0.95 });
    return { videoPath: outPath, durationSeconds: target };
  }
}

/** Pick the editor: real backend when AURI_HOST is set (and AURI_MOCK!=1), else local trim. */
export function makeEditor(): Editor {
  const useReal = Boolean(process.env.AURI_HOST) && process.env.AURI_MOCK !== "1";
  return useReal ? new AuriEditor() : new LocalEditor();
}
