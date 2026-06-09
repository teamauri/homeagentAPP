# Codex Prompt — Build Auri Family OS Mobile Web Demo

You are building a 5-day investor demo for **Auri Family OS**.

## Product positioning

Auri is app-first. The app launches before the robot. The app helps families organize photos, calendar, kids' learning journeys, baby logging, meal prep, and family follow-up. Auri Robot later unlocks physical sessions like reading with Auri, practice clips, homework/object input, and family cameraman.

## Build target

Create a polished **Next.js + React + Tailwind mobile web app** optimized for iPhone viewport. It should look like an actual mobile app.

## Visual style

- White background, black text.
- Uber Black premium / editorial magazine feel.
- Large serif page titles.
- Minimal UI, thin lines, lots of whitespace.
- Notion-style colorful hand-drawn line icons.
- Avoid pastel parenting dashboard feel.
- Avoid cartoon agent faces.
- Avoid generic "Ask AI" button.

## Navigation

Bottom tabs:

1. Today
2. Calendar
3. Journeys
4. Moments
5. Family

## Required screens

### Today
- Header: `Today`
- Personal note: `今天也很好看。`
- Small Auri Robot status row: `Living Room · Ready · not recording`
- Section: `Needs You`
  - Piano plan is ready — View plan
  - Grandma update draft — Open draft
  - School photo note — Review
- Section: `Suggestions`
  - You · Pick one family photo for Friday
  - Mira · Make a Sunday story from 24 photos
  - Milo · Shorten tomorrow's piano plan to 5 minutes
  - Bibi · Suggest one more volcano book for Sophie
  - Nora · Check if this week has any family conflicts

### Calendar
- Header: `Calendar`
- Subtitle: `What's ahead for your family.`
- Filters: All / Sophie / Leo / Baby
- View toggle: Day / Week
- Real plans timeline:
  - Piano lesson — Tomorrow · 4:00 PM · Sophie — Prepared
  - Preschool — Friday · 8:30 AM · Sophie — Needs review
  - Grandma call — Sunday · 7:30 PM · Family — Ready
- AI suggestion:
  - Dinner at home — Friday · 6:30 PM — Suggested by Nora
- Weekly summary.

### Journeys
- Header: `Journeys`
- Subtitle: `Active help streams for your family.`
- Child Journeys:
  - Sophie · Piano — Milo — 3 tiny steps ready
  - Sophie · Reading — Bibi — Dinosaurs + volcanoes
  - Baby · Care Log — Nora — 4 feeds logged today
- Home Flows:
  - Family · Meal Prep — Nora — Dinner plan not started
- Add Help:
  - Meal Prep
  - Baby Logging
  - Homework Hints
  - Reading with Auri
  - Connect Doubao

### Moments
- Header: `Moments`
- Subtitle: `All your moments, in one timeline.`
- Filters: All / Auri / Phone / Reading
- Integrated timeline, not grouped by source:
  - Today 4:20 PM — Auri Robot — Soccer time backyard — Ready
  - Today 2:10 PM — Reading — Dinosaur Day — Saved
  - Yesterday 8:40 PM — Phone + Auri — Sophie's Sunday Story — Draft
  - Yesterday 7:30 PM — Phone — Grandma update — Draft
- Bottom story suggestion: `Sophie's Sunday was full of giggles, cozy moments, and little surprises.`

### Family
- Header: `Family`
- Subtitle: `Your family at a glance.`
- People:
  - Sophie — Piano tomorrow · Dinosaur books
  - Leo — Soccer clip ready
  - Baby — 4 feeds today
  - Mom — Primary admin
  - Dad — Daily brief
  - Grandma — Approved moments only
- Connected to your family:
  - Apple Calendar — Connected
  - iCloud Photos — Connected
  - Auri Robot — Ready
  - Doubao — Available for homework hints
  - Learning Apps — 2 connected
- House rules:
  - Ask before sending to family
  - Auri only saves invited robot moments
  - Low-interruption reminders

## Implementation requirements

- Use mock data from TypeScript objects, not hardcoded JSX only.
- Create reusable components: AppShell, BottomNav, Section, RowItem, StatusPill, DoodleIcon.
- Use client-side state for tab navigation.
- Keep the code small and easy to modify.
- Create responsive desktop wrapper but optimize for iPhone-sized canvas.
- No authentication, no real API integration in this demo.

## Non-goals

- Do not implement real Apple Calendar sync.
- Do not implement real iCloud Photos sync.
- Do not implement WhatsApp/Messenger/Doubao integration.
- Do not build an AI chat interface.
- Do not build a complete account/permissions system.

## Deliverable

A polished mobile web demo that can be deployed to Vercel and shown on iPhone.
