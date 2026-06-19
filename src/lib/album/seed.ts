import { ageAt } from "@/lib/family/profile";
import { getMember } from "@/lib/family/store";
import { DayGroup, FirstItem, GrowthData, MilestoneSession, OrganizedMedia } from "./types";

// A pre-organized growth album so Memory looks alive before the parent runs
// "Organize photos". Tones map to fixed gradient classes in the view.

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function media(id: string, tone: string, opts: Partial<OrganizedMedia> = {}): OrganizedMedia {
  return {
    id,
    kind: opts.kind ?? "photo",
    source: opts.source ?? "phone",
    tone,
    capturedAtISO: opts.capturedAtISO ?? "2026-06-14T10:00:00.000Z",
    isFirst: opts.isFirst ?? false,
    firstLabel: opts.firstLabel,
    durationLabel: opts.durationLabel,
  };
}

interface SeedDay {
  date: string;
  caption: string;
  firstLabel?: string;
  tones: { tone: string; kind?: "photo" | "video"; source?: "phone" | "auri"; durationLabel?: string }[];
}

const seedDays: SeedDay[] = [
  {
    date: "2026-06-14",
    caption: "First trip to the dino museum — she named a Triceratops 🦕",
    firstLabel: "Named her first dinosaur",
    tones: [
      { tone: "g2" },
      { tone: "g5" },
      { tone: "g1", kind: "video", durationLabel: "0:18" },
      { tone: "g4" },
      { tone: "g3" },
      { tone: "g6" },
    ],
  },
  {
    date: "2026-06-11",
    caption: "Goodnight Moon again — asked where the mouse went 🐭",
    tones: [
      { tone: "g3" },
      { tone: "g4" },
      { tone: "g6", kind: "video", source: "auri", durationLabel: "0:30" },
    ],
  },
  {
    date: "2026-06-08",
    caption: "Solved her first puzzle all by herself 🧩",
    firstLabel: "First puzzle solved on her own",
    tones: [{ tone: "g6" }, { tone: "g3" }, { tone: "g5" }, { tone: "g2" }, { tone: "g1", kind: "video", durationLabel: "0:12" }, { tone: "g4" }],
  },
  {
    date: "2026-06-06",
    caption: "Pancakes with Dad. Flour everywhere — worth it.",
    tones: [{ tone: "g4" }, { tone: "g2" }, { tone: "g5" }],
  },
  {
    date: "2026-06-03",
    caption: "A slow park afternoon — braver on the slide.",
    tones: [{ tone: "g1" }, { tone: "g5" }, { tone: "g3" }],
  },
];

export function seedGrowthData(): GrowthData {
  const mia = getMember("mia") ?? getMember("leo")!;
  const days: DayGroup[] = [];
  const firsts: FirstItem[] = [];

  seedDays.forEach((day, di) => {
    const capturedAtISO = `${day.date}T10:00:00.000Z`;
    const items = day.tones.map((t, i) =>
      media(`seed_${di}_${i}`, t.tone, {
        kind: t.kind,
        source: t.source,
        durationLabel: t.durationLabel,
        capturedAtISO,
        isFirst: i === 0 && Boolean(day.firstLabel),
        firstLabel: i === 0 ? day.firstLabel : undefined,
      })
    );
    const age = ageAt(mia.birthday, day.date);
    days.push({
      dateISO: day.date,
      dateLabel: dateLabel(capturedAtISO),
      ageShort: age?.short,
      caption: day.caption,
      isFirstDay: Boolean(day.firstLabel),
      media: items,
    });
    if (day.firstLabel) {
      const first = items[0];
      firsts.push({
        id: `first_${first.id}`,
        label: day.firstLabel,
        dateISO: day.date,
        dateLabel: dateLabel(capturedAtISO),
        ageLong: age?.long,
        mediaId: first.id,
        kind: first.kind,
        source: first.source,
        tone: first.tone,
        durationLabel: first.durationLabel,
      });
    }
  });

  // One older first, to make the Firsts wall feel like a real keepsake.
  const may = ageAt(mia.birthday, "2026-05-22");
  firsts.push({
    id: "first_seed_letter_m",
    label: "Wrote the letter “M”",
    dateISO: "2026-05-22",
    dateLabel: dateLabel("2026-05-22T10:00:00.000Z"),
    ageLong: may?.long,
    mediaId: "seed_letter_m",
    kind: "photo",
    source: "phone",
    tone: "g4",
  });

  const todayAge = ageAt(mia.birthday, new Date().toISOString());
  const session: MilestoneSession = {
    childId: mia.id,
    childName: mia.name,
    ageShort: todayAge?.short,
    nowSummary: "Lately she’s naming animals, stringing two-word phrases, and going down the big slide on her own.",
    suggestions: [
      { icon: "📖", text: "Books with a few more words" },
      { icon: "🦕", text: "A dino museum trip" },
      { icon: "🔢", text: "Count steps together" },
    ],
    reassurance: "Ideas from Mia’s last few weeks — never a score, never a comparison.",
  };

  return { child: { id: mia.id, name: mia.name }, session, days, firsts, skippedCount: 0 };
}
