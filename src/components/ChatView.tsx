import clsx from "clsx";
import { ChatResponseCard as ApiChatCard } from "@/lib/chat-server/types";
import { ChatCardList } from "./ChatCardRenderer";
import { DoodleIcon } from "./Icons";
import { TeamBadge } from "./TeamBadge";
import { chatFixtureMessages } from "@/lib/chat-fixtures";
import { ChatMessage } from "@/lib/chat-contracts";
import { TeamAgentId } from "@/lib/team";

type ChatTurn = {
  id: string;
  sender: "Mom" | "Dad" | "Vita" | "Iris" | "Lumi";
  time: string;
  avatar: "mom" | "dad" | TeamAgentId;
  text: string;
  cards?: ChatMessage["cards"];
};

export type LiveChatTurn = {
  id: string;
  sender: string;
  time: string;
  avatar: "mom" | "dad" | TeamAgentId;
  text: string;
  cards?: ApiChatCard[];
  pending?: boolean;
};

const chatThreadIds = [
  "mom-meds",
  "vita-meds",
  "dad-film",
  "iris-film",
  "mom-react",
  "vita-checkup",
  "lumi-reading",
];

const turns: ChatTurn[] = chatFixtureMessages
  .filter((message) => chatThreadIds.includes(message.id))
  .map((message) => ({
    id: message.id,
    sender: message.sender as ChatTurn["sender"],
    time: message.timeLabel,
    avatar: message.avatar as ChatTurn["avatar"],
    text: message.text,
    cards: message.cards,
  }));

const avatarStyles = {
  mom: "from-[#f7d8be] to-[#8c5135] text-white",
  dad: "from-[#d9e7ef] to-[#4d6777] text-white",
};

export function ChatView({ liveTurns = [] }: { liveTurns?: LiveChatTurn[] }) {
  return (
    <div className="pb-4">
      <div className="space-y-5">
        {turns.map((turn) => (
          <ChatTurnRow key={turn.id} turn={turn} />
        ))}
        {liveTurns.map((turn) => (
          <LiveChatTurnRow key={turn.id} turn={turn} />
        ))}
      </div>
    </div>
  );
}

function ChatTurnRow({ turn }: { turn: ChatTurn }) {
  return (
    <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-2.5">
      <Avatar avatar={turn.avatar} />
      <div className="min-w-0">
        <div className="mb-1 flex items-baseline gap-3">
          <span className="text-[18px] font-semibold leading-6 text-ink">{turn.sender}</span>
          <span className="text-[13px] text-muted">{turn.time}</span>
        </div>
        <p className="max-w-[98%] text-[17px] leading-6 text-ink">{turn.text}</p>
        {turn.cards ? (
          <div className="mt-2">
            <ChatCardList cards={turn.cards} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Avatar({ avatar }: { avatar: ChatTurn["avatar"] }) {
  const isParent = avatar === "mom" || avatar === "dad";
  if (!isParent) return <TeamBadge agentId={avatar} size="sm" />;

  return (
    <div
      className={clsx(
        "grid h-10 w-10 place-items-center overflow-hidden rounded-full border text-[19px] font-semibold",
        isParent ? `border-transparent bg-gradient-to-br ${avatarStyles[avatar]}` : avatarStyles[avatar]
      )}
    >
      {avatar === "mom" ? "J" : "D"}
    </div>
  );
}

function LiveChatTurnRow({ turn }: { turn: LiveChatTurn }) {
  return (
    <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-2.5">
      <LiveAvatar avatar={turn.avatar} sender={turn.sender} />
      <div className="min-w-0">
        <div className="mb-1 flex items-baseline gap-3">
          <span className="text-[18px] font-semibold leading-6 text-ink">{turn.sender}</span>
          <span className="text-[13px] text-muted">{turn.time}</span>
        </div>
        <p className={clsx("max-w-[98%] text-[17px] leading-6", turn.pending ? "text-muted" : "text-ink")}>{turn.text}</p>
        {turn.cards?.length ? (
          <div className="mt-2 space-y-2">
            {turn.cards.map((card, index) => (
              <ApiResponseCard key={`${turn.id}-${card.targetRoute ?? card.title}-${index}`} card={card} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LiveAvatar({ avatar, sender }: { avatar: LiveChatTurn["avatar"]; sender: string }) {
  const isParent = avatar === "mom" || avatar === "dad";
  if (!isParent) return <TeamBadge agentId={avatar} size="sm" />;

  return (
    <div
      className={clsx(
        "grid h-10 w-10 place-items-center overflow-hidden rounded-full border text-[19px] font-semibold",
        isParent ? `border-transparent bg-gradient-to-br ${avatarStyles[avatar]}` : avatarStyles[avatar]
      )}
    >
      {sender.slice(0, 1)}
    </div>
  );
}

function iconForApiCard(type: ApiChatCard["type"]) {
  const icons: Record<ApiChatCard["type"], string> = {
    calendar_draft: "calendar",
    reminder: "bell",
    baby_log: "bottle",
    lesson_recap: "music",
    memory: "photos",
    story_draft: "mail-heart",
    text: "person",
  };
  return icons[type];
}

function labelForApiCard(type: ApiChatCard["type"]) {
  const labels: Record<ApiChatCard["type"], string> = {
    calendar_draft: "Calendar draft",
    reminder: "Reminder",
    baby_log: "Baby log",
    lesson_recap: "Lesson recap",
    memory: "Memory",
    story_draft: "Story draft",
    text: "Text",
  };
  return labels[type];
}

function ApiResponseCard({ card }: { card: ApiChatCard }) {
  const handleClick = () => {
    if (card.targetRoute) {
      window.location.href = card.targetRoute;
      return;
    }
    window.alert(`${card.title} detail placeholder`);
  };

  return (
    <button onClick={handleClick} className="flex min-h-[78px] w-full items-center gap-3 rounded-[16px] border border-line bg-white px-4 py-3 text-left shadow-[0_8px_18px_rgba(8,8,8,0.035)]">
      <div className="grid h-[48px] w-[48px] shrink-0 place-items-center">
        <DoodleIcon name={iconForApiCard(card.type)} className="h-8 w-8" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] leading-5 text-muted">{labelForApiCard(card.type)}</div>
        <div className="text-[17px] font-semibold leading-6 text-ink">{card.title}</div>
        {card.subtitle ? <div className="mt-0.5 text-[13px] leading-5 text-muted">{card.subtitle}</div> : null}
      </div>
      {card.cta ? <span className="shrink-0 rounded-full border border-line px-3 py-1.5 text-[13px] font-medium text-ink">{card.cta}</span> : null}
    </button>
  );
}
