import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import createForgeRoomHostRuntime from "../../rooms/forge-room/host/runtime.ts";

type ForgeNotification = {
  payload: Record<string, unknown>;
  type: string;
};

function encodeBase64Text(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

async function createElectronApi(storageDir: string) {
  return {
    async fmWriteFileAtomic(payload: { data: string; path: string }) {
      await mkdir(dirname(payload.path), { recursive: true });
      await writeFile(payload.path, payload.data, "utf8");
      return {
        success: true,
        path: payload.path,
      };
    },
    async readDirectoryFiles(dirPath: string) {
      try {
        const entries = await readdir(dirPath, { withFileTypes: true });
        return entries.map((entry) => ({
          isDirectory: entry.isDirectory(),
          name: entry.name,
          path: join(dirPath, entry.name),
        }));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return [];
        }
        throw error;
      }
    },
    async readFile(filePath: string) {
      try {
        return encodeBase64Text(await readFile(filePath, "utf8"));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return null;
        }
        throw error;
      }
    },
    async roomToolsCall(request: { operation: string; targetPath?: string }) {
      if (request.operation === "resolve-paths") {
        return {
          success: true,
          paths: {
            storageDir,
          },
        };
      }
      if (request.operation === "ensure-dir") {
        if (typeof request.targetPath !== "string") {
          return {
            success: false,
            error: "targetPath is required",
          };
        }
        await mkdir(request.targetPath, { recursive: true });
        return {
          success: true,
        };
      }
      return {
        success: false,
        error: `Unsupported room tool operation: ${request.operation}`,
      };
    },
  };
}

function createDispatchBridge(dispatchCalls: Array<Record<string, unknown>>) {
  return async (payload: Record<string, unknown>) => {
    dispatchCalls.push(payload);
    const protocol = (payload["payload"] as { protocol?: { protocolKey?: string } } | undefined)
      ?.protocol;
    const protocolKey = protocol?.protocolKey;
    if (protocolKey === "forge-room-breakdown-architect") {
      return {
        success: true,
        reply: {
          text: JSON.stringify({
            acceptanceCriteria: ["Repair Room can read the exported handoff JSON."],
            tasks: [
              {
                title: "Frame repair boundary",
                summary: "Define the minimal Repair Room handoff seam.",
                dispatchMode: "compare",
                seatId: "ai1",
                roleId: "architect",
                compareSeatIds: ["ai2"],
                personaPresetId: "rovo",
                checklist: ["List the export contract fields"],
              },
              {
                title: "Review runtime fit",
                summary: "Check the room-local execution constraints.",
                dispatchMode: "single-owner",
                seatId: "us1",
                roleId: "external-perspective",
                personaPresetId: "gok",
                checklist: [],
              },
              {
                title: "Prepare export package",
                summary: "Shape the final Repair Room handoff payload.",
                dispatchMode: "single-owner",
                seatId: "ai1",
                roleId: "architect",
                dependsOnTaskTitles: ["Frame repair boundary"],
                checklist: [],
              },
            ],
          }),
          provider: "forge-test",
          messageId: "breakdown-message-1",
          conversationId: "breakdown-conversation-1",
        },
        session: {
          id: "breakdown-session-1",
          conversationId: "breakdown-conversation-1",
        },
      };
    }
    if (protocolKey === "forge-room-task-response") {
      const toSlot = payload["toSlot"];
      if (toSlot === "ai1") {
        return {
          success: true,
          reply: {
            text: JSON.stringify({
              summary: "Keep the handoff JSON local and explicit.",
              body: "Use a room-local JSON export and keep the Repair Room intake narrow.",
              artifacts: [],
            }),
            provider: "forge-test",
            messageId: "task-message-ai1",
            conversationId: "task-conversation-ai1",
          },
          session: {
            id: "task-session-ai1",
            conversationId: "task-conversation-ai1",
          },
        };
      }
      if (toSlot === "ai2") {
        return {
          success: true,
          reply: {
            text: JSON.stringify({
              summary: "Document risks before implementation starts.",
              body: "Keep scope minimal, but call out validation and regression risk up front.",
              artifacts: [],
            }),
            provider: "forge-test",
            messageId: "task-message-ai2",
            conversationId: "task-conversation-ai2",
          },
          session: {
            id: "task-session-ai2",
            conversationId: "task-conversation-ai2",
          },
        };
      }
      return {
        success: true,
        reply: {
          text: JSON.stringify({
            summary: "The remote perspective validates the export contract.",
            body: "Keep the handoff readable, explicit, and easy to import downstream.",
            artifacts: [],
          }),
          provider: "forge-test",
          messageId: "task-message-us1",
          conversationId: "task-conversation-us1",
        },
        session: {
          id: "task-session-us1",
          conversationId: "task-conversation-us1",
        },
      };
    }
    if (protocolKey === "forge-room-synthesis") {
      const promptText = String((payload["payload"] as { text?: unknown } | undefined)?.text ?? "");
      const responseIds = Array.from(promptText.matchAll(/responseId:\s+([a-z0-9-]+)/gi)).map(
        (match) => match[1]
      );
      const conflictIds = Array.from(promptText.matchAll(/conflictId:\s+([a-z0-9-]+)/gi)).map(
        (match) => match[1]
      );
      return {
        success: true,
        reply: {
          text: JSON.stringify({
            summary: "Selected Forge synthesis",
            body: "Combine the practical export seam with explicit risk notes for Repair Room intake.",
            selectedResponseIds: responseIds.slice(0, 2),
            unresolvedConflictIds: conflictIds,
            acceptanceCriteria: ["Repair Room can read the exported handoff JSON."],
            openQuestions: ["Should Repair Room keep the import boundary manual in v1?"],
          }),
          provider: "forge-test",
          messageId: "synthesis-message-1",
          conversationId: "synthesis-conversation-1",
        },
        session: {
          id: "synthesis-session-1",
          conversationId: "synthesis-conversation-1",
        },
      };
    }
    return {
      success: false,
      message: `Unhandled protocol: ${String(protocolKey)}`,
    };
  };
}

