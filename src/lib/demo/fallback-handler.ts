import { ChatAIResponse, ChatHelperSegment, ChatRequestBody } from "@/lib/chat-server/types";
import { getMember } from "@/lib/family/store";

function lowerInput(request: ChatRequestBody) {
  const attachmentText = request.attachments?.map((a) => `${a.type ?? ""} ${a.name ?? ""}`).join(" ") ?? "";
  return `${request.message ?? ""} ${attachmentText}`.toLowerCase();
}

// Auri is always the primary voice. `helper` is the second voice that takes a
// task — present only for actionable requests, never for advice.
function auri(reply: string, extra: Partial<ChatAIResponse> = {}): ChatAIResponse {
  return {
    handledByTeamMemberId: "auri",
    handledByName: "Auri",
    intent: extra.intent ?? "general_question",
    reply,
    cards: extra.cards ?? [],
    objectsToCreate: extra.objectsToCreate ?? [],
    helper: extra.helper,
    suggestedFollowups: extra.suggestedFollowups ?? [],
  };
}

const ADVICE_HINTS = [
  "upset", "cry", "crying", "tantrum", "meltdown", "fussy", "clingy", "whining", "whine",
  "won't sleep", "not sleeping", "won't eat", "not eating", "worried", "worry", "scared",
  "why is", "why does", "why won't", "why do", "how do i", "how can i", "what should i", "is it normal",
];

