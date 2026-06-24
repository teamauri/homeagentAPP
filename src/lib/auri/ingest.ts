import { AuriClient } from "@/lib/auri/client";
import { addDemoMedia, createDemoMemoryFromMedia, DemoMediaInput, persistDemoStore } from "@/lib/demo/demo-store";
import { storeUploadedFile } from "@/lib/demo/media-storage";
import { ensureHydrated } from "@/lib/demo/persistence";
import type { PersonId } from "@/lib/types";

export interface RenderedVlogIngestOptions {
  videoId: string;
  vlogId: string;
  durationSeconds?: number;
  title?: string;
  person?: PersonId;
  body?: string;
  tags?: string[];
  ingestMode?: string;
  metadata?: Record<string, unknown>;
  client?: AuriClient;
}

export async function ingestRenderedVlog(options: RenderedVlogIngestOptions) {
  await ensureHydrated();

  const client = options.client ?? new AuriClient();
  const bytes = await client.downloadVlog(options.videoId, options.vlogId);
  const file = new File([bytes], "auri-cut.mp4", { type: "video/mp4" });
  const stored = await storeUploadedFile(file);
  const durationSeconds = options.durationSeconds ? Math.round(options.durationSeconds) : undefined;
  const title = options.title || "Auri Cut film";
  const body = options.body || "A short film from your video, made by Auri Cut.";

  const input: DemoMediaInput = {
    title,
    source: "auri",
    mediaType: "video",
    url: stored.url,
    durationSeconds,
    person: options.person ?? "family",
    body,
    tags: options.tags ?? ["auri-cut"],
    capturedAt: new Date().toISOString(),
    metadata: {
      ingestMode: options.ingestMode ?? "auri-cut",
      storage: stored.storage,
      auriVideoId: options.videoId,
      vlogId: options.vlogId,
      ...options.metadata,
    },
  };

  const media = addDemoMedia([input], "auri");
  const memory = createDemoMemoryFromMedia(media, {
    title: input.title,
    body,
    status: "ready",
    statusLabel: "Ready",
  });
  await persistDemoStore();

  return {
    memory,
    media,
    memoryId: memory?.id,
    mediaUrl: stored.url,
    durationSeconds: input.durationSeconds,
  };
}
