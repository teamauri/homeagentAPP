"use client";

import { useEffect, useMemo, useState } from "react";
import { moments } from "@/lib/mock-data";
import { Card, IconBubble, RowChevron, StatusPill } from "./Primitives";

type ApiMedia = {
  id: string;
  title: string;
  source: string;
  mediaType: "photo" | "video" | "clip";
  url: string;
  thumbnailUrl?: string;
};

type ApiMemory = {
  id: string;
  title: string;
  body: string;
  sourceLabel: string;
  sourceType: string;
  timeLabel: string;
  person: string;
  status: string;
  statusLabel: string;
  mediaIds: string[];
  createdAt: string;
  metadata?: Record<string, unknown>;
};

type MemoryResponse = { items: ApiMemory[]; media: ApiMedia[] };

const FILTERS = [
  { label: "All", match: () => true },
  { label: "Auri", match: (item: ApiMemory) => item.sourceType === "auri" },
  { label: "Phone", match: (item: ApiMemory) => item.sourceType === "phone" },
  { label: "Reading", match: (item: ApiMemory) => item.sourceType === "reading" },
];

function sourceTone(source: string) {
  if (source === "Auri Robot") return "green" as const;
  if (source === "Reading") return "orange" as const;
  if (source.includes("Phone")) return "blue" as const;
  return "default" as const;
}

function imageToneClass(tone = "green") {
  const tones: Record<string, string> = {
    green: "from-[#a8d8ad] via-[#d9c89b] to-[#406f40]",
    orange: "from-[#f7d8ad] via-[#b97448] to-[#f3ead9]",
    purple: "from-[#d7cef4] via-[#9f8ed0] to-[#6d5a76]",
    pink: "from-[#f4d4c6] via-[#dca581] to-[#76644f]",
  };
  return tones[tone] ?? tones.green;
}

function isImageMedia(media?: ApiMedia) {
  return media ? media.mediaType === "photo" : false;
}

// Fixtures used until the live feed loads (or if it fails). The API also returns
// these seeded fixtures, so once loaded we render purely from the API response.
const fixtureItems: ApiMemory[] = moments.map((moment) => ({
  id: moment.id,
  title: moment.title,
  body: moment.body,
  sourceLabel: moment.sourceLabel,
  sourceType: moment.sourceType,
  timeLabel: moment.timeLabel,
  person: moment.person,
  status: moment.status,
  statusLabel: moment.statusLabel,
  mediaIds: [],
  createdAt: "",
  metadata: { fixture: true, icon: moment.icon, imageTone: moment.imageTone },
}));

