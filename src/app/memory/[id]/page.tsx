"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type ApiMedia = {
  id: string;
  title?: string;
  mediaType: "photo" | "video" | "clip";
  url: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  source?: string;
};

type ApiMemory = {
  id: string;
  title: string;
  body: string;
  timeLabel: string;
  sourceLabel: string;
  person: string;
  mediaIds: string[];
  metadata?: Record<string, unknown>;
};

type Detail = { item: ApiMemory; media: ApiMedia[] };

function durationLabel(seconds?: number) {
  if (!seconds) return undefined;
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
}

export default function MemoryDetailPage() {
  const params = useParams();
  const id = String(params?.id ?? "");
  // undefined = loading, null = not found
  const [data, setData] = useState<Detail | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // Prefer the dedicated endpoint (DockKit/data-layer owns it); fall back to
      // the list feed so this page works before that endpoint exists.
      try {
        const r = await fetch(`/api/memory/${encodeURIComponent(id)}`, { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          // Data-layer owner returns { memory, media }; accept { item } too.
          const memory = j?.memory ?? j?.item;
          if (memory) {
            if (!cancelled) setData({ item: memory, media: j.media ?? [] });
            return;
          }
        }
      } catch {
        /* fall through */
      }
      try {
        const r = await fetch(`/api/memory?limit=200`, { cache: "no-store" });
        const j = await r.json();
        const item = (j.items ?? []).find((it: ApiMemory) => it.id === id);
        if (!item) {
          if (!cancelled) setData(null);
          return;
        }
        const byId = new Map<string, ApiMedia>((j.media ?? []).map((m: ApiMedia) => [m.id, m]));
        const media = item.mediaIds.map((mid: string) => byId.get(mid)).filter((m: ApiMedia | undefined): m is ApiMedia => Boolean(m));
        if (!cancelled) setData({ item, media });
      } catch {
        if (!cancelled) setData(null);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <main className="min-h-[100dvh] bg-paper md:grid md:min-h-screen md:place-items-center md:bg-[#f5f1eb] md:px-10 md:py-8">
      <div className="mx-auto w-full overflow-hidden bg-paper md:max-w-[430px]">
        <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-paper md:h-[min(900px,calc(100dvh-4rem))] md:min-h-[760px]">
          <div className="relative px-[26px] pt-[max(18px,env(safe-area-inset-top))]">
            <a href="/" className="inline-flex items-center gap-1 pt-2 text-[13px] text-muted">
              ‹ Memory
            </a>
          </div>
          <div className="no-scrollbar flex-1 overflow-y-auto px-[26px] pb-8 pt-2">
            {data === undefined ? (
              <p className="pt-10 text-center text-[14px] text-muted">Loading…</p>
            ) : data === null ? (
              <p className="pt-10 text-center text-[14px] text-muted">This memory isn’t available.</p>
            ) : (
              <DetailBody detail={data} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function DetailBody({ detail }: { detail: Detail }) {
  const { item, media } = detail;
  const video = media.find((m) => m.mediaType !== "photo");
  const photos = media.filter((m) => m.mediaType === "photo");

  return (
    <div>
      <h1 className="mt-2 font-display text-[27px] leading-tight tracking-[-0.02em] text-ink">{item.title}</h1>
      <p className="mt-1.5 text-[13px] text-muted">
        {item.sourceLabel} · {item.timeLabel}
      </p>

      {video?.url ? (
        <div className="mt-4 overflow-hidden rounded-[18px] border border-line bg-black">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            className="aspect-[4/5] w-full bg-black object-cover"
            src={video.url}
            poster={video.thumbnailUrl}
            controls
            playsInline
            preload="metadata"
          />
        </div>
      ) : photos[0]?.url ? (
        <div className="mt-4 overflow-hidden rounded-[18px] border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[0].url} alt={item.title} className="aspect-[4/5] w-full object-cover" />
        </div>
      ) : null}

      {item.body ? <p className="mt-4 text-[15px] leading-relaxed text-ink">{item.body}</p> : null}

      {video?.durationSeconds ? (
        <p className="mt-2 text-[12px] text-muted">Story film · {durationLabel(video.durationSeconds)}</p>
      ) : null}

      {photos.length ? (
        <>
          <h2 className="mt-7 font-display text-[18px] tracking-[-0.02em] text-ink">Highlights</h2>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {photos.map((p) => (
              <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="relative aspect-square overflow-hidden rounded-[11px] bg-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumbnailUrl ?? p.url} alt="" className="h-full w-full object-cover" />
              </a>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
