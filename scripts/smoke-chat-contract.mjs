import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

function assert(condition, message, details) {
  if (!condition) {
    const suffix = details ? `\n${JSON.stringify(details, null, 2)}` : "";
    throw new Error(`${message}${suffix}`);
  }
}

function prepareNextServerChunks() {
  const serverDir = path.join(root, ".next", "server");
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

async function postJson(route, body) {
  const response = await route.POST(
    new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        familyId: "family_demo",
        userId: "mom_demo",
        currentPage: "chat",
        ...body,
      }),
    })
  );
  const payload = await response.json();
  assert(response.status === 200, "chat contract: expected 200", { status: response.status, payload });
  return payload;
}

function helperObjects(payload) {
  return payload.helper?.objectsToCreate ?? [];
}

function helperCards(payload) {
  return payload.helper?.cards ?? [];
}

function assertReminderJob(payload, message) {
  assert(payload.intent === "reminder", `${message}: expected reminder intent`, payload);
  assert(payload.helper?.teamMemberId === "homekeeper", `${message}: expected homekeeper helper`, payload.helper);
  assert(!helperObjects(payload).some((object) => object.type === "baby_log"), `${message}: must not create baby_log`, helperObjects(payload));
  assert(helperObjects(payload).some((object) => object.type === "reminder_draft"), `${message}: expected reminder draft`, helperObjects(payload));
  assert(helperCards(payload).some((card) => card.type === "reminder"), `${message}: expected reminder card`, helperCards(payload));
}

prepareNextServerChunks();
const chatRoute = routeUserland("api/chat");

const fruitReminder = await postJson(chatRoute, { message: "提醒 Leo 现在去吃水果" });
assertReminderJob(fruitReminder, "fruit reminder");

const fruitCommand = await postJson(chatRoute, { message: "让 Leo 去吃水果" });
assertReminderJob(fruitCommand, "fruit command");

const babyLog = await postJson(chatRoute, { message: "记录 Leo 刚刚吃了水果" });
assert(babyLog.intent === "baby_log", "baby log: expected baby_log intent", babyLog);
assert(
  helperObjects(babyLog).some((object) => object.type === "baby_log") ||
    babyLog.createdLocalObjects?.some((object) => object.type === "baby_log"),
  "baby log: expected baby_log object",
  babyLog
);

const cameraJob = await postJson(chatRoute, { message: "现在拍一段阿丽塔的视频给我" });
assert(cameraJob.intent === "photo_video", "camera job: expected photo_video intent", cameraJob);
assert(cameraJob.helper?.teamMemberId === "cameraman", "camera job: expected cameraman helper", cameraJob.helper);
assert(
  cameraJob.helper?.reply === "Got it. I'll film Mia and edit them into a short story.",
  "camera job: expected explicit-subject cameraman reply",
  cameraJob.helper
);
assert(helperObjects(cameraJob).some((object) => object.type === "reminder_draft"), "camera job: expected scheduled job draft", helperObjects(cameraJob));
const cameraPayload = helperObjects(cameraJob).find((object) => object.type === "reminder_draft")?.payload ?? {};
assert(cameraPayload.agent === "cameraman", "camera job: expected cameraman agent", cameraPayload);
assert(cameraPayload.recordingMode === "cameraman_highlight", "camera job: expected cameraman recordingMode", cameraPayload);
assert(cameraPayload.person === "mia", "camera job: expected explicit camera subject person", cameraPayload);
assert(!helperCards(cameraJob).some((card) => card.type === "text"), "camera job: must not render as text card", helperCards(cameraJob));

const familyCameraJob = await postJson(chatRoute, { message: "现在拍一段视频给我" });
assert(
  familyCameraJob.helper?.reply === "Got it. I'll film the family, primarily Mia if she is there, and Leo, and edit them into a short story.",
  "family camera job: expected default family cameraman reply",
  familyCameraJob.helper
);
const familyCameraPayload = helperObjects(familyCameraJob).find((object) => object.type === "reminder_draft")?.payload ?? {};
assert(familyCameraPayload.person === "mia", "family camera job: expected primary child person", familyCameraPayload);
assert(
  familyCameraPayload.subject === "the family, primarily Mia if she is there, and Leo",
  "family camera job: expected default family subject",
  familyCameraPayload
);

console.log(JSON.stringify({
  ok: true,
  checked: [
    "fruit reminder routes to homekeeper reminder_draft",
    "fruit command routes to homekeeper reminder_draft",
    "explicit care log remains baby_log",
    "camera request routes to cameraman_highlight job draft",
    "cameraman reply uses explicit subject or default family primary child",
  ],
}, null, 2));
