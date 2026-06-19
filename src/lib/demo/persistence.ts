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
const blobPathname = (key: string) => `demo-store/${key}.json`;

async function loadSnapshot(key: string): Promise<Snapshot | null> {
  if (useBlob) {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: blobPathname(key) });
    const hit = blobs.find((blob) => blob.pathname === blobPathname(key));
    if (!hit) return null;
    const response = await fetch(hit.url, { cache: "no-store" });
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
    const { put } = await import("@vercel/blob");
    await put(blobPathname(key), json, {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
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
