import type { Status } from "@/lib/types";

// Status → pill color. Tinted fills (no border) using the design accent palette.
// Note: Tailwind only generates standard opacity steps (10, 20, …), so non-standard
// tints must use bracket syntax like /[0.16].
const statusStyles: Partial<Record<Status, string>> = {
  prepared: "bg-[#2f9d5b]/10 text-[#2f9d5b]",
  ready: "bg-[#2f9d5b]/10 text-[#2f9d5b]",
  "needs-review": "bg-[#e07a2f]/[0.16] text-[#c9621f]",
  suggested: "bg-[#7a55c7]/10 text-[#7a55c7]",
  draft: "bg-[#c08a2b]/[0.14] text-[#c08a2b]",
  saved: "bg-[#2e7dd1]/10 text-[#2e7dd1]",
};

export function StatusPill({ status, label }: { status: Status; label: string }) {
  return (
    <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 ${statusStyles[status] ?? "bg-line/50 text-muted"}`}>
      {label}
    </span>
  );
}