export function createFallbackChatResponse(request: ChatRequestBody): ChatAIResponse {
  const input = lowerInput(request);
  const mia = getMember("mia");
  const med = mia?.health[0]; // "Finishing a 10-day course of medicine"

  // 1) Advice / emotional — Auri alone, grounded in what we know. No task.
  if (ADVICE_HINTS.some((h) => input.includes(h))) {
    const grounded = med
      ? `A couple of things I'd gently look at with Mia: she's still ${med.toLowerCase()}, and little ones are often clingier or more easily upset when they're not feeling 100%. Her bedtime has also slipped past 8pm a few nights this week, and short sleep makes the next day rougher.`
      : "A couple of things worth a look: a slip in sleep or routine, or coming down with something, often shows up as extra fussiness first.";
    return auri(
      `That's hard — I'm sorry you're both having a rough patch. ${grounded} Want me to pull up Mia's sleep and meds from this week?`,
      {
        intent: "general_question",
        suggestedFollowups: ["Show Mia's sleep this week", "Was she off her meds?", "Ideas for a calmer evening"],
      }
    );
  }

  // 2) Actionable → Auri frames + a helper takes the task (second voice).
  if (/拍摄|拍一下|拍一段|拍[^\s，。,.!?]*|录像|录视频|录下|记录下|视频记录|拍照|film|record|video|capture|photo/.test(input)) {
    const timeMatch = request.message?.match(/(\d{1,2})[:：](\d{2})/) ?? null;
    const timeLabel = timeMatch ? `${timeMatch[1]}:${timeMatch[2]} PM` : "8:00 PM";
    const title = request.message?.replace(/今晚|今天|today|tonight/gi, "").replace(/\d{1,2}[:：]\d{2}/, "").trim() || "Capture family moment";
    const helper: ChatHelperSegment = {
      teamMemberId: "cameraman",
      name: "Cameraman",
      reply: `收到，我会在今晚${timeLabel.replace(" PM", "")}拍下这个瞬间。`,
      cards: [
        {
          type: "reminder",
          title,
          subtitle: `Today · ${timeLabel} · Mia`,
          body: "Scheduled camera capture",
          cta: "Edit",
          metadata: { due: timeLabel, time: timeLabel, dateLabel: "Today", person: "mia", agent: "cameraman", recordingMode: "cameraman_highlight" },
        },
      ],
      objectsToCreate: [{ type: "reminder_draft", payload: { title, timeLabel, dateLabel: "Today", person: "mia", agent: "cameraman", recordingMode: "cameraman_highlight", note: request.message } }],
    };
    return auri("交给 Cameraman 来拍这个瞬间。", { intent: "photo_video", helper, suggestedFollowups: ["改时间", "拍完自动保存到 Memory"] });
  }

  if (/记录|记一下|记下|log|logged|刚刚|刚才|已经|喝了|吃了|睡了|尿布|diaper|nap|slept|feed|fed|drank|temperature|体温/.test(input)) {
    const person = input.includes("leo") || input.includes("里奥") ? "leo" : input.includes("mia") || input.includes("阿丽塔") ? "mia" : "baby";
    const title = /fruit|水果/.test(input) ? "Snack: Fruit" : /water|喝水/.test(input) ? "Drink: Water" : "Care note";
    const description = request.message?.trim() || "Care note";
    const helper: ChatHelperSegment = {
      teamMemberId: "homekeeper",
      name: "Homekeeper",
      reply: "已记录这条照护日志。",
      cards: [
        {
          type: "baby_log",
          title,
          subtitle: person,
          body: description,
          cta: "Review",
          metadata: { childId: person, type: "snack", description },
        },
      ],
      objectsToCreate: [{ type: "baby_log", payload: { childId: person, type: "snack", description, timestamp: new Date().toISOString() } }],
    };
    return auri("我会让 Homekeeper 记下这条照护记录。", { intent: "baby_log", helper, suggestedFollowups: ["补充数量", "查看今天记录"] });
  }

  if (input.includes("remind") || input.includes("medicine") || input.includes("meds") || input.includes("water bottle")) {
    // Detect "now / 现在" — use the current time rather than the hardcoded 2 PM slot.
    const isNow = input.includes("now") || input.includes("现在") || input.includes("立刻") || input.includes("马上");
    let timeLabel: string;
    let auriReply: string;
    if (isNow) {
      const h = new Date().getHours();
      const m = new Date().getMinutes();
      const period = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 === 0 ? 12 : h % 12;
      timeLabel = `${h12}:${String(m).padStart(2, "0")} ${period}`;
      auriReply = `好的，我来帮Mia设置吃药提醒。她正在完成10天的疗程，现在该吃${timeLabel}的药了。`;
    } else {
      timeLabel = "2:00 PM";
      auriReply = "Of course — I'll have Homekeeper keep this on the radar.";
    }
    const helper: ChatHelperSegment = {
      teamMemberId: "homekeeper",
      name: "Homekeeper",
      reply: `已为您创建提醒：Mia${isNow ? "现在" : "下午2点"}吃药。`,
      cards: [
        {
          type: "reminder",
          title: "Mia吃药",
          subtitle: `Today · ${timeLabel} · Mia`,
          body: "Mia正在完成10天疗程",
          cta: "Edit",
          metadata: { due: timeLabel, time: timeLabel, dateLabel: "Today", person: "mia", wantsReceipt: true },
        },
      ],
      objectsToCreate: [{ type: "reminder_draft", payload: { title: "Mia吃药", timeLabel, dateLabel: "Today", person: "mia", note: "Mia正在完成10天疗程", wantsReceipt: true } }],
    };
    return auri(auriReply, { intent: "reminder", helper, suggestedFollowups: ["改成其他时间", "谁来拍视频确认?"] });
  }

  if (input.includes("calendar") || input.includes("appointment") || input.includes("basketball") || input.includes("checkup") || input.includes("5:30")) {
    const helper: ChatHelperSegment = {
      teamMemberId: "homekeeper",
      name: "Homekeeper",
      reply: "I created a calendar draft for the whole family to confirm.",
      cards: [
        {
          type: "calendar_draft",
          title: "Basketball game",
          subtitle: "Friday · 5:30 PM · Leo",
          body: "Calendar draft ready for review.",
          cta: "Review event",
          metadata: { person: "leo", date: "Friday", time: "5:30 PM" },
        },
      ],
      objectsToCreate: [{ type: "calendar_draft", payload: { title: "Basketball game", person: "leo", dateLabel: "Friday", timeLabel: "5:30 PM" } }],
    };
    return auri("Got it — Homekeeper will add it to the family calendar.", { intent: "calendar_event", helper, suggestedFollowups: ["Add Dad as pickup", "Add a reminder"] });
  }

  if (input.includes("read") || input.includes("book") || input.includes("dinosaur")) {
    const helper: ChatHelperSegment = {
      teamMemberId: "companion",
      name: "Companion",
      reply: "I saved this as a reading moment — Mia's really into dinosaurs and volcanoes lately.",
      cards: [
        {
          type: "memory",
          title: "Reading moment",
          subtitle: "Dinosaur Day",
          body: "Saved to Memory",
          cta: "View",
          metadata: { child: "mia", topic: "dinosaurs", source: "reading" },
        },
      ],
      objectsToCreate: [{ type: "memory_item", payload: { person: "mia", title: "Dinosaur Day", sourceType: "reading", topics: ["dinosaurs"] } }],
    };
    return auri("Lovely — Companion will keep that with Mia's reading.", { intent: "reading", helper, suggestedFollowups: ["Find another dinosaur book", "Add to Memory"] });
  }

  if (input.includes("photo") || input.includes("album") || input.includes("video") || input.includes("clip")) {
    const helper: ChatHelperSegment = {
      teamMemberId: "cameraman",
      name: "Cameraman",
      reply: "I pulled together the best moments and made a warm draft to share.",
      cards: [
        {
          type: "story_draft",
          title: "Family album draft",
          subtitle: "2 clips · 14 photos · warm caption",
          body: "Ready to review before sharing.",
          cta: "Open draft",
          metadata: { clips: 2, photos: 14 },
        },
      ],
      objectsToCreate: [{ type: "story_draft", payload: { audience: "family", clips: 2, photos: 14, title: "This week with the kids" } }],
    };
    return auri("On it — Cameraman will put the best bits together.", { intent: "photo_video", helper, suggestedFollowups: ["Make it shorter", "Add the soccer clip"] });
  }

  // 3) Default — warm, not a menu of tasks.
  return auri(
    "I'm here. Ask me anything about the kids or the week — or I can set a reminder, sort your photos into an album, or keep a reading note when you need it.",
    { intent: "general_question", suggestedFollowups: ["How's Mia doing this week?", "Organize my photos", "Set a reminder"] }
  );
}
