import clsx from "clsx";
import { useRef, useState } from "react";
import { ChatResponseCard as ApiChatCard } from "@/lib/chat-server/types";
import { ChatCardList } from "./ChatCardRenderer";
import { DoodleIcon } from "./Icons";
import { TeamBadge } from "./TeamBadge";
import { useFamilyMember } from "./FamilyContext";
import { chatFixtureMessages } from "@/lib/chat-fixtures";
import { ChatMessage } from "@/lib/chat-contracts";
import { TeamAgentId } from "@/lib/team";
import { personLabels } from "./calendar-ui";
import { RobotEvent, useRobotEvents } from "./RobotEventContext";
import { ChatTurnCard, DraftInfo } from "@/lib/chat-draft";

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
  cards?: ChatTurnCard[];
  pending?: boolean;
  imageUrl?: string;
  // Epoch ms for chronological ordering across all chat sources.
  createdAt?: number;
};

// Both chat turns and robot events carry an epoch in their id (`auri-<ts>`,
// `revent_<ts>`); pull it out so everything can share one timeline.
function epochFromId(id: string): number {
  const m = id.match(/(\d{10,})/);
  return m ? Number(m[1]) : 0;
}

const chatThreadIds = [
  "mom-meds",
  "vita-meds",
  "dad-film",
  "iris-film",
  "mom-react",
  "vita-checkup",
  "lumi-reading",
  "vita-routine",
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
  const { completions, events } = useRobotEvents();
  // Highlight jobs that are mid-capture: Iris shows a live counter card that
  // climbs as the run catches real clips/photos, then hands off to the keepsake.
  const runningHighlights = events.filter((event) => event.kind === "highlight" && event.status === "recording");
  // Merge live chat turns with robot-event activity (completions + in-flight
  // highlights) into one timeline sorted oldest → newest, so the latest item is
  // always at the bottom no matter which source it came from.
  const stream = [
    ...liveTurns.map((turn) => ({
      key: turn.id,
      at: turn.createdAt ?? epochFromId(turn.id),
      node: <LiveChatTurnRow key={turn.id} turn={turn} />,
    })),
    ...completions.map((event) => ({
      key: `done-${event.id}`,
      at: epochFromId(event.id),
      node: <RobotCompletionRow key={`done-${event.id}`} event={event} />,
    })),
    ...runningHighlights.map((event) => ({
      key: `live-${event.id}`,
      at: epochFromId(event.id),
      node: <HighlightProgressRow key={`live-${event.id}`} event={event} />,
    })),
  ].sort((a, b) => a.at - b.at);

  return (
    <div className="pb-4">
      <div className="space-y-5">
        {turns.map((turn) => (
          <ChatTurnRow key={turn.id} turn={turn} />
        ))}
        {stream.map((item) => item.node)}
      </div>
    </div>
  );
}

// A highlight job catching moments right now. Counters are bound to the event's
// live run state — no fixture, no fake timer in the view.
function HighlightProgressRow({ event }: { event: RobotEvent }) {
  const progress = event.highlightProgress ?? { clips: 0, photos: 0 };
  const target = event.highlight ?? { clipTarget: 0, photoTarget: 0 };
  return (
    <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-2.5">
      <TeamBadge agentId="iris" size="sm" />
      <div className="min-w-0">
        <div className="mb-1 flex items-baseline gap-3">
          <span className="text-[15px] font-semibold leading-5 text-ink">Iris</span>
          <span className="text-[13px] text-muted">{event.timeLabel}</span>
        </div>
        <p className="inline-block max-w-[98%] rounded-[16px] rounded-tl-[5px] bg-[#f3f0eb] px-3.5 py-2 text-[13px] leading-[19px] tracking-[0] text-ink">Catching the highlights — eyes up.</p>
        <div className="mt-2 w-full overflow-hidden rounded-[15px] border border-line bg-white shadow-[0_8px_18px_rgba(8,8,8,0.04)]">
          <div className="flex items-center gap-2.5 px-3.5 pb-2.5 pt-3">
            <div className="grid h-[30px] w-[30px] shrink-0 place-items-center">
              <DoodleIcon name="camera-note" className="h-8 w-8" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] leading-4 tracking-[0] text-muted">Highlight</div>
              <div className="truncate text-[15px] font-semibold leading-5 tracking-[-0.02em] text-ink">{event.title}</div>
            </div>
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#C0492C]/10 px-2.5 py-0.5 text-[11px] font-semibold leading-4 text-[#C0492C]">
              <span className="h-[6px] w-[6px] animate-pulse rounded-full bg-[#C0492C]" aria-hidden="true" />
              capturing
            </span>
          </div>
          <div className="border-t border-line/70 px-3.5 pb-3 pt-2">
            <CounterRow label="Clips · 30s" done={progress.clips} total={target.clipTarget} />
            <CounterRow label="Photos" done={progress.photos} total={target.photoTarget} />
          </div>
        </div>
      </div>
    </div>
  );
}

