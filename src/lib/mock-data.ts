import type { FamilyMemberProfile } from "./family/profile";
import { CalendarEvent, Moment, NeedItem, Suggestion } from "./types";

// Seed content for the calm "Today" inbox and the "Memory" timeline.
// Aligned with the AURI teammates: Iris (films/album), Lumi (reads), Vita (keeper).
// All exports are getter functions that accept children from the live family store.

function childByProfile(
  children: FamilyMemberProfile[],
  predicate: (c: FamilyMemberProfile) => boolean,
  fallbackIndex = 0
): FamilyMemberProfile | undefined {
  return children.find(predicate) ?? children[fallbackIndex];
}

export function getMockNeeds(children: FamilyMemberProfile[]): NeedItem[] {
  const medicineChild = childByProfile(children, (c) => c.health.length > 0) ?? children[0];
  const sportsChild = childByProfile(children, (c) => c.interests.some((i) => /basketball|soccer|sport/i.test(i)) || c.routines.some((r) => /basketball|soccer|sport/i.test(r)), children.length - 1) ?? children[children.length - 1];
  const mc = medicineChild?.name ?? "your child";
  const sc = sportsChild?.name ?? "your child";
  return [
    {
      id: "medicine-receipt",
      icon: "bell",
      title: `${mc}'s medicine — confirm`,
      body: "Vita set the daily 2pm reminder. Approve the video receipt.",
      helper: "Vita",
      actionLabel: "Review",
      status: "needs-review",
    },
    {
      id: "family-album",
      icon: "camera-note",
      title: "This week's album is ready",
      body: "Iris pulled the best moments from your photos.",
      helper: "Iris",
      actionLabel: "Open draft",
      status: "draft",
    },
    {
      id: "checkup",
      icon: "calendar",
      title: `${sc}'s checkup`,
      body: "Vita found an appointment waiting for your decision.",
      helper: "Vita",
      actionLabel: "Review",
      status: "needs-review",
    },
  ];
}

export function getMockSuggestions(children: FamilyMemberProfile[]): Suggestion[] {
  const booksChild = childByProfile(children, (c) => c.interests.some((i) => /book|read|dinosaur/i.test(i))) ?? children[0];
  const bc = booksChild?.name ?? "your child";
  return [
    { id: "pick-photo", helper: "You", icon: "person", text: "Pick one family photo for Friday" },
    { id: "make-album", helper: "Iris", icon: "spark", text: "Make a family album from this week's photos" },
    { id: "dino-insight", helper: "Lumi", icon: "book", text: `${bc} keeps choosing dinosaur books — suggest one more` },
    { id: "family-conflicts", helper: "Vita", icon: "calendar", text: "Check if this week has any family conflicts" },
  ];
}

