import { ageAt } from "@/lib/family/profile";
import { getChildren, getMember } from "@/lib/family/store";
import { Observation } from "@/lib/family/profile";
import { callGeminiAlbum } from "./gemini-vision";
import { fallbackAlbumAnalysis } from "./fallback";
import { AlbumPhotoInput, DayGroup, FirstItem, GrowthData, MilestoneSession, OrganizedMedia } from "./types";

function dateLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Recently";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

const REASSURANCE = "Ideas from the last few weeks — never a score, never a comparison.";

export interface OrganizeResult {
  growth: GrowthData;
  observations: Observation[];
  provider: "gemini" | "fallback";
  model?: string;
  skippedCount: number;
}

export async function organizeAlbum(photos: AlbumPhotoInput[], childId: string): Promise<OrganizeResult> {
  const child = (getMember(childId) ?? getChildren()[0])!;

  let provider: "gemini" | "fallback" = "fallback";
  let model: string | undefined;
  let analysis;
  if (process.env.GEMINI_API_KEY) {
    try {
      const result = await callGeminiAlbum(photos, child.id);
      analysis = result.analysis;
      model = result.model;
      provider = "gemini";
    } catch (error) {
      console.error("[album] Gemini vision failed; using fallback", error);
    }
  }
  if (!analysis) analysis = fallbackAlbumAnalysis(photos, child.id);

  const captionByDate = new Map(analysis.dayCaptions.map((d) => [d.date, d.caption]));
  const kept = analysis.photos.filter((p) => p.keep && photos[p.index]);
  const skippedCount = analysis.photos.length - kept.length;

  // Build media grouped by capture day.
  const byDay = new Map<string, OrganizedMedia[]>();
  const firsts: FirstItem[] = [];
  const observations: Observation[] = [];

  kept.forEach((a) => {
    const photo = photos[a.index];
    const day = photo.capturedAtISO.slice(0, 10);
    const id = `org_${a.index}_${day}`;
    const media: OrganizedMedia = {
      id,
      kind: a.mediaKind,
      source: "phone",
      thumbDataUrl: `data:${photo.mimeType};base64,${photo.dataBase64}`,
      capturedAtISO: photo.capturedAtISO,
      isFirst: Boolean(a.isFirst && a.firstLabel),
      firstLabel: a.firstLabel ?? undefined,
    };
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(media);

    if (media.isFirst) {
      const age = ageAt(child.birthday, photo.capturedAtISO);
      firsts.push({
        id: `first_${id}`,
        label: media.firstLabel!,
        dateISO: photo.capturedAtISO,
        dateLabel: dateLabel(photo.capturedAtISO),
        ageLong: age?.long,
        mediaId: id,
        kind: media.kind,
        source: "phone",
        thumbDataUrl: media.thumbDataUrl,
      });
      observations.push({
        id: `obs_${id}`,
        memberId: child.id,
        source: "album_organize",
        note: media.firstLabel!,
        tags: ["first"],
        observedAt: photo.capturedAtISO,
      });
    }
  });

  const days: DayGroup[] = [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([day, media]) => {
      const age = ageAt(child.birthday, day);
      const firstHere = media.find((m) => m.isFirst);
      return {
        dateISO: day,
        dateLabel: dateLabel(day),
        ageShort: age?.short,
        caption: captionByDate.get(day) ?? "",
        isFirstDay: Boolean(firstHere),
        media,
      };
    });

  const todayAge = ageAt(child.birthday, new Date().toISOString());
  const session: MilestoneSession = {
    childId: child.id,
    childName: child.name,
    ageShort: todayAge?.short,
    nowSummary: analysis.session.nowSummary,
    suggestions: analysis.session.suggestions,
    reassurance: REASSURANCE,
  };

  return {
    growth: { child: { id: child.id, name: child.name }, session, days, firsts, skippedCount },
    observations,
    provider,
    model,
    skippedCount,
  };
}
