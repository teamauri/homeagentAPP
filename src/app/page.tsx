"use client";

import { MouseEvent, useEffect, useRef, useState } from "react";
import { AppShell, TabKey } from "@/components/AppShell";
import { JobsView } from "@/components/JobsView";
import { ChatView, LiveChatTurn } from "@/components/ChatView";
import { MomentsView } from "@/components/MomentsView";
import { ChatApiResponse } from "@/lib/chat-server/types";
import { normalizeTeamAgentId, teamAgentById, type TeamAgentId } from "@/lib/team";
import { FamilyProvider, useFamilyMember } from "@/components/FamilyContext";
import { enrichCards } from "@/lib/chat-draft";

const HOME_TAB_KEY = "auri.homeTab.v1";
const HOME_RETURN_KEY = "auri.returnHome.v1";
const HOME_SCROLL_PREFIX = "auri.homeScroll.";

declare global {
  interface Window {
    __auriMarkHomeReturn?: () => void;
  }
}

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

function normalizeLiveAvatar(value: unknown): "mom" | "dad" | TeamAgentId {
  if (value === "mom" || value === "dad") return value;
  return normalizeTeamAgentId(value) ?? "auri";
}

function normalizeLiveTurn(turn: LiveChatTurn): LiveChatTurn {
  const avatar = normalizeLiveAvatar(turn.avatar);
  const agent = avatar === "mom" || avatar === "dad" ? undefined : teamAgentById[avatar];
  return {
    ...turn,
    avatar,
    sender: agent ? agent.name : turn.sender,
  };
}

