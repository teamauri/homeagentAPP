# Media + Memory API Validation

These endpoints are local-demo-store backed for the 5-day demo. They do not write to iCloud Photos, Auri Robot cloud, or any external service yet.

## Endpoints

- `POST /api/media/upload` uploads or registers phone media.
- `POST /api/ingest/auri-media` ingests Auri Robot clips/media.
- `GET /api/memory` returns fixture memory plus process-local uploaded/ingested memory.

## Phone media upload

JSON smoke test:

```bash
curl -s http://localhost:3000/api/media/upload \
  -H 'Content-Type: application/json' \
  -d '{
    "media": [
      {
        "title": "Friday family photo",
        "person": "family",
        "mediaType": "photo",
        "body": "Picked for Friday.",
        "tags": ["phone", "friday"]
      }
    ]
  }' | python3 -m json.tool
```

Expected:

- `media[0].source` is `phone`
- `memory.status` is `saved`
- `metadata.externalSync` is `mocked`

Multipart smoke test:

```bash
curl -s http://localhost:3000/api/media/upload \
  -F 'person=family' \
  -F 'title=Phone upload demo' \
  -F 'files=@/path/to/photo.jpg' | python3 -m json.tool
```

## Auri Robot ingest

```bash
curl -s http://localhost:3000/api/ingest/auri-media \
  -H 'Content-Type: application/json' \
  -d '{
    "robotId": "auri_living_room",
    "room": "Living Room",
    "memoryTitle": "Soccer time backyard",
    "memoryBody": "Leo scored twice and laughed non-stop.",
    "clips": [
      {
        "title": "Backyard goal clip",
        "person": "leo",
        "type": "clip",
        "durationSeconds": 12,
        "tags": ["soccer", "backyard"]
      }
    ]
  }' | python3 -m json.tool
```

Expected:

- `media[0].source` is `auri`
- `memory.sourceLabel` is `Auri Robot`
- `metadata.externalRobotSync` is `mocked`

## Memory feed

```bash
curl -s 'http://localhost:3000/api/memory?limit=20' | python3 -m json.tool
```

Expected:

- `items` includes seeded fixture memories.
- Uploaded phone media appears as saved memory during the same local server process.
- Ingested Auri Robot media appears as ready memory during the same local server process.
- `summary.auriMedia` and `summary.phoneMedia` count process-local demo media.

Filters:

```bash
curl -s 'http://localhost:3000/api/memory?person=leo&limit=10' | python3 -m json.tool
curl -s 'http://localhost:3000/api/memory?sourceType=auri&limit=10' | python3 -m json.tool
```

## Notes

- Process-local data resets when the dev server restarts or serverless instance resets.
- These endpoints are intentionally real API surfaces with mocked external effects.
- UI can render `items` as Memory rows/cards and use `media` for detail views.
