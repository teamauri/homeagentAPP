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
  dateLabel: string;
  timeLabel: string;
  forRobot?: boolean;
  photoUrl?: string;
  voiceUrl?: string;
  voiceDuration?: number;
}

export function deriveCalendarEventIcon(title: string, person: PersonId) {
  const t = title.toLowerCase();
  if (/piano|music|song|sing/.test(t)) return "piano";
  if (/read|book|story/.test(t)) return "book";
  if (/meal|dinner|lunch|breakfast|eat|cook|snack/.test(t)) return "meal";
  if (/photo|album|picture|smile/.test(t)) return "camera-note";
  if (/call|grandma|grandpa|phone/.test(t)) return "phone";
  if (/soccer|play|sport|run|stretch|jump|exercise|dance|swim/.test(t)) return "soccer";
  if (/draw|paint|art|write|color/.test(t)) return "pencil";
  if (person === "mia") return "girl";
  if (person === "leo") return "boy";
  if (person === "family") return "family";
  return "spark";
}
