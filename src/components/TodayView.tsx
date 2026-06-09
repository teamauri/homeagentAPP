import { needs, suggestions } from "@/lib/mock-data";
import { Card, IconBubble, PageHeader, RowChevron, SectionHeader, StatusPill } from "./Primitives";
import { DoodleIcon } from "./Icons";

export function TodayView() {
  return (
    <div className="space-y-9">
      <PageHeader title="Today" subtitle="you look lovely today." action={<button className="mt-5 grid h-12 w-12 place-items-center rounded-full border border-line text-2xl text-ink">☼</button>} />

      <Card className="flex items-center gap-5 px-5 py-4">
        <IconBubble icon="robot" />
        <div className="min-w-0 flex-1">
          <div className="text-[22px] font-medium">Auri Robot</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[15px] text-muted">
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
            <Card key={item.id} className="flex min-h-[124px] items-center gap-5 px-5 py-4">
              <IconBubble icon={item.icon} />
              <div className="min-w-0 flex-1">
                <h3 className="text-[20px] font-medium leading-tight text-ink">{item.title}</h3>
                <p className="mt-2 max-w-[205px] text-[16px] leading-5 text-muted">{item.body}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <button className="text-[16px] font-medium text-ink">{item.actionLabel}</button>
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
            <button key={item.id} className="flex w-full items-center gap-4 py-3.5 text-left">
              <DoodleIcon name={item.icon} className="h-9 w-9 shrink-0" />
              <StatusPill>{item.helper}</StatusPill>
              <span className="min-w-0 flex-1 text-[17px] text-ink">{item.text}</span>
              <RowChevron />
            </button>
          ))}
        </Card>
      </section>
    </div>
  );
}
