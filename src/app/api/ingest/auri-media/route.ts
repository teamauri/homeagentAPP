import { NextResponse } from "next/server";
import { addDemoMedia, createDemoMemoryFromMedia, DemoMediaInput } from "@/lib/demo/demo-store";
import { isFile, storeUploadedFile } from "@/lib/demo/media-storage";

export const runtime = "nodejs";

function normalizeAuriInputs(body: any): DemoMediaInput[] {
  const rawItems = Array.isArray(body?.media) ? body.media : Array.isArray(body?.clips) ? body.clips : Array.isArray(body?.items) ? body.items : [body];

  return rawItems.map((item: DemoMediaInput, index: number) => ({
    title: item.title || body?.title || `Auri Robot clip ${index + 1}`,
    body: item.body || body?.body || "Auri Robot captured a family moment.",
    person: item.person || body?.person || "family",
    mediaType: item.mediaType || item.type || "clip",
    url: item.url,
    thumbnailUrl: item.thumbnailUrl,
    capturedAt: item.capturedAt || body?.capturedAt,
    durationSeconds: item.durationSeconds,
    tags: item.tags || body?.tags || ["auri-robot"],
    metadata: {
      robotId: body?.robotId || "auri_living_room",
      room: body?.room || "Living Room",
      ingestMode: "auri-robot-demo",
      ...(item.metadata || {}),
    },
  }));
}

// Multipart ingest: real story video + highlight images uploaded from DockKit.
// Fields: video (story .mp4), images (one or more highlight images), plus
// metadata fields memoryTitle/memoryBody/person/robotId/room/capturedAt/tags.
async function inputsFromFormData(formData: FormData): Promise<DemoMediaInput[]> {
  // addDemoMedia coerces unknown persons to "family" at runtime; cast for the input type.
  const person = String(formData.get("person") || "family") as DemoMediaInput["person"];
  const robotId = String(formData.get("robotId") || "auri_living_room");
  const room = String(formData.get("room") || "Living Room");
  const capturedAt = (formData.get("capturedAt") as string) || undefined;
  const tagsRaw = String(formData.get("tags") || "");
  const tags = tagsRaw ? tagsRaw.split(",").map((tag) => tag.trim()).filter(Boolean) : ["auri-robot"];

  const videoFile = formData.get("video");
  const imageFiles = formData.getAll("images").filter(isFile);

  // Store highlight images first so the video can reference one as its thumbnail.
  const storedImages = await Promise.all(imageFiles.map((file) => storeUploadedFile(file)));
  const thumbnailUrl = storedImages[0]?.url;

  const inputs: DemoMediaInput[] = [];

  if (isFile(videoFile)) {
    const storedVideo = await storeUploadedFile(videoFile);
    inputs.push({
      title: String(formData.get("memoryTitle") || formData.get("title") || "Auri Robot story"),
      body: String(formData.get("memoryBody") || formData.get("body") || "A new Story is ready from Auri Robot."),
      person,
      mediaType: "video",
      url: storedVideo.url,
      thumbnailUrl,
      capturedAt,
      tags,
      metadata: { robotId, room, ingestMode: "auri-robot-story", mimeType: storedVideo.mimeType, size: storedVideo.size, storage: storedVideo.storage },
    });
  }

  storedImages.forEach((image, index) => {
    inputs.push({
      title: `Highlight ${index + 1}`,
      body: "Auri Robot story highlight.",
      person,
      mediaType: "photo",
      url: image.url,
      thumbnailUrl: image.url,
      capturedAt,
      tags: [...tags, "highlight"],
      metadata: { robotId, room, ingestMode: "auri-robot-highlight", mimeType: image.mimeType, size: image.size, storage: image.storage },
    });
  });

  return inputs;
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  let inputs: DemoMediaInput[];
  let memoryOptions: { title?: string; body?: string } = {};

  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      inputs = await inputsFromFormData(formData);
      memoryOptions = {
        title: String(formData.get("memoryTitle") || formData.get("title") || "") || undefined,
        body: String(formData.get("memoryBody") || formData.get("body") || "") || undefined,
      };
    } else {
      const body = await request.json();
      inputs = normalizeAuriInputs(body);
      memoryOptions = { title: body?.memoryTitle || body?.title, body: body?.memoryBody };
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid ingest request", detail: error instanceof Error ? error.message : "Unable to parse request" },
      { status: 400 }
    );
  }

  if (!inputs.length) {
    return NextResponse.json({ error: "Provide at least one Auri media item or file" }, { status: 400 });
  }

  const media = addDemoMedia(inputs, "auri");
  const memory = createDemoMemoryFromMedia(media, {
    title: memoryOptions.title || "New memory from Auri Robot",
    body:
      memoryOptions.body || `${media.length} Auri Robot ${media.length === 1 ? "item is" : "items are"} ready in Memory.`,
    status: "ready",
    statusLabel: "Ready",
  });

  const storage = media.find((item) => typeof item.metadata?.storage === "string")?.metadata?.storage;

  return NextResponse.json({
    media,
    memory,
    metadata: {
      provider: "local-demo-store",
      externalRobotSync: storage ?? "mocked",
    },
  });
}
