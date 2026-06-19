# Memory Auto-Edit (phone media → Auri → Story) — design

> Pairs with `DOCKIT_MEMORY_INTEGRATION.md`. That doc is the **inbound** path:
> the DockKit robot finishes a Story and POSTs it into the Memory feed. This doc
> is the **outbound** path: media that is *already in the Memory page* (phone
> photos/videos) is sent to the **same Auri editing backend** the robot uses,
> auto-edited into a Story, and the result lands back in the Memory feed.

```
                 inbound (existing, DOCKIT_MEMORY_INTEGRATION.md)
DockKit robot ───── render Story ─────► POST /api/ingest/auri-media ─► Memory feed
                 outbound (THIS doc)
Memory page  ──► pick a long video ──► Auri compose+vlog ──► Story ──► Memory feed
```

## Hard constraints (locked)

1. **The robot auto-edit product = two active repos: `dockkit-demo` (frontend)
   + `auri-editor` (backend, deployed at `auriedit.onrender.com`).** Do not
   break either. We **read** them for the HTTP contract — `auri-editor` source is
   the authoritative contract (so the `TODO: verify` field names in
   `src/lib/auri/client.ts` can be confirmed from it, not guessed) — and
   reimplement an **independent Node client** in this app.
2. **`home-agent-app` is where this feature is built** (the ffmpeg/编排 layer
   lives here). `video-roughcut`, `highlight-retrieval-lab`, `story-mode-script`
   are experiments — do **not** work in them.
3. home-agent calls the same Auri backend independently (its own `videoId`s, no
   shared state with the robot), so its traffic cannot affect the robot demo.

## Product scope

### Phase 1 (MVP) — explicit "edit a video" entry
A button on the Memory page. User uploads **one long video** → it is auto-edited
into a Story → the Story appears in the feed as a `source: "auri"` Memory (same
card as a robot Story). Proves the full Node→Auri→ingest loop.

### Phase 2 — one-click bulk upload + duration triage
Reuse the existing (convenient) multi-select picker. User selects any mix of
photos/videos. Triage **by duration, computed client-side** (`<video>.duration`
/ File API — instant, no upload needed):

| Item | Handling |
|---|---|
| Photo | Ingest immediately into the Memory feed |
| Video ≤ 30s | Ingest immediately into the Memory feed |
| Video > 30s | Held back as an **edit candidate**; prompt "N long videos — auto-edit into Stories?" → on confirm, each runs the Phase-1 engine, **one Story per video** |

> Decisions locked: single 30s threshold (no middle band); one Story per long
> video (no cross-video montage). Mixed-media montage = future P3.

## The pipeline (single source per Story — no concat)

**`source_mode="uploaded_clips"`** — VERIFIED end-to-end against the live backend
(`auriedit.onrender.com`). The cloud backend **rejects `full_video`**
(`FULL_VIDEO_SOURCE_UNAVAILABLE` — it needs a server-side source path we don't
have for uploaded chunks), so we use uploaded_clips: upload the source, let the
backend's Gemini planner pick a ≤~30s story, then upload one HQ clip per chosen
segment. Output is budgeted to ~30s by the backend (`VLOG_STORY_MAX_SECONDS`).

```
source video (any length)
  │ ffmpeg: split into ≤30s segments  (-c copy, fast)
  ├─►  createVideo → per segment: chunks:prepare → PUT upload → chunks:commit
  │     → :complete-upload   (backend assembles + composes a timeline)
  │
  ├─►  createVlog(source_mode="uploaded_clips", provider="gemini",
  │              render_profile="legacy_story_v1_fast")   ← retry on TIMELINE_NOT_READY
  │     → poll status until upload_contracts ready (Gemini planning)
  │     → per contract { segment_index, start_time_original, end_time_original }:
  │         ffmpeg extractClip(source, start, end) → uploadVlogClip (multipart)
  │     → :complete-upload → :render
  │     → poll GET /vlogs/{id} until READY → /download → mp4
  │
  └─► land result: storeUploadedFile() + addDemoMedia(..., "auri")
        + createDemoMemoryFromMedia()  ← same path as /api/ingest/auri-media
```

Notes (verified): app-id `homeagent-memory` is allowlisted (header only, no HMAC
needed for these endpoints). Error envelope is FastAPI-wrapped:
`{ detail: { error: { code, message, retryable } } }`. **Render requires HQ
source frames** — low-res inputs fail poster gen (`cover frame is not HQ`); real
phone video (≥720p) is fine. Without `AURI_HOST` the pipeline uses `LocalEditor`
(ffmpeg trim to ≤30s) so the feature works with no backend.

## Architecture (all inside `home-agent-app`)

