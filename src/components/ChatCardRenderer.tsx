"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import { ChatCard, Subtask } from "@/lib/chat-contracts";
import { DoodleIcon } from "./Icons";

export function ChatCardRenderer({ card, compact = false }: { card: ChatCard; compact?: boolean }) {
  // A session in progress: render the checklist that updates in place. Done
  // steps collapse to a ticked line, the current step is highlighted.
  if (card.subtasks?.length) {
    return <SubtaskCard card={card} />;
  }

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

// A card carrying live progress. The header matches the flat card; below it,
// the subtasks tick off in place — so this stays one card, not a stream of pings.
// As the running step finishes it advances to the next; once every step is done
// the whole card collapses to a single settled line and sinks into history.
function SubtaskCard({ card }: { card: ChatCard }) {
  const [steps, setSteps] = useState<Subtask[]>(card.subtasks ?? []);

  useEffect(() => {
    const activeIdx = steps.findIndex((s) => s.state === "active");
    if (activeIdx === -1) return; // settled — nothing running
    const timer = setTimeout(() => {
      setSteps((cur) => {
        const next = cur.map((s, i) => (i === activeIdx ? { ...s, state: "done" as const, timeLabel: s.timeLabel === "now" ? "just now" : s.timeLabel } : s));
        const nextTodo = next.findIndex((s) => s.state === "todo");
        if (nextTodo !== -1) next[nextTodo] = { ...next[nextTodo], state: "active", timeLabel: "now" };
        return next;
      });
    }, 2600);
    return () => clearTimeout(timer);
  }, [steps]);

  const doneCount = steps.filter((s) => s.state === "done").length;

  if (steps.length > 0 && doneCount === steps.length) {
    return (
      <div className="flex items-center gap-2 py-0.5 text-[13px] leading-5 text-muted">
        <DoodleIcon name={card.icon} className="h-5 w-5 shrink-0" />
        <span className="min-w-0 truncate">
          {card.title} · <span className="font-semibold text-[#2f9d5b]">{steps.length}/{steps.length} done ✓</span>
        </span>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-[15px] border border-line bg-white shadow-[0_8px_18px_rgba(8,8,8,0.04)]">
      <div className="flex items-center gap-2.5 px-3.5 pb-2.5 pt-3">
        <div className="grid h-[30px] w-[30px] shrink-0 place-items-center">
          <DoodleIcon name={card.icon} className="h-8 w-8" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] leading-4 text-muted">{card.typeLabel}</div>
          <div className="truncate text-[15px] font-semibold leading-5 text-ink">{card.title}</div>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-full bg-[#7a55c7]/10 px-2.5 py-0.5 text-[11px] font-semibold leading-4 text-[#7a55c7]">
          {doneCount} of {steps.length}
        </span>
      </div>
      <div className="border-t border-line/70 px-3.5 pb-2.5 pt-1.5">
        {steps.map((task, i) => (
          <SubtaskRow key={i} task={task} />
        ))}
      </div>
    </div>
  );
}

function SubtaskRow({ task }: { task: Subtask }) {
  if (task.state === "active") {
    return (
      <div className="-mx-1.5 my-0.5 flex items-center gap-2.5 rounded-[10px] bg-[#7a55c7]/10 px-1.5 py-1.5">
        <span className="h-[17px] w-[17px] shrink-0 animate-spin rounded-full border-2 border-[#7a55c7] border-t-transparent" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[#5a3a9e]">{task.label}</span>
        {task.timeLabel ? <span className="shrink-0 text-[12px] text-[#7a55c7]">{task.timeLabel}</span> : null}
      </div>
    );
  }
  if (task.state === "done") {
    return (
      <div className="flex items-center gap-2.5 py-1.5">
        <span className="shrink-0 text-[#2f9d5b]" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="m8.5 12 2.5 2.5 4.5-5" />
          </svg>
        </span>
        <span className="min-w-0 flex-1 truncate text-[14px] text-muted line-through">{task.label}</span>
        {task.timeLabel ? <span className="shrink-0 text-[12px] text-muted/70">{task.timeLabel}</span> : null}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <span className="h-[17px] w-[17px] shrink-0 rounded-full border-[1.5px] border-line" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-[14px] text-ink/75">{task.label}</span>
    </div>
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
