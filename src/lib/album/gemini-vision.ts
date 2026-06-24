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
    "You are Cameraman, the AURI family robot's eye. You organize a parent's camera roll into a warm family growth timeline.",
    "TASK:",
    "1. For EACH photo set keep=true if it is a real photograph of people, pets, places, or a family moment — this INCLUDES a close-up portrait of a single person (e.g. just the mom or dad), a sibling, a grandparent, or the family together, even when no child is in frame. A clear close-up of someone's face is ALWAYS a keepable moment. Set keep=false ONLY for obvious non-moments: screenshots, receipts, memes, documents/text, or a completely blurry/unusable shot (give the reason). When in doubt, KEEP it.",
    "2. Identify which child is the subject (childId) only when a child is clearly present; if no child is in the photo, leave childId unset and STILL keep the photo — do not drop it for lacking a child.",
    "3. Mark isFirst=true ONLY for a genuinely NEW thing for the focus child (a first-time milestone) and give a short firstLabel like \"Named her first dinosaur\".",
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

  // Hard timeout so a slow Gemini call can't run the serverless function up to
  // its 60s cap and return a 504. On abort we throw and organize() falls back to
  // the deterministic organizer, which keeps the photo instead of erroring.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35_000);
  let apiResponse: Response;
  try {
    apiResponse = await fetch(endpoint, {
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
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) throw new Error("Gemini album call timed out");
    throw error;
  } finally {
    clearTimeout(timer);
  }

  if (!apiResponse.ok) {
    const errorText = await apiResponse.text();
    throw new Error(`Gemini album API failed: ${apiResponse.status} ${errorText.slice(0, 240)}`);
  }

  const json = await apiResponse.json();
  const analysis = JSON.parse(extractText(json)) as AlbumAnalysis;
  if (!Array.isArray(analysis.photos)) throw new Error("Gemini album response missing photos[]");
  return { analysis, model };
}
