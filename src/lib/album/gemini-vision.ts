import { getChildren, getMember } from "@/lib/family/store";
import { albumAnalysisSchema } from "./schema";
import { AlbumAnalysis, AlbumPhotoInput } from "./types";

// Build the textual context: who's in this family, the kids' birthdays and
// known interests, and the per-photo index + capture date so the model can
// group days and reason about ages.
function buildContext(photos: AlbumPhotoInput[], childId: string) {
  const child = getMember(childId);
  const kids = getChildren();
  return [
    "You are Iris, the AURI family robot's eye. You organize a parent's camera roll into a warm baby growth timeline.",
    "TASK:",
    "1. For EACH photo decide keep=true only if it shows a real family moment. Set keep=false for screenshots, receipts, memes, documents, blurry shots, or near-duplicates (give the reason).",
    "2. Identify which child is the subject (childId) when clear.",
    "3. Mark isFirst=true ONLY for a genuinely NEW thing for that child (a first-time milestone) and give a short firstLabel like \"Named her first dinosaur\".",
    "4. Write one warm, specific dayCaption per distinct capture date (group by the dates given). Reference what actually happens; never grade development or compare to other children.",
    "5. Write a short session.nowSummary about where the focus child is right now, plus 2-3 gentle support suggestions (icon = one emoji). Never a score, never a comparison.",
    "Return ONLY JSON matching the schema. No markdown.",
    `Focus child: ${child ? `${child.name} (id ${child.id}), born ${child.birthday}, interests ${child.interests.join(", ")}` : childId}`,
    `Children: ${kids.map((k) => `${k.name}=${k.id} (born ${k.birthday})`).join("; ")}`,
    "Photos (index · capture date · type):",
    photos.map((p, i) => `${i} · ${p.capturedAtISO.slice(0, 10)} · ${p.mimeType}`).join("\n"),
  ].join("\n\n");
}

function extractText(json: any): string {
  const parts = json?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) throw new Error("Gemini response missing candidates[0].content.parts");
  const text = parts.map((p) => p?.text).filter(Boolean).join("\n");
  if (!text) throw new Error("Gemini response did not contain text");
  return text;
}

export async function callGeminiAlbum(
  photos: AlbumPhotoInput[],
  childId: string
): Promise<{ analysis: AlbumAnalysis; model: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing");

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const parts: any[] = [{ text: buildContext(photos, childId) }];
  for (const photo of photos) {
    parts.push({ inlineData: { mimeType: photo.mimeType, data: photo.dataBase64 } });
  }

  const apiResponse = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json",
        responseSchema: albumAnalysisSchema,
      },
    }),
  });

  if (!apiResponse.ok) {
    const errorText = await apiResponse.text();
    throw new Error(`Gemini album API failed: ${apiResponse.status} ${errorText.slice(0, 240)}`);
  }

  const json = await apiResponse.json();
  const analysis = JSON.parse(extractText(json)) as AlbumAnalysis;
  if (!Array.isArray(analysis.photos)) throw new Error("Gemini album response missing photos[]");
  return { analysis, model };
}
