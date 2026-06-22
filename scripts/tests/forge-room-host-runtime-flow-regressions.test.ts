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

type ForgeSnapshot = {
  activeSessionId: string | null;
  conflicts: Array<{ id: string }>;
  exports: Array<{ filePath: string }>;
  preflight: {
    status: string;
  };
  responses: Array<{ id: string }>;
  runOverride: {
    architectSeatId?: "ai2";
    enableRovoPreAnalysis: boolean;
    notes: string;
    temporaryConditions: string[];
  } | null;
  runSignature: {
    value: string;
  } | null;
  selectedSynthesisId: string | null;
  sessionContextSelection: {
    preferences: { mode: boolean };
    skill: { measurement: boolean };
    tools: { multimeter: boolean };
    skillKeys: string[];
    equipmentKeys: string[];
    preferenceKeys: string[];
  };
  syntheses: Array<{
    id: string;
    provenance?: {
      operatorProfileSummary?: string[];
      preflightWarnings?: string[];
      runSignature?: string | null;
    } | null;
    status: string;
  }>;
};

function encodeBase64Text(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

function createElectronApi(storageDir: string) {
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
      const promptText = String((payload["payload"] as { text?: string } | undefined)?.text ?? "");
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

function latestForgeSnapshot(notifications: ForgeNotification[]): ForgeSnapshot {
  const snapshot = notifications
    .filter((entry) => entry.type === "forge-state")
    .at(-1)?.payload["snapshot"];
  return snapshot as ForgeSnapshot;
}
