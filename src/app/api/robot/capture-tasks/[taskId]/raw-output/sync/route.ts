import { NextResponse } from "next/server";
import { ensureHydrated, reloadStore } from "@/lib/demo/persistence";
import { syncRawOutputForTask } from "@/lib/robot/raw-output-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: { taskId: string } }) {
  await ensureHydrated();
  await reloadStore("demo");
  const { httpStatus, ...body } = await syncRawOutputForTask(params.taskId);
  return NextResponse.json(body, { status: httpStatus });
}
