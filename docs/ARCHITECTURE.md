# Architecture — current state (source of truth)

> **READ THIS before building a feature. UPDATE it whenever you change the
> architecture (a flow, a store, an external service, a new surface).** This is
> the canonical map of what the app actually does today. Detailed designs live in
> the linked docs; this file is the index + the wiring.
>
> (`TECH_ARCHITECTURE.md` is the *long-term* vision — monorepo, native mobile —
> not the current state. This file is the current state.)

## What this is

`home-agent-app` — "Auri", a family **Memory/Journey** web app (mobile-first
Next.js, deployed on Vercel). A chat-first assistant + a growing timeline of a
child's moments (photos, videos, robot Stories, auto-edited shorts).

## Stack

- **Next.js 14 App Router** + React 18 + TypeScript + Tailwind. `runtime = "nodejs"` on API routes.
- **External services** (keys in `.env.local`, see `DEPLOY.md`):
  - **DeepSeek** / **Gemini** — chat brain + photo-vision organize (`GEMINI_API_KEY`, `DEEPSEEK_API_KEY`).
  - **auri-editor** (`AURI_HOST` / `NEXT_PUBLIC_AURI_HOST`, app-id `homeagent-memory`) — video editing backend (a separate repo, deployed at `auriedit.onrender.com`).
  - **Vercel Blob** (`BLOB_READ_WRITE_TOKEN`) — media storage on Vercel (else local `public/demo-media`).
- **Sibling repos** (not in this app; read-only contract): `dockkit-demo` (robot iOS app, the inbound Story source), `auri-editor` (the video backend). See memory `auri-project-topology`.

## Surfaces (routes)

| Route | What |
|---|---|
| `/` (`AppShell`) | Tabbed shell: **Chat** (`ChatView`), **Inbox** (`JobsView`/`TodayView`), **Journey/Memory** (`MomentsView`). Plus `/calendar`, `/family`. |
| `/memory/[id]` | Memory detail — inline video player + photos. |
| `/objects/[id]` | A created object (calendar draft, reminder, baby log, story…) + actions. |

## Core flows (链路)

### 1. Chat → cards/objects
`ChatView` → `POST /api/chat` → `src/lib/chat-server/*` (DeepSeek, Gemini fallback)
→ returns Auri's reply + **cards** + **objectsToCreate** (calendar/reminder/baby-log/
story…). Objects persist via the demo store; actions via `POST /api/objects/[id]/actions`.

### 2. Photo Organize → timeline
`MomentsView` "＋ Organize" → client decodes photos (HEIC-safe) → `POST /api/album/organize`
(Gemini vision: keep real moments, place by age, write captions) → **growth store**.
Phone videos → `POST /api/media/upload` → demo store.

### 3. Auri Cut — auto-edit a phone video (outbound) ✅ shipped
`MomentsView` "✨ Auri Cut" → pick one video → **all in the browser**
(`src/lib/auri/browser/`): ffmpeg.wasm preprocess (WORKERFS-mount + per-chunk
`-c copy`) + drive **auri-editor directly** (CORS open): createVideo → upload chunks
→ vlog(uploaded_clips) → upload HQ clips → render. Phone returns `{videoId, vlogId}`
→ `POST /api/edit/ingest` (server downloads the rendered mp4 from auri-editor →
stores → creates a `source:"auri"` Memory). Vercel-friendly (no server ffmpeg).
**Design: `MEMORY_AUTO_EDIT_DESIGN.md`. Recipe/limits: memory `auri-cut-client-preprocessing`.**
*(The server-side `/api/edit/create` + `[jobId]` path is a local-only first cut, kept as fallback — needs server ffmpeg, won't run on Vercel.)*

### 4. DockKit robot Story → timeline (inbound) ✅ home-agent side done
Robot finishes a Story (vlog mp4 + highlight images) → `POST /api/ingest/auri-media`
(multipart `video` + `images[]` + metadata) → stores files → creates a
`source:"auri"` Memory (video = media[0], highlights = photos). Also accepts a
JSON `{clips:[{url,…}]}` path (used by Auri Cut ingest + mock). **Design:
`DOCKIT_MEMORY_INTEGRATION.md`.** Robot-side trigger lives in `dockkit-demo` (iOS,
needs device + `HOME_AGENT_INGEST_URL`).

## Data & storage

- **growth store** (`src/lib/album/store.ts`) — the Memory timeline = seed +
  Gemini-organized photos, **merged with** demo-store items so robot Stories,
  phone uploads, and Auri Cut films all show in one feed. Read via `GET /api/memory/growth` (`MomentsView`).
- **demo store** (`src/lib/demo/demo-store.ts`) — media + Memory + objects records. Read via `GET /api/memory`, `/api/memory/[id]`.
- **media-storage** (`src/lib/demo/media-storage.ts`) — `storeUploadedFile()` → Vercel Blob (private, served via `/api/media/blob/[name]`) or local `public/demo-media`.
- **persistence** (`src/lib/demo/persistence.ts`) — hydrate/persist stores (Blob or local `.data`), `reloadStore()` for serverless freshness.

## Known limitations
- **Stores are demo-grade** — in-memory + Blob/local snapshot; ephemeral per
  serverless instance. Files persist (Blob); records may not survive across
  instances/restarts. A real DB is the next step for reliable persistence.
- Vercel needs `BLOB_READ_WRITE_TOKEN` (media storage is read-only otherwise).

## Detailed design docs
`MEMORY_AUTO_EDIT_DESIGN.md` (Auri Cut) · `DOCKIT_MEMORY_INTEGRATION.md` (robot ingest)
· `DATA_MODEL.md` · `DESIGN_SYSTEM.md` / `UI_COPY.md` · `DEPLOY.md` · `PRODUCT_BRIEF.md`.
