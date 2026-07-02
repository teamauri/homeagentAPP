import { NextResponse } from "next/server";
import { CalendarApiEvent, CalendarEventInput, type CalendarJobAgentId, type CalendarRobotCaptureStatus } from "@/lib/calendar-api";
import { listDemoCalendarEvents, persistDemoStore, removeDemoCalendarEvent, upsertDemoCalendarEvent } from "@/lib/demo/demo-store";
import { ensureHydrated, reloadStore } from "@/lib/demo/persistence";
import { helperTeamAgentIds, normalizeTeamAgentId } from "@/lib/team";
import type { PersonId } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const personIds = new Set<PersonId>(["child1", "child2", "baby", "mom", "dad", "grandma", "family"]);
const calendarAgentIds = new Set<CalendarJobAgentId>(helperTeamAgentIds);

function normalizeAgent(value: unknown): CalendarJobAgentId | undefined {
  const agent = normalizeTeamAgentId(value);
  return calendarAgentIds.has(agent as CalendarJobAgentId) ? (agent as CalendarJobAgentId) : undefined;
}

function wantsTruthy(value: string | null) {
  return value === "1" || value === "true" || value === "yes";
}

const DISPLAY_TIME_ZONE = "Asia/Shanghai";
const robotTerminalStatuses = new Set<CalendarRobotCaptureStatus>(["uploaded", "done", "failed"]);
const robotClaimedStatuses = new Set<CalendarRobotCaptureStatus>(["recording", "uploading"]);

function robotStatus(event: CalendarApiEvent): CalendarRobotCaptureStatus {
  const status = event.robot?.status ?? event.status;
  if (status === "recording" || status === "uploading" || status === "uploaded" || status === "done" || status === "failed") {
    return status;
  }
  return "scheduled";
}

function timestampFromId(id: string) {
  const match = id.match(/^revent_(\d+)/);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

function parseEventTimestamp(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : undefined;
}

function zonedDayNumber(timestamp: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DISPLAY_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date(timestamp));
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return undefined;
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function isFloatingTodayFromAnotherDay(event: CalendarApiEvent) {
  if (event.dateLabel.trim().toLowerCase() !== "today") return false;
  if (!Number.isFinite(event.scheduledAt)) return false;
  const createdAt = parseEventTimestamp(event.createdAt) ?? timestampFromId(event.id);
  if (!createdAt) return false;
  const createdDay = zonedDayNumber(createdAt);
  const scheduledDay = zonedDayNumber(event.scheduledAt!);
  return createdDay !== undefined && scheduledDay !== undefined && createdDay !== scheduledDay;
}

function isRobotDockKitCandidate(event: CalendarApiEvent, now = Date.now()) {
  if (!event.forRobot) return false;
  const status = robotStatus(event);
  if (robotTerminalStatuses.has(status) || robotClaimedStatuses.has(status)) return false;
  if (isFloatingTodayFromAnotherDay(event)) return false;
  if (Number.isFinite(event.scheduledAt) && event.scheduledAt! < now - 5 * 60 * 1000) return false;
  return true;
}

function sortRobotCandidates(items: CalendarApiEvent[]) {
  return [...items].sort((a, b) => {
    const aScheduled = Number.isFinite(a.scheduledAt) ? a.scheduledAt! : Number.MAX_SAFE_INTEGER;
    const bScheduled = Number.isFinite(b.scheduledAt) ? b.scheduledAt! : Number.MAX_SAFE_INTEGER;
    if (aScheduled !== bScheduled) return aScheduled - bScheduled;
    const aCreated = parseEventTimestamp(a.createdAt) ?? timestampFromId(a.id) ?? 0;
    const bCreated = parseEventTimestamp(b.createdAt) ?? timestampFromId(b.id) ?? 0;
    return bCreated - aCreated;
  });
}

// Only real, family-created jobs — no seed/mock data is ever injected.
function filteredEvents(request: Request) {
  const url = new URL(request.url);
  const source = url.searchParams.get("source");
  const robotOnly = wantsTruthy(url.searchParams.get("robot"));

  let items: CalendarApiEvent[] = listDemoCalendarEvents();
  if (source === "seed") {
    items = []; // seed data has been removed
  } else if (source === "created") {
    items = items.filter((event) => event.source === "created");
  }
  if (robotOnly) {
    items = sortRobotCandidates(items.filter((event) => isRobotDockKitCandidate(event)));
  }
  return items;
}

function responseFor(items: CalendarApiEvent[]) {
  return NextResponse.json({
    items,
    summary: {
      total: items.length,
      seed: items.filter((event) => event.source === "seed").length,
      created: items.filter((event) => event.source === "created").length,
      robot: items.filter((event) => event.forRobot).length,
    },
    metadata: {
      provider: "local-demo-store",
      writable: true,
    },
  });
}

function normalizeInput(body: unknown): { input?: CalendarEventInput; error?: string } {
  if (!body || typeof body !== "object") return { error: "Request body must be an object" };
  const payload = body as Record<string, unknown>;
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const dateLabel = typeof payload.dateLabel === "string" ? payload.dateLabel.trim() : "";
  const timeLabel = typeof payload.timeLabel === "string" ? payload.timeLabel.trim() : "";
  const person = typeof payload.person === "string" && personIds.has(payload.person as PersonId) ? (payload.person as PersonId) : "family";
  const agent = normalizeAgent(payload.agent);

  if (!title) return { error: "title is required" };
  if (!dateLabel) return { error: "dateLabel is required" };
  if (!timeLabel) return { error: "timeLabel is required" };

  return {
    input: {
      id: typeof payload.id === "string" && payload.id.trim() ? payload.id.trim() : undefined,
      title,
      note: typeof payload.note === "string" ? payload.note : undefined,
      body: typeof payload.body === "string" ? payload.body : undefined,
      person,
      scheduledAt: typeof payload.scheduledAt === "number" ? payload.scheduledAt : undefined,
      dateLabel,
      timeLabel,
      forRobot: Boolean(payload.forRobot),
      icon: typeof payload.icon === "string" && payload.icon.trim() ? payload.icon.trim() : undefined,
      agent,
      recordingMode: typeof payload.recordingMode === "string" && payload.recordingMode.trim() ? payload.recordingMode.trim() : undefined,
      photoUrl: typeof payload.photoUrl === "string" ? payload.photoUrl : undefined,
      voiceUrl: typeof payload.voiceUrl === "string" ? payload.voiceUrl : undefined,
      voiceDuration: typeof payload.voiceDuration === "number" ? payload.voiceDuration : undefined,
    },
  };
}

export async function GET(request: Request) {
  await ensureHydrated();
  await reloadStore("demo");
  return responseFor(filteredEvents(request));
}

export async function POST(request: Request) {
  await ensureHydrated();
  await reloadStore("demo");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  const { input, error } = normalizeInput(body);
  if (!input) return NextResponse.json({ error }, { status: 400 });

  const event = upsertDemoCalendarEvent(input);
  await persistDemoStore();

  return NextResponse.json(
    {
      event,
      metadata: {
        provider: "local-demo-store",
      },
    },
    { status: 201 }
  );
}

export async function DELETE(request: Request) {
  await ensureHydrated();
  await reloadStore("demo");

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const removed = removeDemoCalendarEvent(id);
  if (!removed) return NextResponse.json({ error: "Calendar event not found" }, { status: 404 });

  await persistDemoStore();
  return NextResponse.json({ ok: true, id });
}
