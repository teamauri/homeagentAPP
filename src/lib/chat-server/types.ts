export type TeamMemberId = "nora" | "nina" | "milo" | "bibi" | "mira" | "auri";

export type ChatIntent =
  | "calendar_event"
  | "reminder"
  | "baby_log"
  | "lesson_recap"
  | "memory_story"
  | "reading"
  | "photo_video"
  | "general_question"
  | "unknown";

export type ChatCardType =
  | "calendar_draft"
  | "reminder"
  | "baby_log"
  | "lesson_recap"
  | "memory"
  | "story_draft"
  | "text";

export type LocalObjectType =
  | "calendar_draft"
  | "reminder_draft"
  | "baby_log"
  | "memory_item"
  | "story_draft"
  | "lesson_recap";

export interface ChatRequestBody {
  familyId?: string;
  userId?: string;
  message?: string;
  attachments?: Array<{ id?: string; type?: string; name?: string; url?: string }>;
  currentPage?: string;
}

export interface ChatResponseCard {
  type: ChatCardType;
  title: string;
  subtitle?: string;
  body?: string;
  cta?: string;
  targetRoute?: string;
  metadata?: Record<string, unknown>;
}

export interface ObjectToCreate {
  type: LocalObjectType;
  payload: Record<string, unknown>;
}

export interface CreatedLocalObject {
  id: string;
  type: LocalObjectType;
  route: string;
  status: "draft" | "logged" | "saved" | "ready" | "added" | "sent";
}

export interface ChatAIResponse {
  handledByTeamMemberId: TeamMemberId;
  handledByName: string;
  intent: ChatIntent;
  reply: string;
  cards: ChatResponseCard[];
  objectsToCreate: ObjectToCreate[];
  suggestedFollowups: string[];
}

export interface ChatApiResponse extends ChatAIResponse {
  createdLocalObjects: CreatedLocalObject[];
  metadata: {
    provider: "deepseek" | "gemini" | "openai-compatible" | "fallback";
    fallbackUsed: boolean;
    fallbackReason?: string;
    model?: string;
  };
}
