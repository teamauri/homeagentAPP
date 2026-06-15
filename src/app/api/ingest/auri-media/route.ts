import { NextResponse } from "next/server";
import { addDemoMedia, createDemoMemoryFromMedia, DemoMediaInput } from "@/lib/demo/demo-store";

export const runtime = "nodejs";

function normalizeAuriInputs(body: any): DemoMediaInput[] {
  const rawItems = Array.isArray(body?.media) ? body.media : Array.isArray(body?.clips) ? body.clips : Array.isArray(body?.items) ? body.items : [body];

  return rawItems.map((item: DemoMediaInput, index: number) => ({
    title: item.title || body?.title || `Auri Robot clip ${index + 1}`,
    body: item.body || body?.body || "Auri Robot captured a family moment.",
    person: item.person || body?.person || "family",
    mediaType: item.mediaType || item.type || "clip",
    url: item.url,
    thumbnailUrl: item.thumbnailUrl,
    capturedAt: item.capturedAt || body?.capturedAt,
    durationSeconds: item.durationSeconds,
    tags: item.tags || body?.tags || ["auri-robot"],
    metadata: {
      robotId: body?.robotId || "auri_living_room",
      room: body?.room || "Living Room",
      ingestMode: "auri-robot-demo",
      ...(item.metadata || {}),
    },
  }));
}

export async function POST(request: Request) {
  let body: any;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  const inputs = normalizeAuriInputs(body);
  if (!inputs.length) {
    return NextResponse.json({ error: "Provide at least one Auri media item" }, { status: 400 });
  }

  const media = addDemoMedia(inputs, "auri");
  const memory = createDemoMemoryFromMedia(media, {
    title: body?.memoryTitle || body?.title || "New memory from Auri Robot",
    body: body?.memoryBody || `${media.length} Auri Robot ${media.length === 1 ? "clip is" : "clips are"} ready in Memory.`,
    status: "ready",
    statusLabel: "Ready",
  });

  return NextResponse.json({
    media,
    memory,
    metadata: {
      provider: "local-demo-store",
      externalRobotSync: "mocked",
    },
  });
}
