import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverDir = path.join(root, ".next", "server");
const require = createRequire(import.meta.url);

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

async function withFakeAuriServer(fn) {
  const videoBytes = Buffer.from("fake mp4 bytes");
  const transcriptJson = Buffer.from(JSON.stringify({ text: "Mia read the story." }));
  const transcriptTxt = Buffer.from("Mia read the story.");

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (req.method === "GET" && url.pathname === "/v1/videos/video-smoke-from-auri/raw-output") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ success: true, data: { video_id: "video-smoke-from-auri", status: "ready", progress: 1 } }));
      return;
    }

    if (url.pathname === "/v1/videos/video-smoke-from-auri/raw-output/video/download") {
      res.writeHead(200, { "content-type": "video/mp4", "content-length": String(videoBytes.length) });
      if (req.method === "HEAD") res.end();
      else res.end(videoBytes);
      return;
    }

    if (url.pathname === "/v1/videos/video-smoke-from-auri/raw-output/transcript/download" && url.searchParams.get("format") === "json") {
      res.writeHead(200, { "content-type": "application/json", "content-length": String(transcriptJson.length) });
      if (req.method === "HEAD") res.end();
      else res.end(transcriptJson);
      return;
    }

    if (url.pathname === "/v1/videos/video-smoke-from-auri/raw-output/transcript/download" && url.searchParams.get("format") === "txt") {
      res.writeHead(200, { "content-type": "text/plain", "content-length": String(transcriptTxt.length) });
      if (req.method === "HEAD") res.end();
      else res.end(transcriptTxt);
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const previousHost = process.env.AURI_HOST;
  process.env.AURI_HOST = `http://127.0.0.1:${address.port}`;
  try {
    return await fn();
  } finally {
    if (previousHost === undefined) delete process.env.AURI_HOST;
    else process.env.AURI_HOST = previousHost;
    await new Promise((resolve) => server.close(resolve));
  }
}

