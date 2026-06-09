import { calendarEvents, suggestedEvents } from "@/lib/mock-data";
import { Card, IconBubble, PageHeader, RowChevron, StatusPill } from "./Primitives";

function statusTone(status: string) {
  if (status === "prepared" || status === "ready") return "green" as const;
  if (status === "needs-review") return "orange" as const;
  if (status === "suggested") return "purple" as const;
  return "default" as const;
}

export function CalendarView() {
  const timeline = [calendarEvents[0], calendarEvents[1], suggestedEvents[0], calendarEvents[2]];

  return (
    <div className="space-y-8">
      <PageHeader title="Calendar" subtitle="What's ahead for your family." action={<button className="mt-5 grid h-12 w-12 place-items-center rounded-full border border-line text-2xl">☼</button>} />

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          {["All", "Sophie", "Leo", "Baby"].map((filter, index) => (
            <button key={filter} className={index === 0 ? "rounded-full bg-ink px-5 py-2.5 text-[17px] text-white" : "rounded-full border border-line px-5 py-2.5 text-[17px] text-ink"}>{filter}</button>
          ))}
        </div>
        <div className="flex gap-2">
          {["Day", "Week"].map((filter, index) => (
            <button key={filter} className={index === 0 ? "rounded-full bg-ink px-5 py-2.5 text-[17px] text-white" : "rounded-full border border-line px-5 py-2.5 text-[17px] text-ink"}>{filter}</button>
          ))}
        </div>
      </div>

      <div className="relative pl-10 before:absolute before:left-[9px] before:top-3 before:h-[calc(100%-2rem)] before:w-px before:bg-line">
        {timeline.map((event) => (
          <div key={event.id} className="relative border-b border-line py-6 last:border-b-0">
            <span className="absolute -left-[40px] top-8 h-5 w-5 rounded-full border border-line bg-white" />
            <div className="flex items-center gap-5">
              <IconBubble icon={event.icon} />
              <div className="min-w-0 flex-1">
                <div className="text-[16px] text-muted">{event.person === "family" ? "Family" : "Sophie"}</div>
                <h3 className="mt-1 text-[22px] font-medium leading-tight">{event.title}</h3>
                <div className="mt-2 text-[20px] text-muted">{event.dateLabel} · {event.timeLabel}</div>
                <p className="mt-3 text-[16px] leading-5 text-muted">{event.body}</p>
              </div>
              <div className="flex flex-col items-end gap-3">
                <StatusPill tone={statusTone(event.status)}>{event.statusLabel}</StatusPill>
                <RowChevron />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Card className="px-5 py-4">
        <div className="mb-2 flex items-center gap-4">
          <IconBubble icon="spark" small />
          <h3 className="font-display text-[26px]">This week</h3>
        </div>
        <div className="divide-y divide-line pl-14 text-[17px] leading-6">
          <p className="py-2">2 activities planned, 1 needs your review</p>
          <p className="py-2">Sophie has piano on Tue and preschool on Fri</p>
          <p className="py-2">1 family dinner suggestion is ready</p>
        </div>
      </Card>
    </div>
  );
}
