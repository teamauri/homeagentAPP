"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { deriveCalendarEventIcon, type CalendarApiEvent } from "@/lib/calendar-api";
import { resetClientUserDataOnce } from "@/lib/client-user-data-reset";
import type { PersonId } from "@/lib/types";
import { normalizeTeamAgentId, type TeamAgentId } from "@/lib/team";
import { deriveDateLabel, deriveTimeLabel, scheduledAtFromLabels } from "@/lib/job-time";

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
  summary?: string;
  transcriptJsonUrl?: string;
  transcriptTxtUrl?: string;
}

export interface RobotEvent {
  id: string;
  title: string;
  note?: string;
  person: PersonId;
  // Canonical scheduled time (epoch ms). dateLabel/timeLabel are DERIVED from
  // this for display + kept in sync for the calendar API / DockKit, which still
  // speak in strings. scheduledAt is the source of truth for ordering + expiry.
  scheduledAt: number;
  dateLabel: string;
  timeLabel: string;
  icon: string;
  agent?: TeamAgentId;
  recordingMode?: string;
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
  // counters can climb from actual run state; on "done" the edited set lands as
  // the keepsake.
  kind?: "highlight";
  highlight?: { clipTarget: number; photoTarget: number };
  highlightProgress?: { clips: number; photos: number };
  kept?: boolean;
}

export interface NewRobotEventInput {
  title: string;
  note?: string;
  person: PersonId;
  // Preferred: a real datetime. dateLabel/timeLabel are derived from it. Callers
  // that only have strings (legacy chat drafts) may pass those instead.
  scheduledAt?: number;
  dateLabel?: string;
  timeLabel?: string;
  forRobot: boolean;
  agent?: TeamAgentId;
  recordingMode?: string;
  photoUrl?: string;
  voiceUrl?: string;
  voiceDuration?: number;
}

type RobotEventContextValue = {
  events: RobotEvent[];
  completions: RobotEvent[];
  ready: boolean;
  addEvent: (input: NewRobotEventInput) => string;
  updateEvent: (id: string, updates: Partial<Pick<RobotEvent, "title" | "note" | "person" | "scheduledAt" | "dateLabel" | "timeLabel">>) => void;
  keepEvent: (id: string) => void;
  removeEvent: (id: string) => void;
  runEvent: (id: string) => void;
};

const RobotEventContext = createContext<RobotEventContextValue | null>(null);

// Pick a warm doodle icon from the event's wording, falling back to the child.
export const deriveEventIcon = deriveCalendarEventIcon;

const STORAGE_KEY = "auri.events.v1";
// Tombstones: ids the user deleted locally. The 5s server poll must never
// resurrect these, even if a stale copy still lives in the server snapshot.
const TOMBSTONE_KEY = "auri.deletedIds.v1";
const EVENT_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_STORED_EVENTS = 150;

function nowLabel() {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(new Date());
}

