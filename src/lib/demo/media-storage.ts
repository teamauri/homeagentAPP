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
// - Locally (no token) files fall back to public/demo-media, served by Next.js
//   at /demo-media/<file>, so the endpoint stays testable without a Blob store.
const MEDIA_DIR = path.join(process.cwd(), "public", "demo-media");
const PUBLIC_PREFIX = "/demo-media";

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

/** Persists an uploaded File and returns its publicly servable URL. */
export async function storeUploadedFile(file: File): Promise<StoredFile> {
  const ext = extensionFor(file);
  const fileName = `${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";

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
  return { url: `${PUBLIC_PREFIX}/${fileName}`, fileName, mimeType, size: buffer.byteLength, storage: "local" };
}

export function isFile(value: FormDataEntryValue | null): value is File {
  return typeof value === "object" && value !== null && "arrayBuffer" in value && "size" in value;
}
