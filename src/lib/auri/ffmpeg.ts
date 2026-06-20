/**
 * ffmpeg helpers for the Auri edit pipeline (server-side / Node only).
 *
 * With `source_mode="full_video"` the backend plans + cuts the short itself, so
 * we only need to: probe duration, and split the source into ≤30s segments for
 * chunk upload (stream-copy — no re-encode, fast). See MEMORY_AUTO_EDIT_DESIGN.md.
 */

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";

/** Source-video segment ready for chunk upload. */
export interface Segment {
  path: string;
  index: number;
  durationSeconds: number;
  sizeBytes: number;
  md5: string;
}

export async function probeDurationSeconds(input: string): Promise<number> {
  const { stdout } = await execFileP(FFPROBE, [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    input,
  ]);
  const d = parseFloat(stdout.trim());
  return Number.isFinite(d) ? d : 0;
}

export function fileMd5(input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("md5");
    const stream = createReadStream(input);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

/** Extract an HQ clip [startSec, endSec) from `input`, re-encoded for clean cut boundaries. */
export async function extractClip(input: string, startSec: number, endSec: number, outPath: string): Promise<void> {
  const duration = Math.max(0.1, endSec - startSec);
  await execFileP(FFMPEG, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-ss", String(startSec),
    "-i", input,
    "-t", String(duration),
    "-c:v", "libx264", "-preset", "veryfast",
    "-c:a", "aac",
    "-movflags", "+faststart",
    outPath,
  ]);
}

/**
 * Split `input` into ≤`segmentSeconds` chunks via stream copy (keyframe-aligned,
 * so durations are approximate but ≤ the next keyframe). Returns the segments in
 * order with per-segment duration / size / md5 (for prepareChunk + commitChunk).
 */
export async function splitIntoSegments(input: string, outDir: string, segmentSeconds = 30): Promise<Segment[]> {
  await fs.mkdir(outDir, { recursive: true });
  const pattern = path.join(outDir, "seg_%05d.mp4");

  await execFileP(FFMPEG, [
    "-hide_banner", "-loglevel", "error",
    "-i", input,
    "-c", "copy",
    "-map", "0",
    "-f", "segment",
    "-segment_time", String(segmentSeconds),
    "-reset_timestamps", "1",
    pattern,
  ]);

  const files = (await fs.readdir(outDir)).filter((f) => /^seg_\d+\.mp4$/.test(f)).sort();
  const segments: Segment[] = [];
  for (let i = 0; i < files.length; i++) {
    const p = path.join(outDir, files[i]);
    const [durationSeconds, stat, md5] = await Promise.all([probeDurationSeconds(p), fs.stat(p), fileMd5(p)]);
    segments.push({ path: p, index: i, durationSeconds, sizeBytes: stat.size, md5 });
  }
  return segments;
}
