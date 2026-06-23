import type { PersonId, Status } from "./types";

export type CalendarApiEventSource = "seed" | "created";
export type CalendarApiEventStatus = Status | "scheduled" | "recording" | "uploading" | "uploaded" | "done" | "failed";
export type CalendarRobotCaptureStatus = "scheduled" | "recording" | "uploading" | "uploaded" | "done" | "failed";
export type CalendarRawOutputStatus = "pending" | "processing" | "ready" | "failed";

export interface CalendarRobotCaptureState {
  status: CalendarRobotCaptureStatus;
  robotId?: string;
  auriVideoId?: string;
  auriClientVideoUuid?: string;
  recordingMode?: string;
  rawOutputStatus?: CalendarRawOutputStatus;
  rawOutputMemoryId?: string;
  rawOutputVideoUrl?: string;
  transcriptJsonUrl?: string;
  transcriptTxtUrl?: string;
  rawOutputReadyAt?: string;
  rawOutputSyncedAt?: string;
  rawOutputError?: string;
  startedAt?: string;
  uploadedAt?: string;
  failedAt?: string;
  error?: string;
  updatedAt: string;
}

export interface CalendarApiEvent {
  id: string;
  title: string;
  person: PersonId;
  // Durable absolute time (epoch ms). dateLabel/timeLabel are derived display
  // strings. Events stored before this field existed are "legacy" and get
  // purged on read, since their frozen "Today" can't be resolved to a real day.
  scheduledAt?: number;
  dateLabel: string;
  timeLabel: string;
  icon: string;
  source: CalendarApiEventSource;
  forRobot: boolean;
  status: CalendarApiEventStatus;
  statusLabel: string;
  body?: string;
  note?: string;
  suggested?: boolean;
  auriClientVideoUuid?: string;
  robot?: CalendarRobotCaptureState;
  photoUrl?: string;
  voiceUrl?: string;
  voiceDuration?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CalendarEventInput {
  id?: string;
  title: string;
  note?: string;
  body?: string;
  person: PersonId;
  scheduledAt?: number;
  dateLabel: string;
  timeLabel: string;
  forRobot?: boolean;
  icon?: string;
  photoUrl?: string;
  voiceUrl?: string;
  voiceDuration?: number;
}

export function deriveCalendarEventIcon(title: string, _person: PersonId) {
  const t = title.toLowerCase();
  if (/piano|music|song|sing/.test(t)) return "piano";
  if (/read|book|story/.test(t)) return "book";
  if (/meal|dinner|lunch|breakfast|eat|cook|snack|吃饭/.test(t)) return "meal";
  if (/photo|album|picture|smile/.test(t)) return "camera-note";
  if (/record|recording|film|video|clip|e2e|highlight/.test(t)) return "camera-note";
  if (/call|grandma|grandpa|phone/.test(t)) return "video-heart";
  if (/soccer|play|sport|run|stretch|jump|exercise|dance|swim/.test(t)) return "soccer";
  if (/draw|paint|art|write|color/.test(t)) return "pencil";
  if (/medicine|med|药|pill|vitamin|吃药|dose/.test(t)) return "bell";
  if (/school|class|lesson|homework|study|preschool|dropoff/.test(t)) return "backpack";
  if (/remind|alert|check|confirm/.test(t)) return "bell";
  return "spark";
}
