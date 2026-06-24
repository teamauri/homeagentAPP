import { NextResponse } from "next/server";
import { syncHighlightForTask } from "@/lib/robot/highlight-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: { taskId: string } }) {
  const taskId = params.taskId;
  if (!taskId) return NextResponse.json({ error: "taskId is required" }, { status: 400 });

  const result = await syncHighlightForTask(taskId);
  const body = {
    outcome: result.outcome,
    event: result.event,
    media: result.media,
    memoryId: result.memoryId,
    mediaUrl: result.mediaUrl,
    error: result.error,
    detail: result.detail,
    metadata: result.metadata,
  };

  return NextResponse.json(body, { status: result.httpStatus });
}
