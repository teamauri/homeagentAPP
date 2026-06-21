# Killer demo — scheduled autonomous capture (spec)

> **Vision:** Mom schedules a moment in Home Agent → the robot cameraman wakes up
> at that time, films the family on its own → Auri produces raw-output video +
> transcript artifacts → the finished recording appears in Home Agent's Memory
> for her to watch. No manual filming, no manual editing, no manual import.

## The three pieces

| Piece | Repo | Role |
|---|---|---|
| **Home Agent** | `home-agent-app` (this repo) | AI home organizer for mom — schedules the capture, and is where the finished film lands + is viewed. |
| **DockKit (Talkie)** | `dockkit-demo` (iOS) | The robot cameraman — auto-tracks family members and records. |
| **Auri Editor** | `auri-editor` (backend) | Video backend — stores the raw recording and produces low-quality raw-output video + transcript artifacts for this mode. |

## End-to-end loop

```
① Home Agent: mom creates a "capture task" (a calendar event = who + when [+ where])
        │ ② DockKit fetches the schedule from Home Agent
        ▼
③ At event time → DockKit auto-starts tracking + recording (no human start)
        ▼
④ Recording done → DockKit uploads the raw video chunks to Auri Editor
        ▼
⑤ Home Agent sync route checks Auri raw-output → downloads video + transcripts
        ▼
⑥ Mom watches the finished film in Home Agent's Memory/Journey timeline
```

| Step | Owner | Status |
|---|---|---|
| ① create capture task | Home Agent | ✅ created calendar events can be marked `forRobot` and receive an `auriClientVideoUuid`. |
| ② DockKit fetches schedule | Home Agent exposes API · DockKit consumes | ✅ Home Agent exposes `GET /api/calendar?robot=true`; DockKit polls it through `HomeAgentRobotClient`. |
| ③ auto-start at event time | DockKit (iOS) | ✅ DockKit maps due HomeAgent tasks into the #309 reminder UI and starts Story Tracking Raw Recording Mode after countdown. |
| ④ upload raw video → Auri | DockKit · Auri | ✅ DockKit uploads live chunks for the raw recording and reports canonical `auriVideoId` to Home Agent. |
| ⑤ Auri → Home Agent ingest + store | Auri · Home Agent | ✅ the task-scoped `POST /api/robot/capture-tasks/{taskId}/raw-output/sync` route fetches raw-output video plus transcripts by `auriVideoId`, stores artifacts, and links Memory to the task. |
| ⑥ view in Home Agent | Home Agent | ✅ merges into the Journey timeline + `/memory/[id]` player |

The core contract is now wired for the Raw + Transcript demo path. The current
implementation keeps polling coordination in the Home Agent browser UI: it finds
pending robot events and calls the idempotent task-scoped sync route. A separate
batch poll API is only needed later if polling coordination moves to cron or a
server-owned scheduler.

## The missing link (front half)

**Home Agent side (this repo):**
- Model a **capture task**: currently a created calendar event with `forRobot:
  true`, time, subject, and optional media hints.
- Expose a **robot-readable API**: `GET /api/calendar?robot=true` returns created
  robot capture events from the demo store.
- Accept robot status updates through `POST /api/robot/capture-tasks/{taskId}/status`.
- Expose `POST /api/robot/capture-tasks/{taskId}/raw-output/sync` for one
  idempotent Auri raw-output status/download attempt. The browser candidate loop
  calls this route for pending robot events.

**DockKit side (`dockkit-demo`, out of this repo):**
- Poll/fetch the schedule from Home Agent; at event time auto-start tracking;
  after upload, report the canonical `auriVideoId` back to Home Agent.

## Open design questions
- Pull vs push: does DockKit **poll** Home Agent for tasks, or does Home Agent
  notify the robot? (Robot is on-device; polling is simplest.)
- Task → result linkage: pass a `taskId` through capture → Auri → ingest so the
  finished Memory attaches to the originating calendar task.
- Auth between DockKit and Home Agent (the robot-facing API).

## Raw + Transcript Home Agent path

For the Story Tracking `Raw + Transcript` mode, Home Agent is only a consumer of
existing Auri Editor raw-output artifacts. Home Agent does not create the
raw-output job, does not call Story/Vlog APIs, and does not use the multipart
Story ingest path for this mode.

DockKit reports the canonical `auriVideoId` to Home Agent through:

```http
POST /api/robot/capture-tasks/{taskId}/status
```

When the task-scoped sync route runs, Home Agent polls/downloads by `video_id`
with:

- `GET /v1/videos/{video_id}/raw-output`
- `HEAD /v1/videos/{video_id}/raw-output/video/download`
- `GET /v1/videos/{video_id}/raw-output/video/download`
- `HEAD /v1/videos/{video_id}/raw-output/transcript/download?format=json|txt`
- `GET /v1/videos/{video_id}/raw-output/transcript/download?format=json|txt`

When the raw output is ready, Home Agent stores the video and transcripts,
creates a Memory, links it back to the capture task, and the chat renders the
recorded video from the completed robot event.

For Raw + Transcript mode, HomeAgent does not create raw-output jobs. In the
current implementation, the browser UI owns candidate selection and calls the
task-scoped sync route; the server route owns Auri artifact download, media
storage, Memory creation, and task updates.

A future `/api/robot/raw-output/poll` route can move candidate scanning out of
`RobotEventContext` for cron/server-driven polling. If added, it should reuse
the same one-task sync helper rather than duplicating ingestion logic.

## Boundaries / coordination
- This is a 3-repo feature. **Home Agent only owns ①(model)②(the fetch/report
  API)⑤⑥.** ③④ + the iOS auto-trigger live in `dockkit-demo` — do **not** edit
  that repo from here.
- Note: another session appears to be building the front-half pieces already
  (`RobotEventComposer.tsx` / `RobotEventContext.tsx` here, `EventReminder/` in
  `dockkit-demo`). Coordinate before touching those.

## Related docs
`ARCHITECTURE.md` (current wiring) · `DOCKIT_MEMORY_INTEGRATION.md` (⑤⑥ ingest) ·
`MEMORY_AUTO_EDIT_DESIGN.md` (Auri Cut, the proven Home Agent↔Auri integration).
