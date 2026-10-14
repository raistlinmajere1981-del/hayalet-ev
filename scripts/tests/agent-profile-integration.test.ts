import assert from "node:assert/strict";
import test from "node:test";
import {
  attestAgentCapabilities,
  getAgentCapabilities,
  closeAgentProfileRegistry,
} from "../../electron/agent-profile-service.ts";
import Database from "../../electron/native/better-sqlite3.ts";
import { AgentProfileRegistry } from "../../electron/database/agent-profile-registry.ts";
import { ServerCommands } from "../../src/js/modules/server-commands.ts";
import { SettingsManager } from "../../src/js/modules/settings-manager.ts";
import { requestAgentProfiles } from "../../src/js/modules/agent-profiles.ts";
import type { AgentProfileRequest, AgentProfileScope } from "../../shared/agent-profiles.ts";

void test("host capability attestation never crosses purpose, slot, room or role and does not retain tools on model replacement", () => {
  const devScope: AgentProfileScope = {
    purpose: "development",
    agentId: "ai0",
    roomId: "assistant",
    roleId: "default",
  };
  try {
    const tools = ["development-memory", "filesystem-write"];
    attestAgentCapabilities(devScope, {
      source: "development-host",
      modelId: "dev-model",
      systemInstructions: true,
      tools,
    });
    tools.push("injected-after-attestation");
    assert.deepEqual(getAgentCapabilities(devScope).tools, [
      "development-memory",
      "filesystem-write",
    ]);
    for (const other of [
      { ...devScope, purpose: "runtime" as const },
      { ...devScope, agentId: "ai1" },
      { ...devScope, roomId: "fate-knots" },
      { ...devScope, roleId: "npc" },
    ]) {
      assert.deepEqual(getAgentCapabilities(other).tools, []);
      assert.equal(getAgentCapabilities(other).modelId, null);
    }
    attestAgentCapabilities(devScope, {
      source: "replacement-host",
      modelId: "text-only",
      systemInstructions: true,
      tools: [],
    });
    assert.deepEqual(getAgentCapabilities(devScope).tools, []);
  } finally {
    closeAgentProfileRegistry();
  }
});

void test("profile commands run through the common catalog and renderer transport, with scope checks and honest capability results", async () => {
  const db = new Database(":memory:");
  const store = new AgentProfileRegistry(db);
  const originalWindow = globalThis.window;
  const originalSnapshot = SettingsManager.getSnapshot;
  const requests: AgentProfileRequest[] = [];
  const noTools = {
    source: "test-host",
    modelId: "text-only",
    systemInstructions: true,
    tools: [],
  };
  globalThis.window = {
    electronAPI: {
      agentProfileRequest: async (request: AgentProfileRequest) => {
        requests.push(request);
        if (request.action === "list") return { success: true, data: store.list() };
        if (request.action === "select") {
          store.select(request.scope, request.profileId);
          return { success: true, data: store.editorRead(request.scope) };
        }
        if (request.action === "inspect" || request.action === "capabilities")
          return { success: true, data: store.resolve(request.scope, noTools) };
        return { success: false, error: "Unexpected request" };
      },
    },
  } as unknown as Window & typeof globalThis;
  try {
    const list = (await ServerCommands.run("AgentProfileList", { provider: "ai1" })) as {
      success: boolean;
      data: unknown[];
    };
    assert.equal(list.success, true);
    assert.equal(list.data.length, 5);
    assert.ok(ServerCommands.listByCategory("ai0").includes("AgentProfileSelect"));
    assert.ok(ServerCommands.listByCategory("us1").includes("AgentProfileCapabilities"));
    const selected = (await ServerCommands.run("AgentProfileSelect", {
      provider: "ai1",
      args: "fate-knots-image, ai0, fate-knots, fate-knots-image, runtime",
    })) as { success: boolean };
    assert.equal(selected.success, true);
    const status = (await ServerCommands.run("AgentProfileCapabilities", {
      provider: "ai0",
      args: "ai0, fate-knots, fate-knots-image, runtime",
    })) as { success: boolean; data: { unavailableCapabilities: string[] } };
    assert.equal(status.success, true);
    assert.deepEqual(status.data.unavailableCapabilities, ["image_generate"]);
    const inspected = (await ServerCommands.run("AgentProfileInspect", {
      provider: "ai0",
      args: "ai0, fate-knots, fate-knots-image, runtime",
    })) as { success: boolean; data: { profile: { id: string } } };
    assert.equal(inspected.data.profile.id, "fate-knots-image");
    SettingsManager.getSnapshot = () =>
      ({ slots: { ai1: { disabledCommands: ["AgentProfileList"] } } }) as ReturnType<
        typeof originalSnapshot
      >;
    const before = requests.length;
    const disabled = (await ServerCommands.run("AgentProfileList", { provider: "ai1" })) as {
      success: boolean;
    };
    assert.equal(disabled.success, false);
    assert.equal(requests.length, before);
    const bridge = window.electronAPI as {
      agentProfileRequest: (
        request: AgentProfileRequest
      ) => Promise<{ success: boolean; error?: string; data?: unknown }>;
    };
    bridge.agentProfileRequest = async () => ({
      success: false,
      error: "SQLite write failed",
    });
    await assert.rejects(requestAgentProfiles({ action: "list" }), /SQLite write failed/);
  } finally {
    SettingsManager.getSnapshot = originalSnapshot;
    globalThis.window = originalWindow;
    db.close();
  }
});
