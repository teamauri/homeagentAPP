# Auri Repositioning — Design Doc

_Decided 2026-06-20. Supersedes the "serve-it assistant" framing in earlier docs for the three core tabs._

## 1. Positioning

Auri is a **photo frame + PTZ camera**: plugged in, mostly stationary, can be carried around. The camera points **down by default** and only **looks up to run a session**. When idle, it's a frame cycling the moments it caught.

**Core promise: set once → guaranteed daily delivery.** You don't use Auri like a chatbot moment-to-moment. You configure the output you want once; it delivers on schedule (calendar) or on trigger (alarm). Each output = one **session**: trigger → eyes work → a finished product. That determinism is the point.

What it is **not**: not an open conversation you serve, not a pile of material to organize, not a reminder that rings and is forgotten.

| Old (serve-it) | New (set-once delivery) |
| --- | --- |
| "Needs You" todo list (you do the work) | Today's deliveries (Auri did the work) |
| Auri drafts, you confirm | Auri runs configured sessions, no confirm |
| Pile of moments to organize | Finished products handed to you |
| Reminders that ring & forget | Routines tracked to closure |

## 2. The atomic object: Session (产出)

Everything the user sets becomes a `Session`. Extends the existing `RobotEvent` / `RobotEventContext`.

```
Session {
  id
  type:    'highlight' | 'reading' | 'routine' | 'checkin' | 'nudge'
  trigger: { kind: 'recurring', schedule }      // e.g. daily 17:00–20:00
         | { kind: 'oneoff', date }             // e.g. next Tue 15:00
  source:  'chat' | 'todo' | 'gcal'             // where it came from
  person, title
  subtasks: SubTask[]   // PLANNED — not implemented yet (see §6)
  state:   'configured' | 'armed' | 'running' | 'delivered' | 'paused'
  output?: Deliverable  // reel / reading recap / closed checklist / verdict
  enabled: boolean
}
```

Four delivery types + one lightweight fallback:

- **Highlight (高光)** — set "3×30s + 5 photos daily" in a window (e.g. 5–8pm). Auri looks up in the window, catches real moments, hands you the edited set at day's end.
- **Reading (读书)** — set "15 min daily". At time, Auri + child read a real book; you get a "what was read today" recap.
- **Routine** — set a flow (leaving for school: bottle → fruit → shoes → coat). Alarm rings, someone taps to **start the session**; each step is ticked to closure.
- **Check-in** — set a reminder for someone at home (sitter/grandparent): noon meds + vitamins. Alarm rings at home, a tap starts the session, Auri records + analyzes and pushes you the one key fact (taken / not).
- **Nudge** — the lightest type. No capture, no product; Auri just surfaces it once at its time. Used for pure human to-dos and most imported calendar events. Auri is **not** a general to-do list — nudge is the exception, not the star.

The three retained agents map to types: **Iris → highlight, Lumi → reading, Vita → routine + check-in**. Nova (workout) and Sera (calm) are cut — they don't fit a downward-camera frame.

## 3. Information architecture — 3 tabs

Minimal change: same three bottom-nav keys, repurposed content. `memory`/Journey already matches the style guide; `chat` and `today` get restyled to match it.

| Tab key | New name | Form | Job |
| --- | --- | --- | --- |
| `chat` | **首页 / Home** | a living stream | see today · set tasks · receive updates |
| `today` | **Jobs** | a control panel | manage what Auri's set to do: upcoming one-offs + on/off standing jobs |
| `memory` | **相框 / Frame** | a gallery | highlight products accumulate; idle-frame content |

**Cut:** standalone Today tab, the today status strip, calendar as a nav tab, the Needs-You list, Nova & Sera.

Each tab has a **distinct visual form** so they never read alike: Home = stream, Auri-在做的事 = control list, Frame = gallery.

### 3a. Home (`chat`)

A pure chronological stream + composer. No pinned status strip — determinism lives in the stream itself:

