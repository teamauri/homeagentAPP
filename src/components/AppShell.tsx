import clsx from "clsx";
import { ReactNode } from "react";
import { TabKey } from "@/lib/types";

export type { TabKey };

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: "today", label: "Today", icon: "⌂" },
  { key: "calendar", label: "Calendar", icon: "▣" },
  { key: "journeys", label: "Journeys", icon: "☆" },
  { key: "moments", label: "Moments", icon: "♡" },
  { key: "family", label: "Family", icon: "♧" },
];

export function AppShell({ children, activeTab, onTabChange }: { children: ReactNode; activeTab: TabKey; onTabChange: (tab: TabKey) => void }) {
  return (
    <main className="min-h-screen bg-[#f5f1eb] px-3 py-4 md:grid md:place-items-center md:px-10">
      <div className="mx-auto w-full max-w-[430px] overflow-hidden rounded-[46px] border border-black/10 bg-white shadow-[0_30px_100px_rgba(0,0,0,0.16)]">
        <div className="flex h-[min(900px,calc(100dvh-2rem))] min-h-[760px] flex-col overflow-hidden bg-white">
          <div className="flex items-center justify-between px-8 pt-6 text-sm font-semibold text-ink">
            <span>9:41</span>
            <span className="tracking-[0.15em]">▮▮▮  wifi  ▱</span>
          </div>
          <div className="no-scrollbar flex-1 overflow-y-auto px-7 pb-28 pt-7">{children}</div>
          <nav className="border-t border-line bg-white/95 px-4 pb-7 pt-3 backdrop-blur">
            <div className="grid grid-cols-5 gap-1">
              {tabs.map((tab) => {
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => onTabChange(tab.key)}
                    aria-current={active ? "page" : undefined}
                    className={clsx("flex flex-col items-center gap-1 rounded-2xl py-2 text-xs transition", active ? "text-ink" : "text-ink/45")}
                  >
                    <span className={clsx("text-[22px] leading-none", active && "font-bold")}>{tab.icon}</span>
                    <span className={clsx(active && "font-semibold")}>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </main>
  );
}
