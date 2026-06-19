# Deploy

Next.js 14 (App Router). Two paths — pick by how reliable live uploads must be.

## Environment variables

| Var | Needed for | Notes |
|---|---|---|
| `GEMINI_API_KEY` | Real AI — album vision + chat | Without it everything falls back (UI identical). |
| `DEEPSEEK_API_KEY` | Chat text routing | Optional; chat tries DeepSeek → Gemini → keyword fallback. |
| `GEMINI_MODEL` | — | Optional, default `gemini-2.5-flash`. |
| `BLOB_READ_WRITE_TOKEN` | Robot media on Vercel | Required on Vercel (read-only FS). Auto-set when you create a Vercel Blob store. Locally, media falls back to `public/demo-media`. |

Secrets live on the platform / your shell — never commit them (`.env*` is gitignored).
For a local real-AI run: put them in `.env.local`, then `npm run dev`.

## ⚠️ Persistence caveat (read this first)

`src/lib/demo/demo-store.ts` is an **in-memory** store (globalThis).

- **Single long-running instance** (Render / Railway / Fly / a VM): the store
  survives for the instance's lifetime → organized albums and ingested robot
  Stories **persist** during the demo. ✅
- **Vercel serverless**: each request may hit a different/recycled lambda → the
  in-memory store is **not durable**. Seed content (chat, growth feed, detail
  pages) always renders, but **live uploads / ingests may vanish** between
  requests until persistence lands (swap demo-store for Vercel KV/Postgres).

## A. Single instance (most reliable today) — e.g. Render

1. New Web Service → connect `teamauri/homeagentAPP` → branch
   `claude/great-albattani-8pavj2`.
2. Build: `npm install && npm run build` · Start: `npm start`
3. Add env vars (optional, for real AI): `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`.
4. Open the `https://…onrender.com` URL on a phone.

## B. Vercel (fully reliable once persistence lands)

1. Storage → Create → **Blob** (this injects `BLOB_READ_WRITE_TOKEN`).
2. Add New → Project → import `teamauri/homeagentAPP` → branch
   `claude/great-albattani-8pavj2` (or merge the PR to `main` and deploy `main`).
3. Confirm env: `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `BLOB_READ_WRITE_TOKEN`.
4. Deploy (Next.js auto-detected).

Function timeouts for the slow model calls are set in code via route segment
config (`export const maxDuration = 60`) on `/api/chat` and
`/api/album/organize` — no `vercel.json` function globs needed.

## What works without any keys / on serverless

The seeded story always renders: family-group chat, the growth Memory feed,
milestone session, Firsts wall, and Story detail pages. Real AI (Gemini/DeepSeek)
and durable live uploads need the keys / persistence above.
