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
      res.end(JSON.stringify({
        success: true,
        data: {
          video_id: "video-smoke-from-auri",
          status: "READY",
          progress: 1,
          video_download_url: "/v1/videos/video-smoke-from-auri/raw-output/video/download",
          transcript_json_download_url: "/v1/videos/video-smoke-from-auri/raw-output/transcript/download?format=json",
          transcript_text_download_url: "/v1/videos/video-smoke-from-auri/raw-output/transcript/download?format=txt",
        },
      }));
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

async function getWithParams(route, url, params) {
  return route.GET(new Request(url, { method: "GET" }), { params });
}

prepareNextServerChunks();

const calendarRoute = routeUserland("api/calendar");
const memoryRoute = routeUserland("api/memory");
const mediaBlobRoute = routeUserland("api/media/blob/[name]");
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
const rawOutputSyncRoute = routeUserland("api/robot/capture-tasks/[taskId]/raw-output/sync");
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

const missingRawOutputResponse = await postJson(calendarRoute, "http://localhost/api/calendar", {
  id: `${smokeId}_missing_raw_output`,
  title: "Robot raw output pending",
  note: "Auri raw output job may not be visible on the first sync attempt",
  person: "mia",
  dateLabel: "Tomorrow",
  timeLabel: "4:00 PM",
  forRobot: true,
});
const missingRawOutputPayload = await jsonFromResponse(missingRawOutputResponse);
assert(missingRawOutputResponse.status === 201, "calendar: expected second robot event create 201", {
  status: missingRawOutputResponse.status,
  payload: missingRawOutputPayload,
});

const missingRawOutputStatusResponse = await postJsonWithParams(
  robotStatusRoute,
  `http://localhost/api/robot/capture-tasks/${encodeURIComponent(missingRawOutputPayload.event.id)}/status`,
  {
    status: "uploading",
    robotId: "dockkit_living_room",
    auriVideoId: "video-raw-job-missing",
    auriClientVideoUuid: missingRawOutputPayload.event.auriClientVideoUuid,
    recordingMode: "story_tracking_raw_transcript",
    startedAt: "2026-06-21T10:05:00Z",
  },
  { taskId: missingRawOutputPayload.event.id }
);
const missingRawOutputStatusPayload = await jsonFromResponse(missingRawOutputStatusResponse);
assert(missingRawOutputStatusResponse.status === 200, "robot status: expected second status 200", {
  status: missingRawOutputStatusResponse.status,
  payload: missingRawOutputStatusPayload,
});

const concurrentSyncResponse = await postJson(calendarRoute, "http://localhost/api/calendar", {
  id: `${smokeId}_concurrent_raw_output`,
  title: "Robot raw output concurrent sync",
  note: "Two sync callers should not create duplicate memories",
  person: "mia",
  dateLabel: "Tomorrow",
  timeLabel: "4:15 PM",
  forRobot: true,
});
const concurrentSyncPayload = await jsonFromResponse(concurrentSyncResponse);
assert(concurrentSyncResponse.status === 201, "calendar: expected concurrent robot event create 201", {
  status: concurrentSyncResponse.status,
  payload: concurrentSyncPayload,
});

const concurrentSyncStatusResponse = await postJsonWithParams(
  robotStatusRoute,
  `http://localhost/api/robot/capture-tasks/${encodeURIComponent(concurrentSyncPayload.event.id)}/status`,
  {
    status: "uploading",
    robotId: "dockkit_living_room",
    auriVideoId: "video-smoke-from-auri",
    auriClientVideoUuid: concurrentSyncPayload.event.auriClientVideoUuid,
    recordingMode: "story_tracking_raw_transcript",
    startedAt: "2026-06-21T10:10:00Z",
  },
  { taskId: concurrentSyncPayload.event.id }
);
const concurrentSyncStatusPayload = await jsonFromResponse(concurrentSyncStatusResponse);
assert(concurrentSyncStatusResponse.status === 200, "robot status: expected concurrent status 200", {
  status: concurrentSyncStatusResponse.status,
  payload: concurrentSyncStatusPayload,
});

