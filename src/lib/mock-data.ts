import { Moment, NeedItem, Suggestion } from "./types";

// Seed content for the calm "Today" inbox and the "Memory" timeline.
// Aligned with the AURI teammates: Iris (films/album), Lumi (reads), Vita (keeper).

export const needs: NeedItem[] = [
  {
    id: "medicine-receipt",
    icon: "bell",
    title: "Mia’s medicine — confirm",
    body: "Vita set the daily 2pm reminder. Approve the video receipt.",
    helper: "Vita",
    actionLabel: "Review",
    status: "needs-review",
  },
  {
    id: "family-album",
    icon: "camera-note",
    title: "This week’s album is ready",
    body: "Iris pulled the best moments from your photos.",
    helper: "Iris",
    actionLabel: "Open draft",
    status: "draft",
  },
  {
    id: "checkup",
    icon: "calendar",
    title: "Leo’s checkup",
    body: "Vita found an appointment waiting for your decision.",
    helper: "Vita",
    actionLabel: "Review",
    status: "needs-review",
  },
];

export const suggestions: Suggestion[] = [
  { id: "pick-photo", helper: "You", icon: "person", text: "Pick one family photo for Friday" },
  { id: "make-album", helper: "Iris", icon: "spark", text: "Make a family album from this week’s photos" },
  { id: "dino-insight", helper: "Lumi", icon: "book", text: "Mia keeps choosing dinosaur books — suggest one more" },
  { id: "family-conflicts", helper: "Vita", icon: "calendar", text: "Check if this week has any family conflicts" },
];

export const moments: Moment[] = [
  {
    id: "soccer",
    timeLabel: "Today · 4:20 PM",
    sourceLabel: "Auri Robot",
    sourceType: "auri",
    title: "Soccer time backyard",
    body: "Leo scored twice and laughed non-stop.",
    person: "leo",
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
    body: "We read 3 books about dinosaurs. Mia loved it.",
    person: "mia",
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
    person: "mia",
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
