import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MEDIA_DIR = path.join(process.cwd(), "public", "demo-media");

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  ".json": "application/json",
  ".m4v": "video/x-m4v",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".txt": "text/plain; charset=utf-8",
};

function contentTypeFor(name: string) {
  return CONTENT_TYPE_BY_EXT[path.extname(name).toLowerCase()] || "application/octet-stream";
}

function safeLocalPath(name: string) {
  const root = path.resolve(MEDIA_DIR);
  const filePath = path.resolve(root, name);
  if (filePath !== root && filePath.startsWith(`${root}${path.sep}`)) return filePath;
  return null;
}

function parseRange(rangeHeader: string | null, totalSize: number) {
  if (!rangeHeader) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return undefined;

  let start: number;
  let end: number;
  if (match[1] === "" && match[2] === "") return undefined;
  if (match[1] === "") {
    const suffixLength = Number(match[2]);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return undefined;
    start = Math.max(totalSize - suffixLength, 0);
    end = totalSize - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? totalSize - 1 : Number(match[2]);
  }

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= totalSize) {
    return undefined;
  }
  return { start, end: Math.min(end, totalSize - 1) };
}

async function serveLocalMedia(request: Request, name: string, head = false) {
  const filePath = safeLocalPath(name);
  if (!filePath) return NextResponse.json({ error: "Invalid media name" }, { status: 400 });

  let data: Buffer;
  try {
    data = await readFile(filePath);
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? error.code : undefined;
    if (code === "ENOENT") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to read media" }, { status: 500 });
  }

  const totalSize = data.byteLength;
  const headers = new Headers({
    "accept-ranges": "bytes",
    "content-type": contentTypeFor(name),
  });
  const range = parseRange(request.headers.get("range"), totalSize);
  if (range === undefined) {
    headers.set("content-range", `bytes */${totalSize}`);
    return new Response(null, { status: 416, headers });
  }
  if (range) {
    const chunk = data.subarray(range.start, range.end + 1);
    headers.set("content-length", String(chunk.byteLength));
    headers.set("content-range", `bytes ${range.start}-${range.end}/${totalSize}`);
    return new Response(head ? null : chunk, { status: 206, headers });
  }

  headers.set("content-length", String(totalSize));
  return new Response(head ? null : data, { status: 200, headers });
}

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
    return serveLocalMedia(_request, name);
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

export async function HEAD(request: Request, { params }: { params: { name: string } }) {
  const name = params.name;
  if (!name || name.includes("/") || name.includes("..")) {
    return NextResponse.json({ error: "Invalid media name" }, { status: 400 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return serveLocalMedia(request, name, true);
  }
  return GET(request, { params });
}
