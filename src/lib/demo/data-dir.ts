import path from "node:path";

// Single root for everything the app persists at runtime — uploaded/rendered
// media and the demo-store JSON snapshots.
//
// On Render the container filesystem is ephemeral (wiped on restart/redeploy),
// so point DATA_DIR at a mounted **Persistent Disk** (e.g. /var/data) and both
// media and snapshots survive. Unset (local dev): keep the original layout —
// media in public/demo-media, snapshots in .data — so nothing changes locally.
const ROOT = process.env.DATA_DIR;

export const MEDIA_DIR = ROOT
  ? path.join(ROOT, "demo-media")
  : path.join(process.cwd(), "public", "demo-media");

export const SNAPSHOT_DIR = ROOT ? path.join(ROOT, "demo-store") : path.join(process.cwd(), ".data");
