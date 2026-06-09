import { calendarEvents, suggestedEvents } from "@/lib/mock-data";
import { Card, IconBubble, PageHeader, RowChevron, SectionHeader, StatusPill } from "./Primitives";

function statusTone(status: string) {
  if (status === "prepared" || status === "ready") return "green" as const;
  if (status === "needs-review") return "orange" as const;
  if (status === "suggested") return "purple" as const;
  return "default" as const;
}

export function CalendarView() {
  return (
    <div className="space-y-7">
      <PageHeader title="Calendar" subtitle="What's ahead for your family." action={<button className="grid h-10 w-10 place-items-center rounded-full border border-line">▣</button>} />

      <div className="flex gap-2">
        {['All', 'Sophie', 'Leo', 'Baby'].map((filter, index) => (
          <button key={filter} className={index === 0 ? "rounded-full bg-ink px-5 py-2 text-sm text-white" : "rounded-full border border-line px-5 py-2 text-sm text-ink"}>{filter}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 rounded-2xl border border-line p-1 text-sm">
        <button className="rounded-xl bg-ink px-4 py-2 text-white">Day</button>
        <button className="rounded-xl px-4 py-2 text-muted">Week</button>
      </div>

      <section>
        <SectionHeader title="Real Plans" />
        <div className="relative space-y-4 pl-4 before:absolute before:left-[9px] before:top-4 before:h-[calc(100%-2rem)] before:w-px before:bg-line">
          {calendarEvents.map((event) => (
            <Card key={event.id} className="relative ml-2 flex items-center gap-4 p-4">
              <span className="absolute -left-[28px] top-8 h-3 w-3 rounded-full border border-ink/20 bg-white" />
              <IconBubble icon={event.icon} />
              <div className="min-w-0 flex-1">
                <div className="text-xs uppercase tracking-wider text-muted">{event.dateLabel} · {event.timeLabel}</div>
                <h3 className="mt-1 text-lg font-semibold">{event.title}</h3>
                <p className="mt-1 text-sm text-muted">{event.body}</p>
              </div>
              <div className="flex flex-col items-end gap-3">
                <StatusPill tone={statusTone(event.status)}>{event.statusLabel}</StatusPill>
                <RowChevron />
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="AI Suggestions" />
        {suggestedEvents.map((event) => (
          <Card key={event.id} className="flex items-center gap-4 p-4">
            <IconBubble icon={event.icon} />
            <div className="min-w-0 flex-1">
              <div className="text-xs uppercase tracking-wider text-muted">{event.dateLabel} · {event.timeLabel}</div>
              <h3 className="mt-1 text-lg font-semibold">{event.title}</h3>
              <p className="mt-1 text-sm text-muted">{event.body}</p>
            </div>
            <StatusPill tone="purple">{event.statusLabel}</StatusPill>
            <RowChevron />
          </Card>
        ))}
      </section>

      <Card className="p-5">
        <h3 className="font-display text-2xl">This Week at a Glance</h3>
        <div className="mt-4 grid grid-cols-4 divide-x divide-line text-center">
          <div><div className="text-3xl font-semibold">4</div><div className="text-xs text-muted">Plans</div></div>
          <div><div className="text-3xl font-semibold">2</div><div className="text-xs text-muted">Suggestions</div></div>
          <div><div className="text-3xl font-semibold">1</div><div className="text-xs text-muted">Needs review</div></div>
          <div><div className="text-3xl font-semibold">3</div><div className="text-xs text-muted">Helpers</div></div>
        </div>
      </Card>
    </div>
  );
}
