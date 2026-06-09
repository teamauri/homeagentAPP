import { moments } from "@/lib/mock-data";
import { Card, IconBubble, PageHeader, RowChevron, StatusPill } from "./Primitives";
import { DoodleIcon } from "./Icons";

function sourceTone(source: string) {
  if (source === "Auri Robot") return "green" as const;
  if (source === "Reading") return "orange" as const;
  if (source.includes("Phone")) return "blue" as const;
  return "default" as const;
}

function imageToneClass(tone = "green") {
  const tones: Record<string, string> = {
    green: "from-[#ecf8f0] to-[#d8efe1]",
    orange: "from-[#fff3e7] to-[#f7dcc2]",
    purple: "from-[#f3efff] to-[#dfd4fb]",
    pink: "from-[#fff0f5] to-[#f7d4df]",
  };
  return tones[tone] ?? tones.green;
}

export function MomentsView() {
  return (
    <div className="space-y-7">
      <PageHeader title="Moments" subtitle="All your moments, in one timeline." action={<button className="grid h-10 w-10 place-items-center rounded-full border border-line">✧</button>} />

      <div className="grid grid-cols-4 rounded-2xl border border-line p-1 text-sm">
        {['All', 'Auri', 'Phone', 'Reading'].map((filter, index) => (
          <button key={filter} className={index === 0 ? "rounded-xl bg-ink px-2 py-2 text-white" : "rounded-xl px-2 py-2 text-muted"}>{filter}</button>
        ))}
      </div>

      <div className="relative space-y-6 pl-4 before:absolute before:left-[7px] before:top-3 before:h-[calc(100%-1rem)] before:w-px before:bg-line">
        {moments.map((moment) => (
          <div key={moment.id} className="relative">
            <span className="absolute -left-[21px] top-2 h-3 w-3 rounded-full border border-line bg-white" />
            <div className="mb-2 text-sm text-muted">{moment.timeLabel}</div>
            <Card className="flex gap-4 p-3">
              <div className={`relative grid h-24 w-28 shrink-0 place-items-center overflow-hidden rounded-[18px] bg-gradient-to-br ${imageToneClass(moment.imageTone)}`}>
                <div className="absolute inset-x-3 top-3 h-10 rounded-full border border-white/70 bg-white/35 blur-sm" />
                <DoodleIcon name={moment.icon} className="relative h-14 w-14" />
              </div>
              <div className="min-w-0 flex-1 py-1">
                <StatusPill tone={sourceTone(moment.sourceLabel)}>{moment.sourceLabel}</StatusPill>
                <h3 className="mt-2 text-[18px] font-semibold leading-tight">{moment.title}</h3>
                <p className="mt-1 text-sm leading-5 text-muted">{moment.body}</p>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <span className={moment.status === "draft" ? "h-2 w-2 rounded-full bg-orange-400" : "h-2 w-2 rounded-full bg-green-500"} />
                  <span className="text-muted">{moment.statusLabel}</span>
                </div>
              </div>
              <RowChevron />
            </Card>
          </div>
        ))}
      </div>

      <Card className="flex items-center gap-4 border-[#f3dfbe] bg-[#fffaf1] p-4">
        <IconBubble icon="spark" />
        <p className="flex-1 font-display text-2xl leading-8 tracking-[-0.03em]">Sophie's Sunday was full of giggles, cozy moments, and little surprises.</p>
        <RowChevron />
      </Card>
    </div>
  );
}
