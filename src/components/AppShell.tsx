import clsx from "clsx";
import { ReactNode, useState } from "react";
import { TabKey } from "@/lib/types";
import { DoodleIcon } from "./Icons";

export type { TabKey };

const tabs: { key: TabKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "chat", label: "Chat" },
  { key: "memory", label: "Memory" },
];

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
    <main className="min-h-screen bg-[#faf9f7] px-3 py-4 md:grid md:place-items-center md:px-10">
      <div className="phone-shell mx-auto w-full max-w-[430px] overflow-hidden bg-white">
        <div className="relative flex h-[min(900px,calc(100dvh-2rem))] min-h-[760px] flex-col overflow-hidden bg-white">
          <FixedShellTop activeTab={activeTab} onTabChange={onTabChange} />
          <div className="no-scrollbar flex-1 overflow-y-auto px-[31px] pb-[136px] pt-[236px]">
            {children}
          </div>
          <AuriComposer compact={activeTab === "today"} onSubmit={onComposerSubmit} />
        </div>
      </div>
    </main>
  );
}

function FixedShellTop({ activeTab, onTabChange }: { activeTab: TabKey; onTabChange: (tab: TabKey) => void }) {
  return (
    <div className="absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-white via-white via-[88%] to-white/0 px-[31px] pb-5 pt-[34px]">
      <div className="pointer-events-none absolute left-1/2 top-[18px] z-10 h-[35px] w-[124px] -translate-x-1/2 rounded-full bg-black shadow-inner" />
      <div className="relative z-20 flex items-center justify-between px-[3px] text-[17px] font-semibold text-ink">
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
      <ShellTop activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
}

function ShellTop({ activeTab, onTabChange }: { activeTab: TabKey; onTabChange: (tab: TabKey) => void }) {
  const title = activeTab === "chat" ? "Jane’s Family" : activeTab === "memory" ? "Jane’s Memory" : "Good afternoon,\nJane.";

  return (
    <div className="mt-7">
      <header className="mb-3 grid h-[76px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[31px] leading-[0.91] tracking-[-0.045em] text-ink">
            {title.split("\n").map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>
        </div>
        <button className="flex h-11 shrink-0 items-center gap-2 rounded-[14px] border border-line bg-white px-3 text-[14px] font-medium leading-5 text-ink shadow-[0_4px_14px_rgba(8,8,8,0.025)]">
          <DoodleIcon name="calendar" className="h-5 w-5" monochrome />
          View calendar
        </button>
      </header>
      <TopSegmentedNav activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
}

export function TopSegmentedNav({ activeTab, onTabChange }: { activeTab: TabKey; onTabChange: (tab: TabKey) => void }) {
  return (
    <nav className="grid grid-cols-3 rounded-full border border-line bg-[#fbfaf8] p-1 text-[16px] shadow-[0_10px_26px_rgba(8,8,8,0.035)]">
      {tabs.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "min-h-[38px] rounded-full px-4 transition",
              active ? "bg-white font-semibold text-ink shadow-[0_5px_14px_rgba(8,8,8,0.08)]" : "text-ink/62 hover:text-ink"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

function AuriComposer({
  compact,
  onSubmit,
}: {
  compact: boolean;
  onSubmit?: (message: string) => Promise<void> | void;
}) {
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
    <>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-32 bg-gradient-to-t from-white via-white/95 to-white/0" />
      <div className="absolute inset-x-[31px] bottom-3 z-30">
        <div className="flex h-[56px] items-center gap-3 rounded-full border border-ink/25 bg-white px-3 shadow-[0_18px_42px_rgba(8,8,8,0.18)]">
          <button type="button" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-white text-[30px] font-light leading-none text-ink" aria-label="Add attachment">
            +
          </button>
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-muted/70"
            placeholder={compact ? "Ask me anything..." : "Ask Auri anything..."}
          />
          <button type="button" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-white text-ink" aria-label="Use microphone">
            <svg viewBox="0 0 28 28" className="h-7 w-7" aria-hidden="true">
              <path d="M14 4a4 4 0 0 0-4 4v6a4 4 0 0 0 8 0V8a4 4 0 0 0-4-4Z" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M6 13v1a8 8 0 0 0 16 0v-1M14 22v3M10 25h8" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
            </svg>
          </button>
          <button type="button" onClick={submit} disabled={submitting || !value.trim()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-[24px] leading-none text-white disabled:opacity-35" aria-label="Send message">
            ↑
          </button>
        </div>
      </div>
    </>
  );
}
