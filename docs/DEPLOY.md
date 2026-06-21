# Deploy

Next.js 14 (App Router). Deployed as a single long-running Node service on
**Render** — `https://homeagentapp.onrender.com`.

## Environment variables

| Var | Needed for | Notes |
|---|---|---|
| `GEMINI_API_KEY` | Real AI — album vision + chat | Without it everything falls back (UI identical). |
| `DEEPSEEK_API_KEY` | Chat text routing | Optional; chat tries DeepSeek → Gemini → keyword fallback. |
| `GEMINI_MODEL` | — | Optional, default `gemini-2.5-flash`. |
| `AURI_HOST` | Robot raw-output sync | Default is `https://auriedit.onrender.com`; set explicitly in production. |
| `AURI_APP_ID` | Auri Editor auth | Default is `homeagent-memory`; use the allowlisted app id for the deployed backend. |
| `AURI_AUTH_TOKEN` | Auri Editor auth | Optional bearer token if required by the deployed Auri Editor. |
| `BLOB_READ_WRITE_TOKEN` | Durable robot media | Optional. If set, uploaded/ingested media is stored in a Vercel Blob store (usable from any host, incl. Render); otherwise media falls back to `public/demo-media` / the in-memory store. |

Secrets live on the platform / your shell — never commit them (`.env*` is gitignored).
For a local real-AI run: put them in `.env.local`, then `npm run dev`.

## Persistence note

`src/lib/demo/demo-store.ts` is an **in-memory** store (globalThis). On Render
— a single long-running instance — it survives for the instance's lifetime, so
organized albums and ingested robot Stories persist during the demo. Seed
content (chat, growth feed, detail pages) always renders regardless. For media
that must survive restarts/redeploys, set `BLOB_READ_WRITE_TOKEN` (above).

## Deploy on Render

1. New Web Service → connect `teamauri/homeagentAPP` → branch `main`.
2. Build: `npm install && npm run build` · Start: `npm start`
3. Add env vars from the table above.
4. Render auto-deploys on every push to `main`. Open the live root on a phone:
   `https://homeagentapp.onrender.com/`.

Slow model calls set their own timeout via route segment config
(`export const maxDuration = 60`) on `/api/chat` and `/api/album/organize`.

## Robot raw-output sync

DockKit reports the canonical `auriVideoId`; Home Agent owns artifact download
and Memory creation through the task-scoped sync endpoint. In the current demo,
the Home Agent browser finds pending `story_tracking_raw_transcript` tasks and
calls:

Manual check:

```bash
curl -fsS -X POST https://homeagentapp.onrender.com/api/robot/capture-tasks/<taskId>/raw-output/sync
```

A future batch poll endpoint can be added when polling coordination needs to
move out of `RobotEventContext` and into cron or a server scheduler.

## What works without any keys

The seeded story always renders: family-group chat, the growth Memory feed,
milestone session, Firsts wall, and Story detail pages. Real AI (Gemini/DeepSeek)
and durable live uploads need the keys above.
