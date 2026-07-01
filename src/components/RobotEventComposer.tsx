"use client";

import clsx from "clsx";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import type { PersonId } from "@/lib/types";
import { DoodleIcon } from "./Icons";
import { NewRobotEventInput } from "./RobotEventContext";
import { useFamilyMember } from "./FamilyContext";

const dayOptions = ["Today", "Tomorrow"];

function formatTime(value: string) {
  // value is "HH:MM" 24h from <input type="time">
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "";
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function RobotEventComposer({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (input: NewRobotEventInput) => void }) {
  const sophie = useFamilyMember("child1");
  const mike = useFamilyMember("child2");
  const people: { id: PersonId; label: string }[] = [
    { id: "child1", label: sophie?.name ?? "Sophie" },
    { id: "child2", label: mike?.name ?? "Mike" },
    { id: "family", label: "Family" },
  ];
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [person, setPerson] = useState<PersonId>("child1");
  const [day, setDay] = useState("Today");
  const [time, setTime] = useState("16:00");
  const [forRobot, setForRobot] = useState(true);
  const [photo, setPhoto] = useState<string | null>(null);

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [voiceDuration, setVoiceDuration] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const reset = () => {
    setTitle("");
    setNote("");
    setPerson("child1");
    setDay("Today");
    setTime("16:00");
    setForRobot(true);
    setPhoto(null);
    setRecording(false);
    setElapsed(0);
    if (voiceUrl) URL.revokeObjectURL(voiceUrl);
    setVoiceUrl(null);
    setVoiceDuration(0);
  };

  // Stop the mic stream + recorder cleanly (used on stop / unmount / close).
  const teardownRecorder = () => {
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    return () => {
      teardownRecorder();
      if (voiceUrl) URL.revokeObjectURL(voiceUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tick the elapsed timer while recording.
  useEffect(() => {
    if (!recording) return;
    setElapsed(0);
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  if (!open) return null;

  const pickPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  const startRecording = async () => {
    if (voiceUrl) {
      URL.revokeObjectURL(voiceUrl);
      setVoiceUrl(null);
      setVoiceDuration(0);
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setVoiceUrl(URL.createObjectURL(blob));
        teardownRecorder();
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      window.alert("Microphone isn’t available. Check browser permissions to record a voice note.");
    }
  };

  const stopRecording = () => {
    setVoiceDuration(elapsed);
    recorderRef.current?.stop();
    setRecording(false);
  };

  const deleteVoice = () => {
    if (voiceUrl) URL.revokeObjectURL(voiceUrl);
    setVoiceUrl(null);
    setVoiceDuration(0);
  };

  const playVoice = () => audioRef.current?.play();

  const close = () => {
    if (recording) stopRecording();
    onClose();
  };

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onCreate({
      title: trimmed,
      note: note.trim() || undefined,
      person,
      dateLabel: day,
      timeLabel: formatTime(time) || "Anytime",
      forRobot,
      photoUrl: photo ?? undefined,
      voiceUrl: voiceUrl ?? undefined,
      voiceDuration: voiceUrl ? voiceDuration : undefined,
    });
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center">
      <button aria-label="Close" className="absolute inset-0 bg-ink/30" onClick={close} />
      <div className="relative mt-auto flex max-h-[92dvh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[28px] border border-line bg-paper pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-20px_60px_rgba(8,8,8,0.18)]">
        <div className="mx-auto mt-2.5 h-[5px] w-11 rounded-full bg-line" />
        <div className="px-[26px] pt-3">
          <h2 className="font-display text-[24px] font-normal leading-none tracking-[-0.01em] text-ink">New event</h2>
          <p className="mt-1.5 text-[13px] leading-5 text-muted">Auri Robot will be there for it, and bring back the moment.</p>
        </div>

        <div className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-[26px] pb-4 pt-4">
          <div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What’s the event? e.g. Practice piano"
              className="w-full rounded-[16px] border border-line bg-soft px-3.5 py-3 text-[15px] text-ink outline-none placeholder:text-muted/70 focus:border-ink/25"
            />
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Add a little note for them to hear…"
              className="mt-2 w-full resize-none rounded-[16px] border border-line bg-soft px-3.5 py-2.5 text-[14px] text-ink outline-none placeholder:text-muted/70 focus:border-ink/25"
            />
          </div>

          <div>
            <FieldLabel>For</FieldLabel>
            <div className="flex gap-2">
              {people.map((p) => (
                <Chip key={p.id} active={person === p.id} onClick={() => setPerson(p.id)}>
                  {p.label}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <FieldLabel>When</FieldLabel>
            <div className="flex items-center gap-2">
              {dayOptions.map((d) => (
                <Chip key={d} active={day === d} onClick={() => setDay(d)}>
                  {d}
                </Chip>
              ))}
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="ml-auto rounded-full border border-line bg-soft px-3.5 py-1.5 text-[14px] text-ink outline-none focus:border-ink/25"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setForRobot((v) => !v)}
            className="flex w-full items-center gap-3 rounded-[16px] border border-line bg-soft px-3.5 py-3 text-left"
            aria-pressed={forRobot}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-white">
              <DoodleIcon name="robot" className="h-7 w-7" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium text-ink">Auri Robot will be there</span>
              <span className="block text-[12px] leading-4 text-muted">Shows a reminder, then captures the moment</span>
            </span>
            <Switch on={forRobot} />
          </button>

          <div className={forRobot ? "" : "opacity-50"}>
            <FieldLabel>{forRobot ? "Photo & voice note · optional" : "Photo & note · optional"}</FieldLabel>
            <div className="flex items-start gap-3">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={pickPhoto} className="hidden" />
              {photo ? (
                <div className="relative -rotate-3 rounded-[5px] border border-line bg-white p-1.5 pb-4 shadow-[0_4px_12px_rgba(8,8,8,0.08)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo} alt="Attached" className="h-[58px] w-[64px] rounded-[2px] object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhoto(null)}
                    className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-ink text-[13px] leading-none text-white shadow"
                    aria-label="Remove photo"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="grid h-[74px] w-[74px] shrink-0 place-items-center rounded-[14px] border border-dashed border-line bg-soft text-mint"
                  aria-label="Add photo"
                >
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="18" height="14" rx="2.5" />
                    <circle cx="8.5" cy="10" r="1.6" />
                    <path d="m4 17 5-4 4 3 3-2 4 3" />
                  </svg>
                </button>
              )}

              <div className="min-w-0 flex-1">
                <VoiceNote
                  recording={recording}
                  elapsed={elapsed}
                  voiceUrl={voiceUrl}
                  voiceDuration={voiceDuration}
                  onStart={startRecording}
                  onStop={stopRecording}
                  onDelete={deleteVoice}
                  onPlay={playVoice}
                />
                {voiceUrl ? <audio ref={audioRef} src={voiceUrl} className="hidden" /> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-line px-[26px] pt-3">
          <button
            type="button"
            onClick={submit}
            disabled={!title.trim()}
            className="h-[52px] w-full rounded-full bg-ink text-[15px] font-medium text-white disabled:opacity-35"
          >
            {forRobot ? "Hand it to Auri Robot" : "Add to calendar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Switch({ on }: { on: boolean }) {
  return (
    <span className={clsx("relative inline-flex h-[26px] w-[44px] shrink-0 items-center rounded-full transition-colors", on ? "bg-mint" : "bg-line")} aria-hidden="true">
      <span className={clsx("inline-block h-[20px] w-[20px] rounded-full bg-white shadow transition-transform", on ? "translate-x-[21px]" : "translate-x-[3px]")} />
    </span>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{children}</div>;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "rounded-full border px-4 py-1.5 text-[14px] font-medium transition-colors",
        active ? "border-transparent bg-ink text-white" : "border-line bg-soft text-ink"
      )}
    >
      {children}
    </button>
  );
}

function VoiceNote({
  recording,
  elapsed,
  voiceUrl,
  voiceDuration,
  onStart,
  onStop,
  onDelete,
  onPlay,
}: {
  recording: boolean;
  elapsed: number;
  voiceUrl: string | null;
  voiceDuration: number;
  onStart: () => void;
  onStop: () => void;
  onDelete: () => void;
  onPlay: () => void;
}) {
  if (recording) {
    return (
      <div className="flex h-[74px] items-center gap-3 rounded-[14px] border border-line bg-soft px-3.5">
        <span className="relative grid h-9 w-9 place-items-center" aria-hidden="true">
          <span className="auri-halo-ring absolute h-9 w-9 rounded-full bg-coral" />
          <span className="relative grid h-9 w-9 place-items-center rounded-full bg-coral text-white">
            <span className="h-3 w-3 rounded-[3px] bg-white" />
          </span>
        </span>
        <div className="flex-1">
          <div className="text-[14px] font-medium text-coral">Recording…</div>
          <div className="tabular-nums text-[12px] text-muted">{formatElapsed(elapsed)}</div>
        </div>
        <button type="button" onClick={onStop} className="rounded-full bg-ink px-4 py-1.5 text-[13px] font-medium text-white">
          Stop
        </button>
      </div>
    );
  }

  if (voiceUrl) {
    return (
      <div className="flex h-[74px] items-center gap-2.5 rounded-[14px] border border-line bg-soft px-3.5">
        <button type="button" onClick={onPlay} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-mint text-white" aria-label="Play voice note">
          <svg viewBox="0 0 24 24" className="h-5 w-5 translate-x-[1px]" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
        <span className="flex flex-1 items-center gap-[3px]" aria-hidden="true">
          {[8, 15, 11, 18, 9, 13, 7, 16, 10].map((h, i) => (
            <span key={i} className="w-[2px] rounded-full bg-mint/55" style={{ height: `${h}px` }} />
          ))}
        </span>
        <span className="tabular-nums text-[12px] text-muted">{formatElapsed(voiceDuration)}</span>
        <button type="button" onClick={onDelete} className="text-muted/80" aria-label="Delete voice note">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m1 0v12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V7" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onStart}
      className="flex h-[74px] w-full items-center gap-3 rounded-[14px] border border-dashed border-line bg-soft px-3.5 text-left"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-mint text-white">
        <svg viewBox="0 0 28 28" className="h-5 w-5" aria-hidden="true">
          <path d="M14 4a4 4 0 0 0-4 4v6a4 4 0 0 0 8 0V8a4 4 0 0 0-4-4Z" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M6 13v1a8 8 0 0 0 16 0v-1M14 22v3M10 25h8" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        </svg>
      </span>
      <span>
        <span className="block text-[14px] font-medium text-ink">Record a voice note</span>
        <span className="block text-[12px] text-muted">Like you’re right there with them</span>
      </span>
    </button>
  );
}
