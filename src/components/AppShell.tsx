import clsx from "clsx";
import { ChangeEvent, ReactNode, RefObject, useEffect, useMemo, useRef, useState } from "react";
import { TabKey } from "@/lib/types";
import { useFamilyMembers } from "./FamilyContext";
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

const tabs: { key: TabKey; label: string; icon: string; activeBg: string; activeText: string }[] = [
  { key: "chat", label: "Chat", icon: "home", activeBg: "bg-[#FF6B6B]/15", activeText: "text-[#E03C3C]" },
  { key: "today", label: "Jobs", icon: "bell", activeBg: "bg-[#FF9F43]/15", activeText: "text-[#D47A00]" },
  { key: "memory", label: "Memories", icon: "heart", activeBg: "bg-[#A855F7]/15", activeText: "text-[#7C3AED]" },
];

const titles: Record<TabKey, string> = {
  today: "Jobs",
  chat: "Jane’s Family",
  memory: "Memories",
};

type FamilyNameCorrection = {
  canonical: string;
  aliases: string[];
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function familyNameAliases(id: string, name: string) {
  const lowerId = id.toLowerCase();
  const lowerName = name.toLowerCase();
  const aliases = new Set([name]);

  if (lowerId === "mia" || lowerName === "mia") {
    ["mia", "me a", "mee a", "mya", "maya", "nia"].forEach((alias) => aliases.add(alias));
  }
  if (lowerId === "leo" || lowerName === "leo") {
    ["leo", "lio", "lee oh", "le oh", "rio"].forEach((alias) => aliases.add(alias));
  }

  return [...aliases].filter((alias) => alias.trim().length >= 2);
}

function correctFamilyNameMentions(text: string, corrections: FamilyNameCorrection[]) {
  let corrected = text;
  for (const correction of corrections) {
    const aliases = [...correction.aliases].sort((a, b) => b.length - a.length);
    for (const alias of aliases) {
      const pattern = new RegExp(`(^|[^A-Za-z])(${escapeRegExp(alias)})(?=$|[^A-Za-z])`, "gi");
      corrected = corrected.replace(pattern, (_match, prefix: string) => `${prefix}${correction.canonical}`);
    }
  }
  return corrected;
}

export function AppShell({
  children,
  activeTab,
  onTabChange,
  onComposerSubmit,
  hideHeader = false,
  scrollContainerRef,
  voiceDemoPhase,
}: {
  children: ReactNode;
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  onComposerSubmit?: (message: string, imageUrl?: string) => Promise<void> | void;
  hideHeader?: boolean;
  scrollContainerRef?: RefObject<HTMLDivElement>;
  voiceDemoPhase?: number;
}) {
  return (
    <main className="min-h-[100dvh] bg-paper md:grid md:min-h-screen md:place-items-center md:bg-[#f5f1eb] md:px-10 md:py-8">
      <div className="mx-auto w-full overflow-hidden bg-paper md:max-w-[430px]">
        <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-paper md:h-[min(900px,calc(100dvh-4rem))] md:min-h-[760px]">
          {hideHeader ? <div className="shrink-0 bg-paper pt-[env(safe-area-inset-top)]" /> : <ShellHeader activeTab={activeTab} />}
          <div ref={scrollContainerRef} className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-[9px] pb-3 pt-2">{children}</div>
          <ShellBottom activeTab={activeTab} onTabChange={onTabChange} onComposerSubmit={onComposerSubmit} voiceDemoPhase={voiceDemoPhase} />
        </div>
      </div>
    </main>
  );
}

function ShellHeader({ activeTab }: { activeTab: TabKey }) {
  return (
    <div className="shrink-0 bg-paper pt-[env(safe-area-inset-top)]">
      <header className="flex items-start justify-between gap-3 px-[9px] pb-3 pt-3">
        <div className="min-w-0">
          <h1 className="font-display text-[30px] font-normal leading-[0.96] tracking-[-0.01em] text-ink">
            {titles[activeTab].split("\n").map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>
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
  voiceDemoPhase,
}: {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  onComposerSubmit?: (message: string, imageUrl?: string) => Promise<void> | void;
  voiceDemoPhase?: number;
}) {
  return (
    <div className="shrink-0 bg-paper">
      {activeTab === "chat" ? <AuriComposer onSubmit={onComposerSubmit} voiceDemoPhase={voiceDemoPhase} /> : null}
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
            <DoodleIcon name={tab.icon} className={clsx("h-[24px] w-[24px] transition-all", !active && "opacity-40 grayscale")} />
            <span className={clsx("text-[11px] font-medium tracking-wide", active ? tab.activeText : "text-muted/70")}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function AuriComposer({ onSubmit, voiceDemoPhase = 0 }: { onSubmit?: (message: string, imageUrl?: string) => Promise<void> | void; voiceDemoPhase?: number }) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const familyMembers = useFamilyMembers();
  const familyNameCorrections = useMemo(
    () =>
      familyMembers
        .map((member) => ({
          canonical: member.name.trim(),
          aliases: familyNameAliases(member.id, member.name.trim()),
        }))
        .filter((correction) => correction.canonical && correction.aliases.length),
    [familyMembers]
  );

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

  // Finish dictation: send straight away if anything was captured (submit() stops
  // recognition itself); otherwise just close the panel.
  const finishVoice = () => {
    if (value.trim() || image) submit();
    else stopRecognition();
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
    recognition.lang = "en-US"; // English model; better for English-first dictation.
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
      const correctedTranscript = correctFamilyNameMentions(transcript, familyNameCorrections);
      sessionTextRef.current = correctedTranscript;
      setValue((finalizedRef.current + correctedTranscript).replace(/\s+/g, " ").trimStart());
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

  if (voiceDemoPhase === 1 || voiceDemoPhase === 2) {
    return (
      <div className="px-[9px] pb-2 pt-1.5">
        <RecordingPanel
          transcript={voiceDemoPhase >= 2 ? "watch for sophie's best moments today" : ""}
          elapsed={voiceDemoPhase >= 2 ? 3 : 1}
          onCancel={() => {}}
          onStop={() => {}}
        />
      </div>
    );
  }

  return (
    <div className="px-[9px] pb-2 pt-1.5">
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
        <RecordingPanel transcript={value} elapsed={elapsed} onCancel={cancelVoice} onStop={finishVoice} />
      ) : (
        <div className="auri-composer-shell flex h-[54px] items-center gap-2.5 px-2.5">
          <input ref={fileInputRef} type="file" accept="image/*" onChange={pickImage} className="hidden" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-ink/10 bg-white/72 text-ink/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
            aria-label="Add photo"
          >
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" aria-hidden="true">
              <path d="M12 6.7v10.6M6.7 12h10.6" />
            </svg>
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
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-ink/10 bg-white/72 text-ink/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
            aria-label="Use microphone"
          >
            <svg viewBox="0 0 28 28" className="h-[22px] w-[22px]" aria-hidden="true">
              <path d="M14 4.7a3.5 3.5 0 0 0-3.5 3.5v5.9a3.5 3.5 0 0 0 7 0V8.2A3.5 3.5 0 0 0 14 4.7Z" fill="none" stroke="currentColor" strokeWidth="1.55" />
              <path d="M7.1 13.1v.8a6.9 6.9 0 0 0 13.8 0v-.8M14 20.8v3M10.7 23.8h6.6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.55" />
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
// (wraps freely — never truncated), and two clear actions (Cancel / Send).
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
          aria-label="Send voice message"
        >
          Send
        </button>
      </div>
    </div>
  );
}
