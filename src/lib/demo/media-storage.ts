import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";

// Media storage for ingested DockKit/Auri media.
//
// - On Vercel (BLOB_READ_WRITE_TOKEN present) files go to Vercel Blob with
//   PRIVATE access (the store is private) and are served back through
//   /api/media/blob/<file>, which streams the blob — required because Vercel's
//   filesystem is read-only/ephemeral and private blob URLs aren't directly
//   embeddable in <img>/<video>.
// - Locally (no token) files fall back to public/demo-media and are served
//   through the same /api/media/blob/<file> route, so deployed hosts that do not
//   expose runtime-written public files still return playable media URLs.
const MEDIA_DIR = path.join(process.cwd(), "public", "demo-media");

const EXTENSION_BY_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/x-m4v": "m4v",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "image/webp": "webp",
};

function extensionFor(file: File): string {
  const fromName = path.extname(file.name || "").replace(".", "").toLowerCase();
  if (fromName) return fromName;
  return EXTENSION_BY_MIME[file.type] || (file.type.startsWith("video/") ? "mp4" : "bin");
}

export interface StoredFile {
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  storage: "blob" | "local";
}

async function storeBuffer(buffer: Buffer, fileName: string, mimeType: string): Promise<StoredFile> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    await put(`demo-media/${fileName}`, buffer, {
      access: "private",
      contentType: mimeType,
      addRandomSuffix: false,
    });
    // Private blobs aren't directly embeddable — serve them through our route.
    return { url: `/api/media/blob/${fileName}`, fileName, mimeType, size: buffer.byteLength, storage: "blob" };
  }

  await mkdir(MEDIA_DIR, { recursive: true });
  await writeFile(path.join(MEDIA_DIR, fileName), buffer);
  return { url: `/api/media/blob/${fileName}`, fileName, mimeType, size: buffer.byteLength, storage: "local" };
}

/** Persists an uploaded File and returns its publicly servable URL. */
export async function storeUploadedFile(file: File): Promise<StoredFile> {
  const ext = extensionFor(file);
  const fileName = `${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";

  return storeBuffer(buffer, fileName, mimeType);
}

/** Persists downloaded bytes from an upstream service and returns a servable URL. */
export async function storeBinaryFile(bytes: Uint8Array, originalName: string, mimeType: string): Promise<StoredFile> {
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "-") || `${randomUUID()}.bin`;
  const ext = path.extname(safeName);
  const fileName = ext ? `${randomUUID()}${ext}` : `${randomUUID()}.bin`;
  return storeBuffer(Buffer.from(bytes), fileName, mimeType || "application/octet-stream");
}

export function isFile(value: FormDataEntryValue | null): value is File {
  return typeof value === "object" && value !== null && "arrayBuffer" in value && "size" in value;
}

/** Delete every stored uploaded media file (Blob on Vercel / local folder). */
export async function deleteAllUploadedMedia(): Promise<void> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { list, del } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: "demo-media/" });
    if (blobs.length) await del(blobs.map((b) => b.url));
    return;
  }
  const { rm } = await import("node:fs/promises");
  await rm(MEDIA_DIR, { recursive: true, force: true }).catch(() => {});
}
