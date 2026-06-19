"use client";

import { useState } from "react";
import { AppShell, TabKey } from "@/components/AppShell";
import { TodayView } from "@/components/TodayView";
import { ChatView, LiveChatTurn } from "@/components/ChatView";
import { MomentsView } from "@/components/MomentsView";
import { ChatApiResponse, TeamMemberId } from "@/lib/chat-server/types";
import { teamAgentById } from "@/lib/team";
import { FamilyProvider } from "@/components/FamilyContext";

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

  const sendComposerMessage = async (message: string, imageUrl?: string) => {
    setTab("chat");
    const sentAt = Date.now();
    const pendingId = `helper-pending-${sentAt}`;
    const outgoing = message || (imageUrl ? "📷 Photo" : "");

    setLiveTurns((current) => [
      ...current,
      {
        id: `user-${sentAt}`,
        sender: "Mom",
        time: nowLabel(),
        avatar: "mom",
        text: outgoing,
        imageUrl,
      },
      {
        id: pendingId,
        sender: "Auri",
        time: nowLabel(),
        avatar: "auri",
        text: "Auri is thinking…",
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
          message: outgoing,
          currentPage: tab,
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat API failed with ${response.status}`);
      }

      const payload = (await response.json()) as ChatApiResponse;
      const auriId = `auri-${sentAt}`;

      setLiveTurns((current) => {
        // Replace the pending bubble with Auri's voice (the primary answer).
        const next = current.map((turn) =>
          turn.id === pendingId
            ? {
                id: auriId,
                sender: teamAgentById[payload.handledByTeamMemberId]?.name ?? displayHelperName(payload.handledByName),
                time: nowLabel(),
                avatar: payload.handledByTeamMemberId,
                text: payload.reply,
                cards: payload.cards,
              }
            : turn
        );

        // If a helper took the task, add it as a second bubble right after Auri.
        if (payload.helper) {
          const helper = payload.helper;
          const helperTurn: LiveChatTurn = {
            id: `helper-${sentAt}`,
            sender: teamAgentById[helper.teamMemberId]?.name ?? displayHelperName(helper.name),
            time: nowLabel(),
            avatar: helper.teamMemberId,
            text: helper.reply,
            cards: helper.cards,
          };
          const idx = next.findIndex((turn) => turn.id === auriId);
          return [...next.slice(0, idx + 1), helperTurn, ...next.slice(idx + 1)];
        }
        return next;
      });
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
    <FamilyProvider>
      <AppShell activeTab={tab} onTabChange={setTab} onComposerSubmit={sendComposerMessage}>
        {/*
          Keep every tab mounted and just toggle visibility. Conditional rendering
          (`tab === x && <View/>`) unmounts the inactive views, which made Memory
          re-fetch /api/memory/growth on every visit and discarded scroll state.
          Hiding with `hidden` preserves each view's state between tab switches.
        */}
        <div className={tab === "today" ? "" : "hidden"}>
          <TodayView />
        </div>
        <div className={tab === "chat" ? "" : "hidden"}>
          <ChatView liveTurns={liveTurns} />
        </div>
        <div className={tab === "memory" ? "" : "hidden"}>
          <MomentsView />
        </div>
      </AppShell>
    </FamilyProvider>
  );
}
