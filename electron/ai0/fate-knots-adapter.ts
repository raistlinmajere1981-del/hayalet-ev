import { getAgentProfileRegistry } from "../agent-profile-service.js";
import { ai0RuntimeHost } from "./runtime-host.js";
import { isRecord } from "./opencode-process.js";
import { FATE_KNOTS_IMAGE_SCOPE, FATE_KNOTS_NPC_SCOPE } from "../../shared/ai0-runtime.js";
import type {
  RoomToolFateKnotsAi0CallRequest,
  RoomToolFateKnotsAi0Result,
  RoomToolFateKnotsAi0ImageGenerateRequest,
  RoomToolFateKnotsAi0ImageResult,
  RoomToolFateKnotsAi0ImageStatus,
} from "../../src/types/room-tools.js";

function fields(value: unknown, allowed: string[]): Record<string, unknown> {
  if (!isRecord(value)) throw new Error("Invalid Fate Knots public packet");
  return Object.fromEntries(
    allowed.map((key) => {
      const item = value[key];
      if (
        item === undefined ||
        isRecord(item) ||
        (Array.isArray(item) && item.some((entry) => typeof entry !== "string"))
      )
        throw new Error("Non-public data is not allowed in an AI0 packet field");
      return [key, item];
    })
  );
}
function visibleActor(value: unknown): Record<string, unknown> {
  const actor = fields(value, [
    "actorId",
    "teamId",
    "hp",
    "maxHp",
    "fallen",
    "statusIds",
    "injuryIds",
  ]);
  actor["position"] = fields(isRecord(value) ? value["position"] : undefined, ["row", "range"]);
  return actor;
}
export function sanitizeFateKnotsAi0Packet(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error("Invalid Fate Knots AI0 packet");
  if (value["kind"] === "npc-dialogue") {
    return {
      ...fields(value, ["requestId", "kind", "visibleSceneFacts", "playerInput"]),
      rolePacket: fields(value["rolePacket"], [
        "universeId",
        "runId",
        "npcId",
        "locationId",
        "personaFacts",
        "knownFacts",
        "relationshipFacts",
        "legalInteractionIds",
      ]),
    };
  }
  if (value["kind"] === "combat-choice" && isRecord(value["combatPacket"])) {
    const packet = value["combatPacket"];
    const options = (data: unknown): Record<string, unknown>[] => {
      if (!Array.isArray(data)) throw new Error("Invalid Fate Knots legal options");
      return data.map((item) =>
        fields(item, ["cardId", "targetRequired", "legalPrimaryTargetIds"])
      );
    };
    if (!Array.isArray(packet["visibleActors"])) throw new Error("Invalid visible actor list");
    return {
      ...fields(value, ["requestId", "kind"]),
      combatPacket: {
        ...fields(packet, ["combatId", "turnIndex", "actorId"]),
        ownActor: visibleActor(packet["ownActor"]),
        visibleActors: packet["visibleActors"].map(visibleActor),
        movementOptions: options(packet["movementOptions"]),
        actionOptions: options(packet["actionOptions"]),
      },
    };
  }
  throw new Error("Unsupported Fate Knots runtime packet");
}
export async function callFateKnotsSharedAi0(
  request: RoomToolFateKnotsAi0CallRequest
): Promise<RoomToolFateKnotsAi0Result> {
  const packet = sanitizeFateKnotsAi0Packet(request.payload);
  getAgentProfileRegistry().ensureProfileSelection(FATE_KNOTS_NPC_SCOPE, "fate-knots-npc");
  if (String(request.roomId) !== "game-room" || packet["requestId"] !== request.requestId)
    throw new Error("Invalid Fate Knots AI0 request context");
  if (isRecord(packet["rolePacket"]) && packet["rolePacket"]["universeId"] !== request.universeId)
    throw new Error("Fate Knots universe does not match the public packet");
  const contract =
    packet["kind"] === "npc-dialogue"
      ? "Return only JSON: requestId, kind=npc-dialogue, utterance, optional selectedInteractionId from legalInteractionIds."
      : "Return only JSON: requestId, kind=combat-choice, actorId, optional movementCardId, actionCardId, primaryTargetId, secondaryTargetId. Choose only supplied legal options.";
  const result = await ai0RuntimeHost.chat(
    JSON.stringify(packet),
    FATE_KNOTS_NPC_SCOPE,
    undefined,
    request.timeoutMs,
    contract
  );
  return { text: result.text, port: result.port, workspacePath: result.workspacePath };
}
export async function fateKnotsSharedImageStatus(): Promise<RoomToolFateKnotsAi0ImageStatus> {
  getAgentProfileRegistry().ensureProfileSelection(FATE_KNOTS_IMAGE_SCOPE, "fate-knots-image");
  const result = await ai0RuntimeHost.imageStatus(FATE_KNOTS_IMAGE_SCOPE);
  return {
    available: result.available,
    activeModelKey: result.model ? `${result.model.providerID}:${result.model.id}` : null,
    providerId: result.model?.providerID ?? null,
    modelId: result.model?.id ?? null,
    toolId: result.toolId,
    compatibleTool: result.available,
    imageSkillDetected: false,
    imageSkillNames: [],
    reason: result.reason,
  };
}
export async function generateFateKnotsSharedImage(
  request: RoomToolFateKnotsAi0ImageGenerateRequest
): Promise<RoomToolFateKnotsAi0ImageResult> {
  getAgentProfileRegistry().ensureProfileSelection(FATE_KNOTS_IMAGE_SCOPE, "fate-knots-image");
  return await ai0RuntimeHost.generateImage(
    request.prompt,
    request.sourceAspectRatio,
    FATE_KNOTS_IMAGE_SCOPE,
    request.timeoutMs
  );
}
