# Design System — Auri Family OS Demo

## Direction

White background, black typography, premium editorial feel, Notion-style colorful line icons.

Avoid:
- Pastel baby dashboard.
- Large cartoon avatars.
- Generic AI chat button.
- Heavy gradients.
- Too many cards.

## Visual references

- Uber Black premium restraint.
- Fashion magazine typography.
- Notion-like hand-drawn utility icons.
- High whitespace, thin borders, minimal status colors.

## Typography

Use large serif headings and clean sans-serif body.

Suggested CSS:

```css
--font-display: Georgia, 'Times New Roman', ui-serif, serif;
--font-body: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

## Colors

```css
--bg: #ffffff;
--ink: #080808;
--muted: #6f6f6f;
--line: #e7e2dc;
--card: #ffffff;
--soft: #faf8f5;
--gold: #c08a2b;
--green: #2f9d5b;
--orange: #e07a2f;
--blue: #2e7dd1;
--purple: #7a55c7;
--pink: #db5a82;
```

## Layout

- Mobile-first canvas: 390px wide.
- Desktop demo wrapper may center an iPhone-like canvas.
- Bottom nav fixed.
- Top page padding: 32px.
- Section gap: 28px.
- Row height: 72–96px.

## Components

### PageTitle
Serif, large, black.

### SectionTitle
Serif or semi-serif, medium.

### RowItem
Thin border, radius 20–24px, white background, icon left, text center, action/status right.

### SuggestionRow
No heavy card. Simple line row with helper chip.

### StatusPill
Small pill, muted border, status-specific color.

### DoodleIcon
SVG line-drawn icon. Black stroke + 1–2 accent strokes.

## Icon style

Icons should feel hand-drawn, like Notion illustrations:
- Thin black outline.
- Small colored accent marks.
- Slightly playful but not childish.
- Keep all icons simple and consistent.
