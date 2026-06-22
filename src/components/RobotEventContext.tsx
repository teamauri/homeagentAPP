"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { deriveCalendarEventIcon, type CalendarApiEvent } from "@/lib/calendar-api";
import type { PersonId } from "@/lib/types";

// A "robot event" is a calendar event the parent hands to the Auri Robot: the
// robot shows a reminder at the set time, captures the moment, then sends the
// clip back into family chat. This context is the UI-only source of truth —
// it holds the events, drives the demo Scheduled → Recording → Done flow, and
// exposes the finished ones so Chat can render them as keepsakes.

export type RobotEventStatus = "scheduled" | "recording" | "done";

export interface RobotEventResult {
  videoUrl: string;
  poster?: string;
  duration: string;
  memoryUrl?: string;
  transcriptJsonUrl?: string;
  transcriptTxtUrl?: string;
}

export interface RobotEvent {
  id: string;
  title: string;
  note?: string;
  person: PersonId;
  dateLabel: string;
  timeLabel: string;
  icon: string;
  // When true the robot shows a reminder + captures it; when false it's just a
  // plain calendar event the family planned (still shown on the calendar).
  forRobot: boolean;
  photoUrl?: string;
  voiceUrl?: string;
  voiceDuration?: number;
  status: RobotEventStatus;
  completedAtLabel?: string;
  result?: RobotEventResult;
  robot?: CalendarApiEvent["robot"];
  // Highlight jobs capture real moments across a window. While "recording" the
  // counters climb from actual run state (see startHighlight); on "done" the
  // edited set lands as the keepsake.
  kind?: "highlight";
  highlight?: { clipTarget: number; photoTarget: number };
  highlightProgress?: { clips: number; photos: number };
}

export interface NewRobotEventInput {
  title: string;
  note?: string;
  person: PersonId;
  dateLabel: string;
  timeLabel: string;
  forRobot: boolean;
  photoUrl?: string;
  voiceUrl?: string;
  voiceDuration?: number;
}

type RobotEventContextValue = {
  events: RobotEvent[];
  completions: RobotEvent[];
  addEvent: (input: NewRobotEventInput) => string;
  removeEvent: (id: string) => void;
  runEvent: (id: string) => void;
  startHighlight: (opts?: { title?: string; person?: PersonId; clipTarget?: number; photoTarget?: number }) => string;
};

const RobotEventContext = createContext<RobotEventContextValue | null>(null);

// Stand-in capture clips for the demo "Done" state (real app would attach the
// video the robot actually recorded).
const DEMO_RESULTS: RobotEventResult[] = [
  { videoUrl: "/demo-media/2a90a095-6e5f-4463-a0e9-03d52689ca01.mp4", poster: "/demo-media/04b13ae3-ee7b-44f0-b545-602da2aaee88.jpg", duration: "2:14" },
  { videoUrl: "/demo-media/5f1889cd-9669-4f21-800d-a55dd7aae7b7.mp4", poster: "/demo-media/6a833cf4-0d2e-4503-a294-b032fa63f7eb.jpg", duration: "1:38" },
];

function nowLabel() {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(new Date());
}

// Pick a warm doodle icon from the event's wording, falling back to the child.
export const deriveEventIcon = deriveCalendarEventIcon;

const STORAGE_KEY = "auri.events.v1";

function statusFromApi(status: CalendarApiEvent["status"]): RobotEventStatus {
  if (status === "recording" || status === "uploading" || status === "uploaded") return "recording";
  if (status === "done") return "done";
  return "scheduled";
}

function labelFromIso(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return nowLabel();
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(date);
}

function eventFromApi(event: CalendarApiEvent): RobotEvent {
  const rawVideoUrl = event.robot?.rawOutputVideoUrl;
  return {
    id: event.id,
    title: event.title,
    note: event.note ?? event.body,
    person: event.person,
    dateLabel: event.dateLabel,
    timeLabel: event.timeLabel,
    icon: event.icon,
    forRobot: event.forRobot,
    photoUrl: event.photoUrl,
    voiceUrl: event.voiceUrl,
    voiceDuration: event.voiceDuration,
    robot: event.robot,
    status: rawVideoUrl ? "done" : statusFromApi(event.status),
    completedAtLabel: event.robot?.rawOutputReadyAt ? labelFromIso(event.robot.rawOutputReadyAt) : undefined,
    result: rawVideoUrl
      ? {
          videoUrl: rawVideoUrl,
          duration: "Recorded",
          memoryUrl: event.robot?.rawOutputMemoryId ? `/memory/${event.robot.rawOutputMemoryId}` : undefined,
          transcriptJsonUrl: event.robot?.transcriptJsonUrl,
          transcriptTxtUrl: event.robot?.transcriptTxtUrl,
        }
      : undefined,
  };
}

