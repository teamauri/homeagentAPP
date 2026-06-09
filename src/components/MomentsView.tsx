import { moments } from "@/lib/mock-data";
import { Card, IconBubble, PageHeader, RowChevron, StatusPill } from "./Primitives";

function sourceTone(source: string) {
  if (source === "Auri Robot") return "green" as const;
  if (source === "Reading") return "orange" as const;
  if (source.includes("Phone")) return "blue" as const;
  return "default" as const;
}

function imageToneClass(tone = "green") {
  const tones: Record<string, string> = {
    green: "from-[#a8d8ad] via-[#d9c89b] to-[#406f40]",
    orange: "from-[#f7d8ad] via-[#b97448] to-[#f3ead9]",
    purple: "from-[#d7cef4] via-[#9f8ed0] to-[#6d5a76]",
    pink: "from-[#f4d4c6] via-[#dca581] to-[#76644f]",
  };
  return tones[tone] ?? tones.green;
}

export function MomentsView() {
  return (
    <div className="space-y-8">
      <PageHeader title="Moments" subtitle="All your moments, in one timeline." action={<button className="mt-5 grid h-12 w-12 place-items-center rounded-full border border-line text-2xl">✧</button>} />

      <div className="grid grid-cols-4 rounded-[24px] border border-line p-1 text-[17px]">
        {["All", "Auri", "Phone", "Reading"].map((filter, index) => (
          <button key={filter} className={index === 0 ? "rounded-[20px] bg-white px-2 py-3 text-ink shadow-[0_8px_22px_rgba(0,0,0,0.12)]" : "rounded-[20px] px-2 py-3 text-muted"}>{filter}</button>
        ))}
      </div>

      <div className="relative pl-4 before:absolute before:left-[1px] before:top-3 before:h-[calc(100%-1rem)] before:w-px before:bg-line">
        {moments.map((moment) => (
          <div key={moment.id} className="relative pb-7">
            <span className="absolute -left-[20px] top-1 h-3 w-3 rounded-full bg-line" />
            <div className="mb-5 flex items-center gap-4 text-[18px] text-muted">
              <span>{moment.timeLabel}</span>
              <span className="h-px flex-1 bg-line" />
            </div>
            <Card className="flex min-h-[142px] items-center gap-4 px-4 py-4">
              <IconBubble icon={moment.icon} />
              <div className="min-w-0 flex-1 py-1">
                <StatusPill tone={sourceTone(moment.sourceLabel)}>{moment.sourceLabel}</StatusPill>
                <h3 className="mt-3 text-[21px] font-medium leading-tight">{moment.title}</h3>
                <p className="mt-2 text-[16px] leading-5 text-muted">{moment.sourceLabel === "Auri Robot" ? "Auri Robot clip · Leo" : moment.body}</p>
                <div className="mt-3 flex items-center gap-2 text-[17px]">
                  <span className={moment.status === "draft" ? "h-2 w-2 rounded-full bg-orange-400" : "h-2 w-2 rounded-full bg-green-500"} />
                  <span className="text-muted">{moment.statusLabel}</span>
                </div>
              </div>
              <div className={`relative h-[86px] w-[108px] shrink-0 overflow-hidden rounded-[15px] bg-gradient-to-br ${imageToneClass(moment.imageTone)}`}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_34%,rgba(255,255,255,0.75)_0_9%,transparent_10%),radial-gradient(circle_at_62%_42%,rgba(255,255,255,0.65)_0_11%,transparent_12%),linear-gradient(135deg,transparent_0_54%,rgba(0,0,0,0.16)_55%)]" />
                {moment.id === "sunday-story" ? <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5 p-0.5">{[0, 1, 2, 3].map((tile) => <span key={tile} className={`rounded-[6px] bg-gradient-to-br ${imageToneClass(["green", "orange", "purple", "pink"][tile])}`} />)}</div> : null}
              </div>
            </Card>
          </div>
        ))}
      </div>

      <Card className="flex items-center gap-4 border-[#f1dfbd] px-4 py-4">
        <IconBubble icon="spark" small />
        <p className="flex-1 text-[20px] leading-7">Sophie's Sunday was full of giggles, cozy moments, and little surprises.</p>
        <RowChevron />
      </Card>
    </div>
  );
}
