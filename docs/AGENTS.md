# Auri Agents

This app uses one canonical agent roster in `src/lib/team.ts`. Do not create a parallel
agent registry for chat, jobs, calendar, or robot events. Extend `TeamAgentId`,
`teamAgents`, and the derived helper allowlists instead.

## Canonical Fields

Each `TeamAgent` has:

- `id`: Stable machine id used by chat, jobs, calendar events, robot events, and stored drafts.
- `name`: User-facing display name.
- `role`: Full responsibility sentence for detail views and prompts.
- `shortRole`: Compact label for rows and small cards.
- `summary`: Human description for Jobs agent cards.
- `responsibilities`: Short editable bullets shown in agent management.
- `portrait`: Static asset path for large visual cards and cover surfaces.
- `portraitPosition`: CSS `object-position` for cropping the shared portrait source.
- `icon`: Existing `DoodleIcon` name for small UI.
- `tone`: Background color utility used by `TeamBadge`.
- `accent`: Text/accent color utility.
- `scope`: `group`, `private`, or `device`.

Editable UI overlays for built-in agents are stored in localStorage under
`auri.agentProfiles.v1`, but functional routing still comes from the canonical roster.
Custom agents created in the Jobs UI are profile-only until their id is added to
`TeamAgentId` and wired through the helper allowlists.

## Built-In Helper Agents

`cameraman`
: Captures polished keepsake media: family highlights, albums, photo/video memories,
and video receipts. Use `recordingMode = "cameraman_highlight"` for scheduled robot
highlight jobs.

`watcher`
: Performs recurring observation: every-X-minutes checks, 10-second clips, activity
recognition, and observation timelines. Use `recordingMode = "watcher_interval"`.
Watcher is for knowing what happened, not creating a keepsake film.

`companion`
: Reading, books, reading moments, learning questions, and kid activities.

`coach`
: Parent home workout coach: quick sets, form cues, reps, and workout routines.
Coach is not a parenting advice agent.

`homekeeper`
: Family operations: reminders, calendar drafts, appointments, school logistics,
and home checklists. Homekeeper may remind someone to feed the baby, but does not
record completed care events.

`baby_logger`
: Structured baby care logs for events that happened or are being recorded now:
feeding amount, sleep/nap, diapers, temperature, and medicine taken.

`auri`
: Primary home voice. Auri answers general/advice questions and delegates actionable
work to helper agents.

## Routing Boundaries

- "Remind me to feed Mia at 8" -> `homekeeper` reminder.
- "Mia drank 120ml" or "record Mia's nap" -> `baby_logger` baby log.
- "Film Leo's soccer moment tonight" -> `cameraman` highlight/capture.
- "Every 15 minutes, check what Mia is doing" -> `watcher` interval observation.
- "Read with Leo" -> `companion`.
- "Give me a 20-minute home workout" -> `coach`.

## Product Placement

Jobs tab order:

1. `Upcoming`: daily operational priority.
2. `Every day`: recurring jobs and toggles.
3. `Your agents`: large portrait cards, editable agent profiles, and new custom agent
   profiles.

New routine creation:

- The Every day action is labeled `New Routine`.
- One built-in agent maps to one fixed routine capability; do not create a second
  template-selection layer under an agent.
- The routine page should let the user choose the agent/capability once, then adjust
  configuration such as title, person, and time.
- Agent cards are introductory/edit surfaces only. Do not repeat job counts, next-run
  times, or on/off status there.

Chat home cover:

- A non-interactive 3-second image cover can use the same portrait asset.
- The cover should set mood and brand, not manage agents or jobs.
