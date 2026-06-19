import clsx from "clsx";
import { ChangeEvent, ReactNode, useEffect, useRef, useState } from "react";
import { TabKey } from "@/lib/types";
import { DoodleIcon } from "./Icons";

export type { TabKey };

// Minimal typings for the Web Speech API (not in the standard TS DOM lib).
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
  stop: () => void;
};

declare global {
  interface Window {
    SpeechRecognition?: { new (): SpeechRecognitionLike };
    webkitSpeechRecognition?: { new (): SpeechRecognitionLike };
  }
}

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
  onComposerSubmit?: (message: string, imageUrl?: string) => Promise<void> | void;
}) {
  return (
    <main className="min-h-[100dvh] bg-paper md:grid md:min-h-screen md:place-items-center md:bg-[#f5f1eb] md:px-10 md:py-8">
      <div className="mx-auto w-full overflow-hidden bg-paper md:max-w-[430px]">
        <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-paper md:h-[min(900px,calc(100dvh-4rem))] md:min-h-[760px]">
          <ShellHeader activeTab={activeTab} />
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-[26px] pb-6 pt-2">{children}</div>
          <ShellBottom activeTab={activeTab} onTabChange={onTabChange} onComposerSubmit={onComposerSubmit} />
        </div>
      </div>
    </main>
  );
}

function ShellHeader({ activeTab }: { activeTab: TabKey }) {
  return (
    <div className="shrink-0 bg-paper pt-[env(safe-area-inset-top)]">
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
        <a href="/family" aria-label="Family settings" className="mt-1.5 shrink-0 text-ink/55">
          <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
          </svg>
        </a>
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
  onComposerSubmit?: (message: string, imageUrl?: string) => Promise<void> | void;
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
    <nav className="grid grid-cols-3 border-t border-line bg-paper px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2.5">
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

function AuriComposer({ onSubmit }: { onSubmit?: (message: string, imageUrl?: string) => Promise<void> | void }) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [listening, setListening] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Stop recognition AND detach its handlers, so a final onresult fired by
  // stop() can't write the transcript back into the box after we've cleared it.
  const stopRecognition = () => {
    const rec = recognitionRef.current;
    if (rec) {
      rec.onresult = () => {};
      rec.onend = () => {};
      rec.onerror = () => {};
      rec.stop();
    }
    recognitionRef.current = null;
    setListening(false);
  };

  // Clean up an in-flight recognition session if the composer unmounts.
  useEffect(() => () => stopRecognition(), []);

  const submit = async () => {
    const message = value.trim();
    if ((!message && !image) || submitting) return;
    stopRecognition();
    const attachment = image ?? undefined;
    setSubmitting(true);
    setValue("");
    setImage(null);
    try {
      await onSubmit?.(message, attachment);
    } finally {
      setSubmitting(false);
    }
  };

  const pickImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const toggleVoice = () => {
    if (listening) {
      stopRecognition();
      return;
    }
    const SpeechRecognition =
      typeof window !== "undefined"
        ? window.SpeechRecognition ?? window.webkitSpeechRecognition
        : undefined;
    if (!SpeechRecognition) {
      window.alert("Voice input isn’t supported in this browser. Try Chrome or Safari.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    const base = value.trim() ? `${value.trim()} ` : "";
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      setValue((base + transcript).replace(/\s+/g, " ").trimStart());
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  return (
    <div className="px-[26px] pb-3 pt-2">
      {image ? (
        <div className="mb-2 flex items-center gap-2">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="Attached" className="h-16 w-16 rounded-[14px] border border-line object-cover" />
            <button
              type="button"
              onClick={() => setImage(null)}
              className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink text-[13px] leading-none text-white shadow"
              aria-label="Remove photo"
            >
              ×
            </button>
          </div>
          <span className="text-[13px] text-muted">Photo attached</span>
        </div>
      ) : null}
      <div className="flex h-[54px] items-center gap-2.5 rounded-full border border-ink/15 bg-white px-2.5 shadow-[0_10px_30px_rgba(8,8,8,0.1)]">
        <input ref={fileInputRef} type="file" accept="image/*" onChange={pickImage} className="hidden" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
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
          placeholder={listening ? "Listening…" : "Ask Auri anything…"}
        />
        <button
          type="button"
          onClick={toggleVoice}
          className={clsx(
            "grid h-9 w-9 shrink-0 place-items-center rounded-full border",
            listening ? "animate-pulse border-red-400 bg-red-50 text-red-500" : "border-line bg-white text-ink"
          )}
          aria-label={listening ? "Stop recording" : "Use microphone"}
          aria-pressed={listening}
        >
          <svg viewBox="0 0 28 28" className="h-6 w-6" aria-hidden="true">
            <path d="M14 4a4 4 0 0 0-4 4v6a4 4 0 0 0 8 0V8a4 4 0 0 0-4-4Z" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M6 13v1a8 8 0 0 0 16 0v-1M14 22v3M10 25h8" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
          </svg>
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || (!value.trim() && !image)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-[22px] leading-none text-white disabled:opacity-35"
          aria-label="Send message"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
