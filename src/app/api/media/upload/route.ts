import { NextResponse } from "next/server";
import { addDemoMedia, createDemoMemoryFromMedia, DemoMediaInput, persistDemoStore } from "@/lib/demo/demo-store";
import { ensureHydrated } from "@/lib/demo/persistence";
import { PersonId } from "@/lib/types";

export const runtime = "nodejs";

async function inputsFromJson(request: Request): Promise<DemoMediaInput[]> {
  const body = await request.json();
  if (Array.isArray(body?.media)) return body.media;
  if (Array.isArray(body?.files)) return body.files;
  if (body && typeof body === "object") return [body as DemoMediaInput];
  return [];
}

function toPersonId(value: FormDataEntryValue | null): PersonId {
  const person = String(value || "family");
  if (["sophie", "leo", "baby", "mom", "dad", "grandma", "family"].includes(person)) return person as PersonId;
  return "family";
}

async function inputsFromFormData(request: Request): Promise<DemoMediaInput[]> {
  const formData = await request.formData();
  const files = formData
    .getAll("files")
    .filter((value): value is File => typeof value === "object" && value !== null && "name" in value && "size" in value);
  const fallbackTitle = String(formData.get("title") || "Phone media upload");
  const person = toPersonId(formData.get("person"));

  if (!files.length) {
    return [
      {
        title: fallbackTitle,
        person,
        mediaType: "photo",
        metadata: { uploadMode: "multipart-without-file" },
      },
    ];
  }

  return files.map((file) => ({
    title: file.name || fallbackTitle,
    person,
    mediaType: file.type.startsWith("video/") ? "video" : "photo",
    metadata: {
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      uploadMode: "multipart",
    },
  }));
}

export async function POST(request: Request) {
  await ensureHydrated();
  let inputs: DemoMediaInput[];

  try {
    const contentType = request.headers.get("content-type") || "";
    inputs = contentType.includes("multipart/form-data") ? await inputsFromFormData(request) : await inputsFromJson(request);
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid upload request", detail: error instanceof Error ? error.message : "Unable to parse request" },
      { status: 400 }
    );
  }

  if (!inputs.length) {
    return NextResponse.json({ error: "Provide at least one media item or file" }, { status: 400 });
  }

  const media = addDemoMedia(inputs, "phone");
  const memory = createDemoMemoryFromMedia(media, {
    title: media.length === 1 ? media[0].title : `${media.length} phone items uploaded`,
    body: media.length === 1 ? media[0].body : "Phone media is ready in Memory.",
    status: "saved",
    statusLabel: "Saved",
  });

  await persistDemoStore();

  return NextResponse.json({
    media,
    memory,
    metadata: {
      provider: "local-demo-store",
      externalSync: "mocked",
    },
  });
}