await withFakeAuriServer(async () => {
  const rawOutputSyncResponse = await postJsonWithParams(
    rawOutputSyncRoute,
    `http://localhost/api/robot/capture-tasks/${encodeURIComponent(createPayload.event.id)}/raw-output/sync`,
    {},
    { taskId: createPayload.event.id }
  );
  const rawOutputSyncPayload = await jsonFromResponse(rawOutputSyncResponse);
  assert(rawOutputSyncResponse.status === 200, "raw output sync: expected 200", {
    status: rawOutputSyncResponse.status,
    payload: rawOutputSyncPayload,
  });
  assert(rawOutputSyncPayload.outcome === "ready", "raw output sync: expected ready outcome", rawOutputSyncPayload);
  assert(rawOutputSyncPayload.event?.robot?.rawOutputMemoryId, "raw output sync: expected memory id in sync result", rawOutputSyncPayload.event);
  const syncedRobot = rawOutputSyncPayload.event?.robot;
  for (const artifactUrl of [syncedRobot?.rawOutputVideoUrl, syncedRobot?.transcriptJsonUrl, syncedRobot?.transcriptTxtUrl]) {
    assert(artifactUrl?.startsWith("/api/media/blob/"), "raw output sync: expected artifacts to use media blob route", {
      artifactUrl,
      syncedRobot,
    });
    const mediaName = artifactUrl.split("/").pop();
    const artifactResponse = await getWithParams(mediaBlobRoute, `http://localhost${artifactUrl}`, { name: mediaName });
    assert(artifactResponse.status === 200 || artifactResponse.status === 307, "media blob: expected stored artifact to be servable", {
      artifactUrl,
      status: artifactResponse.status,
    });
  }

  const missingRawOutputSyncResponse = await postJsonWithParams(
    rawOutputSyncRoute,
    `http://localhost/api/robot/capture-tasks/${encodeURIComponent(missingRawOutputPayload.event.id)}/raw-output/sync`,
    {},
    { taskId: missingRawOutputPayload.event.id }
  );
  const missingRawOutputSyncPayload = await jsonFromResponse(missingRawOutputSyncResponse);
  assert(missingRawOutputSyncResponse.status === 202, "raw output sync: expected missing raw-output job to remain pending", {
    status: missingRawOutputSyncResponse.status,
    payload: missingRawOutputSyncPayload,
  });
  assert(missingRawOutputSyncPayload.outcome === "pending", "raw output sync: expected pending outcome for missing raw-output job", missingRawOutputSyncPayload);

  const afterSyncResponse = await calendarRoute.GET(new Request("http://localhost/api/calendar?robot=true"));
  const afterSyncPayload = await jsonFromResponse(afterSyncResponse);
  const syncedRobotTask = afterSyncPayload.items.find((item) => item.id === createPayload.event.id);
  const missingRawOutputTask = afterSyncPayload.items.find((item) => item.id === missingRawOutputPayload.event.id);
  assert(syncedRobotTask?.robot?.rawOutputStatus === "ready", "raw output sync: expected ready state", syncedRobotTask);
  assert(syncedRobotTask?.robot?.rawOutputMemoryId, "raw output sync: expected memory id on robot task", syncedRobotTask);
  assert(syncedRobotTask?.robot?.rawOutputVideoUrl, "raw output sync: expected stored video URL", syncedRobotTask);
  assert(syncedRobotTask?.robot?.transcriptJsonUrl, "raw output sync: expected JSON transcript URL", syncedRobotTask);
  assert(syncedRobotTask?.robot?.transcriptTxtUrl, "raw output sync: expected text transcript URL", syncedRobotTask);
  assert(missingRawOutputTask?.robot?.rawOutputStatus === "pending", "raw output sync: expected missing raw-output job to stay pending", missingRawOutputTask);
  assert(missingRawOutputTask?.status !== "failed", "raw output sync: missing raw-output job should not fail the capture task", missingRawOutputTask);

  const memoryResponse = await memoryRoute.GET(new Request("http://localhost/api/memory"));
  const memoryPayload = await jsonFromResponse(memoryResponse);
  assert(memoryResponse.status === 200, "memory: expected 200 after raw output sync", { status: memoryResponse.status, payload: memoryPayload });
  assert(
    memoryPayload.items.some((item) => item.id === syncedRobotTask.robot.rawOutputMemoryId),
    "memory: expected raw output memory to be listed",
    memoryPayload.items
  );
  assert(
    memoryPayload.media.some((item) => item.mediaType === "video" && item.metadata?.captureTaskId === createPayload.event.id),
    "memory: expected raw output video media to be listed",
    memoryPayload.media
  );

  const [concurrentRawOutputSyncA, concurrentRawOutputSyncB] = await Promise.all([
    postJsonWithParams(
      rawOutputSyncRoute,
      `http://localhost/api/robot/capture-tasks/${encodeURIComponent(concurrentSyncPayload.event.id)}/raw-output/sync`,
      {},
      { taskId: concurrentSyncPayload.event.id }
    ),
    postJsonWithParams(
      rawOutputSyncRoute,
      `http://localhost/api/robot/capture-tasks/${encodeURIComponent(concurrentSyncPayload.event.id)}/raw-output/sync`,
      {},
      { taskId: concurrentSyncPayload.event.id }
    ),
  ]);
  const concurrentRawOutputSyncPayloadA = await jsonFromResponse(concurrentRawOutputSyncA);
  const concurrentRawOutputSyncPayloadB = await jsonFromResponse(concurrentRawOutputSyncB);
  assert(concurrentRawOutputSyncA.status === 200, "raw output sync: expected first concurrent sync 200", {
    status: concurrentRawOutputSyncA.status,
    payload: concurrentRawOutputSyncPayloadA,
  });
  assert(concurrentRawOutputSyncB.status === 200, "raw output sync: expected second concurrent sync 200", {
    status: concurrentRawOutputSyncB.status,
    payload: concurrentRawOutputSyncPayloadB,
  });

  const afterConcurrentMemoryResponse = await memoryRoute.GET(new Request("http://localhost/api/memory"));
  const afterConcurrentMemoryPayload = await jsonFromResponse(afterConcurrentMemoryResponse);
  const concurrentMedia = afterConcurrentMemoryPayload.media.filter((item) => item.metadata?.captureTaskId === concurrentSyncPayload.event.id);
  const concurrentMediaIds = new Set(concurrentMedia.map((item) => item.id));
  const concurrentMemories = afterConcurrentMemoryPayload.items.filter((item) =>
    Array.isArray(item.mediaIds) && item.mediaIds.some((mediaId) => concurrentMediaIds.has(mediaId))
  );
  assert(concurrentMemories.length === 1, "raw output sync: concurrent sync should create exactly one memory", concurrentMemories);
  assert(concurrentMedia.length === 1, "raw output sync: concurrent sync should create exactly one media item", concurrentMedia);
});

