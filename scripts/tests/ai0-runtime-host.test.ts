import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { deflateSync } from "node:zlib";
import Database from "../../electron/native/better-sqlite3.ts";
import { AgentProfileRegistry } from "../../electron/database/agent-profile-registry.ts";
import { Ai0RuntimeHost, extractAi0AssistantMessages } from "../../electron/ai0/runtime-host.ts";
import type { Ai0HostDependencies } from "../../electron/ai0/runtime-host.ts";
import type { Ai0Engine } from "../../electron/ai0/opencode-process.ts";
import { buildAi0Environment } from "../../electron/ai0/opencode-process.ts";
import { validatePng, verifyPngArtifact } from "../../electron/ai0/png-artifact.ts";
import {
  AI0_ASSISTANT_SCOPE,
  AI0_IMAGE_SCOPE,
  AI0_ROOM_SCOPE,
  FATE_KNOTS_NPC_SCOPE,
  FATE_KNOTS_IMAGE_SCOPE,
} from "../../shared/ai0-runtime.ts";
import { sanitizeFateKnotsAi0Packet } from "../../electron/ai0/fate-knots-adapter.ts";

function pixelPng(): Buffer {
  function chunk(name: string, body: Buffer): Buffer {
    const data = Buffer.concat([Buffer.from(name), body]);
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) === 1 ? 0xedb88320 : 0);
    }
    const result = Buffer.alloc(body.length + 12);
    result.writeUInt32BE(body.length, 0);
    data.copy(result, 4);
    result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
    return result;
  }
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
  allowed: string[];
  stopped: boolean;
  created: Array<Record<string, unknown>>;
  imageCalls: Array<Record<string, unknown>>;
  removed: string[];
  engine: Ai0Engine;
}
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "hev-ai0-native-"));
  const db = new Database(":memory:");
  const registry = new AgentProfileRegistry(db);
  const state = {
    pluginActive: true,
    corruptImage: false,
    imageFails: false,
    messages: 0,
    failWait: false,
    seq: 0,
  };
  const processes: FakeProcess[] = [];
  const start: Ai0HostDependencies["start"] = async (workspacePath, _project, allowed) => {
    const proc: FakeProcess = {
      allowed: [...allowed],
      stopped: false,
      created: [],
      imageCalls: [],
      removed: [],
      engine: {
        workspacePath,
        port: 4151,
        stop: async () => {
          proc.stopped = true;
        },
        request: async (method, path, body) => {
          if (method === "GET" && path.startsWith("/api/model"))
            return {
              data: [
                { providerID: "openai", id: "gpt-text" },
                { providerID: "openai", id: "gpt-other" },
              ],
            };
          if (method === "GET" && path.startsWith("/api/plugin"))
            return {
              data: [
                {
                  id: "opencode-gpt-imagegen",
                  state: {
                    status: state.pluginActive ? "active" : "inactive",
                  },
                },
              ],
            };
          if (method === "POST" && path === "/api/session") {
            proc.created.push(body as Record<string, unknown>);
            return { data: { id: "session_" + ++state.seq } };
          }
          if (method === "PUT") return {};
          if (method === "POST" && path.endsWith("/prompt")) {
            state.messages += 1;
            const text = (body as { text: string }).text;
            if (text.startsWith("Generate exactly one PNG using gpt_imagegen. Arguments: ")) {
              const input = JSON.parse(text.slice(text.indexOf("Arguments: ") + 11)) as Record<
                string,
                unknown
              >;
              proc.imageCalls.push(input);
              if (state.imageFails) throw new Error("OpenCode POST failed (HTTP 403)");
              await writeFile(
                String(input["out"]),
                state.corruptImage ? Buffer.from("fake PNG") : pixelPng()
              );
            }
            return { data: {} };
          }
          if (method === "POST" && path.endsWith("/wait")) {
            if (state.failWait) throw new Error("Timed out");
            return null;
          }
          if (method === "GET" && path.includes("/message") && proc.imageCalls.length) {
            const input = proc.imageCalls.at(-1)!;
            return {
              data: [
                {
                  type: "assistant",
                  content: [
                    {
                      type: "tool",
                      name: "gpt_imagegen",
                      state: {
                        status: "completed",
                        input,
                        metadata: { out: input["out"], versioned: false },
                      },
                    },
                  ],
                },
              ],
            };
          }
          if (method === "GET" && path.includes("/message"))
            return {
              data: [
                { type: "assistant", content: [{ type: "text", text: "actual test response" }] },
              ],
            };
          if (method === "DELETE") {
            proc.removed.push(path);
            return {};
          }
          throw new Error("Unexpected engine API " + method + " " + path);
        },
      },
    };
    processes.push(proc);
    return proc.engine;
  };
  const host = new Ai0RuntimeHost({
    registry: () => registry,
    root: () => root,
    artifactRoot: () => join(root, "artifacts"),
    projectRoot: () => "/development-repository",
    defaultModel: async () => ({ providerID: "openai", id: "gpt-text" }),
    start,
  });
  return {
    root,
    registry,
    host,
    state,
    processes,
    cleanup: async () => {
      await host.shutdown();
      db.close();
      await rm(root, { force: true, recursive: true });
    },
  };
}

