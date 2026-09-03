import type { IpcMainInvokeEvent } from "electron";
import { registerHandler } from "./ipc-helpers.ts";
import { roomToolService } from "../room-tool-service.ts";
import { fateKnotsAi0RuntimeService } from "../fate-knots-ai0-runtime-service.ts";
import { fateKnotsAi0ImageService } from "../fate-knots-ai0-image-service.ts";
import type {
  RoomToolCallRequest,
  RoomToolCancelRequest,
  RoomToolFateKnotsAi0CallRequest,
  RoomToolFateKnotsAi0ImageGenerateRequest,
} from "../../src/types/room-tools.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isRolePacket(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value["universeId"]) &&
    isNonEmptyString(value["runId"]) &&
    isNonEmptyString(value["npcId"]) &&
    isNonEmptyString(value["locationId"]) &&
    isStringArray(value["personaFacts"]) &&
    isStringArray(value["knownFacts"]) &&
    isStringArray(value["relationshipFacts"]) &&
    isStringArray(value["legalInteractionIds"])
  );
}

function isCombatOption(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmptyString(value["cardId"]) &&
    typeof value["targetRequired"] === "boolean" &&
    isStringArray(value["legalPrimaryTargetIds"])
  );
}

function isCombatPacket(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value["combatId"]) &&
    typeof value["turnIndex"] === "number" &&
    Number.isInteger(value["turnIndex"]) &&
    value["turnIndex"] >= 0 &&
    isNonEmptyString(value["actorId"]) &&
    isRecord(value["ownActor"]) &&
    Array.isArray(value["visibleActors"]) &&
    Array.isArray(value["movementOptions"]) &&
    value["movementOptions"].every(isCombatOption) &&
    Array.isArray(value["actionOptions"]) &&
    value["actionOptions"].every(isCombatOption)
  );
}

function isRuntimePayload(value: unknown, requestId: string): boolean {
  if (!isRecord(value) || value["requestId"] !== requestId) return false;
  if (value["kind"] === "npc-dialogue") {
    return (
      isRolePacket(value["rolePacket"]) &&
      isStringArray(value["visibleSceneFacts"]) &&
      (value["playerInput"] === null || typeof value["playerInput"] === "string")
    );
  }
  if (value["kind"] === "combat-choice") return isCombatPacket(value["combatPacket"]);
  return false;
}

function isFateKnotsAi0CallRequest(value: unknown): value is RoomToolFateKnotsAi0CallRequest {
  if (!isRecord(value)) return false;
  if (
    value["operation"] !== "fate-knots-ai0-call" ||
    value["roomId"] !== "game-room" ||
    !isNonEmptyString(value["requestId"]) ||
    !isNonEmptyString(value["universeId"])
  ) {
    return false;
  }
  if (
    value["timeoutMs"] !== undefined &&
    (typeof value["timeoutMs"] !== "number" || !Number.isFinite(value["timeoutMs"]))
  ) {
    return false;
  }
  return isRuntimePayload(value["payload"], value["requestId"]);
}

function isFateKnotsAi0ImageGenerateRequest(
  value: unknown
): value is RoomToolFateKnotsAi0ImageGenerateRequest {
  if (!isRecord(value)) return false;
  if (
    value["operation"] !== "fate-knots-ai0-image-generate" ||
    value["roomId"] !== "game-room" ||
    !isNonEmptyString(value["requestId"]) ||
    !isNonEmptyString(value["jobId"]) ||
    !isNonEmptyString(value["prompt"]) ||
    !isNonEmptyString(value["sourceAspectRatio"])
  ) {
    return false;
  }
  if (!/^\d{1,3}:\d{1,3}$/.test(value["sourceAspectRatio"].trim())) return false;
  if (
    value["timeoutMs"] !== undefined &&
    (typeof value["timeoutMs"] !== "number" || !Number.isFinite(value["timeoutMs"]))
  ) {
    return false;
  }
  return true;
}

export function setupRoomToolHandlers(): void {
  registerHandler("room-tools-call", async (event: IpcMainInvokeEvent, request: unknown) => {
    if (isRecord(request) && request["operation"] === "fate-knots-ai0-call") {
      if (!isFateKnotsAi0CallRequest(request)) {
        return {
          success: false,
          operation: "fate-knots-ai0-call",
          requestId: isNonEmptyString(request["requestId"]) ? request["requestId"] : null,
          error: "Invalid Fate Knots AI0 runtime request.",
        };
      }
      const result = await fateKnotsAi0RuntimeService.call(request);
      return {
        success: true,
        operation: request.operation,
        requestId: request.requestId,
        fateKnotsAi0: result,
      };
    }
    if (isRecord(request) && request["operation"] === "fate-knots-ai0-image-generate") {
      if (!isFateKnotsAi0ImageGenerateRequest(request)) {
        return {
          success: false,
          operation: "fate-knots-ai0-image-generate",
          requestId: isNonEmptyString(request["requestId"]) ? request["requestId"] : null,
          jobId: isNonEmptyString(request["jobId"]) ? request["jobId"] : null,
          error: "Invalid Fate Knots AI0 image generation request.",
        };
      }
      try {
        const result = await fateKnotsAi0ImageService.generate(request);
        return {
          success: true,
          operation: request.operation,
          requestId: request.requestId,
          jobId: request.jobId,
          fateKnotsAi0Image: result,
        };
      } catch (error) {
        return {
          success: false,
          operation: request.operation,
          requestId: request.requestId,
          jobId: request.jobId,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
    return await roomToolService.handleCall(event, request as RoomToolCallRequest);
  });

  registerHandler("room-tools-cancel", (_event: IpcMainInvokeEvent, request: unknown) => {
    return roomToolService.cancel(request as RoomToolCancelRequest);
  });
}