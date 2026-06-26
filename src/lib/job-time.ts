// Real-time helpers for jobs. The canonical time on a job is `scheduledAt`
// (epoch ms); every display label ("Today", "3:00 PM") is DERIVED from it at
// render time. This is the fix for the old bug where dateLabel/timeLabel were
// frozen strings — a job created yesterday stayed "Today" forever.

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TIME_ZONE = "Asia/Shanghai";

function startOfDay(d: Date): number {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c.getTime();
}

// Whole-day difference between two epochs (0 = same calendar day, 1 = tomorrow).
function dayDiff(epoch: number, now: number): number {
  return Math.round((startOfDay(new Date(epoch)) - startOfDay(new Date(now))) / DAY_MS);
}

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// "Today" / "Tomorrow" / weekday within the next week / "Jun 30" beyond that.
export function deriveDateLabel(scheduledAt: number, now: number = Date.now()): string {
  const diff = dayDiff(scheduledAt, now);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff < 7) return WEEKDAY[new Date(scheduledAt).getDay()];
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(scheduledAt));
}

export function deriveTimeLabel(scheduledAt: number): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(scheduledAt));
}

export function immediateScheduledAt(now: number = Date.now()): number {
  return now + 60_000;
}

export function timeLabelInZone(epoch: number, timeZone: string = DEFAULT_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).format(new Date(epoch));
}

// From an <input type="date"> (YYYY-MM-DD) + <input type="time"> (HH:MM) in
// local time → epoch ms. Empty date means "today".
export function parseDateTime(dateStr: string, timeStr: string): number {
  const [h, m] = (timeStr || "00:00").split(":").map(Number);
  const base = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  base.setHours(h || 0, m || 0, 0, 0);
  return base.getTime();
}

// Parse a 12-hour "3:00 PM" (or "now") plus a coarse dateLabel into an epoch.
// Used to MIGRATE legacy string-only jobs. Returns null when unparseable.
export function scheduledAtFromLabels(dateLabel: string, timeLabel: string, now: number = Date.now()): number | null {
  const lower = (timeLabel || "").trim().toLowerCase();
  // "now" jobs never carried a real time — anchor them to the current minute so
  // migration can decide if they're already in the past (and thus stale).
  if (lower === "now" || lower === "") {
    return resolveDateLabel(dateLabel, now);
  }
  const m = timeLabel.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return null;
  let hour = parseInt(m[1], 10) % 12;
  if (/pm/i.test(m[3])) hour += 12;
  const min = parseInt(m[2], 10);
  const base = new Date(resolveDateLabel(dateLabel, now));
  base.setHours(hour, min, 0, 0);
  return base.getTime();
}

// Map a coarse dateLabel ("Today", "Tomorrow", "Friday") to a concrete day's
// start epoch, relative to `now`. Unknown labels fall back to today.
function resolveDateLabel(dateLabel: string, now: number): number {
  const label = (dateLabel || "Today").trim();
  const today = startOfDay(new Date(now));
  if (label === "Today") return today;
  if (label === "Tomorrow") return today + DAY_MS;
  const idx = WEEKDAY.findIndex((d) => d.toLowerCase() === label.toLowerCase());
  if (idx >= 0) {
    const todayDow = new Date(now).getDay();
    let delta = idx - todayDow;
    if (delta < 0) delta += 7; // next occurrence
    return today + delta * DAY_MS;
  }
  return today;
}

// "HH:MM" (24h) → today at that time, as epoch ms.
export function todayAt(hhmm: string, now: number = Date.now()): number {
  const [h, m] = (hhmm || "00:00").split(":").map(Number);
  const d = new Date(now);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.getTime();
}