const deleteConcurrentResponse = await calendarRoute.DELETE(
  new Request(`http://localhost/api/calendar?id=${encodeURIComponent(concurrentSyncPayload.event.id)}`, {
    method: "DELETE",
  })
);
const deleteConcurrentPayload = await jsonFromResponse(deleteConcurrentResponse);
assert(deleteConcurrentResponse.status === 200, "calendar: expected concurrent delete 200", {
  status: deleteConcurrentResponse.status,
  payload: deleteConcurrentPayload,
});

const deleteSecondResponse = await calendarRoute.DELETE(
  new Request(`http://localhost/api/calendar?id=${encodeURIComponent(missingRawOutputPayload.event.id)}`, {
    method: "DELETE",
  })
);
const deleteSecondPayload = await jsonFromResponse(deleteSecondResponse);
assert(deleteSecondResponse.status === 200, "calendar: expected second delete 200", { status: deleteSecondResponse.status, payload: deleteSecondPayload });

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
assert(!afterDeletePayload.items.some((item) => item.id === missingRawOutputPayload.event.id), "calendar: deleted second event should not be listed", afterDeletePayload.items);
assert(!afterDeletePayload.items.some((item) => item.id === concurrentSyncPayload.event.id), "calendar: deleted concurrent event should not be listed", afterDeletePayload.items);

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
