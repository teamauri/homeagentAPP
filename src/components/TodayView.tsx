import { needs, suggestions } from "@/lib/mock-data";
import { teamAgents, teamAgentByName } from "@/lib/team";
import { DoodleIcon } from "./Icons";
import { TeamBadge } from "./TeamBadge";

export function TodayView() {
  return (
    <div className="pb-4">
      <button className="mb-6 mt-1 flex min-h-[70px] w-full items-center gap-3 rounded-[18px] border border-line bg-white px-4 text-left shadow-[0_2px_10px_rgba(8,8,8,0.035)]">
        <div className="grid h-[46px] w-[46px] shrink-0 place-items-center">
          <DoodleIcon name="robot" className="h-11 w-11" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[20px] font-semibold leading-6 text-ink">Auri Robot</h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[13px] leading-5 text-muted">
            <span>Living Room</span>
            <span className="h-2 w-2 rounded-full bg-[#62ad57]" aria-hidden="true" />
            <span>Ready</span>
            <span>·</span>
            <span>not recording</span>
          </p>
        </div>
        <span className="text-[34px] font-light leading-none text-ink/45">›</span>
      </button>

      <section className="mb-6">
        <h2 className="font-display text-[24px] font-normal leading-none tracking-[-0.02em] text-ink">Needs You</h2>
        <div className="mt-3 space-y-2.5">
          {needs.map((item) => (
            <NeedRow key={item.id} item={item} />
          ))}
        </div>
      </section>

      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold leading-5 text-ink">Your team</h2>
          <button className="text-[12px] font-semibold leading-5 text-ink">View all</button>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {teamAgents.filter((agent) => agent.id !== "auri").map((agent) => (
            <button key={agent.id} className="min-w-0 text-center">
              <TeamBadge agentId={agent.id} size="md" />
              <span className="mt-1 block truncate text-[12px] font-semibold leading-4 text-ink">{agent.name}</span>
              <span className="block truncate text-[9px] leading-3 text-muted">{agent.shortRole}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="pb-2">
        <div className="mb-2 flex items-center justify-between gap-4">
          <h2 className="font-display text-[20px] font-normal leading-none tracking-[-0.02em] text-ink">Recent in Memory</h2>
        </div>
        <div>
          {suggestions.map((item) => (
            <button key={item.id} className="grid min-h-[44px] w-full grid-cols-[40px_74px_minmax(0,1fr)_16px] items-center gap-3 border-b border-line/80 text-left last:border-b-0">
              {teamAgentByName[item.helper] ? <TeamBadge agentId={teamAgentByName[item.helper].id} size="sm" /> : <DoodleIcon name={item.icon} className="h-8 w-8" />}
              <span className="rounded-full border border-line bg-white px-3 py-0.5 text-center text-[13px] leading-5 text-ink shadow-[0_3px_10px_rgba(8,8,8,0.025)]">{item.helper}</span>
              <span className="truncate text-[14px] leading-5 text-ink">{item.text}</span>
              <span className="text-[30px] font-light leading-none text-ink/45">›</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function NeedRow({ item }: { item: (typeof needs)[number] }) {
  const helper = teamAgentByName[item.helper];
  return (
    <article className="flex min-h-[72px] items-center gap-3 rounded-[16px] border border-line/85 bg-white px-3.5 py-2.5 shadow-[0_1px_4px_rgba(8,8,8,0.03)]">
      <div className="grid h-[42px] w-[42px] shrink-0 place-items-center">
        <DoodleIcon name={helper?.icon ?? item.icon} className="h-9 w-9" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold leading-[17px] text-ink">{item.title}</h3>
        <p className="mt-0.5 text-[13px] leading-[16px] text-muted">{item.body}</p>
      </div>
      <button className="shrink-0 whitespace-nowrap text-right text-[13px] font-semibold text-ink">{item.actionLabel}</button>
      <span className="text-[30px] font-light leading-none text-ink/45">›</span>
    </article>
  );
}
