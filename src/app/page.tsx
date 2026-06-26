"use client";

import { MouseEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
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
const HOME_TABS: TabKey[] = ["chat", "today", "memory"];
const COVER_MIN_MS = 1800;

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
  const visitedTabsRef = useRef<Set<TabKey>>(new Set(["chat"]));
  const pendingRestoreRef = useRef<{ tab: TabKey; allowRestore: boolean } | null>(null);
  const jobsSubpageRef = useRef(false);
  const coverStartedAtRef = useRef(Date.now());

  const scrollKey = (targetTab: TabKey) => `${HOME_SCROLL_PREFIX}${targetTab}.v1`;

  const saveScrollForTab = (targetTab: TabKey = tabRef.current) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    try {
      sessionStorage.setItem(scrollKey(targetTab), String(el.scrollTop));
      sessionStorage.setItem(HOME_TAB_KEY, targetTab);
    } catch { /* ignore */ }
  };

  const saveVisibleTabScroll = () => {
    if (tabRef.current === "today" && jobsSubpageRef.current) return;
    saveScrollForTab(tabRef.current);
  };

  const defaultScrollForTab = (targetTab: TabKey, el: HTMLDivElement) => (
    targetTab === "chat" ? el.scrollHeight - el.clientHeight : 0
  );

  const restoreScrollForTab = (targetTab: TabKey, allowRestore: boolean) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const apply = () => {
      try {
        const saved = allowRestore ? sessionStorage.getItem(scrollKey(targetTab)) : null;
        if (saved !== null) {
          el.scrollTop = Number(saved);
        } else {
          el.scrollTop = defaultScrollForTab(targetTab, el);
        }
      } catch {
        el.scrollTop = defaultScrollForTab(targetTab, el);
      }
    };
    // Restore after the tab content is committed, then again after async layout
    // work (images/data hydration) has had a chance to affect scrollHeight.
    requestAnimationFrame(() => {
      apply();
      requestAnimationFrame(apply);
      window.setTimeout(apply, 250);
    });
  };

  useEffect(() => {
    if (!liveLoaded) return;
    const remaining = Math.max(0, COVER_MIN_MS - (Date.now() - coverStartedAtRef.current));
    const id = window.setTimeout(() => setShowCover(false), remaining);
    return () => window.clearTimeout(id);
  }, [liveLoaded]);

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
        HOME_TABS.forEach((homeTab) => sessionStorage.removeItem(scrollKey(homeTab)));
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
    const initialTab = tabRef.current;
    visitedTabsRef.current.add(initialTab);
    restoreScrollForTab(initialTab, returningHomeRef.current);

    const saveScroll = () => {
      saveVisibleTabScroll();
    };
    window.addEventListener("pagehide", saveScroll);
    return () => window.removeEventListener("pagehide", saveScroll);
  }, [liveLoaded]);

  useLayoutEffect(() => {
    if (!liveLoaded) return;
    const pending = pendingRestoreRef.current;
    if (!pending || pending.tab !== tab) return;
    pendingRestoreRef.current = null;
    restoreScrollForTab(pending.tab, pending.allowRestore);
  }, [tab, liveLoaded]);

  useLayoutEffect(() => {
    if (!liveLoaded || tab !== "today") {
      jobsSubpageRef.current = jobsSubpage;
      return;
    }
    const wasSubpage = jobsSubpageRef.current;
    jobsSubpageRef.current = jobsSubpage;
    if (!wasSubpage && jobsSubpage) {
      requestAnimationFrame(() => {
        const el = scrollContainerRef.current;
        if (el && tabRef.current === "today") el.scrollTop = 0;
      });
      return;
    }
    if (wasSubpage && !jobsSubpage) {
      restoreScrollForTab("today", true);
    }
  }, [jobsSubpage, liveLoaded, tab]);

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
    const save = () => saveVisibleTabScroll();
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
      if (document.visibilityState === "hidden") saveVisibleTabScroll();
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
    if (next === tabRef.current) return;
    saveScrollForTab(tabRef.current);
    const allowRestore = visitedTabsRef.current.has(next);
    visitedTabsRef.current.add(next);
    tabRef.current = next;
    pendingRestoreRef.current = { tab: next, allowRestore };
    setTab(next);
    try { sessionStorage.setItem(HOME_TAB_KEY, next); } catch { /* ignore */ }
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
          const helperDefaultAgent = helperAgent === "mom" || helperAgent === "dad" ? undefined : helperAgent;
          const helperTurn: LiveChatTurn = {
            id: `helper-${sentAt}`,
            sender: helperAgent === "mom" || helperAgent === "dad" ? displayHelperName(helper.name) : teamAgentById[helperAgent].name,
            time: nowLabel(),
            avatar: helperAgent,
            text: helper.reply,
            cards: enrichCards(helper.cards, helper.objectsToCreate, payload.createdLocalObjects, payload.objectsToCreate?.length ?? 0, helperDefaultAgent),
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
          <JobsView
            onSubpageChange={setJobsSubpage}
            onBeforeSubpageOpen={() => {
              saveScrollForTab("today");
              jobsSubpageRef.current = true;
            }}
          />
        </div>
        <div className={tab === "chat" ? "" : "hidden"}>
          <ChatView liveTurns={liveTurns} />
        </div>
        <div className={tab === "memory" ? "" : "hidden"}>
          <MomentsView />
        </div>
        {showCover && tab === "chat" ? <AuriCover onDismiss={() => setShowCover(false)} /> : null}
      </AppShell>
    </div>
  );
}

function AuriCover({ onDismiss }: { onDismiss: () => void }) {
  return (
    <button type="button" onClick={onDismiss} className="absolute inset-0 z-20 bg-paper text-left" aria-label="Enter Auri">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/agents/auri-app-cover.png" alt="" className="h-full w-full object-cover" style={{ objectPosition: "50% 50%" }} />
    </button>
  );
}

export default function Home() {
  return (
    <FamilyProvider>
      <HomeInner />
    </FamilyProvider>
  );
}