function CounterRow({ label, done, total }: { label: string; done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between text-[13px] leading-4">
        <span className="text-ink/80">{label}</span>
        <span className="font-semibold text-ink">
          {done} <span className="font-normal text-muted">/ {total}</span>
        </span>
      </div>
      <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-[#efece6]">
        <div className="h-full rounded-full bg-[#C0492C] transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// A finished robot event lands in chat as a keepsake: Vita (the family keeper)
// shares the clip the robot captured, marked as the event's completion.
function RobotCompletionRow({ event }: { event: RobotEvent }) {
  const who = personLabels[event.person] ?? event.person;
  return (
    <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-2.5">
      <TeamBadge agentId="vita" size="sm" />
      <div className="min-w-0">
        <div className="mb-1 flex items-baseline gap-3">
          <span className="text-[15px] font-semibold leading-5 text-ink">Vita</span>
          <span className="text-[13px] text-muted">{event.completedAtLabel}</span>
        </div>
        <p className="inline-block max-w-[98%] rounded-[16px] rounded-tl-[5px] bg-[#f3f0eb] px-3.5 py-2 text-[13px] leading-[19px] tracking-[0] text-ink">
          {who} finished "{event.title}." Saved the moment for you.
        </p>
        {event.result ? <VideoResultCard event={event} /> : null}
      </div>
    </div>
  );
}

function VideoResultCard({ event }: { event: RobotEvent }) {
  const result = event.result!;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const play = () => {
    videoRef.current?.play();
    setPlaying(true);
  };

  return (
    <div className="mt-2 max-w-[98%] overflow-hidden rounded-[18px] border border-line bg-white shadow-[0_8px_18px_rgba(8,8,8,0.04)]">
      <div className="relative bg-[#17181b]">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          src={result.videoUrl}
          poster={result.poster}
          playsInline
          controls={playing}
          onEnded={() => setPlaying(false)}
          onPause={() => setPlaying(false)}
          className="block max-h-72 w-full object-cover"
        />
        {!playing ? (
          <button onClick={play} className="absolute inset-0 grid place-items-center" aria-label="Play clip">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-white/95 text-ink shadow">
              <svg viewBox="0 0 24 24" className="h-6 w-6 translate-x-[1px]" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
            <span className="absolute bottom-2 left-2 rounded-md bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">{result.duration}</span>
          </button>
        ) : null}
      </div>
      <div className="flex items-center gap-2 px-3.5 py-2.5">
        <span className="text-mint">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="m8.5 12 2.5 2.5 4.5-5" />
          </svg>
        </span>
        <span className="flex-1 truncate text-[13px] font-semibold text-ink">Event complete · {event.title}</span>
        <span className="shrink-0 text-[12px] font-medium text-gold">Keep ♡</span>
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
          <span className="text-[15px] font-semibold leading-5 text-ink">{turn.sender}</span>
          <span className="text-[13px] text-muted">{turn.time}</span>
        </div>
        <p className="inline-block max-w-[98%] rounded-[16px] rounded-tl-[5px] bg-[#f3f0eb] px-3.5 py-2 text-[13px] leading-[19px] tracking-[0] text-ink">{turn.text}</p>
        {turn.cards ? (
          <div className="mt-2">
            <ChatCardList cards={turn.cards} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

// A parent's avatar: the photo uploaded on the Family page when present, else
// the gradient + initial fallback.
function ParentAvatar({ id, fallbackInitial }: { id: "mom" | "dad"; fallbackInitial: string }) {
  const member = useFamilyMember(id);
  const initial = member?.name?.slice(0, 1) || fallbackInitial;
  if (member?.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={member.avatarUrl} alt={member.name} className="h-10 w-10 rounded-full border border-line object-cover" />
    );
  }
  return (
    <div className={clsx("grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-transparent bg-gradient-to-br text-[19px] font-semibold", avatarStyles[id])}>
      {initial}
    </div>
  );
}

function Avatar({ avatar }: { avatar: ChatTurn["avatar"] }) {
  const isParent = avatar === "mom" || avatar === "dad";
  if (!isParent) return <TeamBadge agentId={avatar} size="sm" />;
  return <ParentAvatar id={avatar} fallbackInitial={avatar === "mom" ? "J" : "D"} />;
}

function LiveChatTurnRow({ turn }: { turn: LiveChatTurn }) {
  return (
    <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-2.5">
      <LiveAvatar avatar={turn.avatar} sender={turn.sender} />
      <div className="min-w-0">
        <div className="mb-1 flex items-baseline gap-3">
          <span className="text-[15px] font-semibold leading-5 text-ink">{turn.sender}</span>
          <span className="text-[13px] text-muted">{turn.time}</span>
        </div>
        {turn.imageUrl ? (
          <div className="mb-2 mt-1 overflow-hidden rounded-[16px] border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={turn.imageUrl} alt="Shared photo" className="max-h-64 w-full object-cover" />
          </div>
        ) : null}
        {turn.text ? (
          <p className={clsx("inline-block max-w-[98%] rounded-[16px] rounded-tl-[5px] bg-[#f3f0eb] px-3.5 py-2 text-[13px] leading-[19px] tracking-[0]", turn.pending ? "text-muted" : "text-ink")}>{turn.text}</p>
        ) : null}
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
  return <ParentAvatar id={avatar} fallbackInitial={sender.slice(0, 1)} />;
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

function ApiResponseCard({ card }: { card: ChatTurnCard }) {
  if (card.draft) return <DraftActionCard draft={card.draft} />;

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
        <div className="text-[12px] leading-4 tracking-[0] text-muted">{labelForApiCard(card.type)}</div>
        <div className="text-[15px] font-semibold leading-5 tracking-[-0.02em] text-ink">{card.title}</div>
        {card.subtitle ? <div className="mt-0.5 text-[13px] leading-[18px] tracking-[0] text-muted">{card.subtitle}</div> : null}
      </div>
      {card.cta ? <span className="shrink-0 rounded-full border border-line px-3 py-1.5 text-[13px] font-medium text-ink">{card.cta}</span> : null}
    </button>
  );
}

type DraftState = "confirmed" | "dismissed";
const DRAFT_STATE_KEY = "auri.draftStates.v1";

// A stable key per draft so its confirmed/dismissed state survives a full-page
// nav (the card's state would otherwise reset to "draft" on remount).
function draftKey(d: DraftInfo) {
  return d.objectId ?? `${d.kind}|${d.title}|${d.dateLabel}|${d.timeLabel}|${d.person}`;
}
function readDraftStates(): Record<string, DraftState> {
  try {
    return JSON.parse(sessionStorage.getItem(DRAFT_STATE_KEY) || "{}");
  } catch {
    return {};
  }
}
function writeDraftState(key: string, value: DraftState) {
  try {
    const map = readDraftStates();
    map[key] = value;
    sessionStorage.setItem(DRAFT_STATE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage failures
  }
}

// A reminder / calendar draft the user confirms right in chat. Confirming adds
// it to the calendar (via the shared event store) and flips the card to a
// settled state — no navigating away, so the thread stays intact. The settled
// state is persisted so it stays confirmed/dismissed after a page nav.
function DraftActionCard({ draft }: { draft: DraftInfo }) {
  const { addEvent } = useRobotEvents();
  const key = draftKey(draft);
  const [state, setState] = useState<"draft" | "confirmed" | "dismissed">(() => readDraftStates()[key] ?? "draft");

  const isReminder = draft.kind === "reminder";
  const whenLine = [draft.dateLabel, draft.timeLabel, draft.personLabel].filter(Boolean).join(" · ");

  const confirm = () => {
    addEvent({
      title: draft.title,
      note: draft.note,
      person: draft.person,
      dateLabel: draft.dateLabel,
      timeLabel: draft.timeLabel,
      forRobot: false,
    });
    writeDraftState(key, "confirmed");
    setState("confirmed");
  };

  const dismiss = () => {
    writeDraftState(key, "dismissed");
    setState("dismissed");
  };

  if (state === "dismissed") return null;
  const confirmed = state === "confirmed";

  return (
    <div className="max-w-[98%] overflow-hidden rounded-[16px] border border-line bg-white shadow-[0_8px_18px_rgba(8,8,8,0.04)]">
      <div className="flex items-start gap-3 px-3.5 pt-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center">
          <DoodleIcon name={isReminder ? "bell" : "calendar"} className="h-8 w-8" />
        </div>
        <div className="min-w-0 flex-1 pb-1">
          <div className="text-[12px] leading-4 tracking-[0] text-muted">{isReminder ? "Reminder" : "Calendar event"}</div>
          <div className="text-[15px] font-semibold leading-5 tracking-[-0.02em] text-ink">{draft.title}</div>
          {whenLine ? <div className="mt-0.5 text-[12.5px] leading-4 tracking-[0] text-muted">{whenLine}</div> : null}
          {draft.note ? <div className="mt-1 line-clamp-2 text-[13px] leading-[18px] tracking-[0] text-ink/70">"{draft.note}"</div> : null}
        </div>
      </div>

      {confirmed ? (
        <div className="mt-2 flex items-center justify-between border-t border-line/80 px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-[13px] font-medium text-mint">
            <svg viewBox="0 0 24 24" className="h-[16px] w-[16px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12 4.5 4.5L19 7" />
            </svg>
            {isReminder ? "Reminder set" : "Added to your calendar"}
          </span>
          <a href="/calendar" className="text-[13px] font-semibold text-ink">View calendar</a>
        </div>
      ) : (
        <div className="mt-2 flex gap-2 border-t border-line/80 px-3 py-2.5">
          <button onClick={confirm} className="flex-1 rounded-full bg-ink py-2 text-[14px] font-medium text-white">
            {isReminder ? "Add reminder" : "Add to calendar"}
          </button>
          <button onClick={dismiss} className="rounded-full border border-line px-4 py-2 text-[14px] font-medium text-muted">
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
