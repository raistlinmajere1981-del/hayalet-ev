import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, rm, readFile, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { deflateSync } from "node:zlib";
import { Buffer } from "node:buffer";
import Database from "../../electron/native/better-sqlite3.ts";
import { AgentProfileRegistry } from "../../electron/database/agent-profile-registry.ts";
import { Ai0RuntimeHost } from "../../electron/ai0/runtime-host.ts";
import type { Ai0HostDependencies } from "../../electron/ai0/runtime-host.ts";
import type { Ai0Engine } from "../../electron/ai0/opencode-process.ts";
import { buildAi0Environment } from "../../electron/ai0/opencode-process.ts";
import { validatePng, verifyPngArtifact } from "../../electron/ai0/png-artifact.ts";
import {
  AI0_ASSISTANT_SCOPE,
  FATE_KNOTS_NPC_SCOPE,
  FATE_KNOTS_IMAGE_SCOPE,
} from "../../shared/ai0-runtime.ts";
import type { Ai0Model } from "../../shared/ai0-runtime.ts";
import { sanitizeFateKnotsAi0Packet } from "../../electron/ai0/fate-knots-adapter.ts";
import { AI0_BOUNDARY_PLUGIN } from "../../electron/ai0/boundary-plugin.ts";

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) === 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(name: string, body: Buffer): Buffer {
  const data = Buffer.concat([Buffer.from(name), body]);
  const result = Buffer.alloc(body.length + 12);
  result.writeUInt32BE(body.length);
  data.copy(result, 4);
  result.writeUInt32BE(crc32(data), result.length - 4);
  return result;
}
function pixelPng(): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.from([0, 0, 0, 255, 255]))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
interface FakeProcess {
  engine: Ai0Engine;
  allowed: string[];
  stopped: boolean;
  created: Array<Record<string, unknown>>;
  instructions: unknown[];
  removed: string[];
}
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "hev-ai0-test-"));
  const db = new Database(":memory:");
  const registry = new AgentProfileRegistry(db);
  let selectedModel: Ai0Model = { providerID: "test", id: "model-one" };
  const state = {
    toolAvailable: true,
    toolsSupported: true,
    leakTool: false,
    failWait: false,
    completeTool: true,
    writeFile: true,
    invalidFile: false,
    prompts: 0,
    sequence: 0,
  };
  const processes: FakeProcess[] = [];
  const start: Ai0HostDependencies["start"] = async (workspacePath, _project, allowed) => {
    const outputs = new Map<string, string>();
    const models = [
      { id: "model-one", providerID: "test", capabilities: { tools: state.toolsSupported } },
      { id: "model-two", providerID: "test", capabilities: { tools: state.toolsSupported } },
    ];
    const process: FakeProcess = {
      allowed: [...allowed],
      stopped: false,
      created: [],
      instructions: [],
      removed: [],
      engine: {
        workspacePath,
        port: 4151,
        request: async (method, path, body) => {
          if (method === "GET" && path.startsWith("/api/model")) return { data: models };
          if (method === "POST" && path === "/api/session") {
            const payload = body as Record<string, unknown>;
            process.created.push(payload);
            return { data: { id: `ses_test_${++state.sequence}` } };
          }
          if (method === "PUT") {
            process.instructions.push(body);
            return null;
          }
          if (method === "DELETE") {
            process.removed.push(path);
            return null;
          }
          if (method === "POST" && path.endsWith("/prompt")) {
            state.prompts += 1;
            const session = path.split("/")[3] ?? "";
            const output = outputs.get(session);
            if (output !== undefined && state.writeFile)
              await writeFile(
                join(workspacePath, output),
                state.invalidFile ? Buffer.from("fake success") : pixelPng()
              );
            return { data: {} };
          }
          if (method === "POST" && path.endsWith("/wait")) {
            if (state.failWait) throw new Error("Timed out");
            return null;
          }
          if (method === "GET" && path.includes("/message"))
            return {
              data: [
                {
                  type: "assistant",
                  content: [
                    { type: "text", text: "actual test response" },
                    ...(allowed.includes("image_generate") && state.completeTool
                      ? [{ type: "tool", name: "image_generate", state: { status: "completed" } }]
                      : []),
                  ],
                },
              ],
            };
          throw new Error(`Unexpected fake engine request ${method} ${path}`);
        },
        rpc: async (method, input) => {
          const request = input as { sessionId: string; path?: string };
          if (method === "output") {
            outputs.set(request.sessionId, request.path ?? "");
            return { configured: true };
          }
          const model = process.created.at(-1)?.["model"];
          return {
            sessionId: request.sessionId,
            model,
            tools: {
              ...(state.toolAvailable && allowed.includes("image_generate")
                ? {
                    image_generate: {
                      input: {
                        properties: { prompt: { type: "string" }, output_path: { type: "string" } },
                      },
                    },
                  }
                : {}),
              ...(state.leakTool ? { developer_memory: { input: {} } } : {}),
            },
          };
        },
        stop: async () => {
          process.stopped = true;
        },
      },
    };
    processes.push(process);
    return process.engine;
  };
  const host = new Ai0RuntimeHost({
    registry: () => registry,
    root: () => root,
    artifactRoot: () => join(root, "artifacts"),
    projectRoot: () => "/development-repository",
    defaultModel: async () => selectedModel,
    imagePlugin: async () => undefined,
    start,
  });
  return {
    root,
    registry,
    host,
    processes,
    state,
    setModel: (model: Ai0Model) => {
      selectedModel = model;
    },
    cleanup: async () => {
      await host.shutdown();
      db.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}

void test("normal AI0 preserves its conversation only while model and profile identity are unchanged", async () => {
  const f = await fixture();
  try {
    const first = await f.host.chat("hello");
    await f.host.selectModel(AI0_ASSISTANT_SCOPE, { providerID: "test", id: "model-one" });
    const second = await f.host.chat("again", AI0_ASSISTANT_SCOPE, first.sessionId);
    assert.equal(second.sessionId, first.sessionId);
    assert.equal(f.processes.length, 1);
    f.registry.select(AI0_ASSISTANT_SCOPE, "serious");
    await f.host.invalidateChangedContexts();
    assert.equal(f.processes[0]?.stopped, true);
    await assert.rejects(
      f.host.chat("stale", AI0_ASSISTANT_SCOPE, first.sessionId),
      /expired|changed/
    );
    const serious = await f.host.chat("new");
    assert.notEqual(serious.profileHash, first.profileHash);
    await f.host.selectModel(AI0_ASSISTANT_SCOPE, { providerID: "test", id: "model-two" });
    await assert.rejects(
      f.host.chat("old model", AI0_ASSISTANT_SCOPE, serious.sessionId),
      /expired|changed/
    );
    const changed = await f.host.chat("new model");
    assert.equal(changed.model.id, "model-two");
    assert.notEqual(changed.sessionId, serious.sessionId);
  } finally {
    await f.cleanup();
  }
});

void test("NPC and image work use separate processes, session permissions and stateless game packets", async () => {
  const f = await fixture();
  try {
    f.registry.select(FATE_KNOTS_NPC_SCOPE, "fate-knots-npc");
    await f.host.chat("public npc packet", FATE_KNOTS_NPC_SCOPE);
    await f.host.chat("different run public packet", FATE_KNOTS_NPC_SCOPE);
    const npc = f.processes[0];
    assert.ok(npc);
    assert.deepEqual(npc.allowed, []);
    assert.equal(npc.created.length, 2);
    assert.equal(npc.removed.length, 2);
    assert.deepEqual(npc.created[0]?.["permissions"], [
      { action: "*", resource: "*", effect: "deny" },
    ]);
    f.registry.select(FATE_KNOTS_IMAGE_SCOPE, "fate-knots-image");
    const image = await f.host.generateImage("public art direction", "1:1", FATE_KNOTS_IMAGE_SCOPE);
    assert.ok(image.path.endsWith(".png"));
    assert.deepEqual(f.processes[1]?.allowed, ["image_generate"]);
    assert.notEqual(f.processes[0]?.engine.workspacePath, f.processes[1]?.engine.workspacePath);
    assert.doesNotMatch(
      JSON.stringify(npc.instructions),
      /image-generator|development-agent memory.*public art direction/
    );
  } finally {
    await f.cleanup();
  }
});

void test("image capability comes from the real-session probe contract and fails closed for missing tools, incompatible models or leaked tools", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.host.imageStatus()).available, true);
    assert.equal(f.state.prompts, 0);
    f.state.toolAvailable = false;
    const absent = await f.host.imageStatus();
    assert.equal(absent.available, false);
    assert.match(absent.reason ?? "", /No real image_generate/);
    await assert.rejects(f.host.generateImage("draw"), /No real image_generate/);
    assert.equal(f.state.prompts, 0);
    f.state.toolAvailable = true;
    f.state.leakTool = true;
    const leak = await f.host.imageStatus();
    assert.equal(leak.available, false);
    assert.match(leak.reason ?? "", /outside the task boundary/);
  } finally {
    await f.cleanup();
  }
  const incompatible = await fixture();
  try {
    incompatible.state.toolsSupported = false;
    assert.match((await incompatible.host.imageStatus()).reason ?? "", /cannot call/);
  } finally {
    await incompatible.cleanup();
  }
});

