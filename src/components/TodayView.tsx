import { needs, suggestions } from "@/lib/mock-data";
import { Card, IconBubble, PageHeader, RowChevron, SectionHeader, StatusPill } from "./Primitives";
import { DoodleIcon } from "./Icons";

export function TodayView() {
  return (
    <div className="space-y-8">
      <PageHeader title="Today" subtitle="今天也很好看。" action={<button className="grid h-10 w-10 place-items-center rounded-full border border-line text-xl text-[#ff7a3c]">☼</button>} />

      <Card className="flex items-center gap-4 p-4">
        <IconBubble icon="robot" />
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold">Auri Robot</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
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
            <Card key={item.id} className="flex items-center gap-4 p-4">
              <IconBubble icon={item.icon} />
              <div className="min-w-0 flex-1">
                <h3 className="text-[17px] font-semibold text-ink">{item.title}</h3>
                <p className="mt-1 max-w-[190px] text-sm leading-5 text-muted">{item.body}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <button className="text-sm font-semibold text-ink">{item.actionLabel}</button>
                <RowChevron />
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Suggestions" />
        <Card className="divide-y divide-line overflow-hidden">
          {suggestions.map((item) => (
            <button key={item.id} className="flex w-full items-center gap-3 px-4 py-4 text-left">
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