export function getMockUpcoming(children: FamilyMemberProfile[]): CalendarEvent[] {
  const firstChild = children[0];
  const secondChild = children[1] ?? children[0];
  const booksChild = childByProfile(children, (c) => c.interests.some((i) => /book|read|dinosaur/i.test(i))) ?? firstChild;
  const sportsChild = childByProfile(children, (c) => c.interests.some((i) => /swim|soccer|sport/i.test(i)) || c.routines.some((r) => /swim|soccer|sport/i.test(r)), children.length - 1) ?? secondChild;
  const fc = firstChild?.name ?? "Child";
  const sc = sportsChild?.name ?? "Child";
  const bc = booksChild?.name ?? "Child";
  const fcId = firstChild?.id ?? "child";
  const scId = sportsChild?.id ?? "child";
  const bcId = booksChild?.id ?? "child";
  return [
    {
      id: "piano-lesson",
      title: "Piano lesson",
      person: fcId,
      dateLabel: "Tomorrow",
      timeLabel: "3:15 PM",
      body: `${fc} has 3 tiny practice steps ready.`,
      icon: "piano",
      status: "prepared",
      statusLabel: "Prepared",
    },
    {
      id: "preschool-dropoff",
      title: "Preschool drop-off",
      person: scId,
      dateLabel: "Friday",
      timeLabel: "8:30 AM",
      body: "School chaos still needs a family photo.",
      icon: "backpack",
      status: "needs-review",
      statusLabel: "Needs review",
    },
    {
      id: "family-dinner",
      title: "Dinner at home",
      person: "family",
      dateLabel: "Friday",
      timeLabel: "6:30 PM",
      body: "Nova can build a meal plan from your week.",
      icon: "meal",
      status: "suggested",
      statusLabel: "Suggested",
      suggested: true,
    },
    {
      id: "library-storytime",
      title: "Library story time",
      person: bcId,
      dateLabel: "Saturday",
      timeLabel: "10:00 AM",
      body: "Lumi lined up two dinosaur picks for after.",
      icon: "book",
      status: "prepared",
      statusLabel: "Prepared",
    },
    {
      id: "swim-class",
      title: "Swim class",
      person: scId,
      dateLabel: "Saturday",
      timeLabel: "4:00 PM",
      body: "Pack towels — last week's bag is still damp.",
      icon: "soccer",
      status: "needs-review",
      statusLabel: "Needs review",
    },
    {
      id: "grandma-call",
      title: "Grandma call",
      person: "family",
      dateLabel: "Sunday",
      timeLabel: "7:30 PM",
      body: "Iris has 2 clips from this week ready to share.",
      icon: "video-heart",
      status: "ready",
      statusLabel: "Ready",
    },
  ];
}

export function getMockMoments(children: FamilyMemberProfile[]): Moment[] {
  const firstChild = children[0];
  const sportsChild = childByProfile(children, (c) => c.interests.some((i) => /soccer|sport|ball/i.test(i)) || c.routines.some((r) => /soccer|sport/i.test(r)), children.length - 1) ?? firstChild;
  const booksChild = childByProfile(children, (c) => c.interests.some((i) => /book|read|dinosaur/i.test(i))) ?? firstChild;
  const sc = sportsChild?.name ?? "Child";
  const bc = booksChild?.name ?? "Child";
  const scId = sportsChild?.id ?? "child";
  const bcId = booksChild?.id ?? "child";
  return [
    {
      id: "soccer",
      timeLabel: "Today · 4:20 PM",
      sourceLabel: "Auri Robot",
      sourceType: "auri",
      title: "Soccer time backyard",
      body: `${sc} scored twice and laughed non-stop.`,
      person: scId,
      status: "ready",
      statusLabel: "Ready",
      icon: "soccer",
      imageTone: "green",
    },
    {
      id: "dinosaur-day",
      timeLabel: "Today · 2:10 PM",
      sourceLabel: "Reading",
      sourceType: "reading",
      title: "Dinosaur Day",
      body: `We read 3 books about dinosaurs. ${bc} loved it.`,
      person: bcId,
      status: "saved",
      statusLabel: "Saved",
      icon: "book",
      imageTone: "orange",
    },
    {
      id: "first-steps",
      timeLabel: "Yesterday · 5:12 PM",
      sourceLabel: "Auri Robot",
      sourceType: "auri",
      title: "She walked!",
      body: "Three steps to the couch. Iris caught the whole thing.",
      person: bcId,
      status: "ready",
      statusLabel: "Ready",
      icon: "video-heart",
      imageTone: "purple",
    },
    {
      id: "week-album",
      timeLabel: "Yesterday · 8:40 PM",
      sourceLabel: "Phone",
      sourceType: "phone",
      title: "This week with the kids",
      body: "Iris organized 24 photos into one warm album.",
      person: "family",
      status: "draft",
      statusLabel: "Draft",
      icon: "photos",
      imageTone: "pink",
    },
  ];
}

// Legacy static exports — callers that haven't been updated yet get empty-children fallbacks.
export const needs: NeedItem[] = getMockNeeds([]);
export const suggestions: Suggestion[] = getMockSuggestions([]);
export const upcoming: CalendarEvent[] = getMockUpcoming([]);
export const moments: Moment[] = getMockMoments([]);
