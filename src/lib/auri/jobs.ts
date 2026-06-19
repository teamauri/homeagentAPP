/**
 * Auri Cut background jobs (in-process; survives HMR via globalThis).
 *
 * createEditJob saves nothing — it takes a source path, runs the editor in the
 * background, ingests the result as a `source:"auri"` Memory (same path as the
 * DockKit robot ingest), and exposes status/progress for the UI to poll.
 * Demo-grade: in-memory + the existing demo-store. Not for serverless.
 */

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { addDemoMedia, createDemoMemoryFromMedia, DemoMediaInput, persistDemoStore } from "@/lib/demo/demo-store";
import { storeUploadedFile } from "@/lib/demo/media-storage";
import { ensureHydrated } from "@/lib/demo/persistence";
import { EditStage, makeEditor } from "./editor";

export type JobStatus = "queued" | "uploading" | "analyzing" | "rendering" | "ready" | "failed";

export interface EditJob {
  id: string;
  status: JobStatus;
  progress: number; // 0..1
  createdAt: string;
  title?: string;
  result?: { memoryId?: string; mediaUrl?: string; durationSeconds?: number };
  error?: string;
}

const STAGE_TO_STATUS: Record<EditStage, JobStatus> = {
  uploading: "uploading",
  analyzing: "analyzing",
  rendering: "rendering",
};

const g = globalThis as typeof globalThis & { __auriEditJobs?: Map<string, EditJob> };
g.__auriEditJobs ??= new Map<string, EditJob>();
const jobs = g.__auriEditJobs;

export function getEditJob(id: string): EditJob | undefined {
  return jobs.get(id);
}

export function createEditJob(sourcePath: string, opts: { title?: string } = {}): EditJob {
  const id = `edit_${randomUUID().slice(0, 8)}`;
  const job: EditJob = { id, status: "queued", progress: 0, createdAt: new Date().toISOString(), title: opts.title };
  jobs.set(id, job);
  void runJob(job, sourcePath).catch((e) => {
    job.status = "failed";
    job.error = e instanceof Error ? e.message : String(e);
  });
  return job;
}

async function runJob(job: EditJob, sourcePath: string): Promise<void> {
  const workDir = path.join(process.cwd(), ".data", "edit-jobs", job.id);
  await fs.mkdir(workDir, { recursive: true });

  const editor = makeEditor();
  const result = await editor.editToShort(sourcePath, workDir, (p) => {
    job.status = STAGE_TO_STATUS[p.stage];
    job.progress = p.progress;
  });

  job.result = await ingestResult(result.videoPath, result.durationSeconds, job.title);
  job.status = "ready";
  job.progress = 1;
}

/** Land the rendered short as a source:"auri" Memory (same path as robot ingest). */
async function ingestResult(videoPath: string, durationSeconds: number, title?: string) {
  await ensureHydrated();
  const buffer = await fs.readFile(videoPath);
  const file = new File([new Uint8Array(buffer)], "auri-cut.mp4", { type: "video/mp4" });
  const stored = await storeUploadedFile(file);

  const input: DemoMediaInput = {
    title: title || "Auri Cut film",
    source: "auri",
    mediaType: "video",
    url: stored.url,
    durationSeconds: Math.round(durationSeconds),
    person: "family" as DemoMediaInput["person"],
    body: "An auto-edited short, made by Auri Cut.",
    tags: ["auri-cut"],
    capturedAt: new Date().toISOString(),
    metadata: { ingestMode: "auri-cut", storage: stored.storage },
  };

  const media = addDemoMedia([input], "auri");
  const memory = createDemoMemoryFromMedia(media, {
    title: input.title,
    body: "A short film from your video, made by Auri Cut.",
    status: "ready",
    statusLabel: "Ready",
  });
  await persistDemoStore();

  return { memoryId: memory?.id, mediaUrl: stored.url, durationSeconds: Math.round(durationSeconds) };
}
