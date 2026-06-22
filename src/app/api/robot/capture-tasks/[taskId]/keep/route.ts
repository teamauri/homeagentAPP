import { NextResponse } from "next/server";
import {
  createDemoMemoryFromMedia,
  getDemoCalendarEvent,
  listDemoMedia,
  persistDemoStore,
  updateDemoCalendarRobotStatus,
} from "@/lib/demo/demo-store";
import { ensureHydrated, reloadStore } from "@/lib/demo/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: { taskId: string } }) {
  await ensureHydrated();
  await reloadStore("demo");

  const taskId = params.taskId;
  if (!taskId) return NextResponse.json({ error: "taskId is required" }, { status: 400 });

  const event = getDemoCalendarEvent(taskId);
  if (!event || !event.forRobot) {
    return NextResponse.json({ error: "Robot capture task not found" }, { status: 404 });
  }

  // Already kept — return the existing memory id.
  if (event.robot?.rawOutputMemoryId) {
    return NextResponse.json({
      memoryId: event.robot.rawOutputMemoryId,
      memoryUrl: `/memory/${event.robot.rawOutputMemoryId}`,
      alreadyKept: true,
    });
  }

  if (!event.robot?.rawOutputVideoUrl) {
    return NextResponse.json({ error: "Raw output video not yet available" }, { status: 409 });
  }

  // Find the media item(s) that belong to this capture task.
  const allMedia = listDemoMedia();
  const taskMedia = allMedia.filter(
    (m) => m.metadata?.captureTaskId === taskId || m.metadata?.auriVideoId === event.robot?.auriVideoId
  );

  const memory = createDemoMemoryFromMedia(taskMedia.length ? taskMedia : [], {
    title: event.title,
    body: "Kept from Auri Robot recording.",
    status: "saved",
    statusLabel: "Saved",
  });

  if (!memory) {
    return NextResponse.json({ error: "Could not create memory — no media found for this task" }, { status: 409 });
  }

  updateDemoCalendarRobotStatus(taskId, {
    status: "done",
    rawOutputMemoryId: memory.id,
  });
  await persistDemoStore();

  return NextResponse.json({
    memoryId: memory.id,
    memoryUrl: `/memory/${memory.id}`,
    alreadyKept: false,
  });
}
