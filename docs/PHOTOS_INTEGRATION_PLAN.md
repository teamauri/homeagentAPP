# Photos Integration Plan

## Principle

Auri should help users organize family photos without asking for unnecessary broad access. Photo access should be privacy-first and incremental.

## Phase 1 — Web demo

- Mock iCloud Photos connection.
- Let users upload selected files manually if needed.
- Show how Auri creates unified Moments from Phone + Auri Robot + Reading.

## Phase 2 — iOS app

Use native iOS photo APIs. PhotoKit provides access to photo/video assets managed by Photos, including iCloud assets, with user permission. iOS also supports limited photo-library access where users choose specific assets.

Preferred approach:

1. Start with selected-photo import / picker.
2. Build local lightweight index: date, asset id, thumbnail, location if available and permitted.
3. Upload only user-approved photos, thumbnails, or derived embeddings.
4. Generate story drafts locally/server-side with explicit approval before sharing.
5. Preserve a permission ledger: what was accessed, saved, shared.

## Phase 3 — Android app

Use Android Photo Picker first. It lets users grant access to selected images/videos without giving the app broad media-library access.

Preferred approach:

1. Use selected media picker initially.
2. Add optional broader media-library access later only if essential.
3. Keep parity with iOS story draft and permission UX.

## Product UX

Photos should flow into Moments as a timeline:

- Phone photos
- Auri Robot clips
- Reading moments
- Practice clips
- Shared drafts

Auri should not feel like a surveillance app or a generic photo app. It should feel like a family story system.
