import { NextResponse } from "next/server";
import { organizeAlbum } from "@/lib/album/organize";
import { addOrganized, getGrowth, persistGrowthStore } from "@/lib/album/store";
import { AlbumPhotoInput } from "@/lib/album/types";
import { ensureHydrated, reloadStore } from "@/lib/demo/persistence";

export const runtime = "nodejs";
export const maxDuration = 60;

function normalizePhotos(value: unknown): AlbumPhotoInput[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((p): p is Record<string, unknown> => Boolean(p) && typeof p === "object")
    .map((p) => ({
      name: typeof p.name === "string" ? p.name : "photo",
      mimeType: typeof p.mimeType === "string" ? p.mimeType : "image/jpeg",
      dataBase64: typeof p.dataBase64 === "string" ? p.dataBase64 : "",
      capturedAtISO: typeof p.capturedAtISO === "string" ? p.capturedAtISO : new Date().toISOString(),
    }))
    .filter((p) => p.dataBase64.length > 0);
}

export async function POST(request: Request) {
  await ensureHydrated();
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  const photos = normalizePhotos(body?.photos);
  if (!photos.length) {
    return NextResponse.json({ error: "Provide at least one photo with dataBase64" }, { status: 400 });
  }

  const childId = typeof body?.childId === "string" ? body.childId : "child1";

  try {
    // Pull the latest organized album (growth) AND ingested Stories/uploads
    // (demo) from Blob FIRST, so appending this batch — and the growth we
    // return — builds on other instances' writes instead of dropping them.
    await Promise.all([reloadStore("growth"), reloadStore("demo")]);
    const result = await organizeAlbum(photos, childId);
    addOrganized(result);
    await persistGrowthStore();
    // Count kept PHOTOS (not day-groups) so "organized N" matches what the
    // parent actually uploaded.
    const keptCount = result.growth.days.reduce((n, d) => n + d.media.length, 0);
    return NextResponse.json({
      growth: getGrowth(),
      metadata: { provider: result.provider, model: result.model, skipped: result.skippedCount, organized: keptCount },
    });
  } catch (error) {
    console.error("[api/album/organize] failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Organize failed" }, { status: 500 });
  }
}
