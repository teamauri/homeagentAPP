/**
 * Auri app-id smoke test (Phase 1).
 *
 * Hits POST /v1/llm/token with our independent app-id to learn whether the
 * backend allowlists app-ids. Raw fetch — no build, no TS — so it runs anywhere.
 *
 *   AURI_HOST=https://auri-editor.onrender.com \
 *   AURI_APP_ID=homeagent-memory \
 *   node scripts/auri-smoke.mjs
 *
 * Reads .env.local if present. Interpreting the result:
 *   200            → backend is permissive; independent app-id costs zero backend work.
 *   401 / 403      → app-id is allowlisted; register `homeagent-memory` (or set
 *                    AURI_AUTH_TOKEN), or temporarily reuse dockkit's app-id.
 *   404 / network  → wrong host — confirm AURI_HOST (auri-editor vs auriedit).
 */

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Minimal .env.local loader (only fills vars not already in the environment).
const envPath = path.join(root, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const host = (process.env.AURI_HOST || "http://localhost:8000").replace(/\/$/, "");
const appId = process.env.AURI_APP_ID || "homeagent-memory";
const authToken = process.env.AURI_AUTH_TOKEN || undefined;

const url = `${host}/v1/llm/token?expire_in_seconds=1800`;
const headers = {
  "X-Auri-App-Id": appId,
  "X-Auri-Timestamp": new Date().toISOString(),
  "X-Auri-Trace-Id": randomUUID(),
};
if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

console.log(`POST ${url}`);
console.log(`  app-id: ${appId}${authToken ? " (+ PAT)" : ""}`);

try {
  const res = await fetch(url, { method: "POST", headers });
  const body = await res.text();
  console.log(`  status: ${res.status}`);
  console.log(`  body:   ${body.slice(0, 400)}`);

  if (res.ok) {
    console.log("\n✅ Backend is permissive — independent app-id works, zero backend setup.");
  } else if (res.status === 401 || res.status === 403) {
    console.log("\n⚠️  app-id rejected — register `homeagent-memory` with the Auri backend owner, set AURI_AUTH_TOKEN, or reuse dockkit's app-id temporarily.");
  } else if (res.status === 404) {
    console.log("\n⚠️  404 — likely wrong host. Confirm AURI_HOST (auri-editor.onrender.com vs auriedit.onrender.com).");
  } else {
    console.log("\n❓ Unexpected status — inspect body above.");
  }
} catch (err) {
  console.log(`\n❌ Network error: ${err?.message || err}`);
  console.log("   Confirm AURI_HOST is reachable (auri-editor.onrender.com vs auriedit.onrender.com).");
}
