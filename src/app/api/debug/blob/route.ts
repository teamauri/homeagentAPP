import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Diagnostic only: proves whether Vercel Blob round-trips on this deployment
// (put → list → fetch → delete) and lists what demo snapshots currently exist.
// Never exposes secrets.
export async function GET() {
  const hasToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  if (!hasToken) {
    return NextResponse.json({ blobEnabled: false, reason: "BLOB_READ_WRITE_TOKEN not present at runtime" });
  }

  const result: Record<string, unknown> = { blobEnabled: true };
  try {
    const { put, list, del } = await import("@vercel/blob");
    const marker = `roundtrip-${Date.now()}`;
    const pathname = `demo-store/_debug/${marker}.json`;

    const putRes = await put(pathname, JSON.stringify({ marker }), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
    });
    result.put = { ok: true, url: putRes.url };

    const fetched = await fetch(putRes.url, { cache: "no-store" });
    const body = await fetched.json().catch(() => null);
    result.readBack = { httpOk: fetched.ok, matches: (body as { marker?: string } | null)?.marker === marker };

    const existing = await list({ prefix: "demo-store/" });
    result.snapshots = existing.blobs
      .filter((b) => !b.pathname.includes("/_debug/"))
      .map((b) => ({ pathname: b.pathname, size: b.size, uploadedAt: b.uploadedAt }));

    await del(putRes.url).catch(() => {});
    result.roundTrip = result.readBack && (result.readBack as { matches?: boolean }).matches ? "OK" : "FAILED";
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    result.roundTrip = "ERROR";
  }

  return NextResponse.json(result);
}
