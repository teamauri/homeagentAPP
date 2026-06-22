// Persistence for the in-memory demo stores so ingested robot Stories, phone
// uploads, and organized album structure survive server restarts / cold starts.
//
// One JSON snapshot per store key, written under SNAPSHOT_DIR — a Render
// Persistent Disk in production (via DATA_DIR), else local `.data/` in dev. The
// disk survives restarts/redeploys; without it, persistence is per-instance only.
//
// Each store registers a snapshot()/restore() pair; reads stay synchronous, and
// routes call `ensureHydrated()` (once per cold start, per store) before reading
// and `persistStore(key)` after mutating. For strict cross-instance consistency
// under concurrency, move to a shared DB and swap the adapter — the store API
// does not change.

import { SNAPSHOT_DIR } from "./data-dir";

type Snapshot = Record<string, unknown>;

interface StoreRegistration {
  key: string;
  snapshot: () => Snapshot;
  restore: (data: Snapshot) => void;
}

const registry = new Map<string, StoreRegistration>();

export function registerStore(registration: StoreRegistration) {
  registry.set(registration.key, registration);
}

async function loadSnapshot(key: string): Promise<Snapshot | null> {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  try {
    const raw = await readFile(join(SNAPSHOT_DIR, `${key}.json`), "utf8");
    return JSON.parse(raw) as Snapshot;
  } catch {
    return null;
  }
}

async function saveSnapshot(key: string, data: Snapshot): Promise<void> {
  const json = JSON.stringify(data);
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  await mkdir(SNAPSHOT_DIR, { recursive: true });
  await writeFile(join(SNAPSHOT_DIR, `${key}.json`), json);
}

const hydratedKeys = new Set<string>();
const inflight = new Map<string, Promise<void>>();

/** Hydrate each registered store once per cold start (idempotent, registration-order safe). */
export function ensureHydrated(): Promise<void> {
  const tasks: Promise<void>[] = [];
  for (const registration of registry.values()) {
    if (hydratedKeys.has(registration.key)) continue;
    let task = inflight.get(registration.key);
    if (!task) {
      task = (async () => {
        const data = await loadSnapshot(registration.key).catch(() => null);
        if (data) {
          try {
            registration.restore(data);
          } catch {
            /* ignore malformed snapshot */
          }
        }
        hydratedKeys.add(registration.key);
        inflight.delete(registration.key);
      })();
      inflight.set(registration.key, task);
    }
    tasks.push(task);
  }
  return Promise.all(tasks).then(() => undefined);
}

/**
 * Force-reload a single store from its snapshot, bypassing the cold-start cache.
 * Call this before READING or MUTATING a store that other serverless instances
 * may have written, so a stale warm instance can't show — or worse, clobber on
 * the next persist — data another instance just wrote. (ensureHydrated only runs
 * once per instance, which is enough for cold starts but not for read-modify-
 * write across warm instances.)
 */
export async function reloadStore(key: string): Promise<void> {
  const registration = registry.get(key);
  if (!registration) return;
  const data = await loadSnapshot(key).catch(() => null);
  if (data) {
    try {
      registration.restore(data);
    } catch {
      /* ignore malformed snapshot */
    }
  }
  hydratedKeys.add(key);
}

/** Write one store's current snapshot. Best-effort: failures are swallowed. */
export async function persistStore(key: string): Promise<void> {
  const registration = registry.get(key);
  if (!registration) return;
  try {
    await saveSnapshot(key, registration.snapshot());
  } catch {
    /* best-effort: a failed snapshot must not break the request */
  }
}
