import { connections, familyMembers, houseRules } from "@/lib/mock-data";
import { Card, IconBubble, PageHeader, RowChevron } from "./Primitives";

export function FamilyView() {
  return (
    <div className="space-y-7">
      <PageHeader title="Family" subtitle="Your family at a glance." action={<button className="mt-4 grid h-11 w-11 place-items-center rounded-full border border-line text-xl">☼</button>} />

      <section>
        <h2 className="mb-3 text-[18px] font-medium text-ink">Family members</h2>
        <Card className="divide-y divide-line overflow-hidden px-4">
          {familyMembers.map((person) => (
            <button key={person.id} className="flex w-full items-center gap-4 py-2.5 text-left">
                <IconBubble icon={person.icon} small />
              <div className="min-w-0 flex-1">
                <div className="text-[18px] font-medium">{person.name}</div>
                <div className="mt-1 text-[14px] leading-5 text-muted">{person.summary}</div>
              </div>
              <RowChevron />
            </button>
          ))}
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-[18px] font-medium text-ink">Connected to your family</h2>
        <Card className="divide-y divide-line overflow-hidden px-4">
          {connections.map((connection) => (
            <button key={connection.id} className="flex w-full items-center gap-4 py-3 text-left">
              <IconBubble icon={connection.icon} small />
              <div className="min-w-0 flex-1">
                <h3 className="text-[16px] font-medium">{connection.name}</h3>
                {connection.id === "robot" ? <p className="mt-1 text-[15px] text-muted">{connection.summary}</p> : null}
              </div>
              <span className="whitespace-nowrap text-[14px] text-muted">{connection.statusLabel}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              <RowChevron />
            </button>
          ))}
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-[18px] font-medium text-ink">House rules</h2>
        <Card className="divide-y divide-line overflow-hidden px-4">
          {houseRules.map((rule) => (
            <button key={rule.id} className="flex w-full items-center gap-4 py-4 text-left">
              <IconBubble icon={rule.icon} small />
              <span className="flex-1 text-[15px]">{rule.text}</span>
              <RowChevron />
            </button>
          ))}
        </Card>
      </section>
    </div>
  );
}
