# Auri App Demo Master Plan

## Current Direction

Auri is moving from a static five-tab dashboard demo to a chat-first family OS demo.

The new core product loop is:

```txt
Family input → real AI understanding → helper routing → structured cards → local draft objects → review/action detail
```

The UI should still feel like a premium mobile app, not a generic chatbot. Chat is the input layer; cards, drafts, memory, and family objects are the product.

## Product Goal

Build a 5-day mobile web demo that proves:

1. Auri can understand free-form family input with a real LLM.
2. Auri routes work to the right helper.
3. Auri creates useful local work objects, not just replies.
4. Photos, robot clips, reading moments, and family logistics can live in one family OS.
5. External integrations can stay mocked while the core AI loop feels real.

## Information Architecture

The old tabs:

```txt
Today | Calendar | Journeys | Moments | Family
```

should be replaced with a focused three-tab structure:

```txt
Today | Chat | Memory
```

### Today

Purpose: a calm family inbox and demo launch point.

Shows:

- today's prepared work
- latest AI-created objects
- "Needs review" cards
- robot/privacy status
- shortcuts into Chat
- memory/photo/story highlights
- global Ask Auri composer fixed at the bottom

### Chat

Purpose: primary AI input and response surface.

Shows:

- parent message bubbles
- selected helper identity
- natural language AI reply
- structured clickable cards
- loading, error, and fallback states
- lightweight object detail views or sheets launched from cards
- global Ask Auri composer fixed at the bottom

### Memory

Purpose: integrated family memory timeline and story surface.

Shows:

- phone photos
- Auri Robot clips
- reading moments
- Grandma update drafts
- story cards created from Chat
- global Ask Auri composer fixed at the bottom

### Family / Settings

Purpose: family graph, helpers, connections, and safety.

Family is not a primary nav tab in the current UI direction. It should be available later through a secondary route, settings affordance, or profile entry.

Shows:

- family members
- helper team
- connected sources
- house rules
- privacy and sharing rules

### Hidden / Secondary Surfaces

Objects and Family should exist as secondary routes or sheets, not main nav tabs.

Examples:

- `/objects/:id` for card details
- `/family` for members, helpers, sources, and house rules
- `/objects` only if needed for internal QA, not first-line product navigation

## Current UI Reference Requirements

The latest UI references show a white, premium, serif-led iPhone app with a top segmented nav and a persistent bottom composer.

### Global Layout

- iPhone-sized white canvas.
- iOS status row at top.
- Top segmented nav: `Today | Chat | Memory`.
- Active nav segment is black with white text.
- Large serif page titles.
- Thin borders, soft shadows, large radii, restrained color.
- Ignore exact icon consistency for now; preserve placement and hierarchy.

### Persistent Composer

The `Ask Auri anything...` input exists on every primary page and should remain visually consistent.

Composer elements:

- left circular plus button
- placeholder text: `Ask Auri anything...`
- microphone icon
- black circular send/up-arrow button
- floating rounded pill with subtle shadow
- fixed near bottom inside the phone shell

Behavior:

- On Chat: sends a message into the current thread.
- On Today/Memory: entering text should route the user into Chat with the draft or submitted message.
- Plus and microphone can be non-functional in the first demo step.

### Today Reference

Required elements:

- top segmented nav
- large `Today` title
- greeting: `Good afternoon, Jane.`
- summary: `You have 4 things to look at today.`
- black `View Calendar` button
- Auri Robot status row: `Living Room · Ready · not recording`
- `Needs You` section
- four work cards:
  - Piano recording and teacher notes are ready → `View recap`
  - Basketball game draft added → `Review`
  - Baby may be ready to feed → `Log feed`
  - New memory from Auri Robot → `View`
- each work card has icon, title, body, helper attribution, CTA, dismiss `×`
- `Recent in Memory` section with two rows:
  - Soccer time backyard
  - Dinosaur Day
- persistent composer

### Chat Reference

Required elements:

- top segmented nav
- large `Chat` title
- subtitle: `Sophie’s Family`
- message rows with avatar, sender name, timestamp, bubble
- assistant/helper rows with distinctive helper avatar
- inline structured cards under helper reply
- cards show icon, type label, title, metadata, CTA
- example thread includes:
  - Mom basketball request
  - Nora calendar draft + reminder cards
  - Dad pickup message
  - Nora pickup card
  - Mom piano lesson video
  - Milo lesson recap card
  - Mom Sunday Grandma update
  - Mira Grandma update draft card
- persistent composer

## Required End-to-End Demo Loop

The first fully working flow should be:

