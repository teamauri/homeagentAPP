import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Resolves a privately-stored media file to its short-lived signed CDN URL and
// 307-redirects there. The browser then streams bytes DIRECTLY from Vercel Blob's
// CDN, which serves them fast and with native HTTP Range support (Safari's
// <video> requires Range). Previously we buffered the whole blob through this
// function on every range request, which made video load take ~8s.
export async function GET(_request: Request, { params }: { params: { name: string } }) {
  const name = params.name;
  if (!name || name.includes("/") || name.includes("..")) {
    return NextResponse.json({ error: "Invalid media name" }, { status: 400 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Blob storage not configured" }, { status: 404 });
  }

  try {
    const { get } = await import("@vercel/blob");
    const res = await get(`demo-media/${name}`, { access: "private", useCache: true });
    if (!res?.blob?.downloadUrl) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // Resolve metadata only — don't pull the body through this function.
    try { await (res.stream as ReadableStream | null)?.cancel?.(); } catch { /* nothing to cancel */ }
    // Media elements ignore the downloadUrl's Content-Disposition; they just
    // range-fetch the bytes — so inline <video> playback works.
    return NextResponse.redirect(res.blob.downloadUrl, 307);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to read media" }, { status: 500 });
  }
}
