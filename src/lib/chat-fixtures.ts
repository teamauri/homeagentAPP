import { ChatAIResponse, ChatCard, ChatMessage } from "./chat-contracts";

// The family group = the task board. This mirrors the canonical group-chat
// story from the AURI product site: Mom/Dad plus the in-group teammates
// Vita (keeper), Iris (the eye), Lumi (reads).
export const prdV6ChatCardFixtures: ChatCard[] = [
  {
    id: "medicine-receipt",
    kind: "memory",
    icon: "video-heart",
    typeLabel: "Video receipt",
    title: "Medicine taken · 2:04 PM",
    body: "A 6-second video receipt confirms Mia’s 2pm dose.",
    metadata: ["Auri Robot", "0:06", "Mia"],
    videoUrl: "/demo-media/67fd7e14-aaab-4092-9b9c-1091ec2f87b7.mp4",
    poster: "/demo-media/77128c23-7216-4012-aaea-2a8c21e74de5.jpg",
    durationLabel: "0:06",
    memory: {
      sourceType: "auri",
      capturedAtLabel: "Today 2:04 PM",
      people: ["mia"],
    },
  },
  {
    id: "first-steps-film",
    kind: "memory",
    icon: "camera-note",
    typeLabel: "Film",
    title: "She walked!",
    body: "Three steps to the couch — a 30-second film, sent to the group.",
    metadata: ["Auri Robot", "0:30", "Mia"],
    videoUrl: "/demo-media/e82d1f82-ca73-4222-8db0-4fe4799b9f04.mp4",
    poster: "/demo-media/7fada8f9-fc26-417f-86c7-80fd6b3048b8.jpg",
    durationLabel: "0:30",
    memory: {
      sourceType: "auri",
      capturedAtLabel: "Today 5:12 PM",
      people: ["mia"],
    },
  },
  {
    id: "checkup-calendar",
    kind: "calendar_draft",
    icon: "calendar",
    typeLabel: "Calendar draft",
    title: "Leo’s checkup",
    body: "Added to the family calendar — confirm the time.",
    metadata: ["Tomorrow", "9:30 AM", "Leo"],
    action: { label: "Review event", intent: "review" },
    event: {
      person: "leo",
      dateLabel: "Tomorrow",
      timeLabel: "9:30 AM",
      location: "Clinic",
    },
  },
  {
    id: "morning-routine",
    kind: "job",
    icon: "backpack",
    typeLabel: "Routine",
    title: "Leaving for school",
    metadata: ["Leo", "weekday mornings"],
    subtasks: [
      { label: "Water bottle in bag", state: "done", timeLabel: "7:31" },
      { label: "Fruit packed", state: "active", timeLabel: "now" },
      { label: "Shoes on", state: "todo" },
      { label: "Coat", state: "todo" },
    ],
  },
  {
    id: "reading-moment",
    kind: "memory",
    icon: "book",
    typeLabel: "Reading moment",
    title: "Goodnight Moon with Lumi",
    body: "Mia asked where the mouse went 🐭",
    metadata: ["Reading", "Tonight", "Mia"],
    action: { label: "View", intent: "view" },
    memory: {
      sourceType: "reading",
      capturedAtLabel: "Tonight",
      people: ["mia"],
    },
  },
];

const cardById = Object.fromEntries(prdV6ChatCardFixtures.map((card) => [card.id, card])) as Record<string, ChatCard>;

export const chatFixtureMessages: ChatMessage[] = [
  {
    id: "mom-meds",
    role: "user",
    sender: "Mom",
    avatar: "mom",
    timeLabel: "2:02 PM",
    text: "Did Mia take her 2pm meds?",
  },
  {
    id: "vita-meds",
    role: "helper",
    sender: "Vita",
    avatar: "vita",
    timeLabel: "2:04 PM",
    text: "Yes — 2:04 PM. ✓",
    cards: [cardById["medicine-receipt"]],
  },
  {
    id: "dad-film",
    role: "user",
    sender: "Dad",
    avatar: "dad",
    timeLabel: "4:58 PM",
    text: "Film her if she does something today 🙏",
  },
  {
    id: "iris-film",
    role: "helper",
    sender: "Iris",
    avatar: "iris",
    timeLabel: "5:12 PM",
    text: "She walked! 🎉 Three steps to the couch.",
    cards: [cardById["first-steps-film"]],
  },
  {
    id: "mom-react",
    role: "user",
    sender: "Mom",
    avatar: "mom",
    timeLabel: "5:13 PM",
    text: "AHHH 😭 watching now",
  },
  {
    id: "vita-checkup",
    role: "helper",
    sender: "Vita",
    avatar: "vita",
    timeLabel: "5:20 PM",
    text: "📅 Leo’s checkup tomorrow, 9:30 AM — added to your calendar.",
    cards: [cardById["checkup-calendar"]],
  },
  {
    id: "lumi-reading",
    role: "helper",
    sender: "Lumi",
    avatar: "lumi",
    timeLabel: "8:10 PM",
    text: "Mia and I read Goodnight Moon — she asked where the mouse went 🐭",
    cards: [cardById["reading-moment"]],
  },
  {
    id: "vita-routine",
    role: "helper",
    sender: "Vita",
    avatar: "vita",
    timeLabel: "7:33 AM",
    text: "On it — walking Leo through the morning routine.",
    cards: [cardById["morning-routine"]],
  },
];

export const chatAIResponseFixtures: ChatAIResponse[] = chatFixtureMessages
  .filter((message) => message.role === "helper" && message.cards?.length)
  .map((message) => ({
    id: `${message.id}-response`,
    createdAt: "2026-06-18T09:30:00.000Z",
    threadId: "janes-family",
    helper: message.sender as ChatAIResponse["helper"],
    message,
    cards: message.cards ?? [],
    suggestedReplies: ["Looks good", "Make it shorter", "Show details"],
  }));
