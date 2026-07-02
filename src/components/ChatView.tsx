import clsx from "clsx";
import { ReactNode, useEffect, useState } from "react";
import { ChatResponseCard as ApiChatCard } from "@/lib/chat-server/types";
import { ChatCardList } from "./ChatCardRenderer";
import { DoodleIcon } from "./Icons";
import { teamAgentById } from "@/lib/team";
import { useChildren, useFamilyMember } from "./FamilyContext";
import { chatFixtureMessages } from "@/lib/chat-fixtures";
import { ChatMessage } from "@/lib/chat-contracts";
import { TeamAgentId } from "@/lib/team";
import { RobotEvent, useRobotEvents } from "./RobotEventContext";
import { ChatTurnCard, DraftInfo } from "@/lib/chat-draft";
import { JobCard, JobDetailSheet, phaseForRobotEvent } from "./JobCard";

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

function epochFromIso(value?: string): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function displayTimeFromIso(value?: string): string | undefined {
  const time = epochFromIso(value);
  if (!time) return undefined;
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(time));
}

function robotStartedAt(event: RobotEvent): number {
  return epochFromIso(event.robot?.startedAt) || epochFromIso(event.robot?.uploadedAt) || epochFromId(event.id);
}

function robotCompletedAt(event: RobotEvent): number {
  return (
    epochFromIso(event.robot?.highlightSyncedAt) ||
    epochFromIso(event.robot?.rawOutputReadyAt) ||
    epochFromIso(event.robot?.uploadedAt) ||
    robotStartedAt(event)
  );
}

