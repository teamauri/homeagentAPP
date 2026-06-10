import { needs, suggestions } from "@/lib/mock-data";
import { Card, IconBubble, PageHeader, RowChevron, SectionHeader, StatusPill } from "./Primitives";
import { DoodleIcon } from "./Icons";

export function TodayView() {
  return (
    <div className="space-y-8">
      <PageHeader title="Today" subtitle="you look lovely today." action={<button className="mt-4 grid h-11 w-11 place-items-center rounded-full border border-line text-xl text-ink">☼</button>} />

      <Card className="flex items-center gap-4 px-4 py-4">
        <IconBubble icon="robot" />
        <div className="min-w-0 flex-1">
          <div className="text-[18px] font-medium">Auri Robot</div>
          <div className="mt-1 flex flex-nowrap items-center gap-2 text-[14px] text-muted">
            <span>Living Room</span>
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            <span>Ready</span>
            <span>·</span>
            <span>not recording</span>
          </div>
        </div>
        <RowChevron />
      </Card>

      <section>
        <SectionHeader title="Needs You" count="3" />
        <div className="space-y-3">
          {needs.map((item) => (
            <Card key={item.id} className="flex min-h-[106px] items-center gap-4 px-4 py-4">
              <IconBubble icon={item.icon} />
              <div className="min-w-0 flex-1">
                <h3 className="text-[17px] font-medium leading-tight text-ink">{item.title}</h3>
                <p className="mt-1 max-w-[190px] text-[14px] leading-5 text-muted">{item.body}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <button className="whitespace-nowrap text-[14px] font-medium text-ink">{item.actionLabel}</button>
                <RowChevron />
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Suggestions" />
        <Card className="divide-y divide-line overflow-hidden border-0 rounded-none">
          {suggestions.map((item) => (
            <button key={item.id} className="flex w-full items-center gap-3 py-3.5 text-left">
              <DoodleIcon name={item.icon} className="h-8 w-8 shrink-0" />
              <StatusPill>{item.helper}</StatusPill>
              <span className="min-w-0 flex-1 text-[15px] text-ink">{item.text}</span>
              <RowChevron />
            </button>
          ))}
        </Card>
      </section>
    </div>
  );
}
