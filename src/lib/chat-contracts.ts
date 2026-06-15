import { Helper, PersonId, SourceType } from "./types";

export type ChatParticipant = "Mom" | "Dad" | Helper;

export type ChatCardKind =
  | "calendar_draft"
  | "reminder"
  | "baby_log"
  | "lesson_recap"
  | "memory"
  | "story_draft"
  | "text";

export type ChatMessageRole = "user" | "helper" | "system";

export interface ChatCardAction {
  label: string;
  intent: "review" | "edit" | "open" | "save" | "send" | "view" | "log";
}

interface ChatCardBase {
  id: string;
  kind: ChatCardKind;
  icon: string;
  typeLabel: string;
  title: string;
  body?: string;
  metadata: string[];
  action?: ChatCardAction;
}

export interface CalendarDraftChatCard extends ChatCardBase {
  kind: "calendar_draft";
  event: {
    person: PersonId;
    dateLabel: string;
    timeLabel: string;
    location?: string;
  };
}

export interface ReminderChatCard extends ChatCardBase {
  kind: "reminder";
  reminder: {
    dueLabel: string;
    assignee?: PersonId;
  };
}

export interface BabyLogChatCard extends ChatCardBase {
  kind: "baby_log";
  babyLog: {
    baby: PersonId;
    lastFeedLabel: string;
    suggestedAction: "feed" | "nap" | "diaper" | "note";
  };
}

export interface LessonRecapChatCard extends ChatCardBase {
  kind: "lesson_recap";
  recap: {
    child: PersonId;
    sourceLabel: string;
    steps: string[];
  };
}

export interface StoryDraftChatCard extends ChatCardBase {
  kind: "story_draft";
  story: {
    audience: PersonId;
    sourceCount: number;
    tone: "warm" | "playful" | "brief";
  };
}

export interface MemoryChatCard extends ChatCardBase {
  kind: "memory";
  memory: {
    sourceType: SourceType;
    capturedAtLabel: string;
    people: PersonId[];
  };
}

export interface TextChatCard extends ChatCardBase {
  kind: "text";
  text: {
    recipient?: PersonId;
    draftText: string;
    context?: string;
  };
}

export type ChatCard =
  | CalendarDraftChatCard
  | ReminderChatCard
  | BabyLogChatCard
  | LessonRecapChatCard
  | MemoryChatCard
  | StoryDraftChatCard
  | TextChatCard;

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  sender: ChatParticipant;
  avatar: string;
  timeLabel: string;
  text: string;
  cards?: ChatCard[];
}

export interface ChatAIResponse {
  id: string;
  createdAt: string;
  threadId: string;
  helper: Helper;
  message: ChatMessage;
  cards: ChatCard[];
  suggestedReplies?: string[];
}
