export type TeamAgentId = "nina" | "milo" | "bibi" | "mira" | "nora" | "auri";

export type TeamAgent = {
  id: TeamAgentId;
  name: string;
  role: string;
  shortRole: string;
  icon: string;
  tone: string;
  accent: string;
};

export const teamAgents: TeamAgent[] = [
  {
    id: "nina",
    name: "Nina",
    role: "Baby Care Advisor",
    shortRole: "Baby Care",
    icon: "bottle",
    tone: "bg-[#fff0c9]",
    accent: "text-[#e49b20]",
  },
  {
    id: "milo",
    name: "Milo",
    role: "Piano Coach",
    shortRole: "Piano Coach",
    icon: "piano",
    tone: "bg-[#eee6ff]",
    accent: "text-[#7657c7]",
  },
  {
    id: "bibi",
    name: "Bibi",
    role: "Book Buddy",
    shortRole: "Book Buddy",
    icon: "book",
    tone: "bg-[#dcf4df]",
    accent: "text-[#2f9d5b]",
  },
  {
    id: "mira",
    name: "Mira",
    role: "Memory Keeper",
    shortRole: "Memory Keeper",
    icon: "mail-heart",
    tone: "bg-[#ffe2d3]",
    accent: "text-[#ee5d23]",
  },
  {
    id: "nora",
    name: "Nora",
    role: "Home Coordinator",
    shortRole: "Home Coordinator",
    icon: "calendar",
    tone: "bg-[#dceaff]",
    accent: "text-[#2e6fbd]",
  },
  {
    id: "auri",
    name: "Auri",
    role: "Robot",
    shortRole: "Robot",
    icon: "robot",
    tone: "bg-[#e6f8f6]",
    accent: "text-[#128c86]",
  },
];

export const teamAgentById = Object.fromEntries(teamAgents.map((agent) => [agent.id, agent])) as Record<TeamAgentId, TeamAgent>;
export const teamAgentByName = Object.fromEntries(teamAgents.map((agent) => [agent.name, agent])) as Record<string, TeamAgent>;
