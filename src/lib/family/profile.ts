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
  avatar: string; // DoodleIcon name: mom | dad | girl | boy | baby | grandma
  /** Stable, slow-moving facts the family told us or we learned early. */
  interests: string[];
  /** Recurring rhythms — bedtime, meds, practice, naps. */
  routines: string[];
  /** Health / care notes worth remembering. */
  health: string[];
};

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
    ageLabel: "4",
    avatar: "girl",
    interests: ["dinosaurs", "picture books"],
    routines: ["Bedtime story around 8pm", "2pm medicine"],
    health: ["Finishing a 10-day course of medicine"],
  },
  {
    id: "leo",
    name: "Leo",
    role: "child",
    ageLabel: "7",
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
