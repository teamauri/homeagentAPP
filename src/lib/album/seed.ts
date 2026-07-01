import { ageAt } from "@/lib/family/profile";
import { getChildren, getMember } from "@/lib/family/store";
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
    childId: opts.childId,
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
  /** Which child this day's media belongs to (drives the per-child tabs). */
  childId?: string;
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
      { tone: "g6", kind: "video", source: "auri", durationLabel: "0:30" },
    ],
  },
  {
    date: "2026-06-06",
    caption: "Pancakes with Dad. Flour everywhere — worth it.",
    childId: "child2",
    tones: [{ tone: "g4" }, { tone: "g2" }, { tone: "g5" }],
  },
];

export function seedGrowthData(): GrowthData {
  const primaryChild = getMember("child1") ?? getMember("child2")!;
  const days: DayGroup[] = [];
  const firsts: FirstItem[] = [];

  seedDays.forEach((day, di) => {
    const capturedAtISO = `${day.date}T10:00:00.000Z`;
    const items = day.tones.map((t, i) =>
      media(`seed_${di}_${i}`, t.tone, {
        kind: t.kind,
        source: t.source,
        childId: day.childId ?? "child1",
        durationLabel: t.durationLabel,
        capturedAtISO,
        isFirst: i === 0 && Boolean(day.firstLabel),
        firstLabel: i === 0 ? day.firstLabel : undefined,
      })
    );
    const age = ageAt(primaryChild.birthday, day.date);
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

  const todayAge = ageAt(primaryChild.birthday, new Date().toISOString());
  const primarySession: MilestoneSession = {
    childId: primaryChild.id,
    childName: primaryChild.name,
    ageShort: todayAge?.short,
    nowSummary: "Lately she’s naming animals, stringing two-word phrases, and going down the big slide on her own.",
    suggestions: [
      { icon: "📖", text: "Books with a few more words" },
      { icon: "🦕", text: "A dino museum trip" },
      { icon: "🔢", text: "Count steps together" },
    ],
    reassurance: "Ideas from Sophie’s last few weeks — never a score, never a comparison.",
  };

  // A milestone card for every child (shown on their tab). Sophie gets the rich
  // hand-written one; others are generated warmly from their profile.
  const sessions: Record<string, MilestoneSession> = {};
  for (const child of getChildren()) {
    sessions[child.id] = child.id === primaryChild.id ? primarySession : sessionForChild(child);
  }

  return { child: { id: primaryChild.id, name: primaryChild.name }, session: primarySession, sessions, days, firsts, skippedCount: 0 };
}

function sessionForChild(child: { id: string; name: string; birthday?: string; interests?: string[] }): MilestoneSession {
  const age = ageAt(child.birthday, new Date().toISOString());
  const interests = child.interests ?? [];
  return {
    childId: child.id,
    childName: child.name,
    ageShort: age?.short,
    nowSummary: interests.length
      ? `Lately ${child.name} is into ${interests.slice(0, 2).join(" and ")}, and getting more independent every week.`
      : `${child.name} is growing and curious — new words and new tricks every week.`,
    suggestions: [
      { icon: "📖", text: "Read together before bed" },
      { icon: "🧩", text: "A simple puzzle to try" },
      { icon: "🔢", text: "Count things out loud" },
    ],
    reassurance: `Ideas from ${child.name}’s last few weeks — never a score, never a comparison.`,
  };
}
