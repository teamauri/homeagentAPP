import { NextResponse } from "next/server";
import { getEditJob } from "@/lib/auri/jobs";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { jobId: string } }) {
  const job = getEditJob(params.jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    title: job.title,
    result: job.result ?? null,
    error: job.error ?? null,
  });
}
