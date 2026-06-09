import clsx from "clsx";
import { ReactNode } from "react";
import { TabKey } from "@/lib/types";
import { DoodleIcon } from "./Icons";

export type { TabKey };

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: "today", label: "Today", icon: "home" },
  { key: "calendar", label: "Calendar", icon: "calendar" },
  { key: "journeys", label: "Journeys", icon: "map" },
  { key: "moments", label: "Moments", icon: "heart" },
  { key: "family", label: "Family", icon: "family" },
];

export function AppShell({ children, activeTab, onTabChange }: { children: ReactNode; activeTab: TabKey; onTabChange: (tab: TabKey) => void }) {
  return (
    <main className="min-h-screen bg-[#f7f4ef] px-3 py-4 md:grid md:place-items-center md:px-10">
      <div className="phone-shell mx-auto w-full max-w-[430px] overflow-hidden bg-white">
        <div className="relative flex h-[min(900px,calc(100dvh-2rem))] min-h-[760px] flex-col overflow-hidden bg-white">
          <div className="pointer-events-none absolute left-1/2 top-[18px] z-20 h-[35px] w-[124px] -translate-x-1/2 rounded-full bg-black shadow-inner" />
          <div className="z-10 flex items-center justify-between px-[34px] pt-[34px] text-[17px] font-semibold text-ink">
            <span>9:41</span>
            <div className="flex items-center gap-1.5">
              <span className="flex h-4 items-end gap-0.5">
                <span className="h-1.5 w-1 rounded-sm bg-ink" />
                <span className="h-2.5 w-1 rounded-sm bg-ink" />
                <span className="h-3.5 w-1 rounded-sm bg-ink" />
                <span className="h-4 w-1 rounded-sm bg-ink" />
              </span>
              <span className="text-[15px] leading-none">⌁</span>
              <span className="relative h-3.5 w-6 rounded-[4px] border-2 border-ink/75 after:absolute after:-right-1 after:top-1/2 after:h-1.5 after:w-0.5 after:-translate-y-1/2 after:rounded-r after:bg-ink/75">
                <span className="absolute inset-y-0.5 left-0.5 w-4 rounded-[2px] bg-ink" />
              </span>
            </div>
          </div>
          <div className="no-scrollbar flex-1 overflow-y-auto px-[31px] pb-28 pt-16">{children}</div>
          <nav className="border-t border-line bg-white/95 px-5 pb-7 pt-3 backdrop-blur">
            <div className="grid grid-cols-5 gap-1">
              {tabs.map((tab) => {
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => onTabChange(tab.key)}
                    aria-current={active ? "page" : undefined}
                    className={clsx("flex flex-col items-center gap-1 rounded-2xl py-1.5 text-[12px] transition", active ? "font-semibold text-ink" : "text-ink/48")}
                  >
                    <DoodleIcon name={tab.icon} className="h-7 w-7" monochrome active={active} />
                    <span>{tab.label}</span>
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
