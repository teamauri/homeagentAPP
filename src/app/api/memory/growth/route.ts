import { NextResponse } from "next/server";
import { getGrowth } from "@/lib/album/store";
import { ensureHydrated, reloadStore } from "@/lib/demo/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cache blob reloads on warm instances: skip the round-trip if we reloaded
// within the last 30 s. Writes (organize, ingest) call reloadStore directly
// and reset this, so freshness is preserved after mutations.
let lastReloadAt = 0;
function invalidateGrowthCache(): void {
  lastReloadAt = 0;
}

// Current growth album for Memory: seed + organized photos + ingested Stories.
export async function GET() {
  await ensureHydrated();
  const now = Date.now();
  if (now - lastReloadAt > 30_000) {
    await Promise.all([reloadStore("growth"), reloadStore("demo")]);
    lastReloadAt = now;
  }
  return NextResponse.json({ growth: getGrowth() });
}
