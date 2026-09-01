import test from "node:test";
import assert from "node:assert/strict";

import { materializeFateKnotsAi0Workspace } from "../../rooms/game-room/main-functions/fate-knots/host/ai0-workspace.ts";
import { FATE_KNOTS_AI0_RUNTIME_PROFILE_ID } from "../../rooms/game-room/main-functions/fate-knots/shared/ai0-runtime.ts";

void test("AI0 workspace is rebuilt under managed room storage with only minimal policy files", async () => {
  const operations: Array<{ kind: string; path: string; content?: string }> = [];
  const workspace = await materializeFateKnotsAi0Workspace(
    {
      async resolveRoomStorageDir() {
        return "/app-data/room-storage/game-room";
      },
      async deleteDirectory(path) {
        operations.push({ kind: "delete", path });
      },
      async ensureDirectory(path) {
        operations.push({ kind: "ensure", path });
      },
      async writeTextFile(path, content) {
        operations.push({ kind: "write", path, content });
      },
    },
    " universe / secret .. id "
  );

  assert.equal(
    workspace.workspaceDir,
    "/app-data/room-storage/game-room/fate-knots/ai0-runtime/universe-secret-..-id"
  );
  assert.equal(
    workspace.policyPath,
    "/app-data/room-storage/game-room/fate-knots/ai0-runtime/universe-secret-..-id/AGENTS.md"
  );
  assert.equal(workspace.runtimeProfileId, FATE_KNOTS_AI0_RUNTIME_PROFILE_ID);

  assert.deepEqual(
    operations.map((entry) => `${entry.kind}:${entry.path}`),
    [
      `delete:${workspace.workspaceDir}`,
      `ensure:${workspace.workspaceDir}`,
      `write:${workspace.policyPath}`,
    ]
  );

  const policy = operations.find((entry) => entry.kind === "write")?.content ?? "";
  assert.match(policy, /You are an NPC actor inside Fate Knots\./);
  assert.match(policy, /You are not a coding assistant/);
  assert.match(policy, /Do not request tools, MCP discovery, filesystem, shell, web, image generation, or project memory\./);
  assert.doesNotMatch(policy, /\.rovo/);
  assert.doesNotMatch(policy, /WORKFLOWS\.md/);
  assert.doesNotMatch(policy, /03-ARCHITECTURE\.md/);
});

void test("AI0 workspace refuses an unavailable storage root", async () => {
  await assert.rejects(
    materializeFateKnotsAi0Workspace(
      {
        async resolveRoomStorageDir() {
          return "   ";
        },
        async deleteDirectory() {},
        async ensureDirectory() {},
        async writeTextFile() {},
      },
      "universe-1"
    ),
    /room storage path is unavailable/
  );
});
