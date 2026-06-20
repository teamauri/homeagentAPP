/**
 * Browser-side video preprocessing with ffmpeg.wasm (self-hosted, single-thread).
 *
 * Validated on iPhone Safari (see memory auri-cut-client-preprocessing): the
 * source File is WORKERFS-mounted (never copied whole into wasm memory) and
 * chunks/clips are extracted one at a time with `-c copy` (no re-encode), so peak
 * memory ≈ one chunk and an 8-min / 474MB video splits in ~8s without OOM.
 *
 * Runtime assets live in /public/ffmpeg/ (ffmpeg.js + 814.ffmpeg.js worker +
 * ffmpeg-core.js + .wasm). MUST be same-origin: a cross-origin worker throws
 * SecurityError, and passing classWorkerURL makes a module worker (no
 * importScripts) — so we let the UMD auto-load its classic worker.
 */

const SEG_SECONDS = 28; // ≤30 after keyframe alignment

type FFmpegInstance = {
  load: (opts: { coreURL: string; wasmURL: string }) => Promise<void>;
  exec: (args: string[]) => Promise<number>;
  readFile: (path: string) => Promise<Uint8Array>;
  deleteFile: (path: string) => Promise<void>;
  createDir: (path: string) => Promise<void>;
  mount: (fsType: string, options: unknown, mountPoint: string) => Promise<void>;
  unmount: (mountPoint: string) => Promise<void>;
  terminate: () => void;
};

let ffmpeg: FFmpegInstance | null = null;
let scriptPromise: Promise<void> | null = null;
let mounted = false;

function loadScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const w = window as unknown as { FFmpegWASM?: unknown };
    if (w.FFmpegWASM) return resolve();
    const s = document.createElement("script");
    s.src = "/ffmpeg/ffmpeg.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("failed to load /ffmpeg/ffmpeg.js"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/** Load the ffmpeg.wasm core (downloads ~32MB once). Idempotent. */
export async function loadFFmpeg(onLog?: (m: string) => void): Promise<void> {
  if (ffmpeg) return;
  await loadScript();
  const FFmpeg = (window as unknown as { FFmpegWASM: { FFmpeg: new () => FFmpegInstance } }).FFmpegWASM.FFmpeg;
  const inst = new FFmpeg();
  const base = new URL("/ffmpeg/", location.href).href;
  // No classWorkerURL — that would make a module worker (no importScripts).
  await inst.load({ coreURL: base + "ffmpeg-core.js", wasmURL: base + "ffmpeg-core.wasm" });
  ffmpeg = inst;
  onLog?.("ffmpeg.wasm ready");
}

function fs(): FFmpegInstance {
  if (!ffmpeg) throw new Error("ffmpeg not loaded — call loadFFmpeg() first");
  return ffmpeg;
}

/** WORKERFS-mount the source File (lazy reads; not copied into wasm memory). */
export async function mountInput(file: File): Promise<string> {
  const f = fs();
  if (mounted) { try { await f.unmount("/mount"); } catch { /* not mounted */ } }
  try { await f.createDir("/mount"); } catch { /* exists */ }
  await f.mount("WORKERFS", { files: [file] }, "/mount");
  mounted = true;
  return "/mount/" + file.name;
}

export function chunkCount(durationSeconds: number): number {
  return Math.max(1, Math.ceil(durationSeconds / SEG_SECONDS));
}

/** Extract one ≤28s chunk (index-th window) as mp4 bytes; frees it after read. */
export async function extractChunk(inputPath: string, index: number): Promise<Uint8Array> {
  const f = fs();
  const out = `chunk_${index}.mp4`;
  await f.exec(["-ss", String(index * SEG_SECONDS), "-i", inputPath, "-t", String(SEG_SECONDS), "-c", "copy", "-avoid_negative_ts", "make_zero", out]);
  const bytes = await f.readFile(out);
  await f.deleteFile(out);
  return bytes;
}

/** Extract one HQ clip [startSec, endSec) as mp4 bytes (-c copy, fast). */
export async function extractClip(inputPath: string, startSec: number, endSec: number, label: string): Promise<Uint8Array> {
  const f = fs();
  const out = `clip_${label}.mp4`;
  const dur = Math.max(0.1, endSec - startSec);
  await f.exec(["-ss", String(startSec), "-i", inputPath, "-t", String(dur), "-c", "copy", "-avoid_negative_ts", "make_zero", out]);
  const bytes = await f.readFile(out);
  await f.deleteFile(out);
  return bytes;
}

export { SEG_SECONDS };
