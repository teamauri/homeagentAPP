import { NextResponse } from "next/server";
import { listDemoMedia, listDemoMemory, persistDemoStore, removeDemoMemory } from "@/lib/demo/demo-store";
import { ensureHydrated } from "@/lib/demo/persistence";

export const runtime = "nodejs";

// Delete one Memory (and the media it owns) — used by the Auri Cut result card.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  await ensureHydrated();
  const removed = removeDemoMemory(params.id);
  if (removed) await persistDemoStore();
  return NextResponse.json({ ok: removed });
}

// Detail-page data source: GET /api/memory/{memoryId} returns one memory plus
// its media resolved by mediaIds (in mediaIds order), each with a real url /
// thumbnailUrl for inline playback. Contract: [id] is the memory id.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  await ensureHydrated();
  const memory = listDemoMemory().find((item) => item.id === params.id);
  if (!memory) {
    return NextResponse.json({ error: "Memory not found" }, { status: 404 });
  }

  const mediaById = new Map(listDemoMedia().map((media) => [media.id, media]));
  const media = memory.mediaIds
    .map((mediaId) => mediaById.get(mediaId))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return NextResponse.json({
    memory,
    media,
    metadata: { provider: "local-demo-store" },
  });
}
