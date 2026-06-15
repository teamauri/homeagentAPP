"use client";

import { useState } from "react";

export function ObjectActionButton({
  objectId,
  action,
  actionLabel,
  initialStatus,
}: {
  objectId: string;
  action: "add" | "save" | "send" | "log" | "complete";
  actionLabel: string;
  initialStatus: string;
}) {
  const [statusLabel, setStatusLabel] = useState(initialStatus);
  const [submitting, setSubmitting] = useState(false);

  const applyAction = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      const response = await fetch(`/api/objects/${objectId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) throw new Error("Action failed");
      const payload = (await response.json()) as { statusLabel?: string };
      setStatusLabel(payload.statusLabel || "Added locally");
    } catch {
      setStatusLabel("Action failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        onClick={applyAction}
        disabled={submitting || statusLabel.endsWith("locally")}
        className="min-h-[48px] w-full rounded-full bg-ink px-5 text-[16px] font-semibold text-white shadow-[0_12px_28px_rgba(8,8,8,0.18)] disabled:opacity-45"
      >
        {submitting ? "Adding..." : actionLabel}
      </button>
      <div className="rounded-[18px] border border-line bg-[#fbfaf8] px-4 py-3 text-center text-[14px] font-medium text-ink">
        {statusLabel}
      </div>
    </div>
  );
}
