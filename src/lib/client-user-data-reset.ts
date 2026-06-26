"use client";

const RESET_MARKER_KEY = "auri.userDataReset.20260626.all";

const LOCAL_STORAGE_KEYS = [
  "auri.family.v1",
  "auri.events.v1",
  "auri.deletedIds.v1",
  "auri.standing.v1",
  "auri.agentProfiles.v1",
  "auri.agentProfiles.v2",
];

const SESSION_STORAGE_KEYS = [
  "auri.liveTurns.v1",
  "auri.draftStates.v1",
  "auri.growth.v1",
  "auri.job.v1",
  "auri.homeTab.v1",
  "auri.returnHome.v1",
  "auri.coverSeen.v1",
];

function removeMatching(storage: Storage, prefixes: string[]) {
  for (let i = storage.length - 1; i >= 0; i -= 1) {
    const key = storage.key(i);
    if (key && prefixes.some((prefix) => key.startsWith(prefix))) {
      storage.removeItem(key);
    }
  }
}

export function resetClientUserDataOnce() {
  if (typeof window === "undefined") return;

  try {
    if (window.localStorage.getItem(RESET_MARKER_KEY) === "1") return;
  } catch {
    // Continue with session cleanup when localStorage is unavailable.
  }

  try {
    LOCAL_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
    removeMatching(window.localStorage, ["auri.homeScroll."]);
    window.localStorage.setItem(RESET_MARKER_KEY, "1");
  } catch {
    // ignore storage failures
  }

  try {
    SESSION_STORAGE_KEYS.forEach((key) => window.sessionStorage.removeItem(key));
    removeMatching(window.sessionStorage, ["auri.homeScroll."]);
  } catch {
    // ignore storage failures
  }
}
