# Technical Architecture

## Short term

Build the demo with Next.js + React + Tailwind.

Reason:
- Fastest path to polished mobile web demo.
- Deployable to Vercel.
- Easy to run in Codex.
- Good foundation for web product.

## Long term

Use a monorepo:

```txt
apps/
  web/        Next.js
  mobile/     Expo / React Native
packages/
  core/       shared types and business logic
  api-client/ API client
  design/     tokens and shared UI primitives
  agents/     helper/job abstractions
  media/      media import and processing abstractions
```

## Why native mobile later

Native iOS/Android is needed for:
- Photos library integration.
- Push notifications.
- Share extensions.
- Background uploads/processing.
- Auri Robot BLE/Wi-Fi setup.
- Camera/microphone/local media capabilities.

Expo/React Native is the natural bridge because it keeps React mental model while supporting native iOS/Android features.

## Backend later

Auri will need a backend for:
- Auth and family graph.
- Source connections.
- Moment indexing.
- Agent/job queue.
- Media processing.
- Permissions and audit log.

Demo can use mock JSON.
