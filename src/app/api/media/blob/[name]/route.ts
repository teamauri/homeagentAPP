import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Streams a privately-stored uploaded media file (photo/video) back to the
// browser. The Blob store is private, so its URLs aren't embeddable directly;
// this route reads the blob and pipes it through — WITH HTTP Range support,
// which Safari's <video> requires (it probes with `Range: bytes=0-1` and refuses
// to play if the server answers 200 instead of 206).
export async function GET(request: Request, { params }: { params: { name: string } }) {
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

    const contentType = res.blob.contentType || "application/octet-stream";
    const full = new Uint8Array(await new Response(res.stream as ReadableStream).arrayBuffer());
    const total = full.byteLength;
    const cache = "public, max-age=31536000, immutable";

    const rangeHeader = request.headers.get("range");
    const match = rangeHeader ? /bytes=(\d+)-(\d*)/.exec(rangeHeader) : null;
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? Math.min(parseInt(match[2], 10), total - 1) : total - 1;
      if (Number.isNaN(start) || start > end || start >= total) {
        return new Response(null, { status: 416, headers: { "content-range": `bytes */${total}`, "accept-ranges": "bytes" } });
      }
      const chunk = full.subarray(start, end + 1);
      return new Response(chunk, {
        status: 206,
        headers: {
          "content-type": contentType,
          "accept-ranges": "bytes",
          "content-range": `bytes ${start}-${end}/${total}`,
          "content-length": String(chunk.byteLength),
          "cache-control": cache,
        },
      });
    }

    return new Response(full, {
      status: 200,
      headers: {
        "content-type": contentType,
        "accept-ranges": "bytes",
        "content-length": String(total),
        "cache-control": cache,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to read media" }, { status: 500 });
  }
}
