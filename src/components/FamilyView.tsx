import { connections, familyMembers, houseRules } from "@/lib/mock-data";
import { Card, IconBubble, PageHeader, RowChevron, SectionHeader } from "./Primitives";

export function FamilyView() {
  return (
    <div className="space-y-7">
      <PageHeader title="Family" subtitle="Your family at a glance." action={<button className="grid h-10 w-10 place-items-center rounded-full border border-line">⚙</button>} />

      <section>
        <SectionHeader title="People" />
        <div className="grid grid-cols-2 gap-3">
          {familyMembers.map((person) => (
            <Card key={person.id} className="flex min-h-[105px] flex-col justify-between p-4">
              <div className="flex items-start justify-between gap-2">
                <IconBubble icon={person.icon} small />
                <RowChevron />
              </div>
              <div>
                <div className="text-lg font-semibold">{person.name}</div>
                <div className="mt-1 text-sm leading-5 text-muted">{person.summary}</div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Connected to your family" />
        <Card className="divide-y divide-line overflow-hidden">
          {connections.map((connection) => (
            <button key={connection.id} className="flex w-full items-center gap-4 px-4 py-4 text-left">
              <IconBubble icon={connection.icon} small />
              <div className="min-w-0 flex-1">
                <h3 className="text-[17px] font-semibold">{connection.name}</h3>
                <p className="mt-1 text-sm text-muted">{connection.summary}</p>
              </div>
              <span className="text-sm text-muted">{connection.statusLabel}</span>
              <RowChevron />
            </button>
          ))}
        </Card>
      </section>

      <section>
        <SectionHeader title="House rules" />
        <Card className="divide-y divide-line overflow-hidden">
          {houseRules.map((rule) => (
            <button key={rule.id} className="flex w-full items-center gap-4 px-4 py-4 text-left">
              <IconBubble icon={rule.icon} small />
              <span className="flex-1 text-[16px]">{rule.text}</span>
              <RowChevron />
            </button>
          ))}
        </Card>
      </section>
    </div>
  );
}