function readTombstones(): Set<string> {
  try {
    const raw = localStorage.getItem(TOMBSTONE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function addTombstone(id: string) {
  try {
    const set = readTombstones();
    set.add(id);
    localStorage.setItem(TOMBSTONE_KEY, JSON.stringify([...set]));
  } catch {
    // ignore storage failures
  }
}

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

function durationLabel(seconds?: number) {
  if (!seconds || !Number.isFinite(seconds)) return "Edited highlight";
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return minutes ? `${minutes}:${String(rest).padStart(2, "0")}` : `${rest}s`;
}

function agentFromIcon(icon: string): TeamAgentId {
  if (icon === "camera-note") return "cameraman";
  if (icon === "home") return "watcher";
  if (icon === "book") return "companion";
  if (icon === "muscle" || icon === "soccer") return "coach";
  if (icon === "baby") return "baby_logger";
  return "homekeeper";
}

function normalizeRobotAgent(value: unknown, icon: string): TeamAgentId {
  const agent = normalizeTeamAgentId(value);
  return agent && agent !== "auri" ? agent : agentFromIcon(icon);
}

function timestampFromEventId(id: string): number | undefined {
  const match = id.match(/^revent_(\d+)/);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

function legacyScheduledAt(dateLabel: string, timeLabel: string, anchor?: number) {
  return scheduledAtFromLabels(dateLabel, timeLabel, anchor ?? Date.now());
}

function robotEventActivityTime(event: RobotEvent): number {
  const completedAt =
    event.robot?.highlightSyncedAt ??
    event.robot?.rawOutputReadyAt ??
    event.robot?.uploadedAt ??
    event.robot?.startedAt;
  if (completedAt) {
    const time = new Date(completedAt).getTime();
    if (Number.isFinite(time)) return time;
  }
  return Number.isFinite(event.scheduledAt) ? event.scheduledAt : timestampFromEventId(event.id) ?? Date.now();
}

function pruneStoredEvents(events: RobotEvent[], now = Date.now()): RobotEvent[] {
  const cutoff = now - EVENT_RETENTION_MS;
  return events
    .filter((event) => event.status === "recording" || robotEventActivityTime(event) >= cutoff)
    .sort((a, b) => robotEventActivityTime(a) - robotEventActivityTime(b))
    .slice(-MAX_STORED_EVENTS);
}

function eventFromApi(event: CalendarApiEvent): RobotEvent {
  const rawVideoUrl = event.robot?.rawOutputVideoUrl;
  const highlightVideoUrl = event.robot?.highlightVideoUrl;
  const icon = (event.icon && event.icon !== "spark") ? event.icon : deriveCalendarEventIcon(event.title, event.person);
  // Prefer the durable absolute time. Legacy events (no scheduledAt) fall back
  // to parsing labels relative to the event's creation time. Otherwise an old
  // frozen "Today" label gets reinterpreted as the current day on every read.
  const createdAnchor = event.createdAt ? new Date(event.createdAt).getTime() : timestampFromEventId(event.id);
  const scheduledAt =
    typeof event.scheduledAt === "number"
      ? event.scheduledAt
      : legacyScheduledAt(event.dateLabel, event.timeLabel, createdAnchor) ??
        (event.createdAt ? new Date(event.createdAt).getTime() : Date.now());
  return {
    id: event.id,
    title: event.title,
    note: event.note ?? event.body,
    person: event.person,
    scheduledAt,
    // Always derive display labels from the real time — never trust the server's
    // frozen "Today"/"now" strings, which would otherwise re-pin to today daily.
    dateLabel: deriveDateLabel(scheduledAt),
    timeLabel: deriveTimeLabel(scheduledAt),
    icon,
    agent: normalizeRobotAgent(event.agent, icon),
    recordingMode: event.recordingMode ?? event.robot?.recordingMode,
    forRobot: event.forRobot,
    photoUrl: event.photoUrl,
    voiceUrl: event.voiceUrl,
    voiceDuration: event.voiceDuration,
    robot: event.robot,
    status: rawVideoUrl || highlightVideoUrl ? "done" : statusFromApi(event.status),
    completedAtLabel: event.robot?.highlightSyncedAt
      ? labelFromIso(event.robot.highlightSyncedAt)
      : event.robot?.rawOutputReadyAt
        ? labelFromIso(event.robot.rawOutputReadyAt)
        : undefined,
    result: highlightVideoUrl
      ? {
          videoUrl: highlightVideoUrl,
          duration: durationLabel(event.robot?.durationSeconds),
          memoryUrl: event.robot?.highlightMemoryId ? `/memory/${event.robot.highlightMemoryId}` : undefined,
        }
      : rawVideoUrl
      ? {
          videoUrl: rawVideoUrl,
          poster: event.robot?.rawOutputPosterUrl,
          duration: "Recorded",
          memoryUrl: event.robot?.rawOutputMemoryId ? `/memory/${event.robot.rawOutputMemoryId}` : undefined,
          summary: event.robot?.rawOutputSummary,
          transcriptJsonUrl: event.robot?.transcriptJsonUrl,
          transcriptTxtUrl: event.robot?.transcriptTxtUrl,
        }
      : undefined,
  };
}

function mergeEvents(current: RobotEvent[], incoming: RobotEvent[]) {
  const tombstoned = readTombstones();
  const byId = new Map(current.map((event) => [event.id, event]));
  for (const event of incoming) {
    // Only skip jobs the user explicitly deleted (tombstoned). A past scheduled
    // time is NOT a reason to drop — the job stays so DockKit can record it and
    // the calendar can show it; Upcoming hides past jobs at the view level.
    if (tombstoned.has(event.id)) continue;
    const existing = byId.get(event.id);
    if (existing?.status === "done" && event.status === "scheduled" && event.forRobot) {
      byId.set(event.id, existing);
      continue;
    }
    if (existing?.status === "recording" && event.status === "scheduled" && event.forRobot) {
      const robot = event.robot && existing.robot
        ? { ...event.robot, ...existing.robot, status: existing.robot.status }
        : existing.robot ?? event.robot;
      byId.set(event.id, {
        ...event,
        status: "recording",
        completedAtLabel: existing.completedAtLabel,
        result: existing.result,
        robot,
        kept: existing.kept,
      });
      continue;
    }
    // Preserve client-only fields the API doesn't know about (e.g. kept).
    byId.set(event.id, existing ? { ...event, kept: existing.kept } : event);
  }
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
      scheduledAt: event.scheduledAt,
      dateLabel: event.dateLabel,
      timeLabel: event.timeLabel,
      forRobot: event.forRobot,
      icon: event.icon,
      agent: event.agent,
      recordingMode: event.recordingMode ?? event.robot?.recordingMode,
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
  resetClientUserDataOnce();
  const [events, setEvents] = useState<RobotEvent[]>([]);
  const [ready, setReady] = useState(false);
  const syncingTasks = useRef<Set<string>>(new Set());

  const refreshCreatedEvents = useCallback(() => {
    return fetch("/api/calendar?source=created")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { items?: CalendarApiEvent[] } | null) => {
        if (!Array.isArray(payload?.items)) return;
        // The poll READS the server; it must never DELETE from it. Deleting jobs
        // here (for a missing timestamp or a passed time) is what made freshly
        // created jobs vanish within 5s and never reach the robot. eventFromApi
        // backfills scheduledAt from the labels when the server didn't store one,
        // so nothing is lost. Deletion happens only on an explicit user action.
        const apiEvents = payload.items.map(eventFromApi);
        setEvents((current) => mergeEvents(current, apiEvents));
      })
      .catch(() => undefined);
  }, []);

  // Hydrate created events from localStorage so they survive reloads and the
  // full-page navigation to /calendar (which is a separate route).
  useEffect(() => {
    let cancelled = false;
    let localEvents: RobotEvent[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length) {
        const migrated: RobotEvent[] = parsed.map((e: RobotEvent) => {
          // Any event left "recording" from a previous session never finished.
          const status = e.status === "recording" ? "scheduled" : e.status;
          // Backfill scheduledAt for events stored before timestamps existed.
          const scheduledAt = Number.isFinite(e.scheduledAt)
            ? e.scheduledAt
            : legacyScheduledAt(e.dateLabel, e.timeLabel, timestampFromEventId(e.id)) ?? Date.now();
          // Re-derive labels so a frozen "Today" from a prior day shows correctly.
          const icon = e.icon || deriveEventIcon(e.title, e.person);
          return {
            ...e,
            status,
            scheduledAt,
            dateLabel: deriveDateLabel(scheduledAt),
            timeLabel: deriveTimeLabel(scheduledAt),
            icon,
            agent: normalizeRobotAgent(e.agent, icon),
          };
        });
        // Keep every job — a past scheduled time is NOT a reason to delete. The
        // robot (DockKit) needs the job to stay on the server through and past
        // its scheduled minute so it can record it. Upcoming hides past one-time
        // jobs at the view level (JobsView filters scheduledAt > now); the
        // calendar still shows them on their day. Deletion only happens on an
        // explicit user action (removeEvent) — never on a staleness heuristic.
        localEvents = pruneStoredEvents(migrated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(localEvents));
        setEvents(localEvents);
      }
    } catch {
      // ignore malformed storage
    }

    // Deliberately do NOT re-POST loaded events here. They were already persisted
    // on create; re-posting on every load is what made deleted/dead jobs come
    // back. The server keeps created events on its persistent disk.

    void refreshCreatedEvents().finally(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [refreshCreatedEvents]);

  // Persist after hydration (the `ready` gate avoids clobbering storage with the
  // initial empty array before the load effect has run).
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pruneStoredEvents(events)));
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

  // NOTE: there is deliberately no "heartbeat" that re-POSTs loaded events. Doing
  // so made every open tab resurrect data — a client would load the server's
  // events into local state, then push them all back every 30s, so nothing could
  // ever be deleted. Events are persisted once on create/edit (addEvent /
  // updateEvent) and kept by the server's persistent disk; that is enough.

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

  useEffect(() => {
    if (!ready) return;
    const candidates = events.filter(
      (event) =>
        event.forRobot &&
        (event.recordingMode === "cameraman_highlight" || event.robot?.recordingMode === "cameraman_highlight") &&
        event.robot?.auriVideoId &&
        !event.robot.highlightVideoUrl &&
        !event.robot.highlightMemoryId &&
        !syncingTasks.current.has(event.id)
    );

    for (const event of candidates) {
      syncingTasks.current.add(event.id);
      fetch(`/api/robot/capture-tasks/${encodeURIComponent(event.id)}/highlight/sync`, { method: "POST" })
        .then(() => refreshCreatedEvents())
        .catch(() => undefined)
        .finally(() => {
          syncingTasks.current.delete(event.id);
        });
    }
  }, [events, ready, refreshCreatedEvents]);

  const addEvent = useCallback((input: NewRobotEventInput) => {
    const id = `revent_${Date.now()}`;
    // Resolve to a real datetime, then derive the display labels from it so
    // they always read correctly ("Today" only when it actually is today).
    const scheduledAt =
      input.scheduledAt ??
      scheduledAtFromLabels(input.dateLabel ?? "Today", input.timeLabel ?? "now") ??
      Date.now();
    const event: RobotEvent = {
      id,
      title: input.title,
      note: input.note,
      person: input.person,
      scheduledAt,
      dateLabel: deriveDateLabel(scheduledAt),
      timeLabel: deriveTimeLabel(scheduledAt),
      forRobot: input.forRobot,
      icon: deriveEventIcon(input.title, input.person),
      agent: normalizeRobotAgent(input.agent, deriveEventIcon(input.title, input.person)),
      recordingMode: input.recordingMode,
      photoUrl: input.photoUrl,
      voiceUrl: input.voiceUrl,
      voiceDuration: input.voiceDuration,
      status: "scheduled",
    };
    setEvents((current) => [...current, event]);
    persistEventToCalendarApi(event);
    return id;
  }, []);

  const updateEvent = useCallback((id: string, updates: Partial<Pick<RobotEvent, "title" | "note" | "person" | "scheduledAt" | "dateLabel" | "timeLabel">>) => {
    setEvents((current) => current.map((event) => {
      if (event.id !== id) return event;
      // Keep scheduledAt and the display labels in lockstep, whichever changed.
      const next = { ...event, ...updates };
      if (typeof updates.scheduledAt === "number") {
        next.dateLabel = deriveDateLabel(updates.scheduledAt);
        next.timeLabel = deriveTimeLabel(updates.scheduledAt);
      } else if (updates.dateLabel !== undefined || updates.timeLabel !== undefined) {
        const resolved = scheduledAtFromLabels(next.dateLabel, next.timeLabel);
        if (resolved !== null) next.scheduledAt = resolved;
      }
      persistEventToCalendarApi(next);
      return next;
    }));
  }, []);

  const keepEvent = useCallback((id: string) => {
    // Optimistically mark as kept in local state, then persist to server.
    setEvents((current) => current.map((event) => (event.id === id ? { ...event, kept: true } : event)));
    fetch(`/api/robot/capture-tasks/${encodeURIComponent(id)}/keep`, { method: "POST" })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.memoryUrl) {
          setEvents((current) =>
            current.map((event) =>
              event.id === id && event.result
                ? { ...event, result: { ...event.result, memoryUrl: data.memoryUrl } }
                : event
            )
          );
        }
      })
      .catch(() => {});
  }, []);


  const removeEvent = useCallback((id: string) => {
    // Tombstone so the server poll can't resurrect it on the next 5s tick.
    addTombstone(id);
    setEvents((current) => current.filter((event) => event.id !== id));
    removeEventFromCalendarApi(id);
  }, []);

  // Local/manual start only moves a job into Recording. A completed chat receipt
  // must come from a real robot/backend artifact with a video URL.
  const runEvent = useCallback((id: string) => {
    setEvents((current) => current.map((event) => (event.id === id && event.status === "scheduled" ? { ...event, status: "recording" } : event)));
  }, []);

  const completions = useMemo(() => events.filter((event) => event.status === "done" && !!event.result?.videoUrl), [events]);

  const value = useMemo<RobotEventContextValue>(
    () => ({ events, completions, ready, addEvent, updateEvent, keepEvent, removeEvent, runEvent }),
    [events, completions, ready, addEvent, updateEvent, keepEvent, removeEvent, runEvent]
  );

  return <RobotEventContext.Provider value={value}>{children}</RobotEventContext.Provider>;
}

export function useRobotEvents() {
  const ctx = useContext(RobotEventContext);
  if (!ctx) throw new Error("useRobotEvents must be used within a RobotEventProvider");
  return ctx;
}
