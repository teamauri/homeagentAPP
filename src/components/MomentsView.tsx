"use client";

import { useEffect, useRef, useState } from "react";
import { DayGroup, GrowthData, MilestoneSession, OrganizedMedia } from "@/lib/album/types";
import { useChildren, useFamilyMember } from "./FamilyContext";
import { RobotEvent, useRobotEvents } from "./RobotEventContext";

// Fixed gradient classes for seed/placeholder tones (kept literal so Tailwind
// includes them). Real photos (phone organize) and ingested robot Stories
// (DockKit) render their actual thumbnail instead.
const TONE: Record<string, string> = {
  g1: "bg-gradient-to-br from-[#a8d8ad] via-[#d9c89b] to-[#5e8f54]",
  g2: "bg-gradient-to-br from-[#f7d8ad] via-[#c0794a] to-[#f0e6d4]",
  g3: "bg-gradient-to-br from-[#d7cef4] via-[#9f8ed0] to-[#6d5a76]",
  g4: "bg-gradient-to-br from-[#f4d4c6] via-[#dca581] to-[#76644f]",
  g5: "bg-gradient-to-br from-[#bfe0c4] via-[#8bb98f] to-[#4d7a54]",
  g6: "bg-gradient-to-br from-[#cfe7f0] via-[#7fa9bd] to-[#3c5f6f]",
};
const toneClass = (tone?: string) => (tone && TONE[tone]) || TONE.g1;

// A Memory tab is "All", a source ("auri"/"phone"), or a specific child id.
type Tab = { key: string; label: string };

// Auri Cut — auto-edit one phone video into a ≤30s short via POST /api/edit.
type AuriPhase = "idle" | "intro" | "editing" | "done";
const AURI_STEPS = ["Uploaded", "Analyzed", "Picking highlights", "Rendering"];
function secLabel(s?: number) {
  const n = Math.max(0, Math.round(s || 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
}

// Decode a photo to {width,height,draw}. Tries the fast createImageBitmap path,
// then falls back to an <img> element — crucial on iPhone Safari, where photos
// are usually HEIC and createImageBitmap throws, but <img> renders HEIC natively.
async function decodeImage(file: File): Promise<{ width: number; height: number; draw: (c: CanvasRenderingContext2D, w: number, h: number) => void }> {
  try {
    const bitmap = await createImageBitmap(file);
    return { width: bitmap.width, height: bitmap.height, draw: (c, w, h) => c.drawImage(bitmap, 0, 0, w, h) };
  } catch {
    // Fallback: load via object URL into an <img> (Safari decodes HEIC here).
    return await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight,
          draw: (c, w, h) => c.drawImage(img, 0, 0, w, h),
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`Could not decode ${file.name || "image"}`));
      };
      img.src = url;
    });
  }
}

