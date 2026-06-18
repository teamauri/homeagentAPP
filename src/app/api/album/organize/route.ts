import { NextResponse } from "next/server";
import { organizeAlbum } from "@/lib/album/organize";
import { addOrganized, getGrowth } from "@/lib/album/store";
import { AlbumPhotoInput } from "@/lib/album/types";

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

  const childId = typeof body?.childId === "string" ? body.childId : "mia";

  try {
    const result = await organizeAlbum(photos, childId);
    addOrganized(result);
    return NextResponse.json({
      growth: getGrowth(),
      metadata: { provider: result.provider, model: result.model, skipped: result.skippedCount, organized: result.growth.days.length },
    });
  } catch (error) {
    console.error("[api/album/organize] failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Organize failed" }, { status: 500 });
  }
}