void test("AI0 text tasks preserve session but deny every inherited OpenCode tool", async () => {
  const f = await fixture();
  try {
    const a = await f.host.chat("hello");
    const b = await f.host.chat("again", AI0_ASSISTANT_SCOPE, a.sessionId);
    assert.equal(a.sessionId, b.sessionId);
    assert.deepEqual(f.processes[0]?.allowed, []);
    assert.deepEqual(f.processes[0]?.created[0]?.["permissions"], [
      { action: "*", resource: "*", effect: "deny" },
    ]);
    f.registry.select(AI0_ASSISTANT_SCOPE, "serious");
    await f.host.invalidateChangedContexts();
    assert.equal(f.processes[0]?.stopped, true);
    await assert.rejects(f.host.chat("stale", AI0_ASSISTANT_SCOPE, a.sessionId), /expired/);
  } finally {
    await f.cleanup();
  }
});

void test("image tasks use active model and exactly one OpenCode plugin tool", async () => {
  const f = await fixture();
  try {
    await assert.rejects(
      f.host.selectModel(AI0_IMAGE_SCOPE, { providerID: "openai", id: "gpt-image-2" }),
      /active OpenCode model/
    );
    const ready = await f.host.imageStatus();
    assert.equal(ready.available, true);
    assert.equal(ready.verified, false);
    assert.equal(ready.toolId, "gpt_imagegen");
    assert.equal(f.processes.at(-1)?.imageCalls.length, 0);
    const artifact = await f.host.generateImage("blue dragon", "3:2");
    assert.equal(artifact.width, 1);
    assert.equal(artifact.activeModelKey, "openai:gpt-text");
    assert.match(artifact.sha256, /^[a-f0-9]{64}$/);
    const proc = f.processes.at(-1)!;
    assert.equal(proc.imageCalls[0]?.["prompt"], "blue dragon");
    assert.equal(proc.imageCalls[0]?.["size"], "1536x1024");
    assert.deepEqual(proc.created[0]?.["permissions"], [
      { action: "*", resource: "*", effect: "deny" },
      { action: "gpt_imagegen", resource: "*", effect: "allow" },
    ]);
    assert.equal(proc.removed.length, 1);
    assert.equal((await f.host.imageStatus()).verified, true);
    assert.equal(await f.host.verifyGeneratedImage(artifact.path), artifact.path);
    await writeFile(artifact.path, "replaced");
    await assert.rejects(f.host.verifyGeneratedImage(artifact.path), /PNG/);
  } finally {
    await f.cleanup();
  }
});
void test("plugin failures cannot produce false verified artifacts or fallback", async () => {
  const f = await fixture();
  try {
    f.state.pluginActive = false;
    assert.equal((await f.host.imageStatus()).available, false);
    await assert.rejects(f.host.generateImage("draft"), /unavailable/);
    assert.equal(f.processes.flatMap((p) => p.imageCalls).length, 0);
    f.state.pluginActive = true;
    f.state.corruptImage = true;
    await assert.rejects(f.host.generateImage("corrupt"), /PNG/);
    assert.equal((await f.host.imageStatus()).verified, false);
    f.state.corruptImage = false;
    f.state.imageFails = true;
    await assert.rejects(f.host.generateImage("denied"), /HTTP 403/);
    assert.equal((await f.host.imageStatus()).verified, false);
    await assert.rejects(f.host.verifyGeneratedImage(join(f.root, "unknown.png")), /Only an image/);
  } finally {
    await f.cleanup();
  }
});
void test("room text model and old image selections do not override the active OpenCode image dispatcher", async () => {
  const f = await fixture();
  try {
    await f.host.selectModel(AI0_ROOM_SCOPE, { providerID: "openai", id: "gpt-other" });
    f.registry.select(FATE_KNOTS_NPC_SCOPE, "fate-knots-npc");
    const npc = await f.host.chat("public packet", FATE_KNOTS_NPC_SCOPE);
    assert.equal(npc.model.id, "gpt-other");
    f.registry.selectRuntimeModel(AI0_IMAGE_SCOPE, { providerID: "codex-cli", id: "image_gen" });
    f.registry.select(FATE_KNOTS_IMAGE_SCOPE, "fate-knots-image");
    const image = await f.host.generateImage("world illustration", "1:1", FATE_KNOTS_IMAGE_SCOPE);
    assert.equal(image.activeModelKey, "openai:gpt-text");
    assert.ok(image.path.endsWith(".png"));
  } finally {
    await f.cleanup();
  }
});

