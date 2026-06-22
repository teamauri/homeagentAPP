# DockKit → Home Agent Memory Integration (handoff)

> Handoff for the **App architecture review & refactor** session that owns the
> overall Memory feature (the home-agent Memory UI's image/video display +
> interaction, including robot/DockKit-sourced media). This documents the
> end-to-end pipeline built in the "dockit → home agent memory" session so you
> can build the full Memory UX on top of it without breaking the ingest path.

## What this pipeline does

DockKit (DockKitCamera iOS app) finishes rendering a **Story** (a vlog `.mp4`
plus AIGC **highlight images**). When configured, it POSTs those files to the
Home Agent app's ingest endpoint, which stores them and creates a **Memory**
item that the Memory tab renders live.

```
DockKitCamera (iOS, on device)
  StoryPipelineService.downloadReadyStory()
    → story video localURL + highlight image localURLs
    → HomeAgentMemorySender (multipart POST) ─────────┐
                                                      ▼
home-agent-app  POST /api/ingest/auri-media  (multipart/form-data)
    → media-storage.ts: write files (Vercel Blob | local public/demo-media)
    → demo-store: addDemoMedia(..., "auri") + createDemoMemoryFromMedia(...)
                                                      │
MomentsView  ◄── GET /api/memory ─────────────────────┘  (live render)
```

## Home Agent side (what changed)

| File | Role |
|---|---|
| `src/app/api/ingest/auri-media/route.ts` | Accepts **multipart/form-data** (`video`, `images[]`, metadata) **and** the original JSON path. Stores files, builds `DemoMediaInput[]`, creates one Memory grouping them. |
| `src/lib/demo/media-storage.ts` | **NEW.** `storeUploadedFile(File)`. Uses **Vercel Blob** when `BLOB_READ_WRITE_TOKEN` is set (required on Vercel — read-only FS), else falls back to `public/demo-media/` for local dev. Returns a public URL. |
| `src/components/MomentsView.tsx` | Now a **client component** that fetches `GET /api/memory` and renders real thumbnails / a ▶ video badge. Newest live items first, seeded fixtures after. Falls back to fixtures on fetch error. |
| `.gitignore`, `public/demo-media/.gitkeep` | Ignore locally-written media, keep the dir. |
| `package.json` | Added `@vercel/blob`. |

### Multipart request contract (`POST /api/ingest/auri-media`)

Fields: `video` (file, the story mp4), `images` (repeated file field, highlight
images), `memoryTitle`, `memoryBody`, `person`, `room`, `robotId`, `tags`
(comma-separated), `capturedAt` (ISO8601). The JSON path (`{ clips: [...] }`,
URLs only) still works for mock ingest.

Response: `{ media: DemoMediaItem[], memory: DemoMemoryItem, metadata }`.
`metadata.externalRobotSync` is `"blob"` | `"local"` | `"mocked"`.

### Data shapes (source of truth: `src/lib/demo/demo-store.ts`)

- `DemoMediaItem`: `{ id, title, source: "auri"|"phone", sourceType, mediaType: "photo"|"video"|"clip", url, thumbnailUrl?, capturedAt, person, body, tags, metadata, createdAt }`
- `DemoMemoryItem`: `{ id, title, body, sourceLabel, sourceType, timeLabel, person, status, statusLabel, mediaIds: string[], createdAt, targetRoute, metadata }`
- For a Story ingest: the **video** is media[0] (its `thumbnailUrl` = first highlight image), each highlight is a `photo` media item, and one Memory links all via `mediaIds`.
- `GET /api/memory` returns `{ items: DemoMemoryItem[], media: DemoMediaItem[], summary, metadata }`. Resolve thumbnails by joining `item.mediaIds` → `media[]`.

## DockKit side (what changed)