const chatThreadIds = [
  "mom-sophie-watch",
  "cameraman-sophie-plan",
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

const chatBubbleBg = "bg-[#F1F1F1]";
const chatMeBubbleBg = "bg-[#DDEEE4]";
const chatAvatarOffset = "pl-[54px]";
const chatRowShell = "relative min-w-0";
const chatRowAvatar = "absolute left-0 top-0";
const chatMessageColumn = "min-w-0 max-w-[94%]";
const CHAT_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;

function isRecentChatEvent(at: number, now = Date.now()) {
  return at >= now - CHAT_RETENTION_MS;
}

function normalizeJobTitle(title: string) {
  return title.trim().toLowerCase();
}

export function ChatView({ liveTurns = [], sophieDemoPhase = 0 }: { liveTurns?: LiveChatTurn[]; sophieDemoPhase?: number }) {
  const { events, removeEvent } = useRobotEvents();
  const [selectedJob, setSelectedJob] = useState<RobotEvent | null>(null);
  const visibleTurns = turns.flatMap((turn) => {
    if (turn.id === "mom-sophie-watch") return sophieDemoPhase >= 3 ? [turn] : [];
    if (turn.id === "cameraman-sophie-plan") {
      if (sophieDemoPhase < 4) return [];
      return [{ ...turn, cards: undefined }];
    }
    return [turn];
  });
  const draftManagedJobTitles = new Set(
    liveTurns
      .flatMap((turn) => turn.cards ?? [])
      .map((card) => (card.draft ? normalizeJobTitle(card.draft.title) : undefined))
      .filter((title): title is string => Boolean(title))
  );
  const streamedEvents = events.filter(
    (event) =>
      event.forRobot &&
      (event.status === "recording" || (event.status === "done" && !!event.result?.videoUrl)) &&
      !draftManagedJobTitles.has(normalizeJobTitle(event.title))
  );
  // Merge live chat turns with robot-event activity into one timeline sorted
  // oldest → newest. A job born from a chat draft is managed by that draft card,
  // so backend status changes update the same card instead of adding new rows.
  const stream = [
    ...liveTurns.map((turn) => ({
      key: turn.id,
      at: turn.createdAt ?? epochFromId(turn.id),
      node: <LiveChatTurnRow key={turn.id} turn={turn} />,
    })),
    ...streamedEvents.flatMap((event) => {
      const at = event.status === "done" ? robotCompletedAt(event) : robotStartedAt(event);
      return isRecentChatEvent(at)
        ? [{ key: `job-${event.id}`, at, node: <RobotJobRow key={`job-${event.id}`} event={event} onOpen={() => setSelectedJob(event)} /> }]
        : [];
    }),
  ].sort((a, b) => a.at - b.at);

  return (
    <div className="pb-28">
      <div className="space-y-5">
        {visibleTurns.map((turn) => (
          <ChatTurnRow
            key={turn.id}
            turn={turn}
            after={turn.id === "cameraman-sophie-plan" && sophieDemoPhase >= 5 ? <CameramanMomentJobCard phase={sophieDemoPhase} /> : undefined}
          />
        ))}
        {stream.map((item) => item.node)}
      </div>
      {selectedJob ? (
        <JobDetailSheet
          event={selectedJob}
          onDelete={() => {
            removeEvent(selectedJob.id);
            setSelectedJob(null);
          }}
          onClose={() => setSelectedJob(null)}
        />
      ) : null}
    </div>
  );
}

function CameramanMomentJobCard({ phase }: { phase: number }) {
  const complete = phase >= 8;
  const logs: Array<{ time?: string; text: string; note?: string; state: "done" | "active" | "todo"; tone?: "skip" | "keeper" }> =
    phase >= 8
      ? [
          { time: "9:02", text: "Looking... living room empty", state: "done", tone: "skip" },
          { time: "9:17", text: "Sophie's here, but just napping", note: "Skipped", state: "done", tone: "skip" },
          { time: "9:34", text: "She's up and playing -> filming", state: "done" },
          { text: "Her tower fell, but she laughed", note: "This is the one worth keeping", state: "done", tone: "keeper" },
          { text: "Editing -> \"Sophie's big laugh\" · 0:08", note: "Sent to Family Chat", state: "done", tone: "keeper" },
        ]
      : phase >= 7
        ? [
            { time: "9:02", text: "Looking... living room empty", state: "done", tone: "skip" },
            { time: "9:17", text: "Sophie's here, but just napping", note: "Not a keeper", state: "done", tone: "skip" },
            { time: "9:34", text: "She's up and playing -> filming", state: "active" },
            { text: "Wait for a moment worth keeping", state: "todo" },
          ]
        : phase >= 6
          ? [
              { time: "9:02", text: "Looking... living room empty", state: "done", tone: "skip" },
              { time: "9:17", text: "Sophie's here, but just napping", note: "Not a keeper", state: "active", tone: "skip" },
              { time: "9:34", text: "Check again for movement", state: "todo" },
              { text: "Save only the best moment", state: "todo" },
            ]
          : [
              { time: "9:02", text: "Looking... living room empty", state: "active", tone: "skip" },
              { time: "9:17", text: "Check if Sophie is doing something", state: "todo" },
              { time: "9:34", text: "Film only if it looks worth saving", state: "todo" },
              { text: "Send a keeper to Family Chat", state: "todo" },
            ];
  const [kept, setKept] = useState(false);

  return (
    <div className="w-full overflow-hidden rounded-[16px] border border-line bg-white shadow-[0_8px_18px_rgba(8,8,8,0.04)]">
      <div className="flex items-center gap-2.5 px-3.5 pb-2.5 pt-3">
        <div className="grid h-[30px] w-[30px] shrink-0 place-items-center">
          <DoodleIcon name="camera-note" className="h-8 w-8" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] leading-4 tracking-[0] text-muted">Cameraman</div>
          <div className="text-[15px] font-semibold leading-[18px] tracking-[-0.02em] text-ink">
            {complete ? "Sophie's best moments" : "Watching for Sophie's best moments"}
          </div>
          <div className="text-[12px] leading-4 text-muted">
            {complete ? "Found one worth keeping · 0:08" : "Started just now · checking the room"}
          </div>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-full bg-[#7a55c7]/10 px-2.5 py-0.5 text-[11px] font-semibold leading-4 text-[#7a55c7]">
          {complete ? "Ready" : "Watching"}
        </span>
      </div>

      <div className="border-t border-line/70 px-3.5 pb-2.5 pt-1.5">
        {logs.map((log, index) => (
          <MomentJobLog key={`${log.time ?? "log"}-${index}`} log={log} />
        ))}
      </div>

      {complete ? (
        <div className="border-t border-line/70">
          <div className="relative overflow-hidden rounded-[16px] bg-[#17181b]">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src="/demo-media/sophie-big-laugh.mp4"
              poster="/demo-media/sophie-big-laugh.jpg"
              playsInline
              preload="metadata"
              className="block aspect-[4/3] w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 via-black/35 to-transparent" aria-hidden="true" />
            <button type="button" className="absolute inset-x-0 top-0 grid h-[58%] place-items-center" aria-label="Play Sophie's big laugh">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-white/95 text-ink shadow">
                <svg viewBox="0 0 24 24" className="h-6 w-6 translate-x-[1px]" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
              <span className="absolute left-2 top-2 rounded-md bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">0:08</span>
            </button>
            <div className="pointer-events-none absolute bottom-[50px] left-3.5 right-3.5 text-white">
              <p className="text-[13px] font-normal leading-[16px] tracking-[0] text-white drop-shadow">Her tower fell, but she laughed 😄</p>
            </div>
            <div className="absolute bottom-3.5 left-3.5 right-3.5 flex items-baseline justify-between gap-3 text-[13px] font-semibold leading-[16px] text-white">
              <div className="min-w-0 truncate drop-shadow">Highlight Story · 0:08</div>
              <button
                type="button"
                onClick={() => setKept((value) => !value)}
                aria-pressed={kept}
                className="shrink-0 whitespace-nowrap text-[13px] font-semibold leading-[16px] text-white drop-shadow"
              >
                Keep in Memory <span className={kept ? "text-[#FF3B30]" : "text-white"}>{kept ? "♥" : "♡"}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MomentJobLog({ log }: { log: { time?: string; text: string; note?: string; state: "done" | "active" | "todo"; tone?: "skip" | "keeper" } }) {
  const textTone = "text-muted";
  if (log.state === "active") {
    return (
      <div className="-mx-1.5 my-0.5 flex items-start gap-2.5 rounded-[10px] bg-[#7a55c7]/10 px-1.5 py-1.5">
        <span className="mt-[1px] h-[17px] w-[17px] shrink-0 animate-spin rounded-full border-2 border-[#7a55c7] border-t-transparent" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium leading-[18px] text-[#5a3a9e]">
            {log.time ? <span className="mr-1.5 font-semibold tabular-nums">{log.time}</span> : null}
            {log.text}
          </div>
          {log.note ? <div className="mt-0.5 text-[12px] font-medium leading-4 text-[#7a55c7]">{"->"} {log.note}</div> : null}
        </div>
      </div>
    );
  }
  if (log.state === "done") {
    return (
      <div className="flex items-start gap-2.5 py-1.5">
        <span className="mt-[1px] shrink-0 text-mint" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="m8.5 12 2.5 2.5 4.5-5" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <div className={clsx("text-[14px] leading-[18px]", textTone)}>
            {log.time ? <span className="mr-1.5 font-medium tabular-nums">{log.time}</span> : null}
            {log.text}
          </div>
          {log.note ? (
            <div className="mt-0.5 text-[12px] font-medium leading-4 text-muted">
              {"->"} {log.note}
            </div>
          ) : null}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <span className="mt-[1px] h-[17px] w-[17px] shrink-0 rounded-full border-[1.5px] border-line" aria-hidden="true" />
      <div className="min-w-0 flex-1 text-[14px] leading-[18px] text-ink/70">
        {log.time ? <span className="mr-1.5 tabular-nums text-muted">{log.time}</span> : null}
        {log.text}
      </div>
    </div>
  );
}

function RobotJobRow({ event, onOpen }: { event: RobotEvent; onOpen: () => void }) {
  const agentId = event.agent ?? "homekeeper";
  const agentName = teamAgentById[agentId]?.name ?? "Auri";
  const timeLabel =
    event.status === "done"
      ? event.completedAtLabel ?? displayTimeFromIso(event.robot?.highlightSyncedAt) ?? displayTimeFromIso(event.robot?.rawOutputReadyAt) ?? event.timeLabel
      : displayTimeFromIso(event.robot?.startedAt) ?? displayTimeFromIso(event.robot?.uploadedAt) ?? event.timeLabel;
  return (
    <div className={chatRowShell}>
      <div className={chatRowAvatar}>
        <ChatAgentBadge agentId={agentId} size="sm" />
      </div>
      <div className="min-w-0">
        <div className="mb-1 flex items-baseline gap-3">
          <span className={clsx(chatAvatarOffset, "text-[15px] font-semibold leading-5 text-ink")}>{agentName}</span>
          <span className="text-[13px] text-muted">{timeLabel}</span>
        </div>
        <JobCard event={event} phase={phaseForRobotEvent(event)} onOpen={onOpen} />
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

function isMeAvatar(avatar: ChatTurn["avatar"] | LiveChatTurn["avatar"]) {
  return avatar === "mom";
}

function ChatTurnRow({ turn, after }: { turn: ChatTurn; after?: ReactNode }) {
  const displayName = useParentDisplayName(turn.avatar, turn.sender);
  const isMe = isMeAvatar(turn.avatar);
  return (
    <div
      className={clsx(
        "min-w-0 items-start",
        isMe ? "flex justify-end gap-2.5" : after ? "grid grid-cols-[40px_minmax(0,1fr)] gap-0 pr-[39px]" : "flex gap-2.5"
      )}
    >
      {!isMe ? <Avatar avatar={turn.avatar} /> : null}
      <div className={clsx(isMe ? clsx(chatMessageColumn, "flex flex-col items-end") : after ? "min-w-0 w-full max-w-full" : chatMessageColumn)}>
        {!isMe ? (
          <div className={clsx("mb-1 flex items-baseline gap-3", after && "pl-3")}>
            <span className="text-[15px] font-semibold leading-5 text-ink">{displayName}</span>
            <span className="text-[13px] text-muted">{turn.time}</span>
          </div>
        ) : null}
        <div className={clsx("flex", isMe ? "justify-end" : "justify-start", after && !isMe && "pl-3")}>
          <p
            className={clsx(
              "inline-block rounded-[16px] px-3.5 py-2 text-[13px] leading-[19px] tracking-[0] text-ink",
              "max-w-full",
              isMe ? "rounded-tr-[5px]" : "rounded-tl-[5px]",
              isMe ? chatMeBubbleBg : chatBubbleBg
            )}
          >
            {turn.text}
          </p>
        </div>
        {turn.cards ? (
          <div className="mt-2">
            <ChatCardList cards={turn.cards} />
          </div>
        ) : null}
        {after ? <div className="mt-2 w-full">{after}</div> : null}
      </div>
      {isMe ? <Avatar avatar={turn.avatar} /> : null}
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
  if (!isParent) return <ChatAgentBadge agentId={avatar} size="sm" />;
  return <ParentAvatar id={avatar} fallbackInitial={avatar === "mom" ? "J" : "D"} />;
}

function LiveChatTurnRow({ turn }: { turn: LiveChatTurn }) {
  const displayName = useParentDisplayName(turn.avatar, turn.sender);
  const isMe = isMeAvatar(turn.avatar);
  if (turn.pending) {
    return (
      <div className={chatAvatarOffset}>
        <p className={clsx("inline-block max-w-full rounded-[16px] px-3.5 py-2 text-[13px] leading-[19px] tracking-[0] text-muted", chatBubbleBg)}>{turn.text}</p>
      </div>
    );
  }

  return (
    <div className={clsx("flex min-w-0 items-start gap-2.5", isMe && "justify-end")}>
      {!isMe ? <LiveAvatar avatar={turn.avatar} sender={turn.sender} /> : null}
      <div className={clsx(chatMessageColumn, isMe && "flex flex-col items-end")}>
        {!isMe ? (
          <div className="mb-1 flex items-baseline gap-3">
            <span className="text-[15px] font-semibold leading-5 text-ink">{displayName}</span>
            <span className="text-[13px] text-muted">{turn.time}</span>
          </div>
        ) : null}
        {turn.imageUrl ? (
          <div className={clsx("mb-2 mt-1", isMe && "w-full")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={turn.imageUrl} alt="Shared photo" className="max-h-64 w-full rounded-[16px] border border-line object-cover" />
          </div>
        ) : null}
        {turn.text ? (
          <div className={clsx("flex", isMe ? "justify-end" : "justify-start")}>
            <p
              className={clsx(
                "inline-block max-w-full rounded-[16px] px-3.5 py-2 text-[13px] leading-[19px] tracking-[0]",
                isMe ? "rounded-tr-[5px]" : "rounded-tl-[5px]",
                isMe ? chatMeBubbleBg : chatBubbleBg,
                turn.pending ? "text-muted" : "text-ink"
              )}
            >
              {turn.text}
            </p>
          </div>
        ) : null}
        {turn.cards?.length ? (
          <div className="mt-2 space-y-2">
            {turn.cards.map((card, index) => (
              <ApiResponseCard key={`${turn.id}-${card.targetRoute ?? card.title}-${index}`} card={card} />
            ))}
          </div>
        ) : null}
      </div>
      {isMe ? <LiveAvatar avatar={turn.avatar} sender={turn.sender} /> : null}
    </div>
  );
}

function LiveAvatar({ avatar, sender }: { avatar: LiveChatTurn["avatar"]; sender: string }) {
  const isParent = avatar === "mom" || avatar === "dad";
  if (!isParent) return <ChatAgentBadge agentId={avatar} size="sm" />;
  return <ParentAvatar id={avatar} fallbackInitial={sender.slice(0, 1)} />;
}

function ChatAgentBadge({ agentId, size = "sm" }: { agentId: TeamAgentId; size?: "xs" | "sm" }) {
  const agent = teamAgentById[agentId];
  const sizes = {
    xs: "h-5 w-5",
    sm: "h-10 w-10",
  };
  const iconSizes = {
    xs: "h-4 w-4",
    sm: "h-8 w-8",
  };

  return (
    <span className={clsx("mx-auto grid shrink-0 place-items-center rounded-full border border-line/70 bg-white", sizes[size])}>
      <DoodleIcon name={agent.icon} className={iconSizes[size]} />
    </span>
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

function ApiResponseCard({ card }: { card: ChatTurnCard }) {
  if (card.draft) return <DraftActionCard draft={card.draft} />;

  const handleClick = () => {
    // Reminder cards belong in the calendar, not the object detail page.
    if (card.type === "reminder") {
      window.__auriMarkHomeReturn?.();
      window.location.href = "/calendar";
      return;
    }
    if (card.targetRoute) {
      window.__auriMarkHomeReturn?.();
      window.location.href = card.targetRoute;
      return;
    }
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
  const { addEvent, updateEvent, events, ready: eventsReady } = useRobotEvents();
  const sophie = useFamilyMember("child1");
  const mike = useFamilyMember("child2");
  const jane = useFamilyMember("mom");
  const liang = useFamilyMember("dad");
  const personOptions: Array<{ id: DraftInfo["person"]; label: string }> = [
    { id: "child1", label: sophie?.name ?? "Sophie" },
    { id: "child2", label: mike?.name ?? "Mike" },
    { id: "mom", label: jane?.name ?? "Jane" },
    { id: "dad", label: liang?.name ?? "Liang" },
    { id: "family", label: "Family" },
  ];
  const key = draftKey(draft);

  // Client-side dedup: find a pending event that matches this draft by title.
  // This catches duplicates even when the server-side store was wiped (Render restart).
  const matchingEvent = events.find((e) => e.forRobot && normalizeJobTitle(e.title) === normalizeJobTitle(draft.title));

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
  const agentId = draft.agent ?? matchingEvent?.agent ?? "homekeeper";
  const agent = teamAgentById[agentId];
  const hasCreatedObject = Boolean(draft.objectId);
  const effectiveState = matchingEvent || hasCreatedObject ? "confirmed" : state;
  const activeEventId = confirmedEventId ?? matchingEvent?.id ?? null;

  // Use live edits when confirmed so the confirmed card shows what was saved.
  const liveTitle = editTitle || draft.title;
  const liveTime = editTime || draft.timeLabel;
  const livePerson = editPerson || draft.person;
  const livePersonLabel = personOptions.find((p) => p.id === livePerson)?.label ?? livePerson;
  const whenLine = [draft.dateLabel, liveTime, livePersonLabel].filter(Boolean).join(" · ");

  const confirm = () => {
    if (activeEventId) {
      // Update the existing event — don't create a second calendar entry.
      updateEvent(activeEventId, {
        title: liveTitle,
        person: livePerson,
        ...(liveTime === draft.timeLabel && draft.scheduledAt
          ? { scheduledAt: draft.scheduledAt }
          : { dateLabel: draft.dateLabel, timeLabel: liveTime }),
      });
    } else if (!hasCreatedObject) {
      const id = addEvent({
        title: liveTitle,
        note: draft.note,
        person: livePerson,
        scheduledAt: liveTime === draft.timeLabel ? draft.scheduledAt : undefined,
        dateLabel: draft.dateLabel,
        timeLabel: liveTime,
        forRobot: true,
        agent: agentId,
        recordingMode: draft.recordingMode,
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

  if (!eventsReady) return null;
  if (effectiveState === "dismissed") return null;
  const confirmed = effectiveState === "confirmed";

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
              {personOptions.map((p) => (
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
      <div className="w-full">
        {matchingEvent ? (
          <JobCard event={matchingEvent} phase={phaseForRobotEvent(matchingEvent)} />
        ) : (
          <button onClick={() => setEditing(true)} className="block w-full text-left">
            <JobCard
              phase="created"
              draft={{
                ...draft,
                title: liveTitle,
                timeLabel: liveTime,
                person: livePerson,
                personLabel: livePersonLabel,
                agent: agentId,
              }}
            />
          </button>
        )}
        <div className="px-3 py-2">
          <button
            onClick={() => { window.__auriMarkHomeReturn?.(); window.location.href = "/calendar"; }}
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
            {personOptions.map((p) => (
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
              <ChatAgentBadge agentId={agentId} size="sm" />
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
                {isReminder ? "Homekeeper set" : "Added to your calendar"}
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
