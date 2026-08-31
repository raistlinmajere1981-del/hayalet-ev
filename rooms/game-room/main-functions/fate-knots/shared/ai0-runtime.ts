import type { FateKnotsNpcRolePacket } from "./contracts.js";
import type { FateKnotsAi0CombatDecisionRequest } from "./enemy-controller.js";

export const FATE_KNOTS_AI0_RUNTIME_PROFILE_ID = "fate-knots-ai0-npc-runtime-v1";

export interface FateKnotsAi0RuntimeProfile {
  id: typeof FATE_KNOTS_AI0_RUNTIME_PROFILE_ID;
  role: "npc-actor";
  workspaceIsolation: "external-app-data";
  inheritRepositoryAgentPolicy: false;
  bootstrapProjectMemory: false;
  discoverMcpTools: false;
  allowFilesystem: false;
  allowShell: false;
  allowWeb: false;
  allowImageGeneration: false;
  toolIds: readonly [];
  conversationMode: "stateless-packet";
}

/**
 * Semantic runtime contract. Stage C host integration is responsible for making
 * these flags real by launching AI0 from an app-data workspace outside the repo.
 * Prompt text alone is not an isolation boundary.
 */
export const FATE_KNOTS_AI0_RUNTIME_PROFILE: FateKnotsAi0RuntimeProfile = {
  id: FATE_KNOTS_AI0_RUNTIME_PROFILE_ID,
  role: "npc-actor",
  workspaceIsolation: "external-app-data",
  inheritRepositoryAgentPolicy: false,
  bootstrapProjectMemory: false,
  discoverMcpTools: false,
  allowFilesystem: false,
  allowShell: false,
  allowWeb: false,
  allowImageGeneration: false,
  toolIds: [],
  conversationMode: "stateless-packet",
};

export const FATE_KNOTS_AI0_MINIMAL_POLICY = [
  "You are an NPC actor inside Fate Knots.",
  "You are not a coding assistant and must not inspect or modify Hayalet Ev.",
  "Use only the supplied runtime packet as knowledge.",
  "Do not invent hidden canon, mechanical outcomes, items, stats, or unavailable actions.",
  "Do not request tools, MCP discovery, filesystem, shell, web, image generation, or project memory.",
  "For dialogue, portray only the supplied NPC and stay within its persona and known facts.",
  "For combat, choose only from engine-provided legal options.",
  "Engine state and legality override prose and choices.",
  "Return only the response shape requested by the packet.",
].join("\n");

export interface FateKnotsAi0WorkspaceFile {
  relativePath: "AGENTS.md";
  content: string;
}

export interface FateKnotsAi0WorkspaceSpec {
  root: "app-user-data";
  relativeSegments: readonly ["fate-knots", "ai0-runtime", string];
  files: readonly [FateKnotsAi0WorkspaceFile];
}

function sanitizeWorkspaceSegment(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "universe";
}

/**
 * Provider-neutral workspace recipe. The host joins these segments under the
 * application's user-data directory; it must never resolve them under the repo.
 */
export function buildFateKnotsAi0WorkspaceSpec(universeId: string): FateKnotsAi0WorkspaceSpec {
  return {
    root: "app-user-data",
    relativeSegments: ["fate-knots", "ai0-runtime", sanitizeWorkspaceSegment(universeId)],
    files: [
      {
        relativePath: "AGENTS.md",
        content: `${FATE_KNOTS_AI0_MINIMAL_POLICY}\n`,
      },
    ],
  };
}

export interface FateKnotsAi0DialogueRequest {
  requestId: string;
  kind: "npc-dialogue";
  rolePacket: FateKnotsNpcRolePacket;
  visibleSceneFacts: string[];
  playerInput: string | null;
}

export interface FateKnotsAi0CombatRuntimeRequest {
  requestId: string;
  kind: "combat-choice";
  combatPacket: FateKnotsAi0CombatDecisionRequest;
}

export type FateKnotsAi0RuntimeRequest =
  | FateKnotsAi0DialogueRequest
  | FateKnotsAi0CombatRuntimeRequest;

export interface FateKnotsAi0DialogueResponse {
  requestId: string;
  kind: "npc-dialogue";
  utterance: string;
  selectedInteractionId?: string | null;
}

export interface FateKnotsAi0CombatRuntimeResponse {
  requestId: string;
  kind: "combat-choice";
  actorId: string;
  movementCardId?: string | null;
  actionCardId?: string | null;
  primaryTargetId?: string | null;
  secondaryTargetId?: string | null;
}

export type FateKnotsAi0RuntimeResponse =
  | FateKnotsAi0DialogueResponse
  | FateKnotsAi0CombatRuntimeResponse;

export type FateKnotsAi0ResponseIssueCode =
  | "request-id-mismatch"
  | "response-kind-mismatch"
  | "empty-utterance"
  | "illegal-interaction-id"
  | "actor-id-mismatch"
  | "illegal-movement-card"
  | "illegal-action-card"
  | "missing-primary-target"
  | "illegal-primary-target";

