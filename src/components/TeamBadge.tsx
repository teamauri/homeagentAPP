import clsx from "clsx";
import { TeamAgentId, teamAgentById } from "@/lib/team";
import { DoodleIcon } from "./Icons";

export function TeamBadge({ agentId, size = "md" }: { agentId: TeamAgentId; size?: "sm" | "md" | "lg" }) {
  const agent = teamAgentById[agentId];
  const sizes = {
    sm: "h-10 w-10",
    md: "h-[52px] w-[52px]",
    lg: "h-[62px] w-[62px]",
  };
  const iconSizes = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };

  return (
    <span className={clsx("mx-auto grid shrink-0 place-items-center rounded-full border border-line/70", sizes[size], agent.tone)}>
      <DoodleIcon name={agent.icon} className={iconSizes[size]} />
    </span>
  );
}
