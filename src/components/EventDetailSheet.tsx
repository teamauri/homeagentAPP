"use client";

import { DoodleIcon } from "./Icons";
import { teamAgentById, type TeamAgentId } from "@/lib/team";
import { TeamBadge } from "./TeamBadge";

// The resolved fields a detail sheet needs — composed by the caller so the same
// sheet works for calendar blocks and Jobs rows alike.
export type EventDetail = {
  title: string;
  icon: string;
  agent?: TeamAgentId;
  whenLine: string;
  note?: string;
  quoteNote?: boolean;
  statusLabel?: string;
  hasPhoto?: boolean;
  hasVoice?: boolean;
};

// A bottom sheet showing one event's details (every event is an Auri Robot
// task), styled like the app's event cards. Shows Delete when deletable.
export function EventDetailSheet({ detail, onDelete, onClose }: { detail: EventDetail; onDelete?: () => void; onClose: () => void }) {
  const hasChips = detail.statusLabel || detail.hasPhoto || detail.hasVoice;
  const agent = detail.agent ? teamAgentById[detail.agent] : undefined;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 md:items-center" onClick={onClose}>
      <div className="w-full max-w-[430px] rounded-t-[22px] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:rounded-[22px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          {detail.agent ? <TeamBadge agentId={detail.agent} size="md" /> : (
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] border border-line bg-[#f6f4ee]">
              <DoodleIcon name={detail.icon} className="h-9 w-9" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-medium text-muted">{agent ? `${agent.name} job` : "Auri Robot job"}</div>
            <div className="truncate text-[18px] font-semibold text-ink">{detail.title}</div>
            <div className="mt-0.5 text-[13px] text-muted">{detail.whenLine}</div>
          </div>
        </div>

        {detail.note ? (
          <p className="mt-3 rounded-[12px] bg-[#f6f7f9] px-3 py-2.5 text-[13px] leading-[18px] text-ink/80">{detail.quoteNote ? `“${detail.note}”` : detail.note}</p>
        ) : null}

        {hasChips ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px]">
            {detail.statusLabel ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#eef3f0] px-2.5 py-1 font-medium text-[#2E7B5B]">{detail.statusLabel}</span>
            ) : null}
            {detail.hasPhoto ? <span className="rounded-full bg-[#f1efe8] px-2.5 py-1 text-muted">📷 Photo</span> : null}
            {detail.hasVoice ? <span className="rounded-full bg-[#f1efe8] px-2.5 py-1 text-muted">🎙 Voice note</span> : null}
          </div>
        ) : null}

        <div className="mt-5 flex gap-2.5">
          {onDelete ? (
            <button onClick={onDelete} className="flex-1 rounded-full bg-[#d93025] py-2.5 text-[14px] font-semibold text-white">
              Delete job
            </button>
          ) : null}
          <button onClick={onClose} className={`${onDelete ? "" : "flex-1 "}rounded-full border border-line px-5 py-2.5 text-[14px] font-medium text-ink`}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
