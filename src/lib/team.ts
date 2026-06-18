// AI teammates — aligned with the AURI product site.
// Iris (the eye), Lumi (the companion), Vita (the keeper) live in the family group.
// Nova (the coach) and Sera (the calm) work with you privately, outside the group.
// Auri is the device itself / the router that brings in the right teammate.
export type TeamAgentId = "iris" | "lumi" | "vita" | "nova" | "sera" | "auri";

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
    id: "iris",
    name: "Iris",
    role: "The eye — films the firsts",
    shortRole: "The eye",
    icon: "camera-note",
    tone: "bg-[#FFE6DD]",
    accent: "text-[#C0492C]",
    scope: "group",
  },
  {
    id: "lumi",
    name: "Lumi",
    role: "The companion — reads with your kids",
    shortRole: "Reads along",
    icon: "book",
    tone: "bg-[#EEE6FE]",
    accent: "text-[#6B43B5]",
    scope: "group",
  },
  {
    id: "vita",
    name: "Vita",
    role: "The keeper — logs, calendar, reminders, receipts",
    shortRole: "Keeps things",
    icon: "calendar",
    tone: "bg-[#EAF6EF]",
    accent: "text-[#1F5C42]",
    scope: "group",
  },
  {
    id: "nova",
    name: "Nova",
    role: "The coach — your home workout",
    shortRole: "Your coach",
    icon: "spark",
    tone: "bg-[#F0EADE]",
    accent: "text-[#6F6A60]",
    scope: "private",
  },
  {
    id: "sera",
    name: "Sera",
    role: "The calm — a breath on a hard day",
    shortRole: "The calm",
    icon: "heart",
    tone: "bg-[#F0EADE]",
    accent: "text-[#6F6A60]",
    scope: "private",
  },
  {
    id: "auri",
    name: "Auri",
    role: "The home robot that sees",
    shortRole: "Robot",
    icon: "robot",
    tone: "bg-[#D8EEE2]",
    accent: "text-[#2E7B5B]",
    scope: "device",
  },
];

export const teamAgentById = Object.fromEntries(teamAgents.map((agent) => [agent.id, agent])) as Record<TeamAgentId, TeamAgent>;
export const teamAgentByName = Object.fromEntries(teamAgents.map((agent) => [agent.name, agent])) as Record<string, TeamAgent>;
