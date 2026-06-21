import fs from "node:fs";
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

async function postJson(route, url, body) {
  return route.POST(
    new Request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
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

const robotResponse = await calendarRoute.GET(new Request("http://localhost/api/calendar?robot=true"));
const robotPayload = await jsonFromResponse(robotResponse);
assert(robotResponse.status === 200, "calendar: expected 200 for robot read", { status: robotResponse.status, payload: robotPayload });
assert(robotPayload.items.some((item) => item.id === createPayload.event.id && item.forRobot === true), "calendar: expected created robot event", robotPayload.items);
assert(robotPayload.items.every((item) => item.forRobot === true), "calendar: robot filter should only return robot events", robotPayload.items);

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