void test("a successful tool event and a fully validated fresh PNG are both required; returned artifacts are verified again when opened", async () => {
  const f = await fixture();
  try {
    const image = await f.host.generateImage("test art");
    assert.equal(image.width, 1);
    assert.equal(image.height, 1);
    assert.match(image.sha256, /^[a-f0-9]{64}$/);
    assert.equal(await f.host.verifyGeneratedImage(image.path), image.path);
    await writeFile(image.path, Buffer.from("replaced"));
    await assert.rejects(f.host.verifyGeneratedImage(image.path), /PNG/);
    await assert.rejects(
      f.host.verifyGeneratedImage(join(f.root, "unknown.png")),
      /Only an image generated/
    );
    f.state.writeFile = false;
    await assert.rejects(f.host.generateImage("prose success only"), /ENOENT/);
    f.state.writeFile = true;
    f.state.completeTool = false;
    await assert.rejects(f.host.generateImage("file without tool evidence"), /exactly one real/);
    f.state.completeTool = true;
    f.state.invalidFile = true;
    await assert.rejects(f.host.generateImage("invalid PNG"), /not a PNG/);
  } finally {
    await f.cleanup();
  }
});

void test("timeouts terminate the owning process and never permit its stale session to be reused", async () => {
  const f = await fixture();
  try {
    f.state.failWait = true;
    await assert.rejects(f.host.chat("timeout"), /Timed out/);
    assert.equal(f.processes[0]?.stopped, true);
    f.state.failWait = false;
    const reply = await f.host.chat("next request");
    assert.equal(f.processes.length, 2);
    assert.equal(reply.text, "actual test response");
  } finally {
    await f.cleanup();
  }
});

