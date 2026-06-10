import { addHelp, journeys } from "@/lib/mock-data";
import { Card, IconBubble, PageHeader, RowChevron, StatusPill } from "./Primitives";

export function JourneysView() {
  const childJourneys = journeys.filter((journey) => journey.group === "child");
  const homeFlows = journeys.filter((journey) => journey.group === "home");

  return (
    <div className="space-y-7">
      <PageHeader title="Journeys" subtitle="Active long-term journeys for your family." action={<button className="mt-4 grid h-11 w-11 place-items-center rounded-full border border-line text-xl">☼</button>} />

      <div className="flex gap-2">
        {["All", "Sophie", "Leo", "Baby"].map((filter, index) => (
          <button key={filter} className={index === 0 ? "rounded-full bg-ink px-4 py-2 text-[15px] text-white" : "rounded-full border border-line px-4 py-2 text-[15px] text-ink"}>{filter}</button>
        ))}
      </div>

      {[...childJourneys, ...homeFlows].map((journey) => (
        <Card key={journey.id} className="flex min-h-[104px] items-center gap-4 px-4 py-4">
          <IconBubble icon={journey.icon} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[20px] font-medium leading-tight">{journey.title}</h3>
              <StatusPill tone={journey.helper === "Milo" ? "green" : journey.helper === "Bibi" ? "orange" : "blue"}>{journey.helper}</StatusPill>
            </div>
            <p className="mt-2 text-[15px] text-muted">{journey.body}</p>
          </div>
          <RowChevron />
        </Card>
      ))}

      <section>
        <h2 className="font-display text-[27px] leading-none tracking-[-0.03em]">Add help</h2>
        <p className="mt-2 text-[15px] text-ink/85">What do you want Auri to help with?</p>
        <div className="no-scrollbar mt-5 flex gap-1.5 overflow-x-auto pb-1">
          {addHelp.map((item) => (
            <Card key={item.id} className="flex h-[96px] w-[82px] shrink-0 flex-col items-center justify-center gap-2 px-2 text-center">
              <IconBubble icon={item.icon} small />
              <div className="text-[14px] font-medium leading-tight">{item.label}</div>
            </Card>
          ))}
        </div>
        <Card className="mt-4 flex items-center gap-4 px-4 py-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#f0eafe] text-xl font-serif">i</div>
          <p className="flex-1 text-[18px] leading-6 text-ink/85">Connected learning apps and external helpers can power your journeys.</p>
          <RowChevron />
        </Card>
      </section>
    </div>
  );
}
