import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Streams a privately-stored uploaded media file (photo/video) back to the
// browser. The Blob store is private, so its URLs aren't embeddable directly;
// this route reads the blob with an authenticated get() and pipes it through.
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
    if (!res || !res.stream) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return new Response(res.stream as ReadableStream, {
      headers: {
        "content-type": res.blob.contentType || "application/octet-stream",
        // Immutable file (uuid name) — safe to cache hard in the browser.
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to read media" }, { status: 500 });
  }
}
