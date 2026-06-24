import type { PersonId } from "@/lib/types";
import type { ChatResponseCard, CreatedLocalObject, ObjectToCreate } from "@/lib/chat-server/types";
import { normalizeTeamAgentId, type TeamAgentId } from "@/lib/team";

// A reminder / calendar card Auri proposes in chat that the user can confirm
// inline (no navigation). Confirming turns it into a real calendar event.
export type DraftInfo = {
  kind: "calendar" | "reminder";
  objectId?: string;
  title: string;
  person: PersonId;
  personLabel: string;
  dateLabel: string;
  timeLabel: string;
  agent?: TeamAgentId;
  recordingMode?: string;
  note?: string;
};

// A chat card optionally carrying a confirmable draft.
export type ChatTurnCard = ChatResponseCard & { draft?: DraftInfo };

const PERSON_IDS: PersonId[] = ["mia", "leo", "baby", "mom", "dad", "grandma", "family"];

function normalizePerson(value: unknown): { id: PersonId; label: string } {
  const raw = typeof value === "string" ? value.trim() : "";
  const match = PERSON_IDS.find((p) => p === raw.toLowerCase());
  if (match) return { id: match, label: raw ? raw[0].toUpperCase() + raw.slice(1).toLowerCase() : match };
  if (raw) return { id: "family", label: raw };
  return { id: "family", label: "Family" };
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// The demo's calendar week is Fri Jun 19 → Thu Jun 25, 2026, with "today" = the
// 19th. Map an absolute date onto a label the calendar understands; anything
// outside the visible week falls back to "Today" so it still surfaces.
function demoDayLabel(d: Date): string {
  if (d.getUTCFullYear() === 2026 && d.getUTCMonth() === 5) {
    const day = d.getUTCDate();
    if (day === 19) return "Today";
    if (day === 20) return "Tomorrow";
    if (day >= 21 && day <= 25) return WEEKDAYS[d.getUTCDay()];
  }
  return "Today";
}

function formatTimeUTC(d: Date): string {
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

const TIME_RE = /(\d{1,2}):(\d{2})\s*(AM|PM)/i;
const DAY_WORDS = ["today", "tomorrow", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function pickFromCompound(label: string): { dateLabel?: string; timeLabel?: string } {
  const parts = label.split(/·|,/).map((s) => s.trim()).filter(Boolean);
  let timeLabel: string | undefined;
  let dateLabel: string | undefined;
  for (const part of parts) {
    if (!timeLabel && TIME_RE.test(part)) timeLabel = part.match(TIME_RE)![0];
    else if (!dateLabel && DAY_WORDS.includes(part.toLowerCase())) dateLabel = part;
  }
  return { dateLabel, timeLabel };
}

const ISO_DATETIME_RE = /\d{4}-\d{2}-\d{2}T/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_24_RE = /^(\d{1,2}):(\d{2})$/;

// "17:30" → "5:30 PM"; leaves already-friendly labels ("5:30 PM", "Friday") alone.
// "now" → actual current time + 1 minute (AI sometimes returns the word "now" instead of the time).
function formatTimeField(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  if (v.toLowerCase() === "now") {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
      .format(new Date(Date.now() + 60_000));
  }
  const friendly = v.match(TIME_RE);
  if (friendly) {
    const h = parseInt(friendly[1], 10);
    const period = friendly[3].toUpperCase();
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${h12}:${friendly[2]} ${period}`;
  }
  const m = v.match(TIME_24_RE);
  if (m) {
    const h = parseInt(m[1], 10);
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m[2]} ${period}`;
  }
  return v || undefined;
}

// "2026-06-19" → a demo-week label ("Today"); leaves "Friday"/"Today" alone.
function formatDateField(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  if (ISO_DATE_RE.test(v)) {
    const d = new Date(`${v}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) return demoDayLabel(d);
  }
  return v || undefined;
}

function humanizeWhen(payload: Record<string, unknown>): { dateLabel: string; timeLabel: string } {
  // The model is inconsistent: sometimes a full ISO datetime, sometimes split
  // date + 24h time fields, sometimes a friendly compound string.
  const candidates = [payload.datetime, payload.dateTime, payload.when, payload.time, payload.due, payload.date, payload.timeLabel, payload.dateLabel, payload.dueLabel];
  for (const c of candidates) {
    if (typeof c === "string" && ISO_DATETIME_RE.test(c)) {
      const d = new Date(c);
      if (!Number.isNaN(d.getTime())) return { dateLabel: demoDayLabel(d), timeLabel: formatTimeUTC(d) };
    }
  }
  const compound = pickFromCompound(String(payload.dueLabel ?? payload.subtitle ?? ""));
  const dateLabel = formatDateField(payload.dateLabel ?? payload.date ?? payload.when) ?? compound.dateLabel ?? "Today";
  const timeLabel = formatTimeField(payload.timeLabel ?? payload.time ?? payload.due) ?? compound.timeLabel ?? "";
  return { dateLabel, timeLabel };
}

const BOILERPLATE = /draft ready|ready for review/i;
const JOB_AGENT_IDS = new Set<TeamAgentId>(["cameraman", "companion", "homekeeper", "coach"]);

function normalizeAgent(value: unknown): TeamAgentId | undefined {
  const agent = normalizeTeamAgentId(value);
  return JOB_AGENT_IDS.has(agent as TeamAgentId) ? (agent as TeamAgentId) : undefined;
}

function normalizeRecordingMode(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function cardForDraft(card: ChatResponseCard, object: ObjectToCreate | undefined): ChatResponseCard {
  const type = object?.type;
  if (type !== "reminder_draft" && type !== "calendar_draft") return card;

  const payload = object?.payload ?? {};
  const merged = { ...(card.metadata ?? {}), ...payload } as Record<string, unknown>;
  const title = String(payload.title ?? card.title);
  const { id, label } = normalizePerson(merged.recipient ?? merged.person ?? merged.assignee);
  const { dateLabel, timeLabel } = humanizeWhen(merged);
  const metadata = {
    ...card.metadata,
    ...payload,
    person: id,
    dateLabel,
    timeLabel,
  };

  return {
    ...card,
    type: type === "reminder_draft" ? "reminder" : "calendar_draft",
    title,
    subtitle: card.subtitle ?? [dateLabel, timeLabel, label].filter(Boolean).join(" · "),
    metadata,
  };
}

export function buildDraft(card: ChatResponseCard, object: ObjectToCreate | undefined, createdId?: string): DraftInfo | undefined {
  const objType = object?.type;
  const isReminder = objType === "reminder_draft" || card.type === "reminder";
  const isCalendar = objType === "calendar_draft" || card.type === "calendar_draft";
  if (!isReminder && !isCalendar) return undefined;

  const payload = object?.payload ?? {};
  const meta = card.metadata ?? {};
  const merged = { ...meta, ...payload } as Record<string, unknown>;
  const title = String(payload.title ?? card.title);
  let { id, label } = normalizePerson(merged.recipient ?? merged.person ?? merged.assignee);
  // When the model didn't pin a person, infer it from the title ("Leo's game").
  if (id === "family") {
    const lower = title.toLowerCase();
    const named = PERSON_IDS.find((p) => p !== "family" && lower.includes(p));
    if (named) {
      id = named;
      label = named[0].toUpperCase() + named.slice(1);
    }
  }
  const { dateLabel, timeLabel } = humanizeWhen(merged);
  const noteRaw = (payload.note ?? (card.body && !BOILERPLATE.test(card.body) ? card.body : undefined)) as string | undefined;
  const agent = normalizeAgent(merged.agent);
  const recordingMode = normalizeRecordingMode(merged.recordingMode);

  return {
    kind: isReminder ? "reminder" : "calendar",
    objectId: createdId,
    title,
    person: id,
    personLabel: label,
    dateLabel,
    timeLabel,
    agent,
    recordingMode,
    note: noteRaw ? String(noteRaw) : undefined,
  };
}

// Zip a chat segment's cards with the objects/created-records it produced and
// attach a confirmable draft where one applies.
export function enrichCards(
  cards: ChatResponseCard[] | undefined,
  objects: ObjectToCreate[] | undefined,
  createdFlat: CreatedLocalObject[] | undefined,
  offset: number
): ChatTurnCard[] {
  if (!cards) return [];
  return cards.map((card, i) => {
    const normalizedCard = cardForDraft(card, objects?.[i]);
    return { ...normalizedCard, draft: buildDraft(normalizedCard, objects?.[i], createdFlat?.[offset + i]?.id) };
  });
}
