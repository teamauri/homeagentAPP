"use client";

import { useEffect, useRef, useState } from "react";
import { DayGroup, GrowthData, MilestoneSession, OrganizedMedia } from "@/lib/album/types";
import { useChildren, useFamilyMember } from "./FamilyContext";

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

export function MomentsView() {
  const children = useChildren();
  const [growth, setGrowth] = useState<GrowthData | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [organizing, setOrganizing] = useState<{ count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const res = await fetch("/api/memory/growth", { cache: "no-store" });
    const data = await res.json();
    if (data.growth) setGrowth(data.growth);
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

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

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[12px] text-muted">
          By day · kept by Iris{growth.skippedCount ? ` · ${growth.skippedCount} skipped` : ""}
        </span>
        <button
          onClick={() => inputRef.current?.click()}
          className="rounded-full border border-line bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink shadow-[0_2px_8px_rgba(8,8,8,0.04)]"
        >
          ＋ Organize photos
        </button>
        <input ref={inputRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      </div>

      {organizing ? <OrganizingPanel count={organizing.count} /> : null}

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

      <Feed days={days} />
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

function Feed({ days }: { days: DayGroup[] }) {
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
              <Tile key={m.id} media={m} href={day.memoryId ? `/memory/${day.memoryId}` : m.url} sameTab={Boolean(day.memoryId)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Tile({ media, href, sameTab }: { media: OrganizedMedia; href?: string; sameTab?: boolean }) {
  const inner = (
    <>
      {media.thumbDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.thumbDataUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className={"h-full w-full " + toneClass(media.tone)} />
      )}
      {media.kind === "video" ? (
        <>
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-white/85 pl-0.5 text-[11px] text-ink">▶</span>
          </span>
          {media.durationLabel ? (
            <span className="absolute bottom-1 right-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold text-white">
              {media.source === "auri" ? `${media.durationLabel} · Auri` : media.durationLabel}
            </span>
          ) : null}
        </>
      ) : null}
    </>
  );

  const className = "relative aspect-square overflow-hidden rounded-[11px]";
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
