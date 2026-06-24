import { NextResponse } from "next/server";
import type { CalendarRobotCaptureStatus } from "@/lib/calendar-api";
import {
  listDemoCalendarEvents,
  persistDemoStore,
  updateDemoCalendarRobotStatus,
  type DemoRobotCaptureStatusInput,
} from "@/lib/demo/demo-store";
import { ensureHydrated, reloadStore } from "@/lib/demo/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROBOT_CAPTURE_STATUSES = new Set<CalendarRobotCaptureStatus>(["scheduled", "recording", "uploading", "uploaded", "done", "failed"]);

function cleanString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function cleanPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function normalizePayload(body: unknown): { input?: DemoRobotCaptureStatusInput; error?: string } {
  if (!body || typeof body !== "object") return { error: "Request body must be an object" };
  const payload = body as Record<string, unknown>;
  const status = cleanString(payload.status);
  if (!status || !ROBOT_CAPTURE_STATUSES.has(status as CalendarRobotCaptureStatus)) {
    return { error: "status must be one of scheduled, recording, uploading, uploaded, done, failed" };
  }

  return {
    input: {
      status: status as CalendarRobotCaptureStatus,
      robotId: cleanString(payload.robotId),
      auriVideoId: cleanString(payload.auriVideoId),
      auriClientVideoUuid: cleanString(payload.auriClientVideoUuid),
      recordingMode: cleanString(payload.recordingMode),
      vlogId: cleanString(payload.vlogId),
      durationSeconds: cleanPositiveNumber(payload.durationSeconds),
      startedAt: cleanString(payload.startedAt),
      uploadedAt: cleanString(payload.uploadedAt),
      failedAt: cleanString(payload.failedAt),
      error: cleanString(payload.error),
    },
  };
}

export async function POST(request: Request, { params }: { params: { taskId: string } }) {
  await ensureHydrated();
  await reloadStore("demo");

  const taskId = params.taskId;
  if (!taskId) return NextResponse.json({ error: "taskId is required" }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  const { input, error } = normalizePayload(body);
  if (!input) return NextResponse.json({ error }, { status: 400 });

  const existing = listDemoCalendarEvents().find((event) => event.id === taskId && event.forRobot);
  if (!existing) return NextResponse.json({ error: "Robot capture task not found" }, { status: 404 });
  if (input.auriClientVideoUuid && existing.auriClientVideoUuid && input.auriClientVideoUuid !== existing.auriClientVideoUuid) {
    return NextResponse.json({ error: "auriClientVideoUuid does not match capture task" }, { status: 409 });
  }

  const event = updateDemoCalendarRobotStatus(taskId, input);
  if (!event) return NextResponse.json({ error: "Robot capture task not found" }, { status: 404 });

  await persistDemoStore();

  return NextResponse.json({
    event,
    metadata: {
      provider: "local-demo-store",
      captureTaskId: event.id,
      auriVideoId: event.robot?.auriVideoId,
      vlogId: event.robot?.vlogId,
      durationSeconds: event.robot?.durationSeconds,
      rawOutputStatus: event.robot?.rawOutputStatus,
    },
  });
}
