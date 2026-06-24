import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverDir = path.join(root, ".next", "server");
const require = createRequire(import.meta.url);

const e2ePrefix = `e2e_cameraman_${Date.now()}`;
const cleanupIds = [];

function assert(condition, message, details) {
  if (!condition) {
    const suffix = details ? `\n${JSON.stringify(details, null, 2)}` : "";
    throw new Error(`${message}${suffix}`);
  }
}

function prepareNextServerChunks() {
  const chunksDir = path.join(serverDir, "chunks");
  if (!fs.existsSync(chunksDir)) return;

  for (const entry of fs.readdirSync(chunksDir)) {
    if (!entry.endsWith(".js")) continue;
    const linkPath = path.join(serverDir, entry);
    const target = path.join("chunks", entry);
    try {
      fs.symlinkSync(target, linkPath);
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
  }
}

function routeUserland(routePath) {
  const fullPath = path.join(root, ".next", "server", "app", routePath, "route.js");
  assert(fs.existsSync(fullPath), `Missing built route: ${routePath}. Run npm run build first.`);
  return require(fullPath).routeModule.userland;
}

async function jsonFromResponse(response) {
  return response.json();
}

async function postJson(route, url, body, params) {
  return route.POST(
    new Request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    params ? { params } : undefined
  );
}

async function getWithParams(route, url, params) {
  return route.GET(new Request(url, { method: "GET" }), { params });
}

async function deleteCalendarEventIfPresent(calendarRoute, id) {
  try {
    await calendarRoute.DELETE(
      new Request(`http://localhost/api/calendar?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      })
    );
  } catch {
    // Best-effort cleanup only; preserve the original e2e failure.
  }
}

function cleanupE2ESnapshot() {
  const snapshotPath = path.join(root, ".data", "demo.json");
  if (!fs.existsSync(snapshotPath)) return;
  const data = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  const removedUrls = [];
  const isE2ECapture = (value) => typeof value === "string" && value.startsWith(e2ePrefix);

  if (Array.isArray(data.media)) {
    data.media = data.media.filter((item) => {
      const isE2E = isE2ECapture(item?.metadata?.captureTaskId);
      if (isE2E && typeof item.url === "string") removedUrls.push(item.url);
      return !isE2E;
    });
  }

  if (Array.isArray(data.memory)) {
    data.memory = data.memory.filter((item) => !isE2ECapture(item?.metadata?.captureTaskId));
  }

  fs.writeFileSync(snapshotPath, JSON.stringify(data));
  for (const url of removedUrls) {
    const name = url.split("/").pop();
    if (!name) continue;
    for (const dir of [path.join(root, ".data", "media"), path.join(root, ".data", "blobs")]) {
      try {
        fs.unlinkSync(path.join(dir, name));
      } catch {
        // Blob may already be absent depending on storage backend.
      }
    }
  }
}

async function withFakeAuriVlogServer(fn) {
  const videoBytes = Buffer.from("fake cameraman highlight mp4 bytes");
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (req.method === "GET" && url.pathname === "/v1/videos/video-e2e-cameraman/vlogs/vlog-e2e-cameraman/download") {
      res.writeHead(200, { "content-type": "video/mp4", "content-length": String(videoBytes.length) });
      res.end(videoBytes);
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const previousHost = process.env.AURI_HOST;
  const previousPublicHost = process.env.NEXT_PUBLIC_AURI_HOST;
  const fakeHost = `http://127.0.0.1:${address.port}`;
  process.env.AURI_HOST = fakeHost;
  process.env.NEXT_PUBLIC_AURI_HOST = fakeHost;
  try {
    return await fn();
  } finally {
    if (previousHost === undefined) delete process.env.AURI_HOST;
    else process.env.AURI_HOST = previousHost;
    if (previousPublicHost === undefined) delete process.env.NEXT_PUBLIC_AURI_HOST;
    else process.env.NEXT_PUBLIC_AURI_HOST = previousPublicHost;
    await new Promise((resolve) => server.close(resolve));
  }
}

prepareNextServerChunks();

const calendarRoute = routeUserland("api/calendar");
const robotStatusRoute = routeUserland("api/robot/capture-tasks/[taskId]/status");
const highlightSyncRoute = routeUserland("api/robot/capture-tasks/[taskId]/highlight/sync");
const memoryRoute = routeUserland("api/memory");
const mediaBlobRoute = routeUserland("api/media/blob/[name]");

async function cleanup() {
  for (const id of cleanupIds) await deleteCalendarEventIfPresent(calendarRoute, id);
  cleanupE2ESnapshot();
}

process.on("uncaughtException", async (error) => {
  await cleanup();
  console.error(error);
  process.exitCode = 1;
});

const cameramanTaskId = `${e2ePrefix}_highlight`;
const agentOnlyTaskId = `${e2ePrefix}_agent_only`;
const missingIdsTaskId = `${e2ePrefix}_missing_ids`;

try {
  const createCameramanResponse = await postJson(calendarRoute, "http://localhost/api/calendar", {
    id: cameramanTaskId,
    title: "E2E cameraman highlight",
    note: "Scheduled highlight should use cameraman pipeline.",
    person: "mia",
    dateLabel: "Today",
    timeLabel: "11:59 PM",
    forRobot: true,
    agent: "cameraman",
    recordingMode: "cameraman_highlight",
  });
  const createCameramanPayload = await jsonFromResponse(createCameramanResponse);
  cleanupIds.push(cameramanTaskId);
  assert(createCameramanResponse.status === 201, "cameraman e2e: expected create 201", createCameramanPayload);
  assert(createCameramanPayload.event?.agent === "cameraman", "cameraman e2e: expected cameraman agent", createCameramanPayload.event);
  assert(createCameramanPayload.event?.recordingMode === "cameraman_highlight", "cameraman e2e: expected cameraman recordingMode", createCameramanPayload.event);

  const robotFeedResponse = await calendarRoute.GET(new Request("http://localhost/api/calendar?robot=true"));
  const robotFeedPayload = await jsonFromResponse(robotFeedResponse);
  const robotTask = robotFeedPayload.items?.find((item) => item.id === cameramanTaskId);
  assert(robotTask?.agent === "cameraman", "cameraman e2e: robot feed should preserve agent", robotTask);
  assert(robotTask?.recordingMode === "cameraman_highlight", "cameraman e2e: robot feed should preserve recordingMode", robotTask);

  const uploadedResponse = await postJson(
    robotStatusRoute,
    `http://localhost/api/robot/capture-tasks/${encodeURIComponent(cameramanTaskId)}/status`,
    {
      status: "uploaded",
      robotId: "dockkit_e2e",
      auriVideoId: "video-e2e-cameraman",
      auriClientVideoUuid: createCameramanPayload.event.auriClientVideoUuid,
      recordingMode: "cameraman_highlight",
      vlogId: "vlog-e2e-cameraman",
      durationSeconds: 42,
      startedAt: "2026-06-24T04:00:00Z",
      uploadedAt: "2026-06-24T04:01:00Z",
    },
    { taskId: cameramanTaskId }
  );
  const uploadedPayload = await jsonFromResponse(uploadedResponse);
  assert(uploadedResponse.status === 200, "cameraman e2e: expected robot status 200", uploadedPayload);
  assert(uploadedPayload.event?.robot?.recordingMode === "cameraman_highlight", "cameraman e2e: robot state should store recordingMode", uploadedPayload.event);
  assert(uploadedPayload.event?.robot?.vlogId === "vlog-e2e-cameraman", "cameraman e2e: robot state should store vlogId", uploadedPayload.event);
  assert(uploadedPayload.event?.robot?.durationSeconds === 42, "cameraman e2e: robot state should store duration", uploadedPayload.event);

  await withFakeAuriVlogServer(async () => {
    const syncResponse = await postJson(
      highlightSyncRoute,
      `http://localhost/api/robot/capture-tasks/${encodeURIComponent(cameramanTaskId)}/highlight/sync`,
      {},
      { taskId: cameramanTaskId }
    );
    const syncPayload = await jsonFromResponse(syncResponse);
    assert(syncResponse.status === 200, "cameraman e2e: expected highlight sync 200", syncPayload);
    assert(syncPayload.outcome === "ready", "cameraman e2e: expected highlight ready", syncPayload);
    assert(syncPayload.event?.robot?.highlightMemoryId, "cameraman e2e: expected highlight memory id", syncPayload.event);
    assert(syncPayload.event?.robot?.highlightVideoUrl?.startsWith("/api/media/blob/"), "cameraman e2e: expected media blob highlight URL", syncPayload.event);

    const mediaName = syncPayload.event.robot.highlightVideoUrl.split("/").pop();
    const blobResponse = await getWithParams(mediaBlobRoute, `http://localhost${syncPayload.event.robot.highlightVideoUrl}`, { name: mediaName });
    assert(blobResponse.status === 200 || blobResponse.status === 307, "cameraman e2e: expected highlight video blob to be servable", {
      status: blobResponse.status,
      url: syncPayload.event.robot.highlightVideoUrl,
    });

    const memoryResponse = await memoryRoute.GET(new Request("http://localhost/api/memory"));
    const memoryPayload = await jsonFromResponse(memoryResponse);
    assert(memoryResponse.status === 200, "cameraman e2e: expected memory 200", memoryPayload);
    assert(
      memoryPayload.media.some(
        (item) =>
          item.metadata?.captureTaskId === cameramanTaskId &&
          item.metadata?.recordingMode === "cameraman_highlight" &&
          item.metadata?.ingestMode === "auri-cameraman" &&
          item.metadata?.vlogId === "vlog-e2e-cameraman"
      ),
      "cameraman e2e: expected ingested cameraman media in memory",
      memoryPayload.media
    );

    const syncAgainResponse = await postJson(
      highlightSyncRoute,
      `http://localhost/api/robot/capture-tasks/${encodeURIComponent(cameramanTaskId)}/highlight/sync`,
      {},
      { taskId: cameramanTaskId }
    );
    const syncAgainPayload = await jsonFromResponse(syncAgainResponse);
    assert(syncAgainResponse.status === 200, "cameraman e2e: expected second sync 200", syncAgainPayload);
    assert(syncAgainPayload.outcome === "already_synced", "cameraman e2e: expected second sync to be idempotent", syncAgainPayload);
  });

  const createAgentOnlyResponse = await postJson(calendarRoute, "http://localhost/api/calendar", {
    id: agentOnlyTaskId,
    title: "E2E agent-only cameraman",
    note: "Agent alone must not select the highlight pipeline.",
    person: "mia",
    dateLabel: "Today",
    timeLabel: "11:58 PM",
    forRobot: true,
    agent: "cameraman",
  });
  const createAgentOnlyPayload = await jsonFromResponse(createAgentOnlyResponse);
  cleanupIds.push(agentOnlyTaskId);
  assert(createAgentOnlyResponse.status === 201, "cameraman e2e: expected agent-only create 201", createAgentOnlyPayload);

  const agentOnlyStatusResponse = await postJson(
    robotStatusRoute,
    `http://localhost/api/robot/capture-tasks/${encodeURIComponent(agentOnlyTaskId)}/status`,
    {
      status: "uploaded",
      robotId: "dockkit_e2e",
      auriVideoId: "video-e2e-agent-only",
      vlogId: "vlog-e2e-agent-only",
      startedAt: "2026-06-24T04:02:00Z",
      uploadedAt: "2026-06-24T04:03:00Z",
    },
    { taskId: agentOnlyTaskId }
  );
  assert(agentOnlyStatusResponse.status === 200, "cameraman e2e: expected agent-only status 200", await jsonFromResponse(agentOnlyStatusResponse));

  const agentOnlySyncResponse = await postJson(
    highlightSyncRoute,
    `http://localhost/api/robot/capture-tasks/${encodeURIComponent(agentOnlyTaskId)}/highlight/sync`,
    {},
    { taskId: agentOnlyTaskId }
  );
  const agentOnlySyncPayload = await jsonFromResponse(agentOnlySyncResponse);
  assert(agentOnlySyncResponse.status === 409, "cameraman e2e: agent-only task must not enter highlight sync", agentOnlySyncPayload);
  assert(agentOnlySyncPayload.outcome === "not_cameraman", "cameraman e2e: expected not_cameraman for agent-only task", agentOnlySyncPayload);

  const createMissingIdsResponse = await postJson(calendarRoute, "http://localhost/api/calendar", {
    id: missingIdsTaskId,
    title: "E2E cameraman missing ids",
    note: "Cameraman pipeline should wait for both videoId and vlogId.",
    person: "mia",
    dateLabel: "Today",
    timeLabel: "11:57 PM",
    forRobot: true,
    agent: "cameraman",
    recordingMode: "cameraman_highlight",
  });
  const createMissingIdsPayload = await jsonFromResponse(createMissingIdsResponse);
  cleanupIds.push(missingIdsTaskId);
  assert(createMissingIdsResponse.status === 201, "cameraman e2e: expected missing-ids create 201", createMissingIdsPayload);

  const missingIdsStatusResponse = await postJson(
    robotStatusRoute,
    `http://localhost/api/robot/capture-tasks/${encodeURIComponent(missingIdsTaskId)}/status`,
    {
      status: "uploaded",
      robotId: "dockkit_e2e",
      auriVideoId: "video-e2e-missing-ids",
      recordingMode: "cameraman_highlight",
      startedAt: "2026-06-24T04:04:00Z",
      uploadedAt: "2026-06-24T04:05:00Z",
    },
    { taskId: missingIdsTaskId }
  );
  assert(missingIdsStatusResponse.status === 200, "cameraman e2e: expected missing-ids status 200", await jsonFromResponse(missingIdsStatusResponse));

  const missingIdsSyncResponse = await postJson(
    highlightSyncRoute,
    `http://localhost/api/robot/capture-tasks/${encodeURIComponent(missingIdsTaskId)}/highlight/sync`,
    {},
    { taskId: missingIdsTaskId }
  );
  const missingIdsSyncPayload = await jsonFromResponse(missingIdsSyncResponse);
  assert(missingIdsSyncResponse.status === 409, "cameraman e2e: missing vlog id should block highlight sync", missingIdsSyncPayload);
  assert(missingIdsSyncPayload.outcome === "missing_ids", "cameraman e2e: expected missing_ids without vlogId", missingIdsSyncPayload);

  await cleanup();
  console.log(JSON.stringify({
    ok: true,
    tested: [
      "calendar create preserves agent + recordingMode",
      "robot feed exposes cameraman_highlight",
      "robot uploaded status stores videoId + vlogId + duration",
      "highlight sync downloads fake rendered vlog and creates Memory media",
      "highlight sync is idempotent",
      "agent-only cameraman task is rejected by highlight sync",
      "cameraman_highlight task without vlogId returns missing_ids",
    ],
  }, null, 2));
} catch (error) {
  await cleanup();
  throw error;
}
