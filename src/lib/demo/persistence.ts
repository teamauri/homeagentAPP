// Persistence for the in-memory demo stores so ingested robot Stories, phone
// uploads, and organized album structure survive server restarts / new
// serverless cold starts.
//
// Backend (pluggable, zero forced setup — mirrors media-storage.ts):
//   - Vercel Blob (BLOB_READ_WRITE_TOKEN present): one public JSON snapshot per
//     store key. Works on Vercel where the filesystem is read-only/ephemeral.
//   - Local file `.data/<key>.json` (dev): survives `next dev` restarts.
//   - Neither: no-op (pure in-memory, original behaviour).
//
// Each store registers a snapshot()/restore() pair; reads stay synchronous, and
// routes call `ensureHydrated()` (once per cold start, per store) before reading
// and `persistStore(key)` after mutating. For strict cross-instance consistency
// under concurrency, provision Vercel KV later and swap the adapter — the store
// API does not change.

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

const useBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
// Each persist writes a NEW unique blob under this folder and readers pick the
// newest. We never overwrite a fixed pathname, so a reader can never be served a
// CDN-cached stale copy of an overwritten URL — the root cause of vanishing
// photos. (Vercel Blob is really for immutable assets; for heavier concurrency
// swap this adapter for Vercel KV without touching the store API.)
const blobFolder = (key: string) => `demo-store/${key}/`;

async function loadSnapshot(key: string): Promise<Snapshot | null> {
  if (useBlob) {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: blobFolder(key) });
    if (!blobs.length) return null;
    // Newest write wins. Each blob has a unique URL, so this fetch is fresh.
    const newest = blobs.reduce((a, b) => (new Date(a.uploadedAt) >= new Date(b.uploadedAt) ? a : b));
    const response = await fetch(newest.url, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as Snapshot;
  }

  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  try {
    const raw = await readFile(join(process.cwd(), ".data", `${key}.json`), "utf8");
    return JSON.parse(raw) as Snapshot;
  } catch {
    return null;
  }
}

async function saveSnapshot(key: string, data: Snapshot): Promise<void> {
  const json = JSON.stringify(data);
  if (useBlob) {
    const { put, list, del } = await import("@vercel/blob");
    const folder = blobFolder(key);
    // Write a NEW unique blob (unique URL → never a stale CDN hit on read).
    const pathname = `${folder}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
    await put(pathname, json, { access: "public", contentType: "application/json", addRandomSuffix: false });
    // Best-effort prune of superseded snapshots so the folder doesn't grow.
    try {
      const { blobs } = await list({ prefix: folder });
      const stale = blobs.filter((b) => b.pathname !== pathname).map((b) => b.url);
      if (stale.length) await del(stale);
    } catch {
      /* pruning is best-effort */
    }
    return;
  }

  const { mkdir, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const dir = join(process.cwd(), ".data");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${key}.json`), json);
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
