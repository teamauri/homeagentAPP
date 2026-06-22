import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { MEDIA_DIR } from "./data-dir";

// Media storage for ingested DockKit/Auri media. Files are written under
// MEDIA_DIR (a Render Persistent Disk in production via DATA_DIR, else
// public/demo-media in dev) and served back through /api/media/blob/<file> —
// runtime-written files outside the build aren't reliably served as static
// assets, so the route streams them with HTTP Range for <video> playback.

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
  storage: "disk";
}

async function storeBuffer(buffer: Buffer, fileName: string, mimeType: string): Promise<StoredFile> {
  await mkdir(MEDIA_DIR, { recursive: true });
  await writeFile(path.join(MEDIA_DIR, fileName), buffer);
  return { url: `/api/media/blob/${fileName}`, fileName, mimeType, size: buffer.byteLength, storage: "disk" };
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

/** Delete every stored uploaded media file. */
export async function deleteAllUploadedMedia(): Promise<void> {
  await rm(MEDIA_DIR, { recursive: true, force: true }).catch(() => {});
}
