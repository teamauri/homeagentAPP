// Functional robot agents. Keep IDs literal so routing is obvious in logs/API data.
export type TeamAgentId = "cameraman" | "watcher" | "companion" | "coach" | "homekeeper" | "baby_logger" | "auri";

export type TeamAgentScope = "group" | "private" | "device";

export type TeamAgent = {
  id: TeamAgentId;
  name: string;
  role: string;
  shortRole: string;
  summary: string;
  responsibilities: string[];
  portrait: string;
  portraitPosition: string;
  cardPortrait?: string;
  icon: string;
  tone: string;
  accent: string;
  scope: TeamAgentScope;
};

export const helperTeamAgentIds = ["cameraman", "homekeeper", "companion", "coach", "watcher", "baby_logger"] as const satisfies readonly TeamAgentId[];
export type HelperTeamAgentId = (typeof helperTeamAgentIds)[number];

export const teamAgents: TeamAgent[] = [
  {
    id: "cameraman",
    name: "Cameraman",
    role: "Captures family moments and turns them into highlight stories.",
    shortRole: "Highlights",
    summary: "Captures family moments and turns them into highlight stories.",
    responsibilities: ["Capture moments", "Highlight stories"],
    portrait: "/agents/cameraman-leo.webp",
    portraitPosition: "50% 50%",
    cardPortrait: "/agents/cameraman-card.webp",
    icon: "camera-note",
    tone: "bg-[#FFCFC4]",
    accent: "text-[#C0492C]",
    scope: "group",
  },
  {
    id: "watcher",
    name: "Observer",
    role: "Checks in on nanny activity at intervals and summarizes what is happening.",
    shortRole: "Observes",
    summary: "Takes short recurring clips, recognizes activity, and builds an observation timeline.",
    responsibilities: ["Every X minutes", "10-second clips", "Activity recognition", "Observation timeline"],
    portrait: "/agents/observer-owen.webp",
    portraitPosition: "50% 50%",
    cardPortrait: "/agents/observer-card.webp",
    icon: "home",
    tone: "bg-[#CFE8F7]",
    accent: "text-[#236A8A]",
    scope: "device",
  },
  {
    id: "companion",
    name: "Companion",
    role: "Reads, learns, and plays with kids using real books and toys.",
    shortRole: "Read and play",
    summary: "Reads, learns, and plays with kids using real books and toys.",
    responsibilities: ["Read books", "Learn together", "Play with toys"],
    portrait: "/agents/companion-theo.webp",
    portraitPosition: "50% 50%",
    cardPortrait: "/agents/companion-card.webp",
    icon: "book",
    tone: "bg-[#DDD0FC]",
    accent: "text-[#6B43B5]",
    scope: "group",
  },
  {
    id: "homekeeper",
    name: "Homekeeper",
    role: "Keeps family routines moving with reminders, check-ins, and updates.",
    shortRole: "Routines",
    summary: "Keeps family routines moving with reminders, check-ins, and updates.",
    responsibilities: ["Reminders", "Check-ins", "Family updates"],
    portrait: "/agents/homekeeper-emma.webp",
    portraitPosition: "50% 50%",
    cardPortrait: "/agents/homekeeper-card.webp",
    icon: "calendar",
    tone: "bg-[#C8EDD8]",
    accent: "text-[#1F5C42]",
    scope: "group",
  },
  {
    id: "coach",
    name: "Coach",
    role: "Makes workouts easier with form cues and rep counts.",
    shortRole: "Workout",
    summary: "Makes workouts easier with form cues and rep counts.",
    responsibilities: ["Form cues", "Rep counts", "Workout flow"],
    portrait: "/agents/coach-ethan.webp",
    portraitPosition: "50% 50%",
    cardPortrait: "/agents/coach-card.webp",
    icon: "muscle",
    tone: "bg-[#F5D87A]",
    accent: "text-[#8A6800]",
    scope: "private",
  },
  {
    id: "baby_logger",
    name: "Baby Rhythm",
    role: "Tracks feeds, sleep, and diapers, then suggests what's likely next.",
    shortRole: "Baby rhythm",
    summary: "Tracks feeds, sleep, and diapers, then suggests what's likely next.",
    responsibilities: ["Feeds", "Sleep", "Diapers", "Likely next"],
    portrait: "/agents/baby-rhythm-nina.webp",
    portraitPosition: "50% 50%",
    cardPortrait: "/agents/baby-rhythm-card.webp",
    icon: "baby",
    tone: "bg-[#F8D7E8]",
    accent: "text-[#9D3C6A]",
    scope: "group",
  },
  {
    id: "auri",
    name: "Home",
    role: "The home robot that sees",
    shortRole: "Robot",
    summary: "The primary home voice that understands the family and delegates real work to helpers.",
    responsibilities: ["Family context", "Warm answers", "Task routing", "Robot presence"],
    portrait: "/agents/auri-app-cover.webp",
    portraitPosition: "50% 48%",
    icon: "robot",
    tone: "bg-[#A8DEC0]",
    accent: "text-[#1A6B47]",
    scope: "device",
  },
];

export const teamAgentById = Object.fromEntries(teamAgents.map((agent) => [agent.id, agent])) as Record<TeamAgentId, TeamAgent>;
export const teamAgentByName = Object.fromEntries(teamAgents.map((agent) => [agent.name, agent])) as Record<string, TeamAgent>;

export function normalizeTeamAgentId(value: unknown): TeamAgentId | undefined {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "iris") return "cameraman";
  if (raw === "watch" || raw === "watcher" || raw === "observer" || raw === "monitor") return "watcher";
  if (raw === "lumi") return "companion";
  if (raw === "vita" || raw === "keeper" || raw === "reminder") return "homekeeper";
  if (raw === "baby rhythm" || raw === "baby logger" || raw === "baby_logger" || raw === "babylog" || raw === "baby-log" || raw === "logger") return "baby_logger";
  if (raw === "nova") return "coach";
  if (raw === "coach") return "coach";
  if (raw === "cameraman" || raw === "watcher" || raw === "companion" || raw === "homekeeper" || raw === "coach" || raw === "baby_logger" || raw === "auri") return raw;
  return undefined;
}
