import { NextResponse } from "next/server";
import { AuriClient } from "@/lib/auri/client";
import { addDemoMedia, createDemoMemoryFromMedia, DemoMediaInput, persistDemoStore } from "@/lib/demo/demo-store";
import { storeUploadedFile } from "@/lib/demo/media-storage";
import { ensureHydrated } from "@/lib/demo/persistence";

export const runtime = "nodejs";

// Final hand-off for client-side Auri Cut: the phone sends just { videoId, vlogId }
// after the render finishes. This (fast, Vercel-OK) server step downloads the
// rendered mp4 from auri-editor, stores it (Vercel Blob / local), and creates the
// Memory — no large body passes through the function, no phone→Blob roundtrip.
export async function POST(request: Request) {
  let body: { videoId?: string; vlogId?: string; durationSeconds?: number; title?: string; person?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON { videoId, vlogId }" }, { status: 400 });
  }
  const { videoId, vlogId, durationSeconds, title, person } = body;
  if (!videoId || !vlogId) {
    return NextResponse.json({ error: "videoId and vlogId are required" }, { status: 400 });
  }

  await ensureHydrated();

  let bytes: Uint8Array;
  try {
    bytes = await new AuriClient().downloadVlog(videoId, vlogId);
  } catch (e) {
    return NextResponse.json({ error: `Couldn't fetch the rendered film: ${e instanceof Error ? e.message : e}` }, { status: 502 });
  }

  const file = new File([bytes], "auri-cut.mp4", { type: "video/mp4" });
  const stored = await storeUploadedFile(file);

  const input: DemoMediaInput = {
    title: title || "Auri Cut film",
    source: "auri",
    mediaType: "video",
    url: stored.url,
    durationSeconds: durationSeconds ? Math.round(durationSeconds) : undefined,
    person: (person || "family") as DemoMediaInput["person"],
    body: "A short film from your video, made by Auri Cut.",
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

  return NextResponse.json({ memoryId: memory?.id, mediaUrl: stored.url, durationSeconds: input.durationSeconds });
}
