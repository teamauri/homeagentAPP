import { CalendarEvent, Connection, FamilyMember, HouseRule, Journey, Moment, NeedItem, Suggestion } from "./types";

export const needs: NeedItem[] = [
  {
    id: "piano-plan",
    icon: "piano",
    title: "Piano plan is ready",
    body: "Milo turned tomorrow's lesson into 3 tiny steps.",
    helper: "Milo",
    actionLabel: "View plan",
    status: "prepared",
  },
  {
    id: "grandma-update",
    icon: "mail-heart",
    title: "Grandma update draft",
    body: "Mira found 2 clips Grandma may love.",
    helper: "Mira",
    actionLabel: "Open draft",
    status: "draft",
  },
  {
    id: "school-photo",
    icon: "camera-note",
    title: "School photo note",
    body: "Nora found a form waiting for your decision.",
    helper: "Nora",
    actionLabel: "Review",
    status: "needs-review",
  },
];

export const suggestions: Suggestion[] = [
  { id: "pick-photo", helper: "You", icon: "person", text: "Pick one family photo for Friday" },
  { id: "make-story", helper: "Mira", icon: "spark", text: "Make a Sunday story from 24 photos" },
  { id: "shorten-piano", helper: "Milo", icon: "music", text: "Shorten tomorrow's piano plan to 5 minutes" },
  { id: "volcano-book", helper: "Bibi", icon: "book", text: "Suggest one more volcano book for Sophie" },
  { id: "family-conflicts", helper: "Nora", icon: "calendar", text: "Check if this week has any family conflicts" },
];

export const calendarEvents: CalendarEvent[] = [
  {
    id: "piano",
    title: "Piano Lesson",
    person: "sophie",
    dateLabel: "Tomorrow",
    timeLabel: "4:00 PM",
    body: "Milo has 3 tiny practice steps ready.",
    icon: "piano",
    status: "prepared",
    statusLabel: "Prepared",
  },
  {
    id: "preschool",
    title: "Preschool",
    person: "sophie",
    dateLabel: "Friday",
    timeLabel: "8:30 AM",
    body: "School photo note still needs a family photo.",
    icon: "backpack",
    status: "needs-review",
    statusLabel: "Needs review",
  },
  {
    id: "grandma-call",
    title: "Grandma call",
    person: "family",
    dateLabel: "Sunday",
    timeLabel: "7:30 PM",
    body: "Mira has 2 clips ready to share.",
    icon: "video-heart",
    status: "ready",
    statusLabel: "Ready",
  },
];

export const suggestedEvents: CalendarEvent[] = [
  {
    id: "dinner",
    title: "Dinner at home",
    person: "family",
    dateLabel: "Friday",
    timeLabel: "6:30 PM",
    body: "Nora can build a meal plan from your week.",
    icon: "meal",
    status: "suggested",
    statusLabel: "Suggested by Nora",
    suggested: true,
  },
];

export const journeys: Journey[] = [
  {
    id: "sophie-piano",
    scope: "child",
    person: "sophie",
    title: "Sophie · Piano",
    helper: "Milo",
    icon: "piano",
    body: "3 tiny steps ready",
    group: "child",
  },
  {
    id: "sophie-reading",
    scope: "child",
    person: "sophie",
    title: "Sophie · Reading",
    helper: "Bibi",
    icon: "book",
    body: "Dinosaurs + volcanoes",
    group: "child",
  },
  {
    id: "baby-care-log",
    scope: "child",
    person: "baby",
    title: "Baby · Care Log",
    helper: "Nora",
    icon: "bottle",
    body: "4 feeds logged today",
    group: "child",
  },
  {
    id: "meal-prep",
    scope: "family",
    person: "family",
    title: "Family · Meal Prep",
    helper: "Nora",
    icon: "meal",
    body: "Dinner plan not started",
    group: "home",
  },
];

export const addHelp = [
  { id: "meal-prep", label: "Meal Prep", icon: "meal" },
  { id: "baby-logging", label: "Baby Logging", icon: "bottle" },
  { id: "homework", label: "Homework Hints", icon: "pencil" },
  { id: "reading", label: "Reading with Auri", icon: "book" },
  { id: "doubao", label: "Connect Doubao", icon: "robot" },
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
    body: "We read 3 books about dinosaurs. Sophie loved it.",
    person: "sophie",
    status: "saved",
    statusLabel: "Saved",
    icon: "book",
    imageTone: "orange",
  },
  {
    id: "sunday-story",
    timeLabel: "Yesterday · 8:40 PM",
    sourceLabel: "Phone + Auri",
    sourceType: "phone",
    title: "Sophie's Sunday Story",
    body: "A cozy day with pancakes, parks, and giggles.",
    person: "sophie",
    status: "draft",
    statusLabel: "Draft",
    icon: "phone",
    imageTone: "purple",
  },
  {
    id: "grandma-update",
    timeLabel: "Yesterday · 7:30 PM",
    sourceLabel: "Phone",
    sourceType: "phone",
    title: "Grandma update",
    body: "Shared new photos and a sweet voice message.",
    person: "grandma",
    status: "draft",
    statusLabel: "Draft",
    icon: "mail-heart",
    imageTone: "pink",
  },
];

export const familyMembers: FamilyMember[] = [
  { id: "sophie", name: "Sophie", summary: "Piano tomorrow · Dinosaur books", icon: "girl" },
  { id: "leo", name: "Leo", summary: "Soccer clip ready", icon: "boy" },
  { id: "baby", name: "Baby", summary: "4 feeds today", icon: "baby" },
  { id: "mom", name: "Mom", summary: "Primary admin", icon: "mom" },
  { id: "dad", name: "Dad", summary: "Daily brief", icon: "dad" },
  { id: "grandma", name: "Grandma", summary: "Approved moments only", icon: "grandma" },
];

export const connections: Connection[] = [
  { id: "calendar", name: "Apple Calendar", summary: "Family schedule", statusLabel: "Connected", icon: "calendar" },
  { id: "photos", name: "iCloud Photos", summary: "Family camera roll", statusLabel: "Connected", icon: "photos" },
  { id: "robot", name: "Auri Robot", summary: "Living Room", statusLabel: "Ready", icon: "robot" },
  { id: "doubao", name: "Doubao", summary: "Homework hints", statusLabel: "Available", icon: "cloud" },
  { id: "learning", name: "Learning Apps", summary: "2 apps connected", statusLabel: "2 connected", icon: "graduation" },
];

export const houseRules: HouseRule[] = [
  { id: "ask-before-send", text: "Ask before sending to family", icon: "shield" },
  { id: "invited-moments", text: "Auri only saves invited robot moments", icon: "heart" },
  { id: "low-interruption", text: "Low-interruption reminders", icon: "bell" },
];