function latestForgeSnapshot(notifications: ForgeNotification[]) {
  const snapshot = notifications.filter((entry) => entry.type === "forge-state").at(-1)?.payload[
    "snapshot"
  ];
  return snapshot as {
    activeSessionId: string | null;
    conflicts: Array<{ id: string }>;
    exports: Array<{ filePath: string }>;
    responses: Array<{ id: string }>;
    selectedSynthesisId: string | null;
    syntheses: Array<{ id: string; status: string }>;
  };
}

test("forge-room host runtime runs breakdown, dispatch, synthesis, export, and reopen through the live room-local flow", async () => {
  const storageDir = await mkdtemp(join(tmpdir(), "forge-room-host-flow-"));
  const notifications: ForgeNotification[] = [];
  const hostState = new Map<string, unknown>();
  const dispatchCalls: Array<Record<string, unknown>> = [];
  const electronApi = await createElectronApi(storageDir);
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      electronAPI: electronApi,
    },
  });

  try {
    const hostRuntime = createForgeRoomHostRuntime().activate({
      dispatchBridge: createDispatchBridge(dispatchCalls),
      getState(key: string) {
        return hostState.get(key);
      },
      log() {
        return undefined;
      },
      notifyRoom(type: string, payload: Record<string, unknown> = {}) {
        notifications.push({
          type,
          payload,
        });
      },
      setState(key: string, value: unknown) {
        hostState.set(key, value);
        return value;
      },
    });

    const createResult = await hostRuntime.commands.ForgeRoomCreateSession();
    assert.equal(createResult.success, true);

    const draftResult = await hostRuntime.commands.ForgeRoomGenerateDraft({
      summary: "Repair Room integration",
      brief: "Drive the first Forge Room handoff into Repair Room.",
      constraints: ["Keep orchestration room-local."],
      targetRoomId: "repair-room",
    });
    assert.equal(draftResult.success, true);

    const snapshotAfterDraft = latestForgeSnapshot(notifications);
    assert.equal(snapshotAfterDraft.responses.length, 0);

    const approvedTaskId = (
      notifications.filter((entry) => entry.type === "forge-state").at(-1)?.payload["snapshot"] as {
        draftTasks: Array<{ id: string; level: number }>;
      }
    ).draftTasks.find((task) => task.level === 1)?.id;
    assert.ok(approvedTaskId);

    const approveResult = await hostRuntime.commands.ForgeRoomApproveDraft();
    assert.equal(approveResult.success, true);

    const updateApprovedResult = await hostRuntime.commands.ForgeRoomUpdateApprovedTask({
      taskId: approvedTaskId,
      seatId: "ai1",
      roleId: "architect",
      dispatchMode: "compare",
      compareSeatIds: ["ai2"],
      personaPresetId: "rovo",
    });
    assert.equal(updateApprovedResult.success, true);

    const dispatchResult = await hostRuntime.commands.ForgeRoomDispatchAssignments();
    assert.equal(dispatchResult.success, true);
    assert.ok((dispatchResult.completedAssignments as number) >= 3);

    const snapshotAfterDispatch = latestForgeSnapshot(notifications);
    const conflictId = snapshotAfterDispatch.conflicts[0]?.id;
    const preferredResponseId = snapshotAfterDispatch.responses[0]?.id;
    assert.ok(conflictId);
    assert.ok(preferredResponseId);

    const preferResult = await hostRuntime.commands.ForgeRoomResolveConflict({
      conflictId,
      preferredResponseId,
      status: "open",
    });
    assert.equal(preferResult.success, true);

    const resolveResult = await hostRuntime.commands.ForgeRoomResolveConflict({
      conflictId,
      status: "resolved",
    });
    assert.equal(resolveResult.success, true);

    const synthesisResult = await hostRuntime.commands.ForgeRoomGenerateSynthesis();
    assert.equal(synthesisResult.success, true);

    const exportCheckResult = await hostRuntime.commands.ForgeRoomExportHandoffCheck();
    assert.equal(exportCheckResult.success, true);

    const exportResult = await hostRuntime.commands.ForgeRoomExportHandoff();
    assert.equal(exportResult.success, true);
    assert.ok(typeof exportResult.filePath === "string");

    const exportedJson = JSON.parse(await readFile(String(exportResult.filePath), "utf8")) as {
      selectedSynthesis: { id: string };
      targetRoomId: string;
    };
    assert.equal(exportedJson.targetRoomId, "repair-room");
    assert.equal(exportedJson.selectedSynthesis.id, synthesisResult.synthesisId);

    const sessionId = String(createResult.sessionId);
    const sessionPath = join(storageDir, "sessions", sessionId, "session.json");
    const savedSession = JSON.parse(await readFile(sessionPath, "utf8")) as {
      conflicts: Array<{ preferredResponseId: string | null; status: string }>;
      exports: Array<{ filePath: string }>;
      responses: Array<{ id: string }>;
      selectedSynthesisId: string | null;
    };
    assert.equal(savedSession.responses.length >= 3, true);
    assert.equal(savedSession.selectedSynthesisId, synthesisResult.synthesisId);
    assert.equal(savedSession.conflicts[0]?.status, "resolved");
    assert.equal(savedSession.conflicts[0]?.preferredResponseId, preferredResponseId);
    assert.equal(savedSession.exports.length, 1);

    const reopenNotifications: ForgeNotification[] = [];
    const reopenedRuntime = createForgeRoomHostRuntime().activate({
      dispatchBridge: createDispatchBridge(dispatchCalls),
      getState(key: string) {
        return hostState.get(key);
      },
      log() {
        return undefined;
      },
      notifyRoom(type: string, payload: Record<string, unknown> = {}) {
        reopenNotifications.push({
          type,
          payload,
        });
      },
      setState(key: string, value: unknown) {
        hostState.set(key, value);
        return value;
      },
    });
    const loadResult = await reopenedRuntime.commands.ForgeRoomLoadLatestSession();
    assert.equal(loadResult.success, true);
    const reopenedSnapshot = latestForgeSnapshot(reopenNotifications);
    assert.equal(reopenedSnapshot.selectedSynthesisId, synthesisResult.synthesisId);
    assert.equal(reopenedSnapshot.exports.length, 1);
    assert.equal(reopenedSnapshot.responses.length >= 3, true);
    assert.equal(reopenedSnapshot.conflicts.length >= 1, true);

    const reopenedConflictId = reopenedSnapshot.conflicts[0]?.id;
    assert.ok(reopenedConflictId);
    const reopenConflictResult = await reopenedRuntime.commands.ForgeRoomResolveConflict({
      conflictId: reopenedConflictId,
      status: "open",
    });
    assert.equal(reopenConflictResult.success, true);
    const snapshotAfterConflictReopen = latestForgeSnapshot(reopenNotifications);
    assert.equal(snapshotAfterConflictReopen.exports.length, 1);
    assert.equal(snapshotAfterConflictReopen.selectedSynthesisId, null);

    const protocolKeys = dispatchCalls.map(
      (call) =>
        (call["payload"] as { protocol?: { protocolKey?: string } } | undefined)?.protocol
          ?.protocolKey ?? null
    );
    assert.ok(protocolKeys.includes("forge-room-breakdown-architect"));
    assert.ok(protocolKeys.includes("forge-room-task-response"));
    assert.ok(protocolKeys.includes("forge-room-synthesis"));
  } finally {
    if (windowDescriptor) {
      Object.defineProperty(globalThis, "window", windowDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
    await rm(storageDir, { recursive: true, force: true });
  }
});
