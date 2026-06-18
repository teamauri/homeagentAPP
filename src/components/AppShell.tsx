import clsx from "clsx";
import { ReactNode, useState } from "react";
import { TabKey } from "@/lib/types";
import { DoodleIcon } from "./Icons";

export type { TabKey };

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: "chat", label: "Chat", icon: "family" },
  { key: "today", label: "Inbox", icon: "bell" },
  { key: "memory", label: "Memory", icon: "photos" },
];

const titles: Record<TabKey, string> = {
  today: "Good afternoon,\nJane.",
  chat: "Jane’s Family",
  memory: "Jane’s Memory",
};

const subtitles: Record<TabKey, string> = {
  today: "Here’s what needs you today.",
  chat: "Mom, Dad · Iris, Lumi, Vita",
  memory: "All your moments, in one timeline.",
};

export function AppShell({
  children,
  activeTab,
  onTabChange,
  onComposerSubmit,
}: {
  children: ReactNode;
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  onComposerSubmit?: (message: string) => Promise<void> | void;
}) {
  return (
    <main className="min-h-screen bg-[#f5f1eb] px-3 py-4 md:grid md:place-items-center md:px-10">
      <div className="phone-shell mx-auto w-full max-w-[430px] overflow-hidden bg-paper">
        <div className="relative flex h-[min(900px,calc(100dvh-2rem))] min-h-[760px] flex-col overflow-hidden bg-paper">
          <ShellHeader activeTab={activeTab} />
          <div className="no-scrollbar flex-1 overflow-y-auto px-[26px] pb-6 pt-2">{children}</div>
          <ShellBottom activeTab={activeTab} onTabChange={onTabChange} onComposerSubmit={onComposerSubmit} />
        </div>
      </div>
    </main>
  );
}

function StatusBar() {
  return (
    <div className="relative px-[29px] pt-[16px]">
      <div className="pointer-events-none absolute left-1/2 top-[12px] h-[30px] w-[112px] -translate-x-1/2 rounded-full bg-black" />
      <div className="flex items-center justify-between text-[15px] font-semibold text-ink">
        <span>9:41</span>
        <div className="flex items-center gap-1.5">
          <span className="flex h-3.5 items-end gap-0.5">
            <span className="h-1.5 w-1 rounded-sm bg-ink" />
            <span className="h-2 w-1 rounded-sm bg-ink" />
            <span className="h-3 w-1 rounded-sm bg-ink" />
            <span className="h-3.5 w-1 rounded-sm bg-ink" />
          </span>
          <span className="relative h-3.5 w-6 rounded-[4px] border-2 border-ink/75 after:absolute after:-right-1 after:top-1/2 after:h-1.5 after:w-0.5 after:-translate-y-1/2 after:rounded-r after:bg-ink/75">
            <span className="absolute inset-y-0.5 left-0.5 w-4 rounded-[2px] bg-ink" />
          </span>
        </div>
      </div>
    </div>
  );
}

function ShellHeader({ activeTab }: { activeTab: TabKey }) {
  return (
    <div className="shrink-0 bg-paper">
      <StatusBar />
      <header className="flex items-start justify-between gap-3 px-[26px] pb-3 pt-3">
        <div className="min-w-0">
          <h1 className="font-display text-[34px] font-normal leading-[0.96] tracking-[-0.01em] text-ink">
            {titles[activeTab].split("\n").map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>
          <p className="mt-2 text-[14px] leading-5 text-muted">{subtitles[activeTab]}</p>
        </div>
        <button aria-label="Settings" className="mt-1.5 shrink-0 text-ink/55">
          <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
          </svg>
        </button>
      </header>
    </div>
  );
}

function ShellBottom({
  activeTab,
  onTabChange,
  onComposerSubmit,
}: {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  onComposerSubmit?: (message: string) => Promise<void> | void;
}) {
  return (
    <div className="shrink-0 bg-paper">
      {activeTab === "chat" ? <AuriComposer onSubmit={onComposerSubmit} /> : null}
      <BottomTabBar activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
}

function BottomTabBar({ activeTab, onTabChange }: { activeTab: TabKey; onTabChange: (tab: TabKey) => void }) {
  return (
    <nav className="grid grid-cols-3 border-t border-line bg-paper px-3 pb-6 pt-2.5">
      {tabs.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            aria-current={active ? "page" : undefined}
            className="flex flex-col items-center gap-1 py-1"
          >
            <DoodleIcon name={tab.icon} className="h-[26px] w-[26px]" monochrome active={active} />
            <span className={clsx("text-[11px] font-medium tracking-wide", active ? "text-ink" : "text-muted/70")}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function AuriComposer({ onSubmit }: { onSubmit?: (message: string) => Promise<void> | void }) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const message = value.trim();
    if (!message || submitting) return;
    setSubmitting(true);
    setValue("");
    try {
      await onSubmit?.(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-[26px] pb-3 pt-2">
      <div className="flex h-[54px] items-center gap-2.5 rounded-full border border-ink/15 bg-white px-2.5 shadow-[0_10px_30px_rgba(8,8,8,0.1)]">
        <button
          type="button"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-white text-[26px] font-light leading-none text-ink"
          aria-label="Add photo"
        >
          +
        </button>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
          className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted/70"
          placeholder="Ask Auri anything…"
        />
        <button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-white text-ink" aria-label="Use microphone">
          <svg viewBox="0 0 28 28" className="h-6 w-6" aria-hidden="true">
            <path d="M14 4a4 4 0 0 0-4 4v6a4 4 0 0 0 8 0V8a4 4 0 0 0-4-4Z" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M6 13v1a8 8 0 0 0 16 0v-1M14 22v3M10 25h8" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
          </svg>
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !value.trim()}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-[22px] leading-none text-white disabled:opacity-35"
          aria-label="Send message"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
