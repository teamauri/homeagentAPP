import clsx from "clsx";
import { ReactNode } from "react";
import { DoodleIcon } from "./Icons";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <h1 className="font-display text-[62px] leading-[0.93] tracking-[-0.035em] text-ink">{title}</h1>
        {subtitle ? <p className="mt-4 text-[21px] leading-7 text-ink/88">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function SectionHeader({ title, count }: { title: string; count?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="font-display text-[31px] leading-none tracking-[-0.03em] text-ink">{title}</h2>
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
  return <span className={clsx("rounded-full border px-3 py-1 text-[14px] font-medium", toneClass)}>{children}</span>;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("rounded-[23px] border border-line bg-white", className)}>{children}</div>;
}

export function RowChevron() {
  return <span className="text-[34px] font-light leading-none text-ink/45">›</span>;
}

export function IconBubble({ icon, small = false }: { icon: string; small?: boolean }) {
  return (
    <div className={clsx("grid shrink-0 place-items-center", small ? "h-12 w-12" : "h-[70px] w-[70px]")}>
      <DoodleIcon name={icon} className={small ? "h-11 w-11" : "h-[58px] w-[58px]"} />
    </div>
  );
}
