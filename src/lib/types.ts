export type TabKey = "today" | "chat" | "memory";
export type Helper = "Iris" | "Lumi" | "Vita" | "Nova" | "You";
export type PersonId = "mia" | "leo" | "baby" | "mom" | "dad" | "grandma" | "family";
export type SourceType = "auri" | "phone" | "reading" | "calendar" | "photos" | "external";
export type Status = "ready" | "prepared" | "needs-review" | "draft" | "saved" | "suggested" | "connected";

export interface NeedItem {
  id: string;
  icon: string;
  title: string;
  body: string;
  helper: Helper;
  actionLabel: string;
  status?: Status;
}

export interface Suggestion {
  id: string;
  helper: Helper;
  icon: string;
  text: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  person: PersonId;
  dateLabel: string;
  timeLabel: string;
  body: string;
  icon: string;
  status: Status;
  statusLabel: string;
  suggested?: boolean;
}

export interface Journey {
  id: string;
  scope: "child" | "family" | "home";
  person?: PersonId;
  title: string;
  helper: Helper;
  icon: string;
  body: string;
  group: "child" | "home";
}

export interface Moment {
  id: string;
  timeLabel: string;
  sourceLabel: string;
  sourceType: SourceType;
  title: string;
  body: string;
  person: PersonId;
  status: Status;
  statusLabel: string;
  imageTone?: "green" | "orange" | "purple" | "pink";
  icon: string;
}

export interface FamilyMember {
  id: PersonId;
  name: string;
  summary: string;
  icon: string;
}

export interface Connection {
  id: string;
  name: string;
  summary: string;
  statusLabel: string;
  icon: string;
}

export interface HouseRule {
  id: string;
  text: string;
  icon: string;
}