| File | Role |
|---|---|
| `DockKitCamera/Services/HomeAgentMemorySender.swift` | **NEW.** Builds the multipart POST (field names match the endpoint above). Best-effort. |
| `DockKitCamera/Services/StoryPipelineService.swift` | `StoryPipelineConfig` gained `homeAgentIngestURL: URL?` (from env `HOME_AGENT_INGEST_URL`, nil = disabled). `downloadReadyStory()` calls `sendStoryToHomeAgentIfNeeded()` after the video + highlight images are local. Failures only log. |

Enable on device by setting `HOME_AGENT_INGEST_URL` to e.g.
`https://<your-app>.vercel.app/api/ingest/auri-media`.

## Raw + Transcript mode

Story/Vlog Memory delivery still uses `POST /api/ingest/auri-media`.

The Story Tracking `Raw + Transcript` mode is not the existing Story/Vlog ingest
path. For that mode, Home Agent does not receive a multipart Story upload and
does not call Auri Story/Vlog APIs. DockKit reports the `auriVideoId` through the
robot capture-task status callback, then Home Agent downloads existing
raw-output artifacts from Auri Editor by `video_id`.

DockKit reports the canonical Auri video id to
`POST /api/robot/capture-tasks/{taskId}/status` with
`recordingMode=story_tracking_raw_transcript`. The Home Agent UI currently finds
pending raw-output tasks and calls the idempotent task-scoped sync endpoint:

```http
POST /api/robot/capture-tasks/{taskId}/raw-output/sync
```

That server route performs one Auri raw-output status check, downloads
`/v1/videos/{video_id}/raw-output` artifacts when ready, and creates the Memory
record. A future batch poll route can move candidate scanning out of the browser
if cron/server-driven polling is needed.

Home Agent uses only:

- `GET /v1/videos/{video_id}/raw-output`
- `HEAD /v1/videos/{video_id}/raw-output/video/download`
- `GET /v1/videos/{video_id}/raw-output/video/download`
- `HEAD /v1/videos/{video_id}/raw-output/transcript/download?format=json|txt`
- `GET /v1/videos/{video_id}/raw-output/transcript/download?format=json|txt`

After download, Home Agent stores the raw video and transcripts through its media
storage, creates a Memory linked to the capture task, and surfaces the recorded
video in Chat through the completed robot event.

## Known limitations / decisions the Memory-UX refactor should address

1. **`demo-store` is in-memory & process-local** — resets on server restart and
   is per-instance on serverless. The Memory feature needs a real persistence
   layer (DB) if it should survive restarts / be shared across requests. Files
   in Blob persist; the metadata/Memory records do not.
2. **MomentsView is intentionally minimal** — I wired it to the live feed to
   prove the loop end-to-end. It's the natural thing for your refactor to
   replace/expand (galleries, multi-image highlight carousel, inline video
   player, filters, person scoping, grouping). Keep reading from `/api/memory`
   and joining `mediaIds`→`media` so DockKit-sourced items keep showing.
3. **No video poster generation** — a Story video's thumbnail is just the first
   highlight image. Real poster/first-frame extraction is unbuilt.
4. **No Memory detail route** — `targetRoute` points at `/memory/{id}` which
   doesn't exist yet. The card video thumbnail currently just links to the raw
   file URL (`target="_blank"`).
5. **`person` is hardcoded `"family"`** in the DockKit sender (no subject mapping
   from the robot yet). Adjust if Memory UX needs per-person attribution.
6. **Vercel Blob setup required** for the deployed demo: create a Blob store in
   the Vercel project and ensure `BLOB_READ_WRITE_TOKEN` is present, otherwise
   ingest on Vercel falls back to a non-served local write.

## Verified in this session

- `curl` multipart ingest → files stored, `/demo-media/*.mp4` served (200), `/api/memory` returns the new item.
- Browser: Memory tab shows the ingested "Backyard soccer story" (Auri Robot · Ready) with a real video thumbnail + ▶ badge above the seeded fixtures.
- `tsc --noEmit` clean.
- DockKit code symbols verified against the models; **not compiled** (needs Xcode + device).