```txt
Mom enters:
"Leo has basketball Friday at 5:30. Bring water bottle."

Auri routes to:
Nora the Home Coordinator

UI renders:
AI reply
Calendar draft card
Reminder card

Click calendar card:
Calendar draft detail

Click action:
Add to calendar → status becomes Added locally
```

This golden path should work before expanding polish across every screen.

## Backend Scope

### Real

- `POST /api/chat`
- OpenAI structured output
- compact family context
- helper routing
- natural language reply
- structured cards
- local draft object creation
- fallback deterministic handler for demo reliability

### Mocked

- Apple Calendar write
- Reminder app write
- iCloud Photos sync
- school email integration
- caregiver notification
- Grandma sending
- full video transcription/editing

## API Surface

Required endpoints:

- `POST /api/chat`
- `POST /api/ingest/auri-media`
- `POST /api/media/upload`
- `GET /api/memory`

Optional demo endpoints:

- `GET /api/objects`
- `GET /api/objects/:id`
- `POST /api/objects/:id/actions`

## Shared Contracts

Create shared TypeScript contracts before parallel implementation:

- `ChatAIResponse`
- `ChatCard`
- `DemoObject`
- `ChatMessage`
- `TeamMember`
- `FamilyContext`
- `ObjectAction`

Recommended location:

```txt
src/lib/chat/types.ts
src/lib/demo/family-context.ts
src/lib/demo/demo-store.ts
src/lib/demo/fallback-handler.ts
```

## Parallel Workstreams

## Active Session Ownership

Only one session may own a UI surface at a time. When a session owns a file group,
other sessions must not edit those files without an explicit handoff.

### Project Planner / Integration Lead

Owner:

- product plan
- task sequencing
- session coordination
- merge readiness
- demo validation checklist

Editable files:

- `docs/MASTER_PLAN.md`
- release/demo notes
- integration-only glue after other sessions finish

Avoid:

- direct UI implementation unless explicitly reassigned
- changing contracts while the contracts owner is active

### UI Owner

Thread:

- `Auri UI Owner — Today/Chat/Memory visual implementation`

Owns:

- mobile shell
- `Today | Chat | Memory` navigation
- global composer
- Today visual implementation
- Chat visual implementation
- Memory visual implementation
- responsive iPhone layout

Editable files:

- `src/app/page.tsx`
- `src/components/AppShell.tsx`
- `src/components/TodayView.tsx`
- `src/components/ChatView.tsx`
- `src/components/MomentsView.tsx`
- `src/app/globals.css`
- purely visual UI components

Do not edit:

- `src/lib/chat-contracts.ts`
- `src/lib/chat-fixtures.ts`
- `src/components/ChatCardRenderer.tsx`
- `src/app/chat-card-preview/**`
- `src/app/api/**`

### Contracts Owner

Thread:

- `Auri Contracts Owner — Chat cards/types preview`

Owns:

- chat contracts
- card fixture data
- generic card renderer
- card preview route
- API-safe pure helpers

Editable files:

- `src/lib/chat-contracts.ts`
- `src/lib/chat-fixtures.ts`
- `src/components/ChatCardRenderer.tsx`
- `src/app/chat-card-preview/**`

Do not edit:

- `src/app/page.tsx`
- `src/components/AppShell.tsx`
- `src/components/TodayView.tsx`
- `src/components/ChatView.tsx`
- `src/components/MomentsView.tsx`
- `src/app/globals.css`

### API Owner

Thread:

- `Auri API Owner — Real AI chat endpoint`

Owns:

- `src/app/api/chat/route.ts`
- `src/lib/demo/fallback-handler.ts`
- `src/lib/demo/family-context.ts`
- `src/lib/demo/demo-store.ts` if needed
- OpenAI integration helpers

Must consume contracts from the Contracts Owner.

Do not edit:

- `src/app/page.tsx`
- `src/components/AppShell.tsx`
- `src/components/TodayView.tsx`
- `src/components/ChatView.tsx`
- `src/components/MomentsView.tsx`
- `src/app/globals.css`

### Session A — Contracts and Store

Owns:

- shared TypeScript types
- family/team context
- in-memory demo store abstraction
- object creation helpers
- object-to-route mapping

Should not own:

- final UI styling
- OpenAI prompt tuning

### Session B — Real AI Chat Backend

Owns:

- `POST /api/chat`
- OpenAI API call
- structured JSON schema
- schema validation
- fallback deterministic handler
- error logging

Depends on:

- Session A contracts

### Session C — Chat UI

Owns:

- Chat screen
- message composer
- user/helper message rows
- card renderer
- loading and error states

Depends on:

- Session A contracts
- can start with fake local responses before Session B lands

### Session D — Object Detail Surfaces

Owns:

- detail pages or sheets for local drafts
- mock local actions
- object status transitions

Depends on:

