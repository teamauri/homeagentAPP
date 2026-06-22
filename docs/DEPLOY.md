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
| `DATA_DIR` | **Durable media + records** | Path to a mounted Render Persistent Disk (e.g. `/var/data`). Media and store snapshots are written here and survive restarts/redeploys. Unset → ephemeral (`public/demo-media` + `.data`), lost on restart. |

Secrets live on the platform / your shell — never commit them (`.env*` is gitignored).
For a local real-AI run: put them in `.env.local`, then `npm run dev`.

## Persistence note

`src/lib/demo/demo-store.ts` is an **in-memory** store (globalThis), snapshotted
to one JSON file per store (`SNAPSHOT_DIR`) and mirrored by media files
(`MEDIA_DIR`) — both rooted at `DATA_DIR` when set (see `src/lib/demo/data-dir.ts`).

- **With a Persistent Disk** (`DATA_DIR=/var/data`): organized albums, ingested
  robot Stories, phone uploads, and Auri Cut films survive restarts/redeploys.
- **Without it**: the container FS is ephemeral — those are lost on restart /
  redeploy / free-tier spin-down (seed content always renders regardless).

A disk pins the service to a single instance (it can't be shared) — fine for the
demo. Multi-instance consistency needs a shared DB later.

## Deploy on Render

1. New Web Service → connect `teamauri/homeagentAPP` → branch `main`.
2. Build: `npm install && npm run build` · Start: `npm start`
3. **Add a Persistent Disk** (service → Disks): mount path e.g. `/var/data`,
   size a few GB. Then set env `DATA_DIR=/var/data`. *(Requires a paid instance;
   the disk pins the service to one instance.)*
4. Add the other env vars from the table above.
5. Render auto-deploys on every push to `main`. Open the live root on a phone:
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
