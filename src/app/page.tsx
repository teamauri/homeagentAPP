"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell, TabKey } from "@/components/AppShell";
import { JobsView } from "@/components/JobsView";
import { ChatView, LiveChatTurn } from "@/components/ChatView";
import { MomentsView } from "@/components/MomentsView";
import { ChatApiResponse, TeamMemberId } from "@/lib/chat-server/types";
import { teamAgentById } from "@/lib/team";
import { FamilyProvider, useFamilyMember } from "@/components/FamilyContext";
import { enrichCards } from "@/lib/chat-draft";

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

function HomeInner() {
  const mom = useFamilyMember("mom");
  const senderName = mom?.name ?? "Mom";
  const [tab, setTab] = useState<TabKey>("chat");
  const [liveTurns, setLiveTurns] = useState<LiveChatTurn[]>([]);
  const [liveLoaded, setLiveLoaded] = useState(false);
  const [jobsSubpage, setJobsSubpage] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Persist both the active tab and the chat thread so full-page navigations
  // (e.g. tapping "View calendar" or opening a memory detail) return the user
  // to exactly where they left off.
  useEffect(() => {
    try {
      const savedTab = sessionStorage.getItem("auri.tab.v1") as TabKey | null;
      if (savedTab && ["today", "chat", "memory"].includes(savedTab)) setTab(savedTab);
    } catch { /* ignore */ }
    try {
      const raw = sessionStorage.getItem("auri.liveTurns.v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setLiveTurns(parsed);
      }
    } catch {
      // ignore malformed storage
    }
    setLiveLoaded(true);
  }, []);

  // On load: restore the scroll position saved before a full-page navigation
  // (back from /calendar, /family, etc.) or, if none saved, jump to the bottom
  // of chat so the latest message is always visible. Also save position on leave.
  useEffect(() => {
    if (!liveLoaded) return;
    const el = scrollContainerRef.current;
    if (!el) return;

    // rAF lets the browser finish painting all content before we scroll, so
    // scrollHeight is accurate for both restore and scroll-to-bottom.
    requestAnimationFrame(() => {
      try {
        const savedScroll = sessionStorage.getItem("auri.scrollTop.v1");
        sessionStorage.removeItem("auri.scrollTop.v1");
        if (savedScroll !== null) {
          el.scrollTop = Number(savedScroll);
        } else {
          el.scrollTop = el.scrollHeight;
        }
      } catch { /* ignore */ }
    });

    const saveScroll = () => {
      try {
        sessionStorage.setItem("auri.scrollTop.v1", String(el.scrollTop));
      } catch { /* ignore */ }
    };
    window.addEventListener("beforeunload", saveScroll);
    return () => window.removeEventListener("beforeunload", saveScroll);
  }, [liveLoaded]);

  // Scroll to bottom whenever a new live turn arrives (user sent or Auri replied).
  useEffect(() => {
    if (!liveLoaded) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }, [liveTurns.length, liveLoaded]);

  useEffect(() => {
    if (!liveLoaded) return;
    try {
      // Drop transient "thinking…" bubbles so they don't restore as stuck spinners.
      sessionStorage.setItem("auri.liveTurns.v1", JSON.stringify(liveTurns.filter((turn) => !turn.pending)));
    } catch {
      // ignore quota / serialization failures
    }
  }, [liveTurns, liveLoaded]);

  const switchTab = (next: TabKey) => {
    setTab(next);
    try { sessionStorage.setItem("auri.tab.v1", next); } catch { /* ignore */ }
  };

  const sendComposerMessage = async (message: string, imageUrl?: string) => {
    switchTab("chat");
    const sentAt = Date.now();
    const pendingId = `helper-pending-${sentAt}`;
    const outgoing = message || (imageUrl ? "📷 Photo" : "");

    setLiveTurns((current) => [
      ...current,
      {
        id: `user-${sentAt}`,
        sender: senderName,
        time: nowLabel(),
        avatar: "mom",
        text: outgoing,
        imageUrl,
        createdAt: sentAt,
      },
      {
        id: pendingId,
        sender: "Auri",
        time: nowLabel(),
        avatar: "auri",
        text: "Auri is thinking…",
        pending: true,
        createdAt: sentAt,
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
        // When a helper took the task, skip Auri's framing sentence entirely and
        // show only the helper's bubble. Auri only appears for advice/questions
        // where there is no helper.
        if (payload.helper) {
          const helper = payload.helper;
          const helperTurn: LiveChatTurn = {
            id: `helper-${sentAt}`,
            sender: teamAgentById[helper.teamMemberId]?.name ?? displayHelperName(helper.name),
            time: nowLabel(),
            avatar: helper.teamMemberId,
            text: helper.reply,
            cards: enrichCards(helper.cards, helper.objectsToCreate, payload.createdLocalObjects, payload.objectsToCreate?.length ?? 0),
            createdAt: sentAt,
          };
          return current.map((turn) => turn.id === pendingId ? helperTurn : turn);
        }

        // No helper → Auri is the sole voice (advice / general question).
        return current.map((turn) =>
          turn.id === pendingId
            ? {
                id: `auri-${sentAt}`,
                sender: teamAgentById[payload.handledByTeamMemberId]?.name ?? displayHelperName(payload.handledByName),
                time: nowLabel(),
                avatar: payload.handledByTeamMemberId,
                text: payload.reply,
                cards: enrichCards(payload.cards, payload.objectsToCreate, payload.createdLocalObjects, 0),
                createdAt: sentAt,
              }
            : turn
        );
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
                createdAt: sentAt,
              }
            : turn
        )
      );
    }
  };

  return (
    <AppShell activeTab={tab} onTabChange={switchTab} onComposerSubmit={sendComposerMessage} hideHeader={tab === "today" && jobsSubpage} scrollContainerRef={scrollContainerRef}>
        {/*
          Keep every tab mounted and just toggle visibility. Conditional rendering
          (`tab === x && <View/>`) unmounts the inactive views, which made Memory
          re-fetch /api/memory/growth on every visit and discarded scroll state.
          Hiding with `hidden` preserves each view's state between tab switches.
        */}
        <div className={tab === "today" ? "" : "hidden"}>
          <JobsView onRunActivity={() => switchTab("chat")} onSubpageChange={setJobsSubpage} />
        </div>
        <div className={tab === "chat" ? "" : "hidden"}>
          <ChatView liveTurns={liveTurns} />
        </div>
        <div className={tab === "memory" ? "" : "hidden"}>
          <MomentsView />
        </div>
      </AppShell>
  );
}

export default function Home() {
  return (
    <FamilyProvider>
      <HomeInner />
    </FamilyProvider>
  );
}