export interface FateKnotsAi0ResponseIssue {
  code: FateKnotsAi0ResponseIssueCode;
  value?: string;
}

export interface FateKnotsAi0ResponseValidationResult {
  valid: boolean;
  issues: FateKnotsAi0ResponseIssue[];
}

export function buildFateKnotsAi0DialogueRequest(
  requestId: string,
  rolePacket: FateKnotsNpcRolePacket,
  visibleSceneFacts: readonly string[],
  playerInput: string | null
): FateKnotsAi0DialogueRequest {
  return {
    requestId,
    kind: "npc-dialogue",
    rolePacket: {
      ...rolePacket,
      personaFacts: rolePacket.personaFacts.slice(),
      knownFacts: rolePacket.knownFacts.slice(),
      relationshipFacts: rolePacket.relationshipFacts.slice(),
      legalInteractionIds: rolePacket.legalInteractionIds.slice(),
    },
    visibleSceneFacts: visibleSceneFacts.slice(),
    playerInput,
  };
}

export function buildFateKnotsAi0CombatRuntimeRequest(
  requestId: string,
  combatPacket: FateKnotsAi0CombatDecisionRequest
): FateKnotsAi0CombatRuntimeRequest {
  return {
    requestId,
    kind: "combat-choice",
    combatPacket: {
      ...combatPacket,
      ownActor: {
        ...combatPacket.ownActor,
        position: { ...combatPacket.ownActor.position },
        statusIds: combatPacket.ownActor.statusIds.slice(),
        injuryIds: combatPacket.ownActor.injuryIds.slice(),
      },
      visibleActors: combatPacket.visibleActors.map((actor) => ({
        ...actor,
        position: { ...actor.position },
        statusIds: actor.statusIds.slice(),
        injuryIds: actor.injuryIds.slice(),
      })),
      movementOptions: combatPacket.movementOptions.map((option) => ({
        ...option,
        legalPrimaryTargetIds: option.legalPrimaryTargetIds.slice(),
      })),
      actionOptions: combatPacket.actionOptions.map((option) => ({
        ...option,
        legalPrimaryTargetIds: option.legalPrimaryTargetIds.slice(),
      })),
    },
  };
}

export function validateFateKnotsAi0RuntimeResponse(
  request: FateKnotsAi0RuntimeRequest,
  response: FateKnotsAi0RuntimeResponse
): FateKnotsAi0ResponseValidationResult {
  const issues: FateKnotsAi0ResponseIssue[] = [];

  if (request.requestId !== response.requestId) {
    issues.push({ code: "request-id-mismatch", value: response.requestId });
  }
  if (request.kind !== response.kind) {
    issues.push({ code: "response-kind-mismatch", value: response.kind });
    return { valid: false, issues };
  }

  if (request.kind === "npc-dialogue" && response.kind === "npc-dialogue") {
    if (response.utterance.trim() === "") issues.push({ code: "empty-utterance" });
    if (
      response.selectedInteractionId !== undefined &&
      response.selectedInteractionId !== null &&
      !request.rolePacket.legalInteractionIds.includes(response.selectedInteractionId)
    ) {
      issues.push({ code: "illegal-interaction-id", value: response.selectedInteractionId });
    }
  }

  if (request.kind === "combat-choice" && response.kind === "combat-choice") {
    if (response.actorId !== request.combatPacket.actorId) {
      issues.push({ code: "actor-id-mismatch", value: response.actorId });
    }

    const movementOption =
      response.movementCardId !== undefined && response.movementCardId !== null
        ? request.combatPacket.movementOptions.find(
            (option) => option.cardId === response.movementCardId
          ) ?? null
        : null;
    const actionOption =
      response.actionCardId !== undefined && response.actionCardId !== null
        ? request.combatPacket.actionOptions.find((option) => option.cardId === response.actionCardId) ?? null
        : null;

    if (response.movementCardId !== undefined && response.movementCardId !== null && !movementOption) {
      issues.push({ code: "illegal-movement-card", value: response.movementCardId });
    }

    if (response.actionCardId !== undefined && response.actionCardId !== null && !actionOption) {
      issues.push({ code: "illegal-action-card", value: response.actionCardId });
    }

    const selectedOptions = [movementOption, actionOption].filter(
      (option): option is NonNullable<typeof option> => option !== null
    );
    const requiresPrimaryTarget = selectedOptions.some((option) => option.targetRequired);
    const primaryTargetId = response.primaryTargetId ?? null;

    if (requiresPrimaryTarget && !primaryTargetId) {
      issues.push({ code: "missing-primary-target" });
    }

    if (primaryTargetId) {
      const legalTarget = selectedOptions.some((option) =>
        option.legalPrimaryTargetIds.includes(primaryTargetId)
      );
      if (!legalTarget) {
        issues.push({ code: "illegal-primary-target", value: primaryTargetId });
      }
    }
  }

  return { valid: issues.length === 0, issues };
}
