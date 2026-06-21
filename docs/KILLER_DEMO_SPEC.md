# Killer demo — scheduled autonomous capture (spec)

> **Vision:** Mom schedules a moment in Home Agent → the robot cameraman wakes up
> at that time, films the family on its own → Auri edits it into a polished vlog →
> the finished film appears in Home Agent's Memory for her to watch. No manual
> filming, no manual editing, no manual import.

## The three pieces

| Piece | Repo | Role |
|---|---|---|
| **Home Agent** | `home-agent-app` (this repo) | AI home organizer for mom — schedules the capture, and is where the finished film lands + is viewed. |
| **DockKit (Talkie)** | `dockkit-demo` (iOS) | The robot cameraman — auto-tracks family members and records. |
| **Auri Editor** | `auri-editor` (backend) | Video editing service — turns the raw recording into an AI-edited vlog. |

## End-to-end loop

```
① Home Agent: mom creates a "capture task" (a calendar event = who + when [+ where])
        │ ② DockKit fetches the schedule from Home Agent
        ▼
③ At event time → DockKit auto-starts tracking + recording (no human start)
        ▼
④ Recording done → DockKit uploads the raw video to Auri Editor
        ▼
⑤ Auri Editor renders the vlog → Home Agent backend fetches + stores it
        ▼
⑥ Mom watches the finished film in Home Agent's Memory/Journey timeline
```

| Step | Owner | Status |
|---|---|---|
| ① create capture task | Home Agent | ⚠️ calendar events/objects exist; a robot-consumable **capture task** + display is partial / in progress |
| ② DockKit fetches schedule | Home Agent exposes API · DockKit consumes | ⚠️ Home Agent now exposes `GET /api/calendar?robot=true`; DockKit polling/auth/status linkage still not wired |
| ③ auto-start at event time | DockKit (iOS) | ❌ DockKit-side (out of this repo) |
| ④ upload raw video → Auri | DockKit · Auri | ✅ robot's existing capture→compose→vlog flow |
| ⑤ Auri → Home Agent ingest + store | Auri · Home Agent | ✅ `POST /api/ingest/auri-media` (multipart video + highlight images) → stored → Memory. See `DOCKIT_MEMORY_INTEGRATION.md` |
| ⑥ view in Home Agent | Home Agent | ✅ merges into the Journey timeline + `/memory/[id]` player |

So the **back half (④⑤⑥) works today**; the **front half (①②③) now has a
Home Agent schedule-read API, but DockKit polling, auto-triggering, auth, and
task→Memory linkage remain.** (Auri Cut — mom picks a phone video to auto-edit — already
proves the Home Agent ↔ Auri Editor integration end to end; see
`MEMORY_AUTO_EDIT_DESIGN.md`.)

## The missing link (front half)

**Home Agent side (this repo):**
- Model a **capture task**: currently a created calendar event with `forRobot:
  true`, time, subject, and optional media hints.
- Expose a **robot-readable API**: `GET /api/calendar?robot=true` returns created
  robot capture events from the demo store. Still missing: auth, explicit status
  report/update API, and task→Memory linkage after the finished film lands.

**DockKit side (`dockkit-demo`, out of this repo):**
- Poll/fetch the schedule from Home Agent; at event time auto-start tracking;
  after upload+edit, ingest the result back to Home Agent (existing path),
  tagged with the task id so Home Agent can link film → task.

## Open design questions
- Pull vs push: does DockKit **poll** Home Agent for tasks, or does Home Agent
  notify the robot? (Robot is on-device; polling is simplest.)
- Task → result linkage: pass a `taskId` through capture → Auri → ingest so the
  finished Memory attaches to the originating calendar task.
- Auth between DockKit and Home Agent (the robot-facing API).

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