- Session A store/contracts

### Session E — Today and Memory Integration

Owns:

- Today inbox fed by chat-created objects
- Memory primary tab
- Recent in Memory section
- integrated Memory timeline UI
- Auri Robot + phone + reading summaries

Depends on:

- Session A object contracts

### Session F — QA, Demo Script, Deploy

Owns:

- five required input smoke tests
- build checks
- Vercel env checklist
- two-minute demo script
- release notes for team preview

Depends on:

- Sessions B/C/D golden path

## UI Dependency Policy

The product manager will provide updated UI screenshots and UI copy.

Until those arrive:

- do not over-polish the existing five old pages
- do not keep Calendar/Journeys as primary navigation
- do not add Objects/Family as primary nav
- do build reusable primitives that can survive the redesign
- do prioritize Chat, Cards, local objects, Today inbox, and Memory

When UI assets arrive:

1. map screenshots to `Today | Chat | Memory`
2. extract reusable components
3. update design tokens
4. implement screen-by-screen
5. preserve the AI/object backend contracts

## Small-Step Chat Build Plan

Every step must produce:

1. a working product demo for the PM
2. a deterministic test or smoke test
3. a production build check

### Step 1 — Static Chat Prototype

Goal:

- Replace main nav with `Today | Chat | Memory`.
- Add a Chat screen using hardcoded local demo transcript.
- Render user message, helper identity, reply, and two cards.
- Add persistent composer across primary pages.

PM demo:

- Open Chat and see the Nora basketball example rendered.
- Click cards and see placeholder detail sheets/routes.
- Switch Today/Chat/Memory and see the same composer.

Test:

- `npm run build`
- manual click through Chat → card detail

### Step 2 — Shared Contracts and Local Store

Goal:

- Add shared chat/object types.
- Add local demo store abstraction.
- Store chat messages and created objects in one place.

PM demo:

- Send a local mocked message and see objects appear in Chat and Today.

Test:

- unit/smoke test object creation helpers
- `npm run build`

### Step 3 — Fallback Handler Endpoint

Goal:

- Add `POST /api/chat` without OpenAI first.
- Use deterministic fallback for the five required PRD examples.
- Return the final API shape.

PM demo:

- Type the five examples and see correct helper/cards.

Test:

- API fixture tests for five examples
- `npm run build`

### Step 4 — Real AI Structured Output

Goal:

- Add OpenAI integration behind `OPENAI_API_KEY`.
- Use structured output schema.
- Fall back if key/API/schema fails.

PM demo:

- Type a non-exact family request and see sensible routing/cards.

Test:

- fixture tests still pass with fallback
- one manual real-AI test when key is configured
- `npm run build`

### Step 5 — Card Detail Actions

Goal:

- Cards link to detail views.
- Mock actions update local status.
- Examples: Add to calendar, edit reminder, view baby log, open Grandma draft.

PM demo:

- Complete the golden path: Chat → Nora cards → Calendar detail → Added locally → Today reflects update.

Test:

- route/action smoke tests
- `npm run build`

### Step 6 — Today Integration

Goal:

- Today becomes an inbox of recent AI-created objects.
- Show active drafts, done statuses, and robot/privacy context.

PM demo:

- After using Chat, Today feels updated and alive.

Test:

- create object → Today list updates
- `npm run build`

### Step 7 — Memory Primary Tab

Goal:

- Memory page shows phone photos, Auri Robot clips, reading moments, and story drafts together.
- Chat-created memory/story objects appear in Memory.

PM demo:

- Show how Chat-created story/memory items land in Memory.

Test:

- `npm run build`

### Step 8 — Demo QA and Deploy

Goal:

- Verify 2-minute script.
- Deploy preview.
- Record known limitations.

PM demo:

- Team gets a new preview URL and a short script.

Test:

- five required input smoke tests
- `npm run build`
- Vercel preview

## Acceptance Criteria

1. Chat uses a real LLM when `OPENAI_API_KEY` exists.
2. Chat still works with fallback when AI fails or key is missing.
3. Five required PRD inputs route to the expected helper.
4. AI responses include structured clickable cards.
5. Cards create and link to local draft objects.
6. Mock actions update local status.
7. Memory shows phone media, Auri Robot clips, and reading moments together.
8. Demo can be shown end-to-end in under two minutes.
9. Production build passes.
10. Vercel preview can be shared with the team.

## Immediate Next Step

Start Chat function work now, before final UI images arrive:

1. implement `Today | Chat | Memory` nav
2. build static Chat prototype for the Nora basketball example
3. add persistent composer across Today, Chat, and Memory
4. add card renderer and placeholder detail routes
5. run `npm run build`
6. let PM verify the first visible Chat demo
