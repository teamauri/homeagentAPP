import { NextResponse } from "next/server";
import { persistDemoStore, resetDemoStore } from "@/lib/demo/demo-store";
import { persistGrowthStore, resetGrowthStore } from "@/lib/album/store";
import { deleteAllUploadedMedia } from "@/lib/demo/media-storage";
import { ensureHydrated } from "@/lib/demo/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One-tap "Reset demo data": wipe everything created during testing — organized
// albums, uploaded/ingested Stories, created reminders/logs, and the stored
// media files in Blob — returning Memory to just the seed. Family settings are
// kept.
export async function POST() {
  await ensureHydrated();
  try {
    resetGrowthStore();
    resetDemoStore();
    // Persist the now-empty stores, then drop the stored media files.
    await Promise.all([persistGrowthStore(), persistDemoStore()]);
    await deleteAllUploadedMedia();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Reset failed" }, { status: 500 });
  }
}
