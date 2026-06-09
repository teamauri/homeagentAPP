import clsx from "clsx";
import { ReactNode } from "react";
import { DoodleIcon } from "./Icons";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <h1 className="font-display text-[52px] leading-none tracking-[-0.045em] text-ink">{title}</h1>
        {subtitle ? <p className="mt-3 text-[17px] leading-6 text-ink/80">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function SectionHeader({ title, count }: { title: string; count?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between border-b border-line pb-2">
      <h2 className="font-display text-[27px] tracking-[-0.035em] text-ink">{title}</h2>
      {count ? <span className="text-sm text-muted">{count}</span> : null}
    </div>
  );
}

export function StatusPill({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "green" | "orange" | "purple" | "blue" | "black" }) {
  const toneClass = {
    default: "border-line bg-white text-ink/70",
    green: "border-green-200 bg-green-50 text-green-700",
    orange: "border-orange-200 bg-orange-50 text-orange-700",
    purple: "border-purple-200 bg-purple-50 text-purple-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    black: "border-ink bg-ink text-white",
  }[tone];
  return <span className={clsx("rounded-full border px-3 py-1 text-xs font-medium", toneClass)}>{children}</span>;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("rounded-[22px] border border-line bg-white", className)}>{children}</div>;
}

export function RowChevron() {
  return <span className="text-2xl leading-none text-ink/45">›</span>;
}

export function IconBubble({ icon, small = false }: { icon: string; small?: boolean }) {
  return (
    <div className={clsx("grid shrink-0 place-items-center rounded-2xl bg-soft", small ? "h-11 w-11" : "h-16 w-16")}>
      <DoodleIcon name={icon} className={small ? "h-8 w-8" : "h-11 w-11"} />
    </div>
  );
}