async function postJson(route, url, body) {
  return route.POST(
    new Request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

async function postJsonWithParams(route, url, body, params) {
  return route.POST(
    new Request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params }
  );
}

prepareNextServerChunks();

const calendarRoute = routeUserland("api/calendar");
const smokeId = `smoke_calendar_${Date.now()}`;

const seedResponse = await calendarRoute.GET(new Request("http://localhost/api/calendar?source=seed"));
const seedPayload = await jsonFromResponse(seedResponse);
assert(seedResponse.status === 200, "calendar: expected 200 for seed read", { status: seedResponse.status, payload: seedPayload });
assert(seedPayload.summary.seed >= 6, "calendar: expected seeded in-app events", seedPayload.summary);
assert(seedPayload.items.some((item) => item.id === "piano-lesson" && item.source === "seed"), "calendar: expected piano lesson seed event", seedPayload.items);

const createResponse = await postJson(calendarRoute, "http://localhost/api/calendar", {
  id: smokeId,
  title: "Robot story capture",
  note: "External robot should be able to fetch this",
  person: "mia",
  dateLabel: "Tomorrow",
  timeLabel: "3:45 PM",
  forRobot: true,
});
const createPayload = await jsonFromResponse(createResponse);
assert(createResponse.status === 201, "calendar: expected create 201", { status: createResponse.status, payload: createPayload });
assert(createPayload.event?.id, "calendar: expected created event id", createPayload);
assert(createPayload.event.source === "created", "calendar: expected created event source", createPayload);
assert(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(createPayload.event.auriClientVideoUuid),
  "calendar: expected robot event to include an Auri client video UUID",
  createPayload.event
);

const robotResponse = await calendarRoute.GET(new Request("http://localhost/api/calendar?robot=true"));
const robotPayload = await jsonFromResponse(robotResponse);
assert(robotResponse.status === 200, "calendar: expected 200 for robot read", { status: robotResponse.status, payload: robotPayload });
assert(robotPayload.items.some((item) => item.id === createPayload.event.id && item.forRobot === true), "calendar: expected created robot event", robotPayload.items);
assert(robotPayload.items.every((item) => item.forRobot === true), "calendar: robot filter should only return robot events", robotPayload.items);
const robotTask = robotPayload.items.find((item) => item.id === createPayload.event.id);
assert(robotTask?.auriClientVideoUuid === createPayload.event.auriClientVideoUuid, "calendar: robot read should expose the Auri client video UUID", robotTask);

const robotStatusRoute = routeUserland("api/robot/capture-tasks/[taskId]/status");
const robotStatusResponse = await postJsonWithParams(
  robotStatusRoute,
  `http://localhost/api/robot/capture-tasks/${encodeURIComponent(createPayload.event.id)}/status`,
  {
    status: "uploading",
    robotId: "dockkit_living_room",
    auriVideoId: "video-smoke-from-auri",
    auriClientVideoUuid: createPayload.event.auriClientVideoUuid,
    recordingMode: "story_tracking_raw_transcript",
    startedAt: "2026-06-21T10:00:00Z",
  },
  { taskId: createPayload.event.id }
);
const robotStatusPayload = await jsonFromResponse(robotStatusResponse);
assert(robotStatusResponse.status === 200, "robot status: expected 200", { status: robotStatusResponse.status, payload: robotStatusPayload });
assert(robotStatusPayload.event?.id === createPayload.event.id, "robot status: expected same capture task", robotStatusPayload);
assert(robotStatusPayload.event?.robot?.status === "uploading", "robot status: expected uploading state", robotStatusPayload.event);
assert(robotStatusPayload.event?.robot?.auriVideoId === "video-smoke-from-auri", "robot status: expected Auri video id", robotStatusPayload.event);
assert(robotStatusPayload.event?.robot?.auriClientVideoUuid === createPayload.event.auriClientVideoUuid, "robot status: expected Auri client video UUID", robotStatusPayload.event);
assert(robotStatusPayload.event?.robot?.rawOutputStatus === "pending", "robot status: expected raw output pending", robotStatusPayload.event);

const afterStatusResponse = await calendarRoute.GET(new Request("http://localhost/api/calendar?robot=true"));
const afterStatusPayload = await jsonFromResponse(afterStatusResponse);
const updatedRobotTask = afterStatusPayload.items.find((item) => item.id === createPayload.event.id);
assert(updatedRobotTask?.robot?.auriVideoId === "video-smoke-from-auri", "calendar: expected robot linkage to persist", updatedRobotTask);

await withFakeAuriServer(async () => {
  const rawOutputSyncRoute = routeUserland("api/robot/capture-tasks/[taskId]/raw-output/sync");
  const rawOutputSyncResponse = await postJsonWithParams(
    rawOutputSyncRoute,
    `http://localhost/api/robot/capture-tasks/${encodeURIComponent(createPayload.event.id)}/raw-output/sync`,
    {},
    { taskId: createPayload.event.id }
  );
  const rawOutputSyncPayload = await jsonFromResponse(rawOutputSyncResponse);
  assert(rawOutputSyncResponse.status === 200, "raw output sync: expected 200", { status: rawOutputSyncResponse.status, payload: rawOutputSyncPayload });
  assert(rawOutputSyncPayload.event?.robot?.rawOutputStatus === "ready", "raw output sync: expected ready state", rawOutputSyncPayload.event);
  assert(rawOutputSyncPayload.event?.robot?.rawOutputVideoUrl, "raw output sync: expected stored video URL", rawOutputSyncPayload.event);
  assert(rawOutputSyncPayload.event?.robot?.transcriptJsonUrl, "raw output sync: expected JSON transcript URL", rawOutputSyncPayload.event);
  assert(rawOutputSyncPayload.event?.robot?.transcriptTxtUrl, "raw output sync: expected text transcript URL", rawOutputSyncPayload.event);
  assert(rawOutputSyncPayload.memory?.id, "raw output sync: expected memory", rawOutputSyncPayload);
  assert(rawOutputSyncPayload.media?.some((item) => item.mediaType === "video"), "raw output sync: expected video media", rawOutputSyncPayload.media);
});

const deleteResponse = await calendarRoute.DELETE(
  new Request(`http://localhost/api/calendar?id=${encodeURIComponent(createPayload.event.id)}`, {
    method: "DELETE",
  })
);
const deletePayload = await jsonFromResponse(deleteResponse);
assert(deleteResponse.status === 200, "calendar: expected delete 200", { status: deleteResponse.status, payload: deletePayload });

const afterDeleteResponse = await calendarRoute.GET(new Request("http://localhost/api/calendar?robot=true"));
const afterDeletePayload = await jsonFromResponse(afterDeleteResponse);
assert(!afterDeletePayload.items.some((item) => item.id === createPayload.event.id), "calendar: deleted event should not be listed", afterDeletePayload.items);

console.log(
  JSON.stringify(
    {
      ok: true,
      seedSummary: seedPayload.summary,
      created: createPayload.event,
      afterDeleteSummary: afterDeletePayload.summary,
    },
    null,
    2
  )
);