function HomeInner() {
  const mom = useFamilyMember("mom");
  const senderName = mom?.name ?? "Mom";
  const [tab, setTab] = useState<TabKey>("chat");
  const [liveTurns, setLiveTurns] = useState<LiveChatTurn[]>([]);
  const [liveLoaded, setLiveLoaded] = useState(false);
  const [jobsSubpage, setJobsSubpage] = useState(false);
  const [showCover, setShowCover] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tabRef = useRef<TabKey>("chat");
  const returningHomeRef = useRef(false);
  const liveTurnCountRef = useRef<number | null>(null);

  const scrollKey = (targetTab: TabKey) => `${HOME_SCROLL_PREFIX}${targetTab}.v1`;

  const saveScrollForTab = (targetTab: TabKey = tabRef.current) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    try {
      sessionStorage.setItem(scrollKey(targetTab), String(el.scrollTop));
      sessionStorage.setItem(HOME_TAB_KEY, targetTab);
    } catch { /* ignore */ }
  };

  const restoreScrollForTab = (targetTab: TabKey, allowRestore: boolean) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      try {
        const saved = allowRestore ? sessionStorage.getItem(scrollKey(targetTab)) : null;
        if (saved !== null) {
          el.scrollTop = Number(saved);
        } else {
          el.scrollTop = targetTab === "chat" ? el.scrollHeight : 0;
        }
      } catch {
        el.scrollTop = targetTab === "chat" ? el.scrollHeight : 0;
      }
    });
  };

  useEffect(() => {
    const id = window.setTimeout(() => setShowCover(false), 3000);
    return () => window.clearTimeout(id);
  }, []);

  // Cold launch always enters Chat. A return from a child route restores the
  // tab that initiated navigation, so Back lands where the action started.
  useEffect(() => {
    let returningHome = false;
    try {
      returningHome = sessionStorage.getItem(HOME_RETURN_KEY) === "1";
      returningHomeRef.current = returningHome;
      sessionStorage.removeItem(HOME_RETURN_KEY);
      if (returningHome) {
        const savedTab = sessionStorage.getItem(HOME_TAB_KEY) as TabKey | null;
        if (savedTab === "chat" || savedTab === "today" || savedTab === "memory") {
          tabRef.current = savedTab;
          setTab(savedTab);
        }
      } else {
        sessionStorage.removeItem(HOME_TAB_KEY);
      }
    } catch { /* ignore */ }
    try {
      const raw = sessionStorage.getItem("auri.liveTurns.v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const migrated = parsed.map((turn) => normalizeLiveTurn(turn as LiveChatTurn));
          sessionStorage.setItem("auri.liveTurns.v1", JSON.stringify(migrated));
          setLiveTurns(migrated);
        }
      }
    } catch {
      // ignore malformed storage
    }
    setLiveLoaded(true);
  }, []);

  // On cold load, Chat starts at the newest message. Other tabs start at top.
  // When returning from another route, restore that tab's saved scroll offset.
  useEffect(() => {
    if (!liveLoaded) return;
    restoreScrollForTab(tabRef.current, returningHomeRef.current);

    const saveScroll = () => {
      saveScrollForTab(tabRef.current);
    };
    window.addEventListener("pagehide", saveScroll);
    return () => window.removeEventListener("pagehide", saveScroll);
  }, [liveLoaded]);

  const markReturnFromChildRoute = () => {
    saveScrollForTab(tabRef.current);
    try {
      sessionStorage.setItem(HOME_RETURN_KEY, "1");
    } catch { /* ignore */ }
  };

  const handleHomeClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as Element | null;
    const anchor = target?.closest("a[href]");
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!href || href === "/" || href.startsWith("#")) return;
    try {
      const url = new URL(href, window.location.href);
      if (url.origin === window.location.origin && url.pathname !== "/") {
        markReturnFromChildRoute();
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    window.__auriMarkHomeReturn = markReturnFromChildRoute;
    return () => {
      if (window.__auriMarkHomeReturn === markReturnFromChildRoute) {
        delete window.__auriMarkHomeReturn;
      }
    };
  });

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const save = () => saveScrollForTab(tabRef.current);
    el.addEventListener("scroll", save, { passive: true });
    return () => el.removeEventListener("scroll", save);
  }, [liveLoaded]);

  useEffect(() => {
    try {
      sessionStorage.setItem(HOME_TAB_KEY, tab);
    } catch { /* ignore */ }
  }, [tab]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") saveScrollForTab(tabRef.current);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // Scroll to bottom whenever a new live turn arrives (user sent or Auri replied).
  useEffect(() => {
    if (!liveLoaded) return;
    const previousCount = liveTurnCountRef.current;
    liveTurnCountRef.current = liveTurns.length;
    if (previousCount === null || liveTurns.length <= previousCount) return;
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
    saveScrollForTab(tabRef.current);
    tabRef.current = next;
    setTab(next);
    try { sessionStorage.setItem(HOME_TAB_KEY, next); } catch { /* ignore */ }
    restoreScrollForTab(next, true);
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
        text: "Just a second...",
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
          const helperAgent = normalizeLiveAvatar(helper.teamMemberId);
          const helperTurn: LiveChatTurn = {
            id: `helper-${sentAt}`,
            sender: helperAgent === "mom" || helperAgent === "dad" ? displayHelperName(helper.name) : teamAgentById[helperAgent].name,
            time: nowLabel(),
            avatar: helperAgent,
            text: helper.reply,
            cards: enrichCards(helper.cards, helper.objectsToCreate, payload.createdLocalObjects, payload.objectsToCreate?.length ?? 0),
            createdAt: sentAt,
          };
          return current.map((turn) => turn.id === pendingId ? helperTurn : turn);
        }

        // No helper → Auri is the sole voice (advice / general question).
        const handledAvatar = normalizeLiveAvatar(payload.handledByTeamMemberId);
        return current.map((turn) =>
          turn.id === pendingId
            ? normalizeLiveTurn({
                id: `auri-${sentAt}`,
                sender: handledAvatar === "mom" || handledAvatar === "dad" ? displayHelperName(payload.handledByName) : teamAgentById[handledAvatar].name,
                time: nowLabel(),
                avatar: handledAvatar,
                text: payload.reply,
                cards: enrichCards(payload.cards, payload.objectsToCreate, payload.createdLocalObjects, 0),
                createdAt: sentAt,
              })
            : turn
        );
      });
    } catch {
      setLiveTurns((current) =>
        current.map((turn) =>
          turn.id === pendingId
            ? {
                id: `helper-error-${sentAt}`,
                sender: "System",
                time: nowLabel(),
                avatar: "auri",
                text: "Something took too long. Try again in a moment.",
                createdAt: sentAt,
              }
            : turn
        )
      );
    }
  };

  return (
    <div onClickCapture={handleHomeClickCapture}>
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
        {showCover && tab === "chat" ? <AuriCover /> : null}
      </AppShell>
    </div>
  );
}

function AuriCover() {
  return (
    <div className="absolute inset-0 z-20 bg-paper">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/agents/auri-agent-team.png" alt="" className="h-full w-full object-cover" style={{ objectPosition: "50% 45%" }} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/5 to-black/45" />
      <div className="absolute bottom-[max(4.8rem,env(safe-area-inset-bottom))] left-0 right-0 px-[26px] text-white">
        <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-white/80">Auri Home</p>
        <h1 className="mt-2 font-display text-[36px] font-normal leading-[0.96] tracking-[-0.01em]">Getting the house ready</h1>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <FamilyProvider>
      <HomeInner />
    </FamilyProvider>
  );
}
