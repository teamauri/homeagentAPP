import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Authorizes the browser to upload the rendered short DIRECTLY to Vercel Blob,
// bypassing the 4.5MB serverless request-body limit that a normal multipart POST
// would hit. The client then creates the Memory via a tiny JSON payload.
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["video/mp4"],
        maximumSizeInBytes: 200 * 1024 * 1024,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {
        /* no-op: the client creates the Memory after upload resolves */
      },
    });
    return NextResponse.json(json);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "upload auth failed" }, { status: 400 });
  }
}
