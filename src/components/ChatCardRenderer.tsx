import clsx from "clsx";
import { ChatCard } from "@/lib/chat-contracts";
import { DoodleIcon } from "./Icons";

export function ChatCardRenderer({ card, compact = false }: { card: ChatCard; compact?: boolean }) {
  if (compact || card.kind === "text") {
    return (
      <button className="flex min-h-[58px] w-[305px] max-w-full items-center gap-5 rounded-[15px] border border-line bg-white px-5 text-left shadow-[0_7px_16px_rgba(8,8,8,0.035)]">
        <DoodleIcon name={card.icon} className="h-9 w-9" />
        <span className="min-w-0 flex-1 text-[15px] leading-5 text-ink">{card.title}</span>
      </button>
    );
  }

  return (
    <button className="grid min-h-[72px] w-full grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2 rounded-[15px] border border-line bg-white px-2.5 py-2.5 text-left shadow-[0_8px_18px_rgba(8,8,8,0.04)]">
      <div className="grid h-6 w-6 shrink-0 place-items-center">
        <DoodleIcon name={card.icon} className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13px] leading-4 text-muted">{card.typeLabel}</div>
        <div className={clsx("truncate font-semibold leading-5 text-ink", card.kind === "lesson_recap" || card.kind === "story_draft" ? "text-[15px]" : "text-[15px]")}>
          {card.title}
        </div>
        <div className="mt-0.5 truncate text-[13px] leading-4 text-muted">{card.metadata.join(" · ")}</div>
      </div>
      {card.action ? (
        <span className="shrink-0 whitespace-nowrap rounded-full border border-line px-2.5 py-1.5 text-[12px] font-medium text-ink shadow-[0_4px_10px_rgba(8,8,8,0.03)]">
          {card.action.label}
        </span>
      ) : null}
    </button>
  );
}

export function ChatCardList({ cards }: { cards: ChatCard[] }) {
  return (
    <div className="space-y-2">
      {cards.map((card) => (
        <ChatCardRenderer key={card.id} card={card} />
      ))}
    </div>
  );
}
