import { persistStore, registerStore } from "@/lib/demo/persistence";
import { FamilyMemberProfile, seedFamilyMembers } from "./profile";

// The editable family: names, birthdays, avatar photos. Seeded from the static
// profile, then owned by the Family settings page and persisted (B's store
// layer — survives restart locally via .data, Blob on Vercel).
const g = globalThis as typeof globalThis & { __auriFamily?: FamilyMemberProfile[] };

registerStore({
  key: "family",
  snapshot: () => ({ members: g.__auriFamily }),
  restore: (data) => {
    if (Array.isArray(data.members)) g.__auriFamily = data.members as FamilyMemberProfile[];
  },
});

function members(): FamilyMemberProfile[] {
  if (!g.__auriFamily) g.__auriFamily = seedFamilyMembers.map((m) => ({ ...m }));
  return g.__auriFamily;
}

export function getFamily(): FamilyMemberProfile[] {
  return members();
}

export function getMember(id: string): FamilyMemberProfile | undefined {
  return members().find((m) => m.id === id);
}

export function getChildren(): FamilyMemberProfile[] {
  return members().filter((m) => m.role === "child");
}

export function setFamily(next: FamilyMemberProfile[]): Promise<void> {
  g.__auriFamily = next;
  return persistStore("family");
}
