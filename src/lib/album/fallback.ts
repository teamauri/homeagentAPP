import { getMember } from "@/lib/family/store";
import { AlbumAnalysis, AlbumPhotoInput, DropReason } from "./types";

// Deterministic stand-in for the Gemini vision pass, used when GEMINI_API_KEY
// is missing. It keeps the exact same shape as the real analysis so the rest
// of the pipeline (and the UI) is identical — only the "intelligence" is faked.

// Only obvious non-photos by filename. Deliberately conservative: a manually
// chosen upload should be kept, so we don't guess from "img_e"/"capture"/"scan"
// (those are normal iPhone edited/burst photos) or from PNG alone.
const SCREENSHOT_HINTS = ["screenshot", "screen shot", "screen_shot", "scrnli", "receipt"];
const DAY_CAPTIONS = [
  "A slow, happy afternoon together.",
  "Lots of giggles today.",
  "Out and about — fresh air and big smiles.",
  "A cozy day at home.",
  "Backyard play until the light went gold.",
];

function isLikelyScreenshot(name: string, _mime: string): DropReason | undefined {
  const lower = name.toLowerCase();
  if (SCREENSHOT_HINTS.some((h) => lower.includes(h))) return "screenshot";
  return undefined;
}

function hash(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

export function fallbackAlbumAnalysis(photos: AlbumPhotoInput[], childId: string): AlbumAnalysis {
  const child = getMember(childId);
  const interest = child?.interests[0] ?? "the world";

  const firstLabelPool = [
    `Said a new ${interest} word`,
    "Took a few steps on her own",
    "Stacked five blocks",
    "Drew her first circle",
    "Counted to ten",
  ];

  const photoAnalyses = photos.map((photo, index) => {
    const drop = isLikelyScreenshot(photo.name, photo.mimeType);
    const mediaKind: "photo" | "video" = photo.mimeType.startsWith("video/") ? "video" : "photo";
    return {
      index,
      keep: !drop,
      reason: drop,
      childId: drop ? null : childId,
      mediaKind,
      isFirst: false as boolean,
      firstLabel: undefined as string | undefined,
    };
  });

  // Mark one "first" on the earliest kept photo of each distinct day, for a few days.
  const keptByDay = new Map<string, number>();
  photoAnalyses.forEach((a, i) => {
    if (!a.keep) return;
    const day = photos[i].capturedAtISO.slice(0, 10);
    if (!keptByDay.has(day)) keptByDay.set(day, i);
  });
  let firstCount = 0;
  for (const [day, idx] of keptByDay) {
    if (firstCount >= 3) break;
    if (hash(day) % 2 === 0) {
      photoAnalyses[idx].isFirst = true;
      photoAnalyses[idx].firstLabel = firstLabelPool[hash(day) % firstLabelPool.length];
      firstCount += 1;
    }
  }

  const days = [...new Set(photos.map((p) => p.capturedAtISO.slice(0, 10)))];
  const dayCaptions = days.map((date) => {
    const first = photoAnalyses.find((a) => a.isFirst && photos[a.index].capturedAtISO.slice(0, 10) === date);
    return { date, caption: first?.firstLabel ? `${first.firstLabel} — a first today.` : DAY_CAPTIONS[hash(date) % DAY_CAPTIONS.length] };
  });

  return {
    photos: photoAnalyses,
    dayCaptions,
    session: {
      nowSummary: child
        ? `Lately ${child.name} is into ${child.interests.join(" and ")}, and getting more independent every week.`
        : "Growing and curious every week.",
      suggestions: [
        { icon: "📖", text: "Books with a few more words" },
        { icon: "🦕", text: `More ${interest}` },
        { icon: "🔢", text: "Count things together" },
      ],
    },
  };
}