| Path | Role |
|---|---|
| `src/lib/auri/client.ts` | **Node port** of the Auri HTTP client (token, video compose, vlog render, download, artifacts). Independent of dockkit. |
| `src/lib/auri/ffmpeg.ts` | Spawn local ffmpeg (v7 present): probe duration, split source into ≤30s segments (`-c copy`). No transcode/downsample/HQ-extract needed with `full_video`. *(next)* |
| `src/lib/auri/pipeline.ts` | Orchestrator (the `VlogWorkflowRunner` equivalent) — ties ffmpeg + client. *(Phase 1, next)* |
| `src/lib/auri/jobs.ts` | Background job store + worker loop; status `uploading→analyzing→选高光→rendering→ready`; persisted to `.data/`. *(Phase 1, next)* |
| `POST /api/edit/create` | `{ videoUrl | mediaId, title?, style? }` → create job, return `jobId`. |
| `GET /api/edit/[jobId]` | Job status/progress for the UI to poll. |
| reuse `media-storage.ts` / `demo-store.ts` | `storeUploadedFile`, `addDemoMedia(inputs,"auri")`, `createDemoMemoryFromMedia`, `persistDemoStore`, `ensureHydrated` — result lands like the robot path and shows via `/api/memory`. |
| `MomentsView.tsx` | Phase-1 entry; Phase-2 bulk upload + triage + candidate prompt; in-progress card; result card. |

### Runtime note
ffmpeg + minutes-long polling must run in a **long-lived Node process** that can
spawn ffmpeg (`next start` locally, or a companion worker) — **not** a Vercel
serverless request. For the demo: in-process background job + `.data/`
persistence so a refresh/return re-attaches via `GET /api/edit/[jobId]`.

## Auth / env — the live vs local split (important)

```
AURI_HOST=http://localhost:8000              # local dev (no app-id check) — DEFAULT for now
# AURI_HOST=https://auriedit.onrender.com    # deployed (app-id allowlisted — needs provisioning)
AURI_APP_ID=homeagent-memory
AURI_AUTH_TOKEN=                             # HMAC/PAT, only for the deployed backend
```

Two backends, two auth realities (verified):
- **Local `auri-editor` (this checkout) has NO app-id check** — `TODOs.md:22`
  lists adding the `X-Auri-App-Id`+HMAC middleware as a TODO; `create_video` uses
  a hard-coded UUID. So pointing `AURI_HOST` at a locally-run `uvicorn api.main:app`
  Just Works with any app-id. **This is our dev/test loop.**
- **Deployed `auriedit.onrender.com` IS gated** — smoke test returned
  `403 LLM_APP_ID_NOT_ALLOWED` for `homeagent-memory`. That error code does **not
  exist in this checkout**, so the deployment runs a newer build with the
  allowlist added. Per `docs/video_editing_pipeline_spec.md`, real auth = a
  provisioned app **UUID** (`app_clients.app_uuid`) + **HMAC signature**.

**Consequence for "register homeagent-memory":** it can't be done by editing this
repo — the live allowlist lives in the deployment (DB/env on Render). The backend
operator must provision a home-agent app UUID + HMAC secret. Until then, develop
against a **local auri-editor** instance.

## UI status mapping (Auri → user-facing)

| Auri vlog `status`/`stage` | User-facing |
|---|---|
| compose uploading / `PROCESSING` | 上传中 |
| compose READY / `planning` | 分析画面 |
| `awaiting_upload` / uploading clips | 挑选高光 |
| `RENDER_QUEUED` / `RENDERING` | 渲染中 |
| `READY` | 完成 (Story card) |
| `FAILED` / `EXPIRED` / `CANCELED` | 失败（可重试） |

## UI wiring handoff (for the Memory-page owner)

The backend is done + verified E2E against the live Auri backend. The remaining
piece is the `MomentsView` entry, intentionally **not** wired here because that
file is under active redesign by other sessions (per-child tabs, copy redesign).
It's fully decoupled — it only calls two stable endpoints:

- `POST /api/edit/create` — multipart `{ video: File, title?: string }` → `{ jobId }`.
- `GET /api/edit/[jobId]` → `{ status, progress, result: { memoryId, mediaUrl, durationSeconds } | null, error }`.
  `status`: `queued|uploading|analyzing|rendering|ready|failed`.

Four UI states (matches the confirmed mock — see chat history / earlier screenshots):
1. **Entry** — a `✨ Auri Cut` button next to `＋ Organize photos`.
2. **Intro card** (on click) — "Pick one video — Auri cuts it into a short film
   under 30s" + `Choose a video` (opens a single-video `<input accept="video/*">`)
   + Cancel. Picking a video → `POST /api/edit/create` with it.
3. **Editing card** (mirror `OrganizingPanel`) — staged progress driven by polling
   `GET /api/edit/[jobId]`: uploading → analyzing → rendering. "You can leave…".
4. **Result card** — on `ready`, `Watch` → `/memory/{result.memoryId}` (the
   existing detail page plays the mp4, since the job ingests via the same
   demo-store path as the robot Story ingest).

No backend env → `LocalEditor` (ffmpeg trim) still produces a real ≤30s mp4, so
the UI is testable offline. Set `AURI_HOST`/`AURI_APP_ID` for the real edit.

## Open items
- ~~Confirm `AURI_HOST`~~ → **`https://auriedit.onrender.com`** (verified).
- ~~Confirm app-id allowlist~~ → **allowlisted**; need `homeagent-memory`
  registered by the backend owner (or knowingly reuse dockkit's app-id to unblock).
- Exact JSON field names for `createVideo`/`createVlog` bodies — verify against
  the live backend (client marks these `TODO: verify`). Blocked until we have a
  working app-id to get past `/v1/llm/token`.
- Persistence: demo uses in-memory `demo-store` + `.data/` (resets on restart —
  see DOCKIT_MEMORY_INTEGRATION.md known-limitations). DB is a later call.
```