function mergeEvents(current: RobotEvent[], incoming: RobotEvent[]) {
  const byId = new Map(current.map((event) => [event.id, event]));
  for (const event of incoming) byId.set(event.id, event);
  return [...byId.values()];
}

function persistEventToCalendarApi(event: RobotEvent) {
  fetch("/api/calendar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: event.id,
      title: event.title,
      note: event.note,
      person: event.person,
      dateLabel: event.dateLabel,
      timeLabel: event.timeLabel,
      forRobot: event.forRobot,
      photoUrl: event.photoUrl,
      voiceUrl: event.voiceUrl,
      voiceDuration: event.voiceDuration,
    }),
  }).catch(() => {
    // Keep the local demo path usable even if the server API is unavailable.
  });
}

function removeEventFromCalendarApi(id: string) {
  fetch(`/api/calendar?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {
    // Keep local deletion responsive even if server persistence fails.
  });
}

export function RobotEventProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<RobotEvent[]>([]);
  const [ready, setReady] = useState(false);
  const completedCount = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const syncingTasks = useRef<Set<string>>(new Set());

  const refreshCreatedEvents = useCallback(() => {
    return fetch("/api/calendar?source=created")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { items?: CalendarApiEvent[] } | null) => {
        if (!Array.isArray(payload?.items)) return;
        const apiEvents = payload.items.map(eventFromApi);
        setEvents((current) => mergeEvents(current, apiEvents));
        completedCount.current = apiEvents.filter((event) => event.status === "done").length;
      })
      .catch(() => undefined);
  }, []);

  // Hydrate created events from localStorage so they survive reloads and the
  // full-page navigation to /calendar (which is a separate route).
  useEffect(() => {
    let localEvents: RobotEvent[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length) {
        // Any event left "recording" from a previous session never finished.
        localEvents = parsed.map((e: RobotEvent) => (e.status === "recording" ? { ...e, status: "scheduled" } : e));
        setEvents(localEvents);
        completedCount.current = localEvents.filter((e: RobotEvent) => e.status === "done").length;
      }
    } catch {
      // ignore malformed storage
    }

    for (const event of localEvents) persistEventToCalendarApi(event);

    void refreshCreatedEvents();

    setReady(true);
  }, [refreshCreatedEvents]);

  // Persist after hydration (the `ready` gate avoids clobbering storage with the
  // initial empty array before the load effect has run).
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch {
      // ignore quota / serialization failures
    }
  }, [events, ready]);

  useEffect(() => {
    if (!ready) return;
    const interval = setInterval(() => {
      void refreshCreatedEvents();
    }, 5000);
    return () => clearInterval(interval);
  }, [ready, refreshCreatedEvents]);

  // Heartbeat: re-POST pending robot events every 30s so Render's in-memory
  // calendar stays populated even after a cold start. DockKit polls every 5s,
  // so this guarantees it finds events as long as the web app is open.
  useEffect(() => {
    if (!ready) return;
    const interval = setInterval(() => {
      events
        .filter((e) => e.forRobot && e.status !== "done")
        .forEach(persistEventToCalendarApi);
    }, 30_000);
    return () => clearInterval(interval);
  }, [ready, events]);

  useEffect(() => {
    if (!ready) return;
    const candidates = events.filter(
      (event) =>
        event.forRobot &&
        event.robot?.auriVideoId &&
        event.robot?.recordingMode === "story_tracking_raw_transcript" &&
        (event.robot.rawOutputStatus === "pending" || event.robot.rawOutputStatus === "processing") &&
        !event.robot.rawOutputVideoUrl &&
        !syncingTasks.current.has(event.id)
    );

    for (const event of candidates) {
      syncingTasks.current.add(event.id);
      fetch(`/api/robot/capture-tasks/${encodeURIComponent(event.id)}/raw-output/sync`, { method: "POST" })
        .then(() => refreshCreatedEvents())
        .catch(() => undefined)
        .finally(() => {
          syncingTasks.current.delete(event.id);
        });
    }
  }, [events, ready, refreshCreatedEvents]);

  // Clear any pending demo transitions if the app unmounts.
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const addEvent = useCallback((input: NewRobotEventInput) => {
    const id = `revent_${Date.now()}`;
    const event: RobotEvent = {
      id,
      title: input.title,
      note: input.note,
      person: input.person,
      dateLabel: input.dateLabel,
      timeLabel: input.timeLabel,
      forRobot: input.forRobot,
      icon: deriveEventIcon(input.title, input.person),
      photoUrl: input.photoUrl,
      voiceUrl: input.voiceUrl,
      voiceDuration: input.voiceDuration,
      status: "scheduled",
    };
    setEvents((current) => [...current, event]);
    persistEventToCalendarApi(event);
    return id;
  }, []);

  const removeEvent = useCallback((id: string) => {
    setEvents((current) => current.filter((event) => event.id !== id));
    removeEventFromCalendarApi(id);
  }, []);

  // Demo: walk an event from Scheduled → Recording → Done, attaching a clip at
  // the end so Chat can surface the keepsake.
  const runEvent = useCallback((id: string) => {
    setEvents((current) => current.map((event) => (event.id === id && event.status === "scheduled" ? { ...event, status: "recording" } : event)));
    const t = setTimeout(() => {
      const result = DEMO_RESULTS[completedCount.current % DEMO_RESULTS.length];
      completedCount.current += 1;
      setEvents((current) =>
        current.map((event) =>
          event.id === id && event.status === "recording"
            ? { ...event, status: "done", completedAtLabel: nowLabel(), result }
            : event
        )
      );
    }, 4200);
    timers.current.push(t);
  }, []);

  // Start a highlight job: it goes straight to "recording" and the capture
  // counters tick up from real run state until both targets are met, then it
  // settles to "done" with the edited set. The progress lives on the event, so
  // the Home stream renders a live counter card bound to it.
  const startHighlight = useCallback((opts?: { title?: string; person?: PersonId; clipTarget?: number; photoTarget?: number }) => {
    const id = `revent_${Date.now()}`;
    const clipTarget = opts?.clipTarget ?? 3;
    const photoTarget = opts?.photoTarget ?? 5;
    setEvents((current) => [
      ...current,
      {
        id,
        title: opts?.title ?? "Evening highlights",
        person: opts?.person ?? "family",
        dateLabel: "Today",
        timeLabel: nowLabel(),
        icon: "camera-note",
        forRobot: true,
        kind: "highlight",
        highlight: { clipTarget, photoTarget },
        highlightProgress: { clips: 0, photos: 0 },
        status: "recording",
      },
    ]);

    // Closure-tracked progress keeps each setEvents updater pure (no scheduling
    // side effects inside the updater).
    let clips = 0;
    let photos = 0;
    const step = () => {
      // Catch whichever target is proportionally furthest behind.
      if (photos < photoTarget && (clips >= clipTarget || photos / photoTarget <= clips / clipTarget)) photos += 1;
      else if (clips < clipTarget) clips += 1;

      if (clips >= clipTarget && photos >= photoTarget) {
        const result = DEMO_RESULTS[completedCount.current % DEMO_RESULTS.length];
        completedCount.current += 1;
        setEvents((current) => current.map((event) => (event.id === id ? { ...event, highlightProgress: { clips, photos }, status: "done", completedAtLabel: nowLabel(), result } : event)));
        return;
      }
      setEvents((current) => current.map((event) => (event.id === id ? { ...event, highlightProgress: { clips, photos } } : event)));
      const next = setTimeout(step, 850);
      timers.current.push(next);
    };
    const first = setTimeout(step, 850);
    timers.current.push(first);
    return id;
  }, []);

  const completions = useMemo(() => events.filter((event) => event.status === "done"), [events]);

  const value = useMemo<RobotEventContextValue>(() => ({ events, completions, addEvent, removeEvent, runEvent, startHighlight }), [events, completions, addEvent, removeEvent, runEvent, startHighlight]);

  return <RobotEventContext.Provider value={value}>{children}</RobotEventContext.Provider>;
}

export function useRobotEvents() {
  const ctx = useContext(RobotEventContext);
  if (!ctx) throw new Error("useRobotEvents must be used within a RobotEventProvider");
  return ctx;
}
