import { addHelp, journeys } from "@/lib/mock-data";
import { Card, IconBubble, PageHeader, RowChevron, SectionHeader, StatusPill } from "./Primitives";

export function JourneysView() {
  const childJourneys = journeys.filter((journey) => journey.group === "child");
  const homeFlows = journeys.filter((journey) => journey.group === "home");

  return (
    <div className="space-y-7">
      <PageHeader title="Journeys" subtitle="Active help streams for your family." action={<button className="rounded-full border border-line px-4 py-2 text-sm font-semibold">+ Add help</button>} />

      <div className="flex gap-2">
        {['All', 'Sophie', 'Leo', 'Baby'].map((filter, index) => (
          <button key={filter} className={index === 0 ? "rounded-full bg-ink px-5 py-2 text-sm text-white" : "rounded-full border border-line px-5 py-2 text-sm text-ink"}>{filter}</button>
        ))}
      </div>

      <section>
        <SectionHeader title="Child Journeys" />
        <Card className="divide-y divide-line overflow-hidden">
          {childJourneys.map((journey) => (
            <button key={journey.id} className="flex w-full items-center gap-4 px-4 py-4 text-left">
              <IconBubble icon={journey.icon} />
              <div className="min-w-0 flex-1">
                <h3 className="text-[18px] font-semibold">{journey.title}</h3>
                <div className="mt-2 flex items-center gap-2">
                  <StatusPill tone={journey.helper === "Milo" ? "green" : journey.helper === "Bibi" ? "orange" : "blue"}>{journey.helper}</StatusPill>
                  <span className="text-sm text-muted">{journey.body}</span>
                </div>
              </div>
              <RowChevron />
            </button>
          ))}
        </Card>
      </section>

      <section>
        <SectionHeader title="Home Flows" />
        <Card className="divide-y divide-line overflow-hidden">
          {homeFlows.map((journey) => (
            <button key={journey.id} className="flex w-full items-center gap-4 px-4 py-4 text-left">
              <IconBubble icon={journey.icon} />
              <div className="min-w-0 flex-1">
                <h3 className="text-[18px] font-semibold">{journey.title}</h3>
                <div className="mt-2 flex items-center gap-2">
                  <StatusPill tone="blue">{journey.helper}</StatusPill>
                  <span className="text-sm text-muted">{journey.body}</span>
                </div>
              </div>
              <RowChevron />
            </button>
          ))}
        </Card>
      </section>

      <section>
        <SectionHeader title="Add Help" />
        <p className="mb-4 text-sm text-muted">What do you want Auri to help with?</p>
        <div className="grid grid-cols-2 gap-3">
          {addHelp.map((item) => (
            <Card key={item.id} className="flex min-h-[120px] flex-col justify-between p-4">
              <IconBubble icon={item.icon} />
              <div className="mt-3 text-lg font-semibold leading-tight">{item.label}</div>
            </Card>
          ))}
        </div>
        <Card className="mt-4 flex items-center gap-4 p-4">
          <IconBubble icon="spark" small />
          <p className="flex-1 text-sm text-muted">Connected learning apps and external helpers can power your journeys.</p>
          <RowChevron />
        </Card>
      </section>
    </div>
  );
}
