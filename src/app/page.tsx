"use client";

import { useState } from "react";
import { AppShell, TabKey } from "@/components/AppShell";
import { TodayView } from "@/components/TodayView";
import { ChatView, LiveChatTurn } from "@/components/ChatView";
import { MomentsView } from "@/components/MomentsView";
import { ChatApiResponse, TeamMemberId } from "@/lib/chat-server/types";
import { teamAgentById } from "@/lib/team";

function nowLabel() {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date());
}

function displayHelperName(name: string) {
  return name.split(" the ")[0] || name;
}

export default function Home() {
  const [tab, setTab] = useState<TabKey>("chat");
  const [liveTurns, setLiveTurns] = useState<LiveChatTurn[]>([]);

  const sendComposerMessage = async (message: string) => {
    setTab("chat");
    const sentAt = Date.now();
    const pendingId = `helper-pending-${sentAt}`;

    setLiveTurns((current) => [
      ...current,
      {
        id: `user-${sentAt}`,
        sender: "Mom",
        time: nowLabel(),
        avatar: "mom",
        text: message,
      },
      {
        id: pendingId,
        sender: "Auri",
        time: nowLabel(),
        avatar: "auri",
        text: "Thinking through the best helper...",
        pending: true,
      },
    ]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          familyId: "family_demo",
          userId: "mom_demo",
          message,
          currentPage: tab,
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat API failed with ${response.status}`);
      }

      const payload = (await response.json()) as ChatApiResponse;

      setLiveTurns((current) =>
        current.map((turn) =>
          turn.id === pendingId
            ? {
                id: `helper-${sentAt}`,
                sender: teamAgentById[payload.handledByTeamMemberId]?.name ?? displayHelperName(payload.handledByName),
                time: nowLabel(),
                avatar: payload.handledByTeamMemberId,
                text: payload.reply,
                cards: payload.cards,
              }
            : turn
        )
      );
    } catch {
      setLiveTurns((current) =>
        current.map((turn) =>
          turn.id === pendingId
            ? {
                id: `helper-error-${sentAt}`,
                sender: "Auri",
                time: nowLabel(),
                avatar: "auri",
                text: "I couldn’t reach the helper service. Try again in a moment.",
              }
            : turn
        )
      );
    }
  };

  return (
    <AppShell activeTab={tab} onTabChange={setTab} onComposerSubmit={sendComposerMessage}>
      {tab === "today" && <TodayView />}
      {tab === "chat" && <ChatView liveTurns={liveTurns} />}
      {tab === "memory" && <MomentsView />}
    </AppShell>
  );
}
