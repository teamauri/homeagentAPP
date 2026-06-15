# Chat API Validation

## Environment

The route supports DeepSeek as the preferred real AI provider, with Gemini as an optional secondary provider.

Local env:

```bash
DEEPSEEK_API_KEY=...
DEEPSEEK_MODEL=deepseek-chat # optional
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash # optional
```

Do not commit API keys. Put local keys in `.env.local` and production/preview keys in Vercel Environment Variables.

Provider priority:

1. DeepSeek when `DEEPSEEK_API_KEY` is present.
2. Gemini when `GEMINI_API_KEY` is present.
3. Deterministic fallback when no AI key exists or AI response validation fails.

If both AI provider keys are missing, `/api/chat` still works through deterministic fallback and returns:

```json
{
  "metadata": {
    "provider": "fallback",
    "fallbackUsed": true,
    "fallbackReason": "DEEPSEEK_API_KEY and GEMINI_API_KEY are missing"
  }
}
```

## Run locally

```bash
npm run dev
```

## Fallback smoke test

```bash
curl -s http://localhost:3000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "familyId": "family_demo",
    "userId": "mom_demo",
    "message": "Leo has basketball Friday at 5:30. Bring water bottle.",
    "attachments": [],
    "currentPage": "chat"
  }' | python3 -m json.tool
```

Expected:

- `handledByTeamMemberId` is `nora`
- `intent` is `calendar_event`
- cards include `calendar_draft` and `reminder`
- `objectsToCreate` includes `calendar_draft` and `reminder_draft`
- `createdLocalObjects` has two ids

With a working AI provider key, `metadata.provider` should be `deepseek` or `gemini` and `fallbackUsed` should be `false`.

## Required fixture messages

### Calendar + reminder

```txt
Leo has basketball Friday at 5:30. Bring water bottle.
```

Expected helper: Nora.

### Baby log

```txt
Baby drank 120ml at 8:30 AM.
```

Expected helper: Nina.

### Piano lesson

```txt
Here’s Sophie’s piano lesson video.
```

Use an attachment if desired:

```json
[{ "type": "video", "name": "lesson.mov" }]
```

Expected helper: Milo.

### Photo story

```txt
Make a Sunday update for Grandma.
```

Expected helper: Mira.

### Reading

```txt
Sophie loved the dinosaur book today.
```

Expected helper: Bibi.

## Vercel env

Use Vercel UI or CLI:

```bash
npx vercel@latest env add DEEPSEEK_API_KEY
npx vercel@latest env add DEEPSEEK_MODEL
npx vercel@latest env add GEMINI_API_KEY
npx vercel@latest env add GEMINI_MODEL
```

After adding env vars, redeploy the preview.

## Notes

- External integrations are mocked.
- Local objects are stored in a process-local demo store for the 5-day demo.
- Serverless memory can reset across deployments/cold starts; that is acceptable for this demo phase.
- If DeepSeek or Gemini returns invalid schema, times out, or the API fails, the route logs the error and falls back automatically.
