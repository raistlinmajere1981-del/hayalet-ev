import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, readdir, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "../../electron/native/better-sqlite3.ts";
import { AgentProfileRegistry } from "../../electron/database/agent-profile-registry.ts";
import { createAgentProfileWorkspace } from "../../electron/agent-profile-workspace.ts";
import { AGENT_CHARACTER_FEATURES } from "../../shared/agent-character-features.ts";
import type {
  AgentCapabilitySnapshot,
  AgentCharacterProfile,
  AgentProfileScope,
} from "../../shared/agent-profiles.ts";
import { normalizeOpencodeUiSharedState } from "../../shared/opencode-ui-state.ts";

const scope: AgentProfileScope = {
  purpose: "runtime",
  agentId: "ai0",
  roomId: "test-room",
  roleId: "default",
};
const noTools: AgentCapabilitySnapshot = {
  source: "test-host",
  modelId: "text-only",
  systemInstructions: true,
  tools: [],
};

function fixture() {
  const db = new Database(":memory:");
  return { db, store: new AgentProfileRegistry(db) };
}

void test("registry seeds once and persists CRUD and scope selections in application SQLite", async () => {
  const directory = await mkdtemp(join(tmpdir(), "hev-profile-db-"));
  const filename = join(directory, "app.db");
  let db = new Database(filename);
  try {
    let store = new AgentProfileRegistry(db);
    assert.equal(store.list().length, 5);
    const profile = store.saveProfile(
      {
        id: "custom",
        name: "Custom",
        description: "",
        selectedFeatureIds: ["detail-minimal"],
        instructionId: null,
        requestedCapabilities: [],
      },
      0
    );
    store.select(scope, profile.id);
    db.close();
    db = new Database(filename);
    store = new AgentProfileRegistry(db);
    assert.equal(store.list().length, 6);
    assert.equal(store.selected(scope).id, "custom");
    const updated = store.saveProfile({ ...profile, name: "Changed" }, profile.version);
    assert.equal(updated.version, 2);
    assert.throws(() => store.saveProfile(profile, 1), /version conflict/);
    store.deleteProfile("custom", updated.version);
    assert.equal(store.selected(scope).id, "normal");
    for (const item of store.list()) store.deleteProfile(item.id, item.version);
    db.close();
    db = new Database(filename);
    store = new AgentProfileRegistry(db);
    assert.deepEqual(store.list(), []);
    assert.throws(() => store.resolve(scope, noTools), /Select a profile/);
  } finally {
    db.close();
    await rm(directory, { recursive: true, force: true });
  }
});

void test("resolution orders base, agent, room, role and personality without development imports", () => {
  const { db, store } = fixture();
  try {
    store.saveInstruction(
      {
        id: "agent-ai0",
        purpose: "runtime",
        layer: "agent",
        targetId: "ai0",
        content: "AGENT_CONTEXT",
      },
      0
    );
    store.saveInstruction(
      {
        id: "room-test",
        purpose: "runtime",
        layer: "room",
        targetId: "test-room",
        content: "PUBLIC_ROOM_CONTEXT",
      },
      0
    );
    store.saveInstruction(
      {
        id: "role-test",
        purpose: "runtime",
        layer: "role",
        targetId: "default",
        content: "PUBLIC_TASK_CONTEXT",
      },
      0
    );
    store.saveInstruction(
      {
        id: "dev-only",
        purpose: "development",
        layer: "agent",
        targetId: "ai0",
        content: "DEVELOPMENT_MEMORY_AND_SECRET",
      },
      0
    );
    store.select({ ...scope, purpose: "development" }, "serious");
    const result = store.resolve(scope, noTools);
    assert.deepEqual(
      result.layers.map((layer) => layer.layer),
      ["base", "agent", "room", "role", "character"]
    );
    assert.equal(result.profile.id, "normal");
    assert.ok(
      result.system.indexOf("AGENT_CONTEXT") < result.system.indexOf("PUBLIC_ROOM_CONTEXT")
    );
    assert.ok(
      result.system.indexOf("PUBLIC_ROOM_CONTEXT") < result.system.indexOf("PUBLIC_TASK_CONTEXT")
    );
    assert.ok(
      result.system.indexOf("PUBLIC_TASK_CONTEXT") < result.system.indexOf("Character preferences")
    );
    assert.doesNotMatch(
      result.system,
      /DEVELOPMENT_MEMORY_AND_SECRET|\.rovo|workspace policy when working/
    );
    assert.doesNotMatch(
      store.resolve({ ...scope, roomId: "other-room" }, noTools).system,
      /PUBLIC_ROOM_CONTEXT/
    );
    assert.doesNotMatch(
      store.resolve({ ...scope, agentId: "ai2" }, noTools).system,
      /AGENT_CONTEXT/
    );
    assert.match(
      store.resolve({ ...scope, purpose: "development" }, noTools).system,
      /DEVELOPMENT_MEMORY_AND_SECRET/
    );
  } finally {
    db.close();
  }
});

