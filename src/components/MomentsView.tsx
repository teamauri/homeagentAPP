"use client";

import { useEffect, useRef, useState } from "react";
import { DayGroup, FirstItem, GrowthData, MilestoneSession, OrganizedMedia } from "@/lib/album/types";

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

type Filter = "All" | "Firsts" | "Auri" | "Phone";
const FILTERS: Filter[] = ["All", "Firsts", "Auri", "Phone"];

async function fileToPayload(file: File) {
  const bitmap = await createImageBitmap(file);
  const max = 768;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, w, h);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
  return {
    name: file.name,
    mimeType: "image/jpeg",
    dataBase64: dataUrl.split(",")[1] ?? "",
    capturedAtISO: new Date(file.lastModified || Date.now()).toISOString(),
  };
}

export function MomentsView() {
  const [growth, setGrowth] = useState<GrowthData | null>(null);
  const [filter, setFilter] = useState<Filter>("All");
  const [organizing, setOrganizing] = useState<{ count: number } | null>(null);
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
    const images = [...files].filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    setOrganizing({ count: images.length });
    try {
      const photos = await Promise.all(images.map(fileToPayload));
      const res = await fetch("/api/album/organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId: growth?.child.id ?? "mia", photos }),
      });
      const data = await res.json();
      if (data.growth) setGrowth(data.growth);
    } catch {
      /* keep current view on failure */
    } finally {
      setOrganizing(null);
    }
  }

  if (!growth) {
    return <div className="pt-10 text-center text-[14px] text-muted">Loading memories…</div>;
  }

  const days = filterDays(growth.days, filter);

  return (
    <div className="pb-4">
      <SessionCard session={growth.session} />

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={
              "shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] " +
              (filter === f
                ? f === "Firsts"
                  ? "border-[#b9772a] bg-[#b9772a] font-semibold text-white"
                  : "border-ink bg-ink font-semibold text-white"
                : f === "Firsts"
                  ? "border-[#eccfa0] text-[#b9772a]"
                  : "border-line text-muted")
            }
          >
            {f === "Firsts" ? "★ Firsts" : f}
          </button>
        ))}
      </div>

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
        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      </div>

      {organizing ? <OrganizingPanel count={organizing.count} /> : null}

      {filter === "Firsts" ? <FirstsWall firsts={growth.firsts} /> : <Feed days={days} />}
    </div>
  );
}

function SessionCard({ session }: { session: MilestoneSession }) {
  return (
    <section className="mt-1 rounded-[18px] border border-[#ecdebf] bg-gradient-to-br from-[#fbf3e3] to-white p-4">
      <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#b9772a]">
        <span>✦</span>
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

function FirstsWall({ firsts }: { firsts: FirstItem[] }) {
  return (
    <div className="mt-4">
      <p className="mb-3 text-[12.5px] text-muted">{firsts.length} milestones, kept forever</p>
      {firsts.map((first) => (
        <article key={first.id} className="mb-3 overflow-hidden rounded-[16px] border border-line">
          <div className="relative h-[150px]">
            {first.thumbDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={first.thumbDataUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className={"h-full w-full " + toneClass(first.tone)} />
            )}
            {first.kind === "video" ? (
              <span className="absolute inset-0 grid place-items-center">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-white/85 pl-0.5 text-ink">▶</span>
              </span>
            ) : null}
          </div>
          <div className="p-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#fbeede] px-2 py-0.5 text-[10px] font-bold text-[#b9772a]">★ First</span>
            <h4 className="mt-1.5 text-[15px] font-semibold text-ink">{first.label}</h4>
            <p className="mt-0.5 text-[11.5px] text-muted">
              {first.dateLabel}
              {first.ageLong ? ` · ${first.ageLong}` : ""}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}

function filterDays(days: DayGroup[], filter: Filter): DayGroup[] {
  if (filter === "All" || filter === "Firsts") return days;
  const source = filter === "Auri" ? "auri" : "phone";
  return days
    .map((day) => ({ ...day, media: day.media.filter((m) => m.source === source) }))
    .filter((day) => day.media.length > 0);
}