async function fileToPayload(file: File) {
  const { width, height, draw } = await decodeImage(file);
  const max = 768;
  const scale = Math.min(1, max / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  draw(ctx, w, h);
  // Always re-encode to JPEG so HEIC/PNG all arrive as a compact base64 the
  // server (and Gemini) can read, and stay well under Vercel's body limit.
  const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
  return {
    name: file.name,
    mimeType: "image/jpeg",
    dataBase64: dataUrl.split(",")[1] ?? "",
    capturedAtISO: new Date(file.lastModified || Date.now()).toISOString(),
  };
}

// The Auri Cut render runs on auri-editor, but the orchestration + progress live
// in this browser tab. Persist the ids once the render is queued so a page refresh
// can resume polling instead of losing the whole job.
const JOB_KEY = "auri.job.v1";

export function MomentsView() {
  const children = useChildren();
  const { completions } = useRobotEvents();
  // Clips the robot captured this session (events + highlights) — playable here.
  const robotClips = completions.filter((event) => event.result);
  const [growth, setGrowth] = useState<GrowthData | null>(() => {
    try {
      const raw = sessionStorage.getItem("auri.growth.v1");
      return raw ? (JSON.parse(raw) as GrowthData) : null;
    } catch {
      return null;
    }
  });
  const [filter, setFilter] = useState<string>("all");
  const [organizing, setOrganizing] = useState<{ count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const auriInputRef = useRef<HTMLInputElement>(null);
  const [auriPhase, setAuriPhase] = useState<AuriPhase>("idle");
  const [editStep, setEditStep] = useState(0);
  const [auriResult, setAuriResult] = useState<{ memoryId?: string; durationSeconds?: number; mediaUrl?: string } | null>(null);
  // A video to play in an inline enlarged player on THIS page (no navigation).
  const [lightbox, setLightbox] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/memory/growth", { cache: "no-store" });
    const data = await res.json();
    if (data.growth) {
      setGrowth(data.growth);
      try { sessionStorage.setItem("auri.growth.v1", JSON.stringify(data.growth)); } catch { /* ignore */ }
    }
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  // Resume an Auri Cut render that was in flight when the tab was refreshed. The
  // render keeps going on auri-editor; we just need to re-attach and poll it.
  useEffect(() => {
    let saved: { videoId?: string; vlogId?: string } | null = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(JOB_KEY) || "null");
    } catch {
      saved = null;
    }
    if (saved?.videoId && saved?.vlogId) {
      setAuriPhase("editing");
      setEditStep(3);
      resumeAuriCut(saved.videoId, saved.vlogId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn before navigating away while an edit is running — leaving drops the
  // browser-side orchestration (the resume above only covers a render in flight).
  useEffect(() => {
    if (auriPhase !== "editing") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [auriPhase]);

  // Auri Cut: preprocess the video in the browser (ffmpeg.wasm) + drive the Auri
  // backend directly, then land the rendered short as a Memory. No server job.
  async function onAuriVideo(files: FileList | null) {
    const file = files?.[0];
    if (auriInputRef.current) auriInputRef.current.value = "";
    if (!file) return;
    setError(null);
    setStatus(null);
    setAuriResult(null);
    setEditStep(0);
    setAuriPhase("editing");
    try {
      const { editToShortInBrowser } = await import("@/lib/auri/browser/pipeline");
      const result = await editToShortInBrowser(
        file,
        ({ stage, progress }) => {
          setEditStep(stage === "uploading" ? (progress > 0.2 ? 1 : 0) : stage === "analyzing" ? 2 : 3);
        },
        // Render queued — persist the ids so a refresh can resume polling.
        (cp) => {
          try {
            sessionStorage.setItem(JOB_KEY, JSON.stringify(cp));
          } catch {
            /* private mode / quota — resume just won't be available */
          }
        },
      );
      await finishAndShow(result.videoId, result.vlogId, result.durationSeconds);
    } catch (e) {
      setAuriPhase("idle");
      try {
        sessionStorage.removeItem(JOB_KEY);
      } catch {
        /* ignore */
      }
      // A stale deploy (the app updated while this tab stayed open) makes a
      // code-split chunk 404. Recover by reloading to the fresh build.
      const msg = e instanceof Error ? e.message : String(e);
      if ((e as { name?: string })?.name === "ChunkLoadError" || /Loading chunk \S+ failed|ChunkLoadError/.test(msg)) {
        setError("The app just updated — refreshing…");
        setTimeout(() => window.location.reload(), 700);
        return;
      }
      setError(msg || "Editing failed — please try again.");
    }
  }

  // Hand the rendered vlog's ids to the server (it downloads the mp4 from
  // auri-editor, stores it, creates the Memory), then surface the film. Shared by
  // a fresh edit and by a refresh-resumed one.
  async function finishAndShow(videoId: string, vlogId: string, durationSeconds?: number) {
    const res = await fetch("/api/edit/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId, vlogId, durationSeconds, person: growth?.child.id ?? "family" }),
    });
    if (!res.ok) throw new Error(`Couldn't save the film (${res.status})`);
    const data = await res.json();
    try {
      sessionStorage.removeItem(JOB_KEY);
    } catch {
      /* ignore */
    }
    setAuriResult({ memoryId: data.memoryId, durationSeconds: data.durationSeconds, mediaUrl: data.mediaUrl });
    setAuriPhase("done");
    await refresh().catch(() => {});
    // Show the new film in the timeline immediately — even if the server store
    // hasn't propagated across serverless instances yet (it'll be there on the
    // next load). Skip if a refresh already surfaced it.
    if (data.mediaUrl) {
      setGrowth((prev) => {
        if (!prev) return prev;
        const present = prev.days.some(
          (d) => (data.memoryId && d.memoryId === data.memoryId) || d.media.some((m) => m.url === data.mediaUrl),
        );
        if (present) return prev;
        const now = new Date();
        const newDay: DayGroup = {
          dateISO: now.toISOString(),
          dateLabel: `Today · ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
          caption: "A short film from your video, made by Auri Cut.",
          isFirstDay: false,
          memoryId: data.memoryId,
          media: [
            {
              id: data.memoryId ?? `auri-${now.getTime()}`,
              kind: "video",
              source: "auri",
              url: data.mediaUrl,
              durationLabel: data.durationSeconds ? secLabel(data.durationSeconds) : undefined,
              capturedAtISO: now.toISOString(),
              isFirst: false,
            },
          ],
        };
        return { ...prev, days: [newDay, ...prev.days] };
      });
    }
  }

  // After a page refresh mid-render, pick the job back up: the render is still
  // running on auri-editor, so just re-poll by its ids and ingest when ready.
  async function resumeAuriCut(videoId: string, vlogId: string) {
    try {
      const { AuriClient } = await import("@/lib/auri/client");
      const done = await new AuriClient().pollUntilVlogFinished(videoId, vlogId);
      await finishAndShow(videoId, vlogId, done.storyBudgetSeconds);
    } catch {
      setAuriPhase("idle");
      try {
        sessionStorage.removeItem(JOB_KEY);
      } catch {
        /* ignore */
      }
      setError("Your film was interrupted — please start Auri Cut again.");
    }
  }

  async function deleteAuriFilm(memoryId?: string) {
    setAuriPhase("idle");
    if (!memoryId) return;
    try { await fetch(`/api/memory/${memoryId}`, { method: "DELETE" }); } catch { /* best effort */ }
    refresh().catch(() => {});
  }

  async function onFiles(files: FileList | null) {
    if (!files || !files.length) return;
    const all = [...files];
    // iPhone Safari sometimes reports an empty MIME type; fall back to the
    // file extension so HEIC/MOV/etc. still get routed correctly.
    const isVideo = (f: File) => f.type.startsWith("video/") || /\.(mov|mp4|m4v|avi|webm)$/i.test(f.name);
    const isImage = (f: File) => f.type.startsWith("image/") || /\.(heic|heif|jpe?g|png|gif|webp)$/i.test(f.name);
    const videos = all.filter(isVideo);
    const images = all.filter((f) => !isVideo(f) && isImage(f));
    if (!images.length && !videos.length) {
      setError("Those files aren't photos or videos.");
      return;
    }
    const childId = growth?.child.id ?? "mia";
    setError(null);
    setStatus(null);
    setOrganizing({ count: images.length + videos.length });
    // Trust the growth returned by the organize POST itself — it's computed on
    // the same instance that just did the work. A separate GET can land on a
    // different (stale) serverless instance and show "nothing".
    let nextGrowth: GrowthData | null = null;
    const notes: string[] = [];
    try {
      // Photos → Gemini vision organize. Videos → stored (real URL) and shown.
      if (images.length) {
        // Decode each photo independently so one undecodable file doesn't sink
        // the whole batch. A decode that yields empty base64 (e.g. iOS canvas
        // export failing on HEIC) counts as failed, not a silent empty send.
        type Payload = Awaited<ReturnType<typeof fileToPayload>>;
        const encoded = await Promise.all(
          images.map((f) =>
            fileToPayload(f).then(
              (p): { p: Payload } | null => (p.dataBase64 ? { p } : null),
              () => null
            )
          )
        );
        const photos = encoded.filter((e): e is { p: Payload } => e !== null).map((e) => e.p);
        const failed = encoded.length - photos.length;
        if (failed) notes.push(`${failed} couldn't be read on this device`);
        if (photos.length) {
          const res = await fetch("/api/album/organize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ childId, photos }),
          });
          if (!res.ok) {
            const detail = await res.text().catch(() => "");
            throw new Error(
              res.status === 413
                ? "Those photos are too large — try fewer at once."
                : `Organize failed (${res.status})${detail ? `: ${detail.slice(0, 140)}` : ""}`
            );
          }
          const data = await res.json();
          if (data.growth) nextGrowth = data.growth as GrowthData;
          const organized = data?.metadata?.organized ?? 0;
          const skipped = data?.metadata?.skipped ?? 0;
          const provider = data?.metadata?.provider ?? "?";
          if (organized > 0) notes.push(`organized ${organized} (${provider})`);
          // Gemini may triage a shot out (screenshot / not a clear moment).
          if (organized === 0 && skipped > 0) notes.push(`${skipped} kept out as not-a-clear-moment`);
        }
        if (failed && !photos.length) throw new Error("Couldn't read those photos on this device (try a screenshot or a different photo).");
      }
      if (videos.length) {
        const form = new FormData();
        videos.forEach((v) => form.append("files", v));
        form.append("person", childId);
        const res = await fetch("/api/media/upload", { method: "POST", body: form });
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          throw new Error(`Video upload failed (${res.status})${detail ? `: ${detail.slice(0, 140)}` : ""}`);
        }
        notes.push(`${videos.length} video${videos.length > 1 ? "s" : ""} uploaded`);
        // The upload route doesn't return growth, so re-fetch to pull the video in.
        nextGrowth = null;
      }
      if (nextGrowth) setGrowth(nextGrowth);
      else await refresh();
      // Always report the outcome so a no-visible-change is never a silent mystery.
      setStatus(notes.length ? `Done · ${notes.join(" · ")}` : "Done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed — please try again.");
    } finally {
      setOrganizing(null);
      if (inputRef.current) inputRef.current.value = ""; // allow re-selecting the same file
    }
  }

  if (!growth) {
    return <div className="pt-10 text-center text-[14px] text-muted">Loading memories…</div>;
  }

  // All · one tab per child (oldest first).
  const tabs: Tab[] = [
    { key: "all", label: "All" },
    ...children.map((c) => ({ key: `child:${c.id}`, label: c.name })),
  ];
  const days = filterDays(growth.days, filter);
  // The milestone card belongs to a child, so show it only inside that child's
  // tab — not on "All".
  const activeChildId = filter.startsWith("child:") ? filter.slice("child:".length) : undefined;
  const activeSession = activeChildId ? growth.sessions?.[activeChildId] : undefined;

  return (
    <div className="pb-4">
      <div className="no-scrollbar mt-1 flex gap-2 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={
              "shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] " +
              (filter === t.key ? "border-ink bg-ink font-semibold text-white" : "border-line text-muted")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeSession ? <SessionCard session={activeSession} /> : null}

      <div className="sticky -top-2 z-10 flex items-center justify-between bg-paper pb-1.5 pt-3">
        <span className="text-[12px] text-muted">
          By day · kept by Iris{growth.skippedCount ? ` · ${growth.skippedCount} skipped` : ""}
        </span>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => setAuriPhase("intro")}
            className="rounded-full bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-white shadow-[0_2px_8px_rgba(8,8,8,0.06)]"
          >
            ✨ Auri Cut
          </button>
          <button
            onClick={() => inputRef.current?.click()}
            className="rounded-full border border-line bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink shadow-[0_2px_8px_rgba(8,8,8,0.04)]"
          >
            ＋ Organize
          </button>
        </div>
        <input ref={inputRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
        <input ref={auriInputRef} type="file" accept="video/*" hidden onChange={(e) => onAuriVideo(e.target.files)} />
      </div>

      {organizing ? <OrganizingPanel count={organizing.count} /> : null}

      {auriPhase === "intro" ? (
        <AuriCutIntro onPick={() => auriInputRef.current?.click()} onDismiss={() => setAuriPhase("idle")} />
      ) : null}
      {auriPhase === "editing" ? <AuriCutEditing step={editStep} /> : null}
      {auriPhase === "done" ? <AuriCutResult result={auriResult} onDismiss={() => setAuriPhase("idle")} onPlay={setLightbox} onDelete={() => deleteAuriFilm(auriResult?.memoryId)} /> : null}

      {error ? (
        <div className="mt-3 flex items-start gap-2 rounded-[12px] border border-[#f0d4cc] bg-[#fdf3f0] px-3 py-2.5 text-[12.5px] text-[#9a4a36]">
          <span>⚠️</span>
          <span className="flex-1 break-words">{error}</span>
          <button onClick={() => setError(null)} className="text-[#c08070]">
            ✕
          </button>
        </div>
      ) : null}

      {status ? (
        <div className="mt-3 flex items-start gap-2 rounded-[12px] border border-[#cfe7d4] bg-[#f1faf3] px-3 py-2.5 text-[12.5px] text-[#3d6b48]">
          <span>✅</span>
          <span className="flex-1 break-words">{status}</span>
          <button onClick={() => setStatus(null)} className="text-[#7aa886]">
            ✕
          </button>
        </div>
      ) : null}

      {robotClips.length ? <RobotKeepsakes events={robotClips} /> : null}

      <Feed days={days} onPlay={setLightbox} />

      {lightbox ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3" onClick={() => setLightbox(null)}>
          <button
            onClick={() => setLightbox(null)}
            aria-label="Close"
            className="absolute right-3 top-[max(14px,env(safe-area-inset-top))] grid h-9 w-9 place-items-center rounded-full bg-white/15 text-[18px] text-white"
          >
            ✕
          </button>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video src={lightbox} controls autoPlay playsInline className="max-h-[85vh] w-full rounded-[14px] bg-black" onClick={(e) => e.stopPropagation()} />
        </div>
      ) : null}
    </div>
  );
}

// Clips Auri Robot captured this session, surfaced in Memory and playable inline.
function RobotKeepsakes({ events }: { events: RobotEvent[] }) {
  return (
    <section className="mt-4">
      <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-muted">
        <span aria-hidden="true">🤖</span>
        <span>From Auri Robot</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {events.map((event) => (
          <RobotClipTile key={event.id} event={event} />
        ))}
      </div>
    </section>
  );
}

function RobotClipTile({ event }: { event: RobotEvent }) {
  const result = event.result!;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  return (
    <div className="overflow-hidden rounded-[12px] border border-line bg-white shadow-[0_2px_8px_rgba(8,8,8,0.04)]">
      <div className="relative aspect-video bg-[#17181b]">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          src={result.videoUrl}
          poster={result.poster}
          playsInline
          controls={playing}
          onEnded={() => setPlaying(false)}
          onPause={() => setPlaying(false)}
          className="h-full w-full object-cover"
        />
        {!playing ? (
          <button
            type="button"
            onClick={() => {
              videoRef.current?.play();
              setPlaying(true);
            }}
            className="absolute inset-0 grid place-items-center"
            aria-label="Play clip"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white/90 pl-0.5 text-[12px] text-ink">▶</span>
            <span className="absolute bottom-1.5 right-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">{result.duration}</span>
          </button>
        ) : null}
      </div>
      <div className="px-2.5 py-1.5">
        <div className="truncate text-[12.5px] font-semibold text-ink">{event.title}</div>
        {event.completedAtLabel ? <div className="text-[11px] text-muted">{event.completedAtLabel}</div> : null}
      </div>
    </div>
  );
}

function SessionCard({ session }: { session: MilestoneSession }) {
  const child = useFamilyMember(session.childId);
  return (
    <section className="mt-3 rounded-[18px] border border-[#ecdebf] bg-gradient-to-br from-[#fbf3e3] to-white p-4">
      <div className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#b9772a]">
        {child?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={child.avatarUrl} alt={session.childName} className="h-7 w-7 rounded-full border border-[#ecdebf] object-cover" />
        ) : (
          <span>✦</span>
        )}
        <span>
          Where {session.childName} is now{session.ageShort ? ` · ${session.ageShort}` : ""}
        </span>
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-[#3b3b3b]">{session.nowSummary}</p>
      <p className="mt-3 text-[11px] font-bold text-muted">Little things that might help next</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {session.suggestions.map((s, i) => (
          <span key={i} className="rounded-full border border-line bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-ink">
            {s.icon} {s.text}
          </span>
        ))}
      </div>
      <p className="mt-3 text-[10.5px] text-[#b3ada3]">{session.reassurance}</p>
    </section>
  );
}

function OrganizingPanel({ count }: { count: number }) {
  return (
    <div className="mt-4 rounded-[16px] border border-line bg-white p-4 text-center shadow-[0_2px_10px_rgba(8,8,8,0.04)]">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#ffe6dd] text-[22px]">📷</div>
      <p className="mt-2 font-display text-[18px] text-ink">Iris is organizing {count} photos…</p>
      <p className="mt-1 text-[12px] text-muted">Keeping the real moments · placing them by age · writing the story</p>
      <div className="mx-auto mt-3 h-1.5 w-40 overflow-hidden rounded-full bg-[#eee]">
        <div className="h-full w-2/3 animate-pulse rounded-full bg-ink" />
      </div>
    </div>
  );
}

function AuriCutIntro({ onPick, onDismiss }: { onPick: () => void; onDismiss: () => void }) {
  return (
    <div className="mt-3 rounded-[16px] border border-[#eccfa0] bg-[#fbf3e3] p-3.5">
      <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#b9772a]">
        <span>✨</span>
        <span>Make a short film</span>
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-[#3b3b3b]">
        Pick one video — Auri keeps the best moments and cuts it into a short film under 30 seconds.
      </p>
      <div className="mt-3 flex gap-2">
        <button onClick={onPick} className="flex-1 rounded-full bg-ink py-2 text-[12.5px] font-semibold text-white">
          Choose a video
        </button>
        <button onClick={onDismiss} className="rounded-full border border-line px-4 py-2 text-[12.5px] text-muted">
          Cancel
        </button>
      </div>
    </div>
  );
}

function AuriCutEditing({ step }: { step: number }) {
  return (
    <div className="mt-4 rounded-[16px] border border-line bg-white p-4 text-center shadow-[0_2px_10px_rgba(8,8,8,0.04)]">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#ffe6dd] text-[22px]">🎬</div>
      <p className="mt-2 font-display text-[18px] text-ink">Auri is cutting your film…</p>
      <p className="mt-1 text-[12px] text-muted">
        {step === 0 ? "Loading the editor (first run downloads ~30MB) — hang tight" : "Keeping the best moments · trimming to a 30s short"}
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
        {AURI_STEPS.map((label, i) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={"text-[11.5px] " + (i < step ? "text-[#3b7a4d]" : i === step ? "font-semibold text-[#b9772a]" : "text-[#b3ada3]")}>
              {i < step ? "✓ " : ""}
              {label}
            </span>
            {i < AURI_STEPS.length - 1 ? <span className="text-[11px] text-[#cfc8ba]">›</span> : null}
          </span>
        ))}
      </div>
      <div className="mx-auto mt-3 h-1.5 w-44 overflow-hidden rounded-full bg-[#eee]">
        <div className="h-full rounded-full bg-ink transition-all duration-500" style={{ width: `${Math.min(100, ((step + 1) / AURI_STEPS.length) * 100)}%` }} />
      </div>
      <p className="mt-3 text-[10.5px] text-[#b3ada3]">You can leave — we’ll keep working and notify you</p>
    </div>
  );
}

function AuriCutResult({ result, onDismiss, onPlay, onDelete }: { result: { memoryId?: string; durationSeconds?: number; mediaUrl?: string } | null; onDismiss: () => void; onPlay: (url: string) => void; onDelete: () => void }) {
  const meta = [result?.durationSeconds ? secLabel(result.durationSeconds) : null, "made by Auri Cut"].filter(Boolean).join(" · ");
  const [saving, setSaving] = useState(false);

  // Save the film to the phone's Photos via the native share sheet ("Save Video"),
  // falling back to opening the file so the user can save it manually.
  async function saveToPhotos() {
    if (!result?.mediaUrl) return;
    setSaving(true);
    try {
      const blob = await (await fetch(result.mediaUrl)).blob();
      const file = new File([blob], "auri-cut.mp4", { type: "video/mp4" });
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: "Auri Cut film" });
      } else {
        window.open(result.mediaUrl, "_blank");
      }
      onDismiss();
    } catch {
      /* user cancelled the share sheet — leave the card up */
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-[16px] border border-[#eccfa0] bg-[#fbf3e3] p-3">
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.04em] text-[#b9772a]">
        <span>✨</span> Your film is ready
      </div>
      {result?.mediaUrl ? (
        <button type="button" onClick={() => onPlay(result.mediaUrl as string)} className="relative mt-2 block w-full overflow-hidden rounded-[12px] bg-black" aria-label="Play film">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video src={`${result.mediaUrl}#t=0.1`} muted playsInline preload="metadata" className="aspect-video w-full bg-black object-cover" />
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-white/85 pl-0.5 text-[18px] text-ink">▶</span>
          </span>
        </button>
      ) : null}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-[15px] text-ink">Auri Cut film</p>
          <p className="text-[11.5px] text-muted">{meta}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button onClick={onDelete} className="rounded-full border border-line bg-white px-3.5 py-2 text-[12.5px] font-semibold text-[#9a4a36]">
            Delete
          </button>
          {result?.mediaUrl ? (
            <button onClick={saveToPhotos} disabled={saving} className="rounded-full bg-ink px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50">
              {saving ? "Saving…" : "Save to Photos"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Feed({ days, onPlay }: { days: DayGroup[]; onPlay: (url: string) => void }) {
  if (!days.length) return <p className="mt-8 text-center text-[13px] text-muted">No moments here yet.</p>;
  return (
    <div className="mt-4">
      {days.map((day) => (
        <section key={day.dateISO + day.dateLabel} className="mb-6">
          <h3 className="font-display text-[16px] tracking-[-0.02em] text-ink">
            {day.dateLabel}
            {day.ageShort ? <span className="ml-1.5 text-[11px] font-semibold text-[#b3ada3]">· {day.ageShort}</span> : null}
          </h3>
          {day.caption ? (
            <p className="mb-2.5 mt-1 text-[12.5px] leading-snug text-[#3b3b3b]">
              {day.isFirstDay ? (
                <span className="mr-1.5 inline-flex items-center gap-1 rounded-full bg-[#fbeede] px-2 py-0.5 align-middle text-[10px] font-bold text-[#b9772a]">
                  ★ First
                </span>
              ) : null}
              {day.caption}
            </p>
          ) : null}
          <div className="grid grid-cols-3 gap-1.5">
            {day.media.map((m) => (
              <Tile key={m.id} media={m} href={day.memoryId ? `/memory/${day.memoryId}` : m.url} sameTab={Boolean(day.memoryId)} onPlay={onPlay} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Tile({ media, href, sameTab, onPlay }: { media: OrganizedMedia; href?: string; sameTab?: boolean; onPlay: (url: string) => void }) {
  const inner = (
    <>
      {media.thumbDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.thumbDataUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className={"h-full w-full " + toneClass(media.tone)} />
      )}
      {/* Robot-captured media is tagged so it's clear it came from Auri. */}
      {media.source === "auri" ? (
        <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold text-white">
          🤖 Auri
        </span>
      ) : null}
      {media.kind === "video" ? (
        <>
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-white/85 pl-0.5 text-[11px] text-ink">▶</span>
          </span>
          {media.durationLabel ? (
            <span className="absolute bottom-1 right-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold text-white">
              {media.durationLabel}
            </span>
          ) : null}
        </>
      ) : null}
    </>
  );

  const className = "relative aspect-square overflow-hidden rounded-[11px]";
  // Videos play inline in an enlarged player on this page — no navigation.
  if (media.kind === "video" && media.url) {
    return (
      <button type="button" onClick={() => onPlay(media.url as string)} className={className}>
        {inner}
      </button>
    );
  }
  // A real Story links to its detail page; a bare media URL opens in a new tab.
  if (href) {
    return (
      <a href={href} target={sameTab ? undefined : "_blank"} rel={sameTab ? undefined : "noreferrer"} className={className}>
        {inner}
      </a>
    );
  }
  return <div className={className}>{inner}</div>;
}

function filterDays(days: DayGroup[], filter: string): DayGroup[] {
  if (!filter.startsWith("child:")) return days; // "all"
  const childId = filter.slice("child:".length);
  return days
    .map((day) => ({ ...day, media: day.media.filter((m) => m.childId === childId) }))
    .filter((day) => day.media.length > 0);
}