void test("runtime inherits user's existing OpenCode configuration and overrides only server auth", () => {
  const env = buildAi0Environment(
    {
      OPENCODE_CONFIG: "/home/user/.config/opencode/custom.json",
      OPENCODE_CONFIG_CONTENT: "user config",
      OPENCODE_CONFIG_DIR: "/home/user/.config/opencode",
      OPENCODE_PASSWORD: "user local server",
      OPENCODE_SIMULATE: "0",
      PATH: "/bin",
      NODE_OPTIONS: "--inspect",
    },
    "private-ai0-password"
  );
  assert.equal(env["OPENCODE_CONFIG_CONTENT"], "user config");
  assert.equal(env["OPENCODE_CONFIG_DIR"], "/home/user/.config/opencode");
  assert.equal(env["OPENCODE_PASSWORD"], "private-ai0-password");
  assert.equal(env["OPENCODE_SERVER_PASSWORD"], "private-ai0-password");
  assert.equal(env["NODE_OPTIONS"], undefined);
});

void test("PNG validation retains full payload and verifies image hashes", async () => {
  const bytes = pixelPng();
  assert.equal(validatePng(bytes).width, 1);
  assert.throws(() => validatePng(bytes.subarray(0, 8)), /incomplete/);
  const root = await mkdtemp(join(tmpdir(), "hev-png-"));
  try {
    const path = join(root, "test.png");
    await writeFile(path, bytes);
    const result = await verifyPngArtifact(root, path);
    assert.equal(result.width, 1);
    assert.deepEqual(await readFile(path), bytes);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test("NPC boundary strips private fields before any external model request", () => {
  const packet = sanitizeFateKnotsAi0Packet({
    requestId: "request",
    kind: "npc-dialogue",
    developerMemory: "SECRET",
    rolePacket: {
      universeId: "u",
      runId: "r",
      npcId: "n",
      locationId: "l",
      personaFacts: [],
      knownFacts: [],
      relationshipFacts: [],
      legalInteractionIds: [],
      hiddenKnowledge: "SECRET",
    },
    visibleSceneFacts: ["visible"],
    playerInput: null,
  });
  assert.doesNotMatch(JSON.stringify(packet), /SECRET/);
  assert.throws(
    () =>
      sanitizeFateKnotsAi0Packet({
        ...packet,
        playerInput: { secret: "SECRET" },
      }),
    /Non-public/
  );
});

void test("provider errors never expose raw remote response bodies", () => {
  assert.throws(
    () =>
      extractAi0AssistantMessages({
        data: [
          {
            type: "assistant",
            error: {
              type: "provider.auth",
              status: 403,
              message: "SYNTHETIC_SECRET",
              response: { body: "SYNTHETIC_SECRET" },
            },
          },
        ],
      }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /provider.auth.*HTTP 403/);
      assert.doesNotMatch(error.message, /SYNTHETIC_SECRET/);
      return true;
    }
  );
});