void test("resolution hashes are deterministic and track content, version, scope and actual capabilities", () => {
  const { db, store } = fixture();
  try {
    const first = store.resolve(scope, noTools);
    assert.equal(first.resolverVersion, 1);
    assert.match(first.hash, /^[a-f0-9]{64}$/);
    assert.equal(
      first.hash,
      store.resolve(
        { roleId: "default", roomId: "test-room", agentId: "ai0", purpose: "runtime" },
        noTools
      ).hash
    );
    const editor = store.editorRead(scope);
    store.saveEditor(scope, editor);
    assert.equal(first.hash, store.resolve(scope, noTools).hash);
    store.saveInstruction(
      {
        id: "base-runtime",
        purpose: "runtime",
        layer: "base",
        targetId: "*",
        content: "Updated public base instructions",
      },
      1
    );
    const updated = store.resolve(scope, noTools);
    assert.notEqual(first.hash, updated.hash);
    assert.equal(updated.layers[0]?.version, 2);
    assert.notEqual(updated.hash, store.resolve({ ...scope, roomId: "another" }, noTools).hash);
    assert.notEqual(
      updated.hash,
      store.resolve(scope, { ...noTools, modelId: "different-model" }).hash
    );
    const a = store.resolve(scope, { ...noTools, tools: ["search", "image-generation", "search"] });
    const b = store.resolve(scope, { ...noTools, tools: ["image-generation", "search"] });
    assert.equal(a.hash, b.hash);
  } finally {
    db.close();
  }
});

void test("task-bound presets cannot cross purposes or roles and never manufacture image capability", () => {
  const { db, store } = fixture();
  try {
    const imageScope = { ...scope, roomId: "fate-knots", roleId: "fate-knots-image" };
    assert.throws(() => store.select(scope, "fate-knots-image"), /do not match/);
    assert.throws(
      () => store.select({ ...imageScope, purpose: "development" }, "fate-knots-image"),
      /do not match/
    );
    store.select(imageScope, "fate-knots-image");
    const unavailable = store.resolve(imageScope, noTools);
    assert.deepEqual(unavailable.capabilities.tools, []);
    assert.deepEqual(unavailable.unavailableCapabilities, ["image-generation"]);
    assert.equal(unavailable.delivery, "system");
    const available = store.resolve(imageScope, { ...noTools, tools: ["image-generation"] });
    assert.deepEqual(available.unavailableCapabilities, []);
    assert.notEqual(available.hash, unavailable.hash);
    assert.equal(
      store.resolve(imageScope, { ...noTools, systemInstructions: false }).delivery,
      "workspace"
    );
  } finally {
    db.close();
  }
});

