import { NextResponse } from "next/server";
import { CalendarApiEvent, CalendarEventInput } from "@/lib/calendar-api";
import { listDemoCalendarEvents, persistDemoStore, removeDemoCalendarEvent, upsertDemoCalendarEvent } from "@/lib/demo/demo-store";
import { ensureHydrated, reloadStore } from "@/lib/demo/persistence";
import type { PersonId } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const personIds = new Set<PersonId>(["mia", "leo", "baby", "mom", "dad", "grandma", "family"]);

function wantsTruthy(value: string | null) {
  return value === "1" || value === "true" || value === "yes";
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
    items = items.filter((event) => event.forRobot);
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
