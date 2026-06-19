import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Diagnostic only: reports whether the deployed function can SEE the API keys
// at runtime, plus each value's length so a pasted trailing space/newline shows
// up as an off-by-one. Never returns the secret values themselves.
function describe(value: string | undefined) {
  if (!value) return { present: false, length: 0, trimmedLength: 0, hasWhitespaceEdges: false };
  const trimmed = value.trim();
  return {
    present: true,
    length: value.length,
    trimmedLength: trimmed.length,
    hasWhitespaceEdges: trimmed.length !== value.length,
  };
}

export async function GET() {
  return NextResponse.json({
    note: "Diagnostic only — does not expose secret values.",
    env: {
      DEEPSEEK_API_KEY: describe(process.env.DEEPSEEK_API_KEY),
      DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL ?? null,
      GEMINI_API_KEY: describe(process.env.GEMINI_API_KEY),
      GEMINI_MODEL: process.env.GEMINI_MODEL ?? null,
      BLOB_READ_WRITE_TOKEN: { present: Boolean(process.env.BLOB_READ_WRITE_TOKEN) },
    },
    runtime: {
      vercel: process.env.VERCEL ?? null,
      vercelEnv: process.env.VERCEL_ENV ?? null,
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    },
  });
}
