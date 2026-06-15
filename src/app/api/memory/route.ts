import { NextResponse } from "next/server";
import { listDemoMedia, listDemoMemory } from "@/lib/demo/demo-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sourceType = url.searchParams.get("sourceType");
  const person = url.searchParams.get("person");
  const limit = Number(url.searchParams.get("limit") || 50);

  const media = listDemoMedia();
  const items = listDemoMemory()
    .filter((item) => (sourceType ? item.sourceType === sourceType : true))
    .filter((item) => (person ? item.person === person : true))
    .slice(0, Number.isFinite(limit) && limit > 0 ? limit : 50);

  return NextResponse.json({
    items,
    media,
    summary: {
      totalItems: items.length,
      totalMedia: media.length,
      auriMedia: media.filter((item) => item.source === "auri").length,
      phoneMedia: media.filter((item) => item.source === "phone").length,
    },
    metadata: {
      provider: "local-demo-store",
      externalPhotosSync: "mocked",
    },
  });
}
