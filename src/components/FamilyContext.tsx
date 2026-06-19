"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { FamilyMemberProfile } from "@/lib/family/profile";

// Client-side family data so the functional pages (chat, memory) can show the
// names and profile photos edited on the Family settings page. Fetched once on
// mount; since /family is a separate route, returning home remounts this and
// picks up a fresh save.
const FamilyContext = createContext<Record<string, FamilyMemberProfile>>({});

export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const [byId, setById] = useState<Record<string, FamilyMemberProfile>>({});

  useEffect(() => {
    fetch("/api/family", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.members)) {
          setById(Object.fromEntries((data.members as FamilyMemberProfile[]).map((m) => [m.id, m])));
        }
      })
      .catch(() => {});
  }, []);

  return <FamilyContext.Provider value={byId}>{children}</FamilyContext.Provider>;
}

export function useFamilyMember(id?: string): FamilyMemberProfile | undefined {
  const byId = useContext(FamilyContext);
  return id ? byId[id] : undefined;
}
