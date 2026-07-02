import { NextResponse } from "next/server";
import { persistDemoStore, resetChatHistoryStore } from "@/lib/demo/demo-store";
import { ensureHydrated } from "@/lib/demo/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await ensureHydrated();
  try {
    resetChatHistoryStore();
    await persistDemoStore();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Reset failed" }, { status: 500 });
  }
}
