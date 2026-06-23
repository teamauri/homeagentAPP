import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { ChatResponseCard as ApiChatCard } from "@/lib/chat-server/types";
import { ChatCardList } from "./ChatCardRenderer";
import { DoodleIcon } from "./Icons";
import { teamAgentById } from "@/lib/team";
import { TeamBadge } from "./TeamBadge";
import { useChildren, useFamilyMember } from "./FamilyContext";
import { chatFixtureMessages } from "@/lib/chat-fixtures";
import { ChatMessage } from "@/lib/chat-contracts";
import { TeamAgentId } from "@/lib/team";
import { RobotEvent, useRobotEvents } from "./RobotEventContext";
import { ChatTurnCard, DraftInfo } from "@/lib/chat-draft";

type ChatTurn = {
  id: string;
  sender: string;
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
          <span className="text-[15px] font-semibold leading-5 text-ink">{teamAgentById["iris"].name}</span>
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

// A finished job lands in chat as a new message: a job card showing the Done
// status, with the captured video embedded and a Keep button at the bottom.
function RobotCompletionRow({ event }: { event: RobotEvent }) {
  const agentId = event.agent ?? "vita";
  const agentName = teamAgentById[agentId]?.name ?? "Vita";
  return (
    <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-2.5">
      <TeamBadge agentId={agentId} size="sm" />
      <div className="min-w-0">
        <div className="mb-1 flex items-baseline gap-3">
          <span className="text-[15px] font-semibold leading-5 text-ink">{agentName}</span>
          <span className="text-[13px] text-muted">{event.completedAtLabel}</span>
        </div>
        <JobDoneCard event={event} />
      </div>
    </div>
  );
}

function JobDoneCard({ event }: { event: RobotEvent }) {
  const { keepEvent } = useRobotEvents();
  const result = event.result;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const play = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
    }
    setPlaying(true);
  };

  // Seek to 1s on metadata load so the first meaningful frame shows as thumbnail
  // instead of a black screen (only when no explicit poster image is provided).
  const handleMetadata = () => {
    if (result && !result.poster && videoRef.current && !playing) {
      videoRef.current.currentTime = 1;
    }
  };

  return (
    <div className="w-full overflow-hidden rounded-[18px] border border-line bg-white shadow-[0_8px_18px_rgba(8,8,8,0.04)]">
      {/* Job card header */}
      <div className="flex items-center gap-2.5 px-3.5 pb-2.5 pt-3">
        <div className="grid h-[30px] w-[30px] shrink-0 place-items-center">
          <DoodleIcon name={event.icon} className="h-8 w-8" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] leading-4 tracking-[0] text-muted">{event.dateLabel} · {event.timeLabel}</div>
          <div className="truncate text-[15px] font-semibold leading-5 tracking-[-0.02em] text-ink">{event.title}</div>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#2f9d5b]/10 px-2.5 py-0.5 text-[11px] font-semibold leading-4 text-[#2f9d5b]">
          <svg viewBox="0 0 24 24" className="h-[10px] w-[10px]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m5 12 4.5 4.5L19 7" />
          </svg>
          Done
        </span>
      </div>

      {/* Embedded video */}
      {result ? (
        <div className="border-t border-line/70">
          <div className="relative bg-[#17181b]">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoRef}
              src={result.videoUrl}
              poster={result.poster}
              playsInline
              preload="metadata"
              controls={playing}
              onLoadedMetadata={handleMetadata}
              onEnded={() => setPlaying(false)}
              onPause={() => setPlaying(false)}
              className="block max-h-64 w-full object-cover"
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
        </div>
      ) : null}

      {/* Keep button */}
      <div className="flex items-center justify-end gap-2 border-t border-line px-3.5 py-2.5">
        {event.kept ? (
          <span className="shrink-0 text-[12px] font-medium text-gold">💗 Kept</span>
        ) : (
          <button onClick={() => keepEvent(event.id)} className="shrink-0 text-[12px] font-medium text-gold active:opacity-60">
            Keep 💗
          </button>
        )}
      </div>
    </div>
  );
}

function useParentDisplayName(avatar: string, fallback: string): string {
  const member = useFamilyMember(avatar === "mom" || avatar === "dad" ? avatar : undefined);
  if (member?.name) return member.name;
  const agent = teamAgentById[avatar as TeamAgentId];
  if (agent) return agent.name;
  return fallback;
}