function MediaThumb({ item, media }: { item: ApiMemory; media: ApiMedia[] }) {
  const primary = media.find((m) => m.mediaType === "video" || m.mediaType === "clip") ?? media[0];
  const isVideo = primary ? primary.mediaType !== "photo" : false;
  const thumbUrl = primary?.thumbnailUrl ?? (isImageMedia(primary) ? primary?.url : undefined);
  const tone = (item.metadata?.imageTone as string) || (item.sourceType === "reading" ? "orange" : "green");

  if (thumbUrl) {
    const href = primary?.url ?? thumbUrl;
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="relative block h-[82px] w-[96px] shrink-0 overflow-hidden rounded-[15px] bg-line"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumbUrl} alt={item.title} className="h-full w-full object-cover" />
        {isVideo ? (
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-black/45 text-[13px] text-white backdrop-blur">▶</span>
          </span>
        ) : null}
      </a>
    );
  }

  // No real media (fixtures / chat-derived memory): keep the doodle gradient tile.
  return (
    <div className={`relative h-[82px] w-[96px] shrink-0 overflow-hidden rounded-[15px] bg-gradient-to-br ${imageToneClass(tone)}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_34%,rgba(255,255,255,0.75)_0_9%,transparent_10%),radial-gradient(circle_at_62%_42%,rgba(255,255,255,0.65)_0_11%,transparent_12%),linear-gradient(135deg,transparent_0_54%,rgba(0,0,0,0.16)_55%)]" />
      {item.id === "sunday-story" ? (
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5 p-0.5">
          {[0, 1, 2, 3].map((tile) => (
            <span key={tile} className={`rounded-[6px] bg-gradient-to-br ${imageToneClass(["green", "orange", "purple", "pink"][tile])}`} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function MomentsView() {
  const [data, setData] = useState<MemoryResponse | null>(null);
  const [activeFilter, setActiveFilter] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/memory?limit=50", { cache: "no-store" });
        if (!response.ok) throw new Error(`memory feed ${response.status}`);
        const payload = (await response.json()) as MemoryResponse;
        if (!cancelled) setData(payload);
      } catch {
        if (!cancelled) setData({ items: fixtureItems, media: [] });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const items = data?.items ?? fixtureItems;
  const mediaById = useMemo(() => {
    const map = new Map<string, ApiMedia>();
    (data?.media ?? []).forEach((media) => map.set(media.id, media));
    return map;
  }, [data]);

  // Newest uploaded/ingested memory first, seeded fixtures after.
  const ordered = useMemo(() => {
    const live = items.filter((item) => item.metadata?.fixture !== true);
    const fixtures = items.filter((item) => item.metadata?.fixture === true);
    live.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return [...live, ...fixtures];
  }, [items]);

  const visible = ordered.filter((item) => FILTERS[activeFilter].match(item));

  return (
    <div className="space-y-7">
      <div className="grid grid-cols-4 rounded-[24px] border border-line p-1 text-[15px]">
        {FILTERS.map((filter, index) => (
          <button
            key={filter.label}
            onClick={() => setActiveFilter(index)}
            className={index === activeFilter ? "rounded-[20px] bg-white px-2 py-2.5 text-ink shadow-[0_8px_22px_rgba(0,0,0,0.12)]" : "rounded-[20px] px-2 py-2.5 text-muted"}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="relative pl-4 before:absolute before:left-[1px] before:top-3 before:h-[calc(100%-1rem)] before:w-px before:bg-line">
        {visible.length === 0 ? (
          <p className="py-8 text-center text-[15px] text-muted">No moments yet for this filter.</p>
        ) : null}
        {visible.map((item) => {
          const media = item.mediaIds.map((id) => mediaById.get(id)).filter((m): m is ApiMedia => Boolean(m));
          return (
            <div key={item.id} className="relative pb-7">
              <span className="absolute -left-[20px] top-1 h-3 w-3 rounded-full bg-line" />
              <div className="mb-4 flex items-center gap-4 text-[16px] text-muted">
                <span>{item.timeLabel}</span>
                <span className="h-px flex-1 bg-line" />
              </div>
              <Card className="flex min-h-[126px] items-center gap-3 px-4 py-4">
                <IconBubble icon={(item.metadata?.icon as string) || "spark"} small />
                <div className="min-w-0 flex-1 py-1">
                  <StatusPill tone={sourceTone(item.sourceLabel)}>{item.sourceLabel}</StatusPill>
                  <h3 className="mt-2 text-[18px] font-medium leading-tight">{item.title}</h3>
                  <p className="mt-1 line-clamp-2 text-[14px] leading-5 text-muted">{item.body}</p>
                  <div className="mt-2 flex items-center gap-2 text-[14px]">
                    <span className={item.status === "draft" ? "h-2 w-2 rounded-full bg-orange-400" : "h-2 w-2 rounded-full bg-green-500"} />
                    <span className="text-muted">{item.statusLabel}</span>
                  </div>
                </div>
                <MediaThumb item={item} media={media} />
              </Card>
            </div>
          );
        })}
      </div>

      <Card className="flex items-center gap-4 border-[#f1dfbd] px-4 py-4">
        <IconBubble icon="spark" small />
        <p className="flex-1 text-[17px] leading-6">Sophie&apos;s Sunday was full of giggles, cozy moments, and little surprises.</p>
        <RowChevron />
      </Card>
    </div>
  );
}
