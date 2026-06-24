// Functional robot agents. Keep IDs literal so routing is obvious in logs/API data.
export type TeamAgentId = "cameraman" | "companion" | "homekeeper" | "coach" | "auri";

export type TeamAgentScope = "group" | "private" | "device";

export type TeamAgent = {
  id: TeamAgentId;
  name: string;
  role: string;
  shortRole: string;
  icon: string;
  tone: string;
  accent: string;
  scope: TeamAgentScope;
};

export const teamAgents: TeamAgent[] = [
  {
    id: "cameraman",
    name: "Cameraman",
    role: "The eye — films the firsts",
    shortRole: "The eye",
    icon: "camera-note",
    tone: "bg-[#FFCFC4]",
    accent: "text-[#C0492C]",
    scope: "group",
  },
  {
    id: "companion",
    name: "Companion",
    role: "The companion — reads with your kids",
    shortRole: "Reads along",
    icon: "book",
    tone: "bg-[#DDD0FC]",
    accent: "text-[#6B43B5]",
    scope: "group",
  },
  {
    id: "homekeeper",
    name: "Homekeeper",
    role: "Reminders, calendar check-ins, and video receipts",
    shortRole: "Reminders",
    icon: "calendar",
    tone: "bg-[#C8EDD8]",
    accent: "text-[#1F5C42]",
    scope: "group",
  },
  {
    id: "coach",
    name: "Coach",
    role: "The coach — your home workout",
    shortRole: "Your coach",
    icon: "spark",
    tone: "bg-[#F5D87A]",
    accent: "text-[#8A6800]",
    scope: "private",
  },
  {
    id: "auri",
    name: "Home",
    role: "The home robot that sees",
    shortRole: "Robot",
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
  if (raw === "lumi") return "companion";
  if (raw === "vita" || raw === "keeper" || raw === "reminder") return "homekeeper";
  if (raw === "nova") return "coach";
  if (raw === "coach") return "coach";
  if (raw === "cameraman" || raw === "companion" || raw === "homekeeper" || raw === "auri") return raw;
  return undefined;
}
