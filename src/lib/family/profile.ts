// Family member profiles + an observation log.
//
// This is the heart of the "home agent" differentiation: the app accumulates a
// long-term, structured context about each family member — their interests,
// routines, and a running log of real observations produced by the app itself
// (album organizing, reminder receipts, robot clips). The insight engine
// (see ./insights.ts) feeds this context to the model so it can say things a
// generic chatbot never could, because it doesn't have your family's history.

export type FamilyRole = "parent" | "child" | "baby" | "extended_family";

export type FamilyMemberProfile = {
  id: string;
  name: string;
  role: FamilyRole;
  ageLabel?: string;
  /** ISO date (YYYY-MM-DD). Drives the age shown on growth moments/firsts. */
  birthday?: string;
  avatar: string; // DoodleIcon fallback: mom | dad | girl | boy | baby | grandma
  /** Real uploaded photo (data URL or CDN url). Shown instead of the doodle. */
  avatarUrl?: string;
  /** Stable, slow-moving facts the family told us or we learned early. */
  interests: string[];
  /** Recurring rhythms — bedtime, meds, practice, naps. */
  routines: string[];
  /** Health / care notes worth remembering. */
  health: string[];
};

/** Age of someone with `birthday` at moment `atISO`, as a compact "3y 4m". */
export function ageAt(birthday: string | undefined, atISO: string): { years: number; months: number; short: string; long: string } | undefined {
  if (!birthday) return undefined;
  const birth = new Date(birthday);
  const at = new Date(atISO);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(at.getTime())) return undefined;
  let months = (at.getFullYear() - birth.getFullYear()) * 12 + (at.getMonth() - birth.getMonth());
  if (at.getDate() < birth.getDate()) months -= 1;
  if (months < 0) months = 0;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  const short = `${years}y ${rem}m`;
  const long = `${years} ${years === 1 ? "year" : "years"} ${rem} ${rem === 1 ? "month" : "months"}`;
  return { years, months, short, long };
}

export type ObservationSource =
  | "album_organize" // Task ② — Iris organizing phone photos
  | "reminder_receipt" // Task ③ — a video receipt completing a reminder
  | "robot_clip" // an Auri cameraman clip
  | "reading_session" // Lumi reading with a kid
  | "manual"; // a parent note

export type Observation = {
  id: string;
  memberId: string;
  source: ObservationSource;
  /** One short, factual line. The "why" behind a future insight. */
  note: string;
  /** Optional structured tags for grouping (e.g. ["dinosaurs", "books"]). */
  tags?: string[];
  /** ISO timestamp — recency matters for insights. */
  observedAt: string;
};

// ---------------------------------------------------------------------------
// Seed family — Jane's family. Seed profiles give the home agent a baseline;
// new observations accumulated during the demo make its insights feel real.
// ---------------------------------------------------------------------------
export const seedFamilyMembers: FamilyMemberProfile[] = [
  {
    id: "mom",
    name: "Jane",
    role: "parent",
    avatar: "mom",
    interests: ["photography", "running"],
    routines: ["Usually the one holding the camera"],
    health: [],
  },
  {
    id: "dad",
    name: "Marcus",
    role: "parent",
    avatar: "dad",
    interests: ["cooking", "basketball"],
    routines: ["School pickup on Fridays"],
    health: [],
  },
  {
    id: "mia",
    name: "Mia",
    role: "child",
    ageLabel: "3",
    birthday: "2023-02-10",
    avatar: "girl",
    interests: ["dinosaurs", "picture books"],
    routines: ["Bedtime story around 8pm", "daily medicine (time varies)"],
    health: ["Finishing a 10-day course of medicine"],
  },
  {
    id: "leo",
    name: "Leo",
    role: "child",
    ageLabel: "7",
    birthday: "2019-03-15",
    avatar: "boy",
    interests: ["basketball", "drawing"],
    routines: ["Basketball Fridays at 5:30"],
    health: [],
  },
];

export const seedObservations: Observation[] = [
  {
    id: "obs_seed_1",
    memberId: "mia",
    source: "reading_session",
    note: "Read Goodnight Moon with Lumi — asked where the mouse went.",
    tags: ["books", "bedtime"],
    observedAt: "2026-06-16T20:10:00.000Z",
  },
  {
    id: "obs_seed_2",
    memberId: "leo",
    source: "robot_clip",
    note: "Iris filmed first three steps to the couch — big milestone.",
    tags: ["milestone"],
    observedAt: "2026-06-15T17:12:00.000Z",
  },
];

export const familyMemberById = Object.fromEntries(
  seedFamilyMembers.map((member) => [member.id, member])
) as Record<string, FamilyMemberProfile>;