void test("PNG validation rejects signature-only payloads, corrupt chunks, truncated pixels and symlink escapes", async () => {
  const bytes = pixelPng();
  assert.equal(validatePng(bytes).width, 1);
  assert.throws(() => validatePng(bytes.subarray(0, 8)), /incomplete/);
  const corrupt = Buffer.from(bytes);
  corrupt[42] = (corrupt[42] ?? 0) ^ 1;
  assert.throws(() => validatePng(corrupt), /checksum/);
  const root = await mkdtemp(join(tmpdir(), "hev-png-"));
  try {
    const outside = join(root, "outside.png");
    await writeFile(outside, bytes);
    const inside = join(root, "nested");
    await import("node:fs/promises").then(async (fs) => await fs.mkdir(inside));
    const link = join(inside, "image.png");
    await symlink(outside, link);
    await assert.rejects(verifyPngArtifact(inside, link), /escaped/);
    assert.deepEqual(await readFile(outside), bytes);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test("runtime environment replaces inherited OpenCode configuration without exposing development directories", () => {
  const env = buildAi0Environment(
    {
      OPENCODE_CONFIG: "/development/secret.json",
      OPENCODE_CONFIG_CONTENT: "developer-memory",
      OPENCODE_CONFIG_DIR: "/development",
      OPENCODE_SIMULATE: "1",
      OPENCODE_API_KEY: "unrelated",
      CDP_PORT: "9222",
      NODE_OPTIONS: "--inspect",
      PATH: "/bin",
    },
    "/runtime",
    { permissions: [{ action: "*", effect: "deny" }] },
    "private-server-password"
  );
  assert.equal(env["OPENCODE_CONFIG"], undefined);
  assert.equal(env["OPENCODE_SIMULATE"], undefined);
  assert.equal(env["OPENCODE_API_KEY"], undefined);
  assert.equal(env["OPENCODE_CONFIG_DIR"], "/runtime/config");
  assert.equal(env["OPENCODE_TEST_HOME"], "/runtime/home");
  assert.equal(env["OPENCODE_CONFIG_PROJECT_DISABLE"], "1");
  assert.equal(env["CDP_PORT"], undefined);
  assert.equal(env["NODE_OPTIONS"], undefined);
});

void test("Fate Knots projection discards unknown and hidden fields at every packet boundary", () => {
  const packet = sanitizeFateKnotsAi0Packet({
    requestId: "request",
    kind: "npc-dialogue",
    developerMemory: "SECRET",
    hiddenCanon: "SECRET",
    rolePacket: {
      universeId: "u",
      runId: "r",
      npcId: "npc",
      locationId: "place",
      personaFacts: ["public persona"],
      knownFacts: ["public knowledge"],
      relationshipFacts: [],
      legalInteractionIds: [],
      hiddenKnowledge: "SECRET",
    },
    visibleSceneFacts: ["public scene"],
    playerInput: null,
  });
  assert.doesNotMatch(JSON.stringify(packet), /SECRET|developerMemory|hiddenCanon|hiddenKnowledge/);
  const combat = sanitizeFateKnotsAi0Packet({
    requestId: "combat",
    kind: "combat-choice",
    combatPacket: {
      combatId: "c",
      turnIndex: 1,
      actorId: "npc",
      ownActor: {
        actorId: "npc",
        teamId: "opposition",
        hp: 10,
        maxHp: 10,
        fallen: false,
        position: { row: "front", range: "near", secret: "SECRET" },
        statusIds: [],
        injuryIds: [],
        hiddenCommit: "SECRET",
      },
      visibleActors: [],
      movementOptions: [],
      actionOptions: [],
      playerCommittedCards: ["SECRET"],
    },
  });
  assert.doesNotMatch(JSON.stringify(combat), /SECRET|playerCommittedCards|hiddenCommit/);
  assert.throws(
    () => sanitizeFateKnotsAi0Packet({ ...packet, playerInput: { secret: "SECRET" } }),
    /Non-public/
  );
});

void test("the host boundary blocks provider requests during capability probes and guards actual tool execution", () => {
  assert.match(AI0_BOUNDARY_PLUGIN, /PROBE_MUST_NOT_CALL_PROVIDER/);
  assert.match(AI0_BOUNDARY_PLUGIN, /ctx\.session\.hook\("generate"/);
  assert.match(AI0_BOUNDARY_PLUGIN, /ctx\.tool\.hook\("execute.before"/);
  assert.match(AI0_BOUNDARY_PLUGIN, /value\.input\.output_path !== expected/);
});
