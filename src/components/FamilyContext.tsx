"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { resetClientUserDataOnce } from "@/lib/client-user-data-reset";
import type { FamilyMemberProfile } from "@/lib/family/profile";

// Client-side family data so the functional pages (chat, memory) can show the
// names and profile photos edited on the Family settings page. Fetched once on
// mount; since /family is a separate route, returning home remounts this and
// picks up a fresh save.
const FamilyContext = createContext<Record<string, FamilyMemberProfile>>({});

const LS_KEY = "auri.family.v1";
const CANONICAL_PARENT_DATA: Record<string, Pick<FamilyMemberProfile, "name" | "avatarUrl">> = {
  mom: { name: "Jane", avatarUrl: "/family/jane.jpg" },
  dad: { name: "Liang", avatarUrl: "/family/liang.jpg" },
};

function withCanonicalParentData(members: FamilyMemberProfile[]): FamilyMemberProfile[] {
  return members.map((member) => (
    CANONICAL_PARENT_DATA[member.id]
      ? { ...member, ...CANONICAL_PARENT_DATA[member.id] }
      : member
  ));
}

export function loadFamilyFromStorage(): FamilyMemberProfile[] | null {
  resetClientUserDataOnce();
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? withCanonicalParentData(parsed) : null;
  } catch { return null; }
}

export function saveFamilyToStorage(members: FamilyMemberProfile[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(members)); } catch { /* quota */ }
}

export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const [byId, setById] = useState<Record<string, FamilyMemberProfile>>(() => {
    // Seed immediately from localStorage so UI doesn't flash seed names
    const local = typeof window !== "undefined" ? loadFamilyFromStorage() : null;
    return local ? Object.fromEntries(local.map((m) => [m.id, m])) : {};
  });

  useEffect(() => {
    fetch("/api/family", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data.members)) return;
        const local = loadFamilyFromStorage();
        // Prefer localStorage (user edits) over server seed; merge avatarUrls from server
        const merged = local ?? withCanonicalParentData(data.members);
        setById(Object.fromEntries((merged as FamilyMemberProfile[]).map((m) => [m.id, m])));
      })
      .catch(() => {});
  }, []);

  return <FamilyContext.Provider value={byId}>{children}</FamilyContext.Provider>;
}

export function useFamilyMember(id?: string): FamilyMemberProfile | undefined {
  const byId = useContext(FamilyContext);
  return id ? byId[id] : undefined;
}

export function useFamilyMembers(): FamilyMemberProfile[] {
  const byId = useContext(FamilyContext);
  return Object.values(byId);
}

/** Children, oldest first (by birthday). Drives the per-child tabs in Memory. */
export function useChildren(): FamilyMemberProfile[] {
  const byId = useContext(FamilyContext);
  return Object.values(byId)
    .filter((m) => m.role === "child" || m.role === "baby")
    .sort((a, b) => (a.birthday ?? "9999") < (b.birthday ?? "9999") ? -1 : 1);
}

export function useParents(): FamilyMemberProfile[] {
  const byId = useContext(FamilyContext);
  return Object.values(byId).filter((m) => m.role === "parent");
}