function ChatTurnRow({ turn }: { turn: ChatTurn }) {
  const displayName = useParentDisplayName(turn.avatar, turn.sender);
  return (
    <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-2.5">
      <Avatar avatar={turn.avatar} />
      <div className="min-w-0">
        <div className="mb-1 flex items-baseline gap-3">
          <span className="text-[15px] font-semibold leading-5 text-ink">{displayName}</span>
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
  const displayName = useParentDisplayName(turn.avatar, turn.sender);
  return (
    <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-2.5">
      <LiveAvatar avatar={turn.avatar} sender={turn.sender} />
      <div className="min-w-0">
        <div className="mb-1 flex items-baseline gap-3">
          <span className="text-[15px] font-semibold leading-5 text-ink">{displayName}</span>
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
    // Reminder cards belong in the calendar, not the object detail page.
    if (card.type === "reminder") {
      window.location.href = "/calendar";
      return;
    }
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

const PERSON_OPTIONS = [
  { id: "mia", label: "Mia" },
  { id: "leo", label: "Leo" },
  { id: "mom", label: "Mom" },
  { id: "dad", label: "Dad" },
  { id: "family", label: "Family" },
];
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
  const { addEvent, updateEvent, events } = useRobotEvents();
  const key = draftKey(draft);

  // Client-side dedup: find a pending event that matches this draft by title.
  // This catches duplicates even when the server-side store was wiped (Render restart).
  const matchingEvent = events.find(
    (e) => e.forRobot && e.status !== "done" &&
           e.title.trim().toLowerCase() === draft.title.trim().toLowerCase()
  );

  const [state, setState] = useState<"draft" | "confirmed" | "dismissed">(() => {
    if (matchingEvent) return "confirmed";
    return readDraftStates()[key] ?? "draft";
  });
  // Track which event this card owns so Save updates it instead of adding a new one.
  const [confirmedEventId, setConfirmedEventId] = useState<string | null>(matchingEvent?.id ?? null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(draft.title);
  const [editTime, setEditTime] = useState(draft.timeLabel);
  const [editPerson, setEditPerson] = useState<DraftInfo["person"]>(draft.person);

  // Handle events loading asynchronously (localStorage hydration happens after first render).
  useEffect(() => {
    if (matchingEvent && state === "draft") {
      setState("confirmed");
      setConfirmedEventId(matchingEvent.id);
      writeDraftState(key, "confirmed");
    }
  }, [matchingEvent?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isReminder = draft.kind === "reminder";
  const agentId = draft.agent ?? matchingEvent?.agent ?? (isReminder ? "vita" : "vita");
  const agent = teamAgentById[agentId];

  // Use live edits when confirmed so the confirmed card shows what was saved.
  const liveTitle = editTitle || draft.title;
  const liveTime = editTime || draft.timeLabel;
  const livePerson = editPerson || draft.person;
  const livePersonLabel = PERSON_OPTIONS.find((p) => p.id === livePerson)?.label ?? livePerson;
  const whenLine = [draft.dateLabel, liveTime, livePersonLabel].filter(Boolean).join(" · ");

  const confirm = () => {
    if (confirmedEventId) {
      // Update the existing event — don't create a second calendar entry.
      updateEvent(confirmedEventId, {
        title: liveTitle,
        person: livePerson,
        dateLabel: draft.dateLabel,
        timeLabel: liveTime,
      });
    } else {
      const id = addEvent({
        title: liveTitle,
        note: draft.note,
        person: livePerson,
        dateLabel: draft.dateLabel,
        timeLabel: liveTime,
        forRobot: true,
        agent: agentId,
      });
      setConfirmedEventId(id);
    }
    writeDraftState(key, "confirmed");
    setState("confirmed");
    setEditing(false);
  };

  const dismiss = () => {
    writeDraftState(key, "dismissed");
    setState("dismissed");
  };

  if (state === "dismissed") return null;
  const confirmed = state === "confirmed";

  if (confirmed) {
    if (editing) {
      return (
        <div className="max-w-[98%] overflow-hidden rounded-[16px] border border-line bg-white shadow-[0_8px_18px_rgba(8,8,8,0.04)]">
          <div className="space-y-2 px-3.5 py-3">
            <div className="mb-1 text-[12px] font-medium text-muted">{isReminder ? "Edit reminder" : "Edit event"}</div>
            <input
              className="w-full rounded-[10px] border border-line bg-surface px-3 py-1.5 text-[14px] text-ink outline-none"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Title"
            />
            <input
              className="w-full rounded-[10px] border border-line bg-surface px-3 py-1.5 text-[14px] text-ink outline-none"
              value={editTime}
              onChange={(e) => setEditTime(e.target.value)}
              placeholder="Time (e.g. 1:30 PM)"
            />
            <div className="flex flex-wrap gap-1.5">
              {PERSON_OPTIONS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setEditPerson(p.id as DraftInfo["person"])}
                  className={clsx(
                    "rounded-full px-3 py-1 text-[13px] font-medium",
                    editPerson === p.id ? "bg-ink text-white" : "border border-line bg-white text-ink"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={confirm} className="flex-1 rounded-full bg-ink py-2 text-[14px] font-medium text-white">
                Save
              </button>
              <button onClick={() => setEditing(false)} className="rounded-full border border-line px-4 py-2 text-[14px] font-medium text-muted">
                Cancel
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full overflow-hidden rounded-[15px] border border-line bg-white shadow-[0_8px_18px_rgba(8,8,8,0.04)]">
        <button
          onClick={() => setEditing(true)}
          className="flex w-full items-start gap-2.5 px-3 py-3 text-left"
        >
          <TeamBadge agentId={agentId} size="xs" />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] leading-4 text-muted">
              {agent.name}
            </div>
            <div className="text-[15px] font-semibold leading-5 tracking-[-0.02em] text-ink">
              {liveTitle}
            </div>
            <div className="mt-0.5 text-[12.5px] leading-[18px] text-muted">{whenLine}</div>
          </div>
        </button>
        <div className="border-t border-line px-3 py-2">
          <button
            onClick={() => { window.location.href = "/calendar"; }}
            className="w-full rounded-full border border-line py-1.5 text-[12.5px] font-medium text-ink shadow-[0_4px_10px_rgba(8,8,8,0.03)]"
          >
            View in Calendar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[98%] overflow-hidden rounded-[16px] border border-line bg-white shadow-[0_8px_18px_rgba(8,8,8,0.04)]">
      {editing ? (
        <div className="px-3.5 py-3 space-y-2">
          <div className="text-[12px] font-medium text-muted mb-1">{isReminder ? "Edit reminder" : "Edit event"}</div>
          <input
            className="w-full rounded-[10px] border border-line bg-surface px-3 py-1.5 text-[14px] text-ink outline-none"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Title"
          />
          <input
            className="w-full rounded-[10px] border border-line bg-surface px-3 py-1.5 text-[14px] text-ink outline-none"
            value={editTime}
            onChange={(e) => setEditTime(e.target.value)}
            placeholder="Time (e.g. 1:30 PM)"
          />
          <div className="flex flex-wrap gap-1.5">
            {PERSON_OPTIONS.map((p) => (
              <button
                key={p.id}
                onClick={() => setEditPerson(p.id as DraftInfo["person"])}
                className={clsx(
                  "rounded-full px-3 py-1 text-[13px] font-medium",
                  editPerson === p.id ? "bg-ink text-white" : "border border-line bg-white text-ink"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setEditing(false)} className="flex-1 rounded-full bg-ink py-2 text-[14px] font-medium text-white">
              Done
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3 px-3.5 pt-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center">
              <TeamBadge agentId={agentId} size="sm" />
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <div className="text-[12px] leading-4 tracking-[0] text-muted">{agent.name}</div>
              <div className="text-[15px] font-semibold leading-5 tracking-[-0.02em] text-ink">{liveTitle}</div>
              {whenLine ? <div className="mt-0.5 text-[12.5px] leading-4 tracking-[0] text-muted">{whenLine}</div> : null}
              {draft.note ? <div className="mt-1 line-clamp-2 text-[13px] leading-[18px] tracking-[0] text-ink/70">"{draft.note}"</div> : null}
            </div>
            {!confirmed && (
              <button onClick={() => setEditing(true)} className="mt-0.5 shrink-0 text-[12px] font-medium text-ink/50 hover:text-ink">
                Edit
              </button>
            )}
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
        </>
      )}
    </div>
  );
}
