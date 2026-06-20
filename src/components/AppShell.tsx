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
  onerror: (event: { error?: string }) => void;
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
  { key: "memory", label: "Journey", icon: "photos" },
];

const titles: Record<TabKey, string> = {
  today: "Inbox",
  chat: "Jane’s Family",
  memory: "Journey",
};

const subtitles: Record<TabKey, string> = {
  today: "Here’s what needs you today.",
  chat: "Mom, Dad · Iris, Lumi, Vita",
  memory: "Watch your family grow, together.",
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
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-[26px] pb-3 pt-2">{children}</div>
          <ShellBottom activeTab={activeTab} onTabChange={onTabChange} onComposerSubmit={onComposerSubmit} />
        </div>
      </div>
    </main>
  );
}

function ShellHeader({ activeTab }: { activeTab: TabKey }) {
  return (
    <div className="shrink-0 bg-paper pt-[env(safe-area-inset-top)]">
      <header className="flex items-start justify-between gap-3 px-[26px] pb-2 pt-2">
        <div className="min-w-0">
          <h1 className="font-display text-[30px] font-normal leading-[0.96] tracking-[-0.01em] text-ink">
            {titles[activeTab].split("\n").map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>
          <p className="mt-1.5 text-[14px] leading-5 text-muted">{subtitles[activeTab]}</p>
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
    <nav className="grid grid-cols-3 border-t border-line bg-paper px-3 pb-[max(0.55rem,env(safe-area-inset-bottom))] pt-1.5">
      {tabs.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            aria-current={active ? "page" : undefined}
            className="flex flex-col items-center gap-1 py-0.5"
          >
            <DoodleIcon name={tab.icon} className="h-[24px] w-[24px]" monochrome active={active} />
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
  const [elapsed, setElapsed] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Snapshot of the text box from before recording started, so Cancel can
  // restore it (dropping only what this dictation session added).
  const baseTextRef = useRef("");
  // The Web Speech API auto-ends each utterance after a pause. We keep dictation
  // alive until the user taps Done/Cancel by restarting on every onend while this
  // flag is set. finalizedRef holds transcript locked in from prior sessions
  // (each restart begins a fresh results buffer); sessionTextRef is the current
  // session's interim/final text.
  const keepListeningRef = useRef(false);
  const finalizedRef = useRef("");
  const sessionTextRef = useRef("");

  // Stop recognition AND detach its handlers, so a final onresult fired by
  // stop() can't write the transcript back into the box after we've cleared it.
  const stopRecognition = () => {
    keepListeningRef.current = false;
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

  // Abandon the in-progress dictation and roll the text box back.
  const cancelVoice = () => {
    stopRecognition();
    setValue(baseTextRef.current.trimEnd());
  };

  // Clean up an in-flight recognition session if the composer unmounts.
  useEffect(() => () => stopRecognition(), []);

  // Run a 1s timer while listening; reset to 0 each time recording starts.
  useEffect(() => {
    if (!listening) return;
    setElapsed(0);
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [listening]);

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
    recognition.continuous = true;
    const base = value.trim() ? `${value.trim()} ` : "";
    baseTextRef.current = base;
    finalizedRef.current = base;
    sessionTextRef.current = "";
    keepListeningRef.current = true;

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      sessionTextRef.current = transcript;
      setValue((finalizedRef.current + transcript).replace(/\s+/g, " ").trimStart());
    };
    // A pause ends the session; while the user hasn't tapped Done/Cancel, fold
    // what we heard into the running transcript and restart so it feels continuous.
    recognition.onend = () => {
      if (!keepListeningRef.current) {
        setListening(false);
        return;
      }
      const merged = (finalizedRef.current + sessionTextRef.current).replace(/\s+/g, " ").trimStart();
      finalizedRef.current = merged ? `${merged} ` : "";
      sessionTextRef.current = "";
      try {
        recognition.start();
      } catch {
        setListening(false);
      }
    };
    recognition.onerror = (event) => {
      // Permission/hardware failures are terminal — stop retrying. Transient ones
      // (e.g. "no-speech") fall through to onend, which restarts.
      if (event.error === "not-allowed" || event.error === "service-not-allowed" || event.error === "audio-capture") {
        keepListeningRef.current = false;
        setListening(false);
      }
    };

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  return (
    <div className="px-[26px] pb-2 pt-1.5">
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
      {listening ? (
        <RecordingPanel transcript={value} elapsed={elapsed} onCancel={cancelVoice} onStop={stopRecognition} />
      ) : (
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
            placeholder="Ask Auri anything…"
          />
          <button
            type="button"
            onClick={toggleVoice}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-white text-ink"
            aria-label="Use microphone"
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
      )}
    </div>
  );
}

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// A calm "listening" panel that rises in place of the composer while dictation
// is active: a mic with soft breathing halos, a timer, the full live transcript
// (wraps freely — never truncated), and two clear actions (Cancel / Done).
function RecordingPanel({
  transcript,
  elapsed,
  onCancel,
  onStop,
}: {
  transcript: string;
  elapsed: number;
  onCancel: () => void;
  onStop: () => void;
}) {
  const text = transcript.trim();
  return (
    <div className="rounded-[22px] border border-line bg-white px-[18px] pb-4 pt-6 shadow-[0_14px_36px_rgba(8,8,8,0.10)]">
      <div className="flex flex-col items-center gap-3.5">
        <span className="relative grid h-16 w-16 place-items-center" aria-hidden="true">
          <span className="auri-halo-ring absolute h-16 w-16 rounded-full bg-mint" />
          <span className="auri-halo-ring absolute h-16 w-16 rounded-full bg-mint" style={{ animationDelay: "1.2s" }} />
          <span className="relative grid h-14 w-14 place-items-center rounded-full bg-mint text-white">
            <svg viewBox="0 0 28 28" className="h-7 w-7" aria-hidden="true">
              <path d="M14 4a4 4 0 0 0-4 4v6a4 4 0 0 0 8 0V8a4 4 0 0 0-4-4Z" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M6 13v1a8 8 0 0 0 16 0v-1M14 22v3M10 25h8" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
            </svg>
          </span>
        </span>

        <div className="flex items-center gap-2">
          <span className="text-[15px] font-medium text-mint">Listening</span>
          <span className="tabular-nums text-[13px] text-muted">{formatElapsed(elapsed)}</span>
        </div>

        <p className="no-scrollbar max-h-[34vh] w-full overflow-y-auto whitespace-pre-wrap break-words text-center text-[16px] leading-relaxed text-ink">
          {text || <span className="text-muted/70">Start speaking…</span>}
        </p>
      </div>

      <div className="mt-4 flex gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="h-11 flex-1 rounded-full border border-line bg-soft text-[15px] font-medium text-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onStop}
          className="h-11 flex-1 rounded-full bg-mint text-[15px] font-medium text-white"
          aria-label="Stop recording and keep text"
        >
          Done
        </button>
      </div>
    </div>
  );
}
