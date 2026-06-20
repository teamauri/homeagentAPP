import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { createEditJob } from "@/lib/auri/jobs";
import { isFile } from "@/lib/demo/media-storage";

export const runtime = "nodejs";

// POST multipart/form-data: { video: File, title?: string }
// → saves the source, starts a background Auri Cut job, returns { jobId }.
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data with a `video` file" }, { status: 400 });
  }

  const video = form.get("video");
  if (!isFile(video)) {
    return NextResponse.json({ error: "Missing `video` file" }, { status: 400 });
  }
  if (!video.type.startsWith("video/") && !/\.(mov|mp4|m4v|avi|webm)$/i.test(video.name)) {
    return NextResponse.json({ error: "`video` must be a video file" }, { status: 400 });
  }

  const uploadsDir = path.join(process.cwd(), ".data", "edit-uploads");
  await fs.mkdir(uploadsDir, { recursive: true });
  const ext = (video.name.split(".").pop() || "mp4").toLowerCase();
  const sourcePath = path.join(uploadsDir, `${randomUUID()}.${ext}`);
  await fs.writeFile(sourcePath, new Uint8Array(await video.arrayBuffer()));

  const title = String(form.get("title") || "") || undefined;
  const job = createEditJob(sourcePath, { title });

  return NextResponse.json({ jobId: job.id, status: job.status });
}
