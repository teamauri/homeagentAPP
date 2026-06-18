// Types for the "growth album" — phone photos/videos organized by Iris into a
// day-by-day timeline, with milestone ("First") detection and a milestone +
// support session for Memory.

// ---- What the client uploads ----------------------------------------------
export interface AlbumPhotoInput {
  /** Original file name (helps the fallback heuristic spot screenshots). */
  name: string;
  mimeType: string;
  /** Down-scaled image as a base64 string (no data: prefix). */
  dataBase64: string;
  /** Capture time — File.lastModified (ms) mapped to ISO on the client. */
  capturedAtISO: string;
}

// ---- What the model (or fallback) returns ---------------------------------
export type DropReason = "screenshot" | "receipt" | "meme" | "document" | "blurry" | "duplicate" | "not_family";

export interface PhotoAnalysis {
  index: number;
  keep: boolean;
  /** When keep=false, why it was skipped. */
  reason?: DropReason;
  childId?: string | null;
  mediaKind: "photo" | "video";
  /** A genuinely new thing for this child ("first time ..."). */
  isFirst: boolean;
  firstLabel?: string | null;
}

export interface DayCaption {
  date: string; // YYYY-MM-DD
  caption: string;
}

export interface SessionSuggestion {
  icon: string;
  text: string;
}

export interface AlbumAnalysis {
  photos: PhotoAnalysis[];
  dayCaptions: DayCaption[];
  session: {
    nowSummary: string;
    suggestions: SessionSuggestion[];
  };
}

// ---- The organized result the UI renders ----------------------------------
export interface OrganizedMedia {
  id: string;
  kind: "photo" | "video";
  source: "phone" | "auri";
  /** Thumbnail to render: inline data URL (phone organize) or a real CDN/local
   * URL (robot Stories ingested via DockKit). Undefined → gradient tone tile. */
  thumbDataUrl?: string;
  /** Full media URL to open/play (real ingested media). */
  url?: string;
  /** Gradient class for seed/placeholder tiles. */
  tone?: string;
  durationLabel?: string;
  capturedAtISO: string;
  isFirst: boolean;
  firstLabel?: string;
}

export interface DayGroup {
  dateISO: string;
  dateLabel: string; // "Saturday, Jun 14"
  ageShort?: string; // "3y 4m"
  caption: string;
  isFirstDay: boolean;
  media: OrganizedMedia[];
}

export interface FirstItem {
  id: string;
  label: string;
  dateISO: string;
  dateLabel: string;
  ageLong?: string; // "3 years 4 months"
  mediaId: string;
  kind: "photo" | "video";
  source: "phone" | "auri";
  thumbDataUrl?: string;
  tone?: string;
  durationLabel?: string;
}

export interface MilestoneSession {
  childId: string;
  childName: string;
  ageShort?: string;
  nowSummary: string;
  suggestions: SessionSuggestion[];
  reassurance: string;
}

export interface GrowthData {
  child: { id: string; name: string };
  session: MilestoneSession;
  days: DayGroup[];
  firsts: FirstItem[];
  skippedCount: number;
}
