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

prepareNextServerChunks();

const chatRoute = routeUserland("api/chat");
const objectActionsRoute = routeUserland("api/objects/[id]/actions");
const uploadRoute = routeUserland("api/media/upload");
const auriIngestRoute = routeUserland("api/ingest/auri-media");
const memoryRoute = routeUserland("api/memory");

const chatCases = [
  {
    name: "basketball",
    message: "Leo has basketball Friday at 5:30. Bring water bottle.",
    helper: "nora",
    cardTypes: ["calendar_draft", "reminder"],
    createdCount: 2,
  },
  {
    name: "baby",
    message: "Baby drank 120ml at 8:30 AM.",
    helper: "nina",
    cardTypes: ["baby_log"],
    createdCount: 1,
  },
  {
    name: "piano",
    message: "Here’s Sophie’s piano lesson video.",
    helper: "milo",
    cardTypes: ["lesson_recap"],
    createdCount: 1,
  },
  {
    name: "grandma",
    message: "Make a Sunday update for Grandma.",
    helper: "mira",
    cardTypes: ["story_draft"],
    createdCount: 1,
  },
  {
    name: "reading",
    message: "Sophie loved the dinosaur book today.",
    helper: "bibi",
    cardTypes: ["memory"],
    createdCount: 1,
  },
];

const chatResults = [];

for (const testCase of chatCases) {
  const response = await postJson(chatRoute, "http://localhost/api/chat", {
    familyId: "family_demo",
    userId: "mom_demo",
    message: testCase.message,
    currentPage: "chat",
  });
  const payload = await jsonFromResponse(response);
  const actualCardTypes = payload.cards.map((card) => card.type);
  const routes = payload.cards.map((card) => card.targetRoute).filter(Boolean);

  assert(response.status === 200, `${testCase.name}: expected 200 response`, { status: response.status, payload });
  assert(payload.handledByTeamMemberId === testCase.helper, `${testCase.name}: helper mismatch`, payload);
  assert(
    testCase.cardTypes.every((type) => actualCardTypes.includes(type)),
    `${testCase.name}: card types mismatch`,
    { expected: testCase.cardTypes, actual: actualCardTypes }
  );
  assert(payload.createdLocalObjects.length === testCase.createdCount, `${testCase.name}: created object count mismatch`, payload.createdLocalObjects);
  assert(routes.length === payload.cards.length, `${testCase.name}: every response card should link to a local object`, routes);

  chatResults.push({
    name: testCase.name,
    helper: payload.handledByTeamMemberId,
    cardTypes: actualCardTypes,
    routes,
    created: payload.createdLocalObjects.length,
  });
}

const actionCases = [
  { name: "calendar", message: chatCases[0].message, action: "add", status: "added", label: "Added locally" },
  { name: "baby", message: chatCases[1].message, action: "log", status: "logged", label: "Logged locally" },
  { name: "grandma", message: chatCases[3].message, action: "send", status: "sent", label: "Sent locally" },
  { name: "reading", message: chatCases[4].message, action: "save", status: "saved", label: "Saved locally" },
];

const actionResults = [];

for (const testCase of actionCases) {
  const chatResponse = await postJson(chatRoute, "http://localhost/api/chat", { message: testCase.message });
  const chatPayload = await jsonFromResponse(chatResponse);
  const objectId = chatPayload.createdLocalObjects[0]?.id;
  assert(objectId, `${testCase.name}: expected created local object`, chatPayload);

  const response = await postJson(
    objectActionsRoute,
    `http://localhost/api/objects/${objectId}/actions`,
    { action: testCase.action },
    { id: objectId }
  );
  const payload = await jsonFromResponse(response);

  assert(response.status === 200, `${testCase.name}: expected action 200`, { status: response.status, payload });
  assert(payload.object.status === testCase.status, `${testCase.name}: status mismatch`, payload);
  assert(payload.statusLabel === testCase.label, `${testCase.name}: status label mismatch`, payload);

  actionResults.push({
    name: testCase.name,
    action: testCase.action,
    objectStatus: payload.object.status,
    statusLabel: payload.statusLabel,
  });
}

await postJson(uploadRoute, "http://localhost/api/media/upload", {
  media: [
    {
      title: "Friday family photo",
      person: "family",
      mediaType: "photo",
      body: "Picked for Friday.",
      tags: ["phone", "friday"],
    },
  ],
});

await postJson(auriIngestRoute, "http://localhost/api/ingest/auri-media", {
  robotId: "auri_living_room",
  room: "Living Room",
  memoryTitle: "Soccer time backyard",
  memoryBody: "Leo scored twice and laughed non-stop.",
  clips: [{ title: "Backyard goal clip", person: "leo", type: "clip", durationSeconds: 12, tags: ["soccer"] }],
});

const memoryResponse = await memoryRoute.GET(new Request("http://localhost/api/memory?limit=20"));
const memoryPayload = await jsonFromResponse(memoryResponse);

assert(memoryResponse.status === 200, "memory: expected 200", { status: memoryResponse.status, memoryPayload });
assert(memoryPayload.summary.phoneMedia >= 1, "memory: expected phone media", memoryPayload.summary);
assert(memoryPayload.summary.auriMedia >= 1, "memory: expected Auri media", memoryPayload.summary);
assert(
  memoryPayload.items.some((item) => item.sourceLabel === "Phone") && memoryPayload.items.some((item) => item.sourceLabel === "Auri Robot"),
  "memory: expected Phone and Auri Robot memory items",
  memoryPayload.items.slice(0, 5)
);

console.log(
  JSON.stringify(
    {
      ok: true,
      chatResults,
      actionResults,
      memorySummary: memoryPayload.summary,
    },
    null,
    2
  )
);
