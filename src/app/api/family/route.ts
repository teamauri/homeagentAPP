import { NextResponse } from "next/server";
import { getFamily, setFamily } from "@/lib/family/store";
import { FamilyMemberProfile, FamilyRole } from "@/lib/family/profile";
import { ensureHydrated } from "@/lib/demo/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES: FamilyRole[] = ["parent", "child", "baby", "extended_family"];

function normalize(value: unknown): FamilyMemberProfile[] | null {
  if (!Array.isArray(value)) return null;
  const members: FamilyMemberProfile[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const m = raw as Record<string, unknown>;
    if (typeof m.id !== "string" || typeof m.name !== "string") continue;
    members.push({
      id: m.id,
      name: m.name,
      role: ROLES.includes(m.role as FamilyRole) ? (m.role as FamilyRole) : "child",
      ageLabel: typeof m.ageLabel === "string" ? m.ageLabel : undefined,
      birthday: typeof m.birthday === "string" ? m.birthday : undefined,
      avatar: typeof m.avatar === "string" ? m.avatar : "girl",
      avatarUrl: typeof m.avatarUrl === "string" ? m.avatarUrl : undefined,
      interests: Array.isArray(m.interests) ? (m.interests as string[]).filter((s) => typeof s === "string") : [],
      routines: Array.isArray(m.routines) ? (m.routines as string[]).filter((s) => typeof s === "string") : [],
      health: Array.isArray(m.health) ? (m.health as string[]).filter((s) => typeof s === "string") : [],
    });
  }
  return members;
}

export async function GET() {
  await ensureHydrated();
  return NextResponse.json({ members: getFamily() });
}

export async function PUT(request: Request) {
  await ensureHydrated();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const members = normalize((body as { members?: unknown })?.members);
  if (!members || !members.length) {
    return NextResponse.json({ error: "Provide members[]" }, { status: 400 });
  }
  await setFamily(members);
  return NextResponse.json({ members: getFamily() });
}