void test("character editor saves atomically, detects stale edits and keeps task and tool requirements separate", () => {
  const { db, store } = fixture();
  try {
    const editor = store.editorRead(scope);
    const normal = editor.profiles.find((item) => item.id === "normal") as AgentCharacterProfile;
    normal.name = "Updated normal";
    normal.instructionId = "fate-knots-image-role";
    normal.requestedCapabilities = ["image-generation"];
    const saved = store.saveEditor(scope, editor);
    const actual = saved.profiles.find((item) => item.id === "normal");
    assert.equal(actual?.name, "Updated normal");
    assert.equal(actual?.instructionId, null);
    assert.deepEqual(actual?.requestedCapabilities, []);
    assert.equal(actual?.version, 2);
    assert.throws(() => store.saveEditor(scope, editor), /Registry changed/);
    const invalid = store.editorRead(scope);
    invalid.profiles = invalid.profiles.map((item) =>
      item.id === "normal"
        ? { ...item, name: "Should roll back", selectedFeatureIds: ["unknown-feature"] }
        : item
    );
    assert.throws(() => store.saveEditor(scope, invalid), /Unknown character feature/);
    assert.equal(store.list().find((item) => item.id === "normal")?.name, "Updated normal");
    const wrongScope = store.editorRead(scope);
    wrongScope.activeProfileId = "fate-knots-npc";
    assert.throws(() => store.saveEditor(scope, wrongScope), /do not match/);
    assert.equal(store.selected(scope).id, "normal");
  } finally {
    db.close();
  }
});

void test("instruction CRUD enforces scope identity, optimistic versions, base policy and bounded systems", () => {
  const { db, store } = fixture();
  try {
    const input = {
      id: "task",
      purpose: "runtime" as const,
      layer: "role" as const,
      targetId: "default",
      content: "Public task",
    };
    store.saveInstruction(input, 0);
    assert.equal(store.listInstructions("runtime").find((item) => item.id === "task")?.version, 1);
    assert.throws(() => store.saveInstruction(input, 0), /version conflict/);
    assert.throws(
      () => store.saveInstruction({ ...input, purpose: "development" }, 1),
      /immutable/
    );
    store.saveInstruction({ ...input, content: "x".repeat(16000) }, 1);
    assert.throws(() => store.resolve(scope, noTools), /system budget/);
    store.deleteInstruction("task", 2);
    assert.doesNotMatch(store.resolve(scope, noTools).system, /Public task/);
    assert.throws(() => store.deleteInstruction("base-runtime", 1), /required/);
    assert.throws(() => store.select({ ...scope, agentId: "../../outside" }, "normal"), /Invalid/);
  } finally {
    db.close();
  }
});

void test("workspace export creates separate empty workspaces with only resolved AGENTS and hash", async () => {
  const { db, store } = fixture();
  const directory = await mkdtemp(join(tmpdir(), "hev-profile-workspace-"));
  try {
    const result = store.resolve(scope, noTools);
    const first = await createAgentProfileWorkspace(join(directory, "workspaces"), result);
    const second = await createAgentProfileWorkspace(join(directory, "workspaces"), result);
    assert.notEqual(first.workspacePath, second.workspacePath);
    assert.deepEqual(await readdir(first.workspacePath), ["AGENTS.md"]);
    const content = await readFile(first.agentsPath, "utf8");
    assert.match(content, new RegExp(result.hash));
    assert.ok(content.includes(result.system));
    assert.doesNotMatch(content, /\.rovo|DEVELOPMENT_MEMORY_AND_SECRET/);
    await symlink(directory, join(directory, "unsafe"));
    await assert.rejects(createAgentProfileWorkspace(join(directory, "unsafe"), result), /Unsafe/);
  } finally {
    db.close();
    await rm(directory, { recursive: true, force: true });
  }
});

void test("JSON UI state is no longer a profile authority and all editor traits have resolver semantics", () => {
  const state = normalizeOpencodeUiSharedState({
    characterProfiles: { activeProfileId: "legacy", profiles: [{ id: "legacy", name: "Legacy" }] },
  });
  assert.equal(Object.hasOwn(state, "characterProfiles"), false);
  assert.equal(Object.keys(AGENT_CHARACTER_FEATURES).length, 39);
});

void test("character semantics come from SQLite and their version contributes to the resolution hash", () => {
  const { db, store } = fixture();
  try {
    const original = store.resolve(scope, noTools);
    db.prepare("UPDATE agent_character_features SET content=?, version=version+1 WHERE id=?").run(
      "Use a warm and concise tone",
      "tone-friendly"
    );
    const changed = store.resolve(scope, noTools);
    assert.match(changed.system, /Use a warm and concise tone/);
    assert.equal(changed.characterFeatures.find((item) => item.id === "tone-friendly")?.version, 2);
    assert.notEqual(changed.hash, original.hash);
  } finally {
    db.close();
  }
});
