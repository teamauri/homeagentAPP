import { NextResponse } from "next/server";
import { ingestRenderedVlog } from "@/lib/auri/ingest";
import type { PersonId } from "@/lib/types";

export const runtime = "nodejs";

// Final hand-off for client-side Auri Cut: the phone sends just { videoId, vlogId }
// after the render finishes. This (fast, Vercel-OK) server step downloads the
// rendered mp4 from auri-editor, stores it (Vercel Blob / local), and creates the
// Memory — no large body passes through the function, no phone→Blob roundtrip.
export async function POST(request: Request) {
  let body: { videoId?: string; vlogId?: string; durationSeconds?: number; title?: string; person?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON { videoId, vlogId }" }, { status: 400 });
  }
  const { videoId, vlogId, durationSeconds, title, person } = body;
  if (!videoId || !vlogId) {
    return NextResponse.json({ error: "videoId and vlogId are required" }, { status: 400 });
  }

  let result: Awaited<ReturnType<typeof ingestRenderedVlog>>;
  try {
    result = await ingestRenderedVlog({
      videoId,
      vlogId,
      durationSeconds,
      title,
      person: (person || "family") as PersonId,
    });
  } catch (e) {
    return NextResponse.json({ error: `Couldn't fetch the rendered film: ${e instanceof Error ? e.message : e}` }, { status: 502 });
  }

  return NextResponse.json({ memoryId: result.memoryId, mediaUrl: result.mediaUrl, durationSeconds: result.durationSeconds });
}