- Past sessions collapse to a one-line gray row (e.g. "出门上学 routine · 4/4 闭环 ✓").
- A `NOW` marker separates done / happening / not-yet.
- The running session is a live card near the bottom (camera-up highlight capturing, ticking routine checklist).
- Finished updates land as their own cards (reading recap, the edited highlight set).
- You type to set tasks; one-offs ("next Tue capture the recital") are accepted and confirmed inline.

Device/camera status, if surfaced, lives in the top app header line (`Auri · Living Room`), not a separate block.

### 3b. Jobs (`today`)

A control panel, two zones:

- **即将 · 一次性** (upcoming, one-off) — dated sessions + imported Google Calendar events, sorted by date, **auto-clears after firing**. This is the lightweight agenda; no calendar grid needed.
- **每天在做 · 常驻** (recurring) — each session is one compact row: doodle icon + name + trigger + health dot + on/off toggle. Grouped by type. No thumbnails, no "view product" — purely "is it on, when does it fire, is it healthy."

A `清单 | 日历` toggle switches the recurring view to a **read-only week overlay**: Auri sessions colored by type laid over real calendar events, surfacing conflicts (e.g. "Wed: highlight window collides with parent meeting"). Editing happens back in Google Calendar — Auri's calendar view exists only to show how Auri fits your week, not to manage time.

`+ New Routine` offers the routine templates; each asks only the minimal config so "set once" takes ~30s.

### 3c. 相框 (`memory`)

Unchanged from the current Journey/Moments screen (already the canonical style). Receives highlight products long-term and is what the device shows when idle.

## 4. Stream update rule (Home)

Each session is an agent reporting progress. Rule:

- **In-session progress → update in place.** One live card; completed substeps collapse to ticked one-liners so the card never balloons (4 steps = 4 short rows). One live card per session, sits at the stream bottom while running, then **collapses to a single line** and sinks into history when done.
- **New message → only for** (a) a finished update you'll want to scroll back and find, and (b) anything needing your eyes (check-in "tap to start", a "not taken" alert).

Rule of thumb: "would you want to find this in history as its own thing?" Yes → new message; "step 2 of 4 done" → in place. This keeps the stream quiet most of the time — a few finished updates + the occasional tap, not dozens of pings. Per type:

| Type | In place | New message |
| --- | --- | --- |
| Routine | checklist ticks | collapses to one line on closure |
| Highlight | counter `1/3 段 · 2/5 张` | edited set at night |
| Reading | `reading… 12 min` | recap when done |
| Check-in | recording/analyzing | "tap to start" + result (taken/not) |

## 5. Reminders / events — three sources, one model

All three funnel into the same "即将" zone and the same Session model:

| Source | Default type | Upgradable? |
| --- | --- | --- |
| User says in chat ("capture the recital tomorrow") | session or nudge (by intent) | — |
| Pure personal to-do ("pay the bill") | nudge | — |
| Existing Google Calendar event | nudge (tagged `Google 日历`) | Auri proactively offers to upgrade capturable ones to a session |

**Demo decision:** do **not** build real OAuth. Mock a "connected to Google Calendar" state + seeded events. Keep a thin `CalendarSource` adapter so it can be swapped for a real `calendar.readonly` API later without touching UI. The mock calendar view already built becomes the read-only week overlay (§3b) — near-zero extra cost.

## 6. Open / deferred

- `subtasks[]` and `liveCardState` on Session are **planned, not yet built** — design them when we implement the live-card mechanism, build alongside it.
- Whether to accept pure `nudge` to-dos at all, or only Auri-runnable sessions (current lean: accept nudge as the explicit exception).

## 7. Visual style

Match the style guide in `assets/` (Journey/Moments is the reference). Tokens: cream `#f5f1eb` background, white cards with soft shadow, `font-display` (Georgia serif) titles, Inter body, pill filter tabs (`border-ink bg-ink` active), tinted status pills, the hand-drawn `DoodleIcon` set, 3-tab bottom nav. See `docs/DESIGN_SYSTEM.md`.
