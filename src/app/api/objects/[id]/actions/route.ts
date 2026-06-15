import { NextResponse } from "next/server";
import { applyDemoObjectAction } from "@/lib/demo/demo-store";

export const runtime = "nodejs";

const allowedActions = ["add", "save", "send", "log", "complete"] as const;
type AllowedAction = (typeof allowedActions)[number];

function normalizeAction(value: unknown): AllowedAction {
  return allowedActions.includes(value as AllowedAction) ? (value as AllowedAction) : "add";
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const action = normalizeAction(body && typeof body === "object" ? (body as { action?: unknown }).action : undefined);
  const object = applyDemoObjectAction(params.id, action);

  if (!object) {
    return NextResponse.json({ error: "Object not found" }, { status: 404 });
  }

  return NextResponse.json({
    object,
    statusLabel:
      object.status === "sent"
        ? "Sent locally"
        : object.status === "logged"
          ? "Logged locally"
          : object.status === "saved"
            ? "Saved locally"
            : "Added locally",
    metadata: {
      provider: "local-demo-store",
      externalWrite: "mocked",
    },
  });
}
