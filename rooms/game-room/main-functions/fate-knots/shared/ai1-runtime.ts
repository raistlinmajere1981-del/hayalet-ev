import type {
  FateKnotsCombatResultPackage,
  FateKnotsDmScenePacket,
} from "./contracts.js";

export const FATE_KNOTS_AI1_RUNTIME_PROFILE_ID = "fate-knots-ai1-dm-runtime-v1";

export interface FateKnotsAi1RuntimeProfile {
  id: typeof FATE_KNOTS_AI1_RUNTIME_PROFILE_ID;
  role: "dm-narrator";
  ownsMechanics: false;
  allowedDuringCombat: false;
  maySelectPlayerTransitions: false;
  mayInventCanon: false;
  responseMode: "narration-only";
}

export const FATE_KNOTS_AI1_RUNTIME_PROFILE: FateKnotsAi1RuntimeProfile = {
  id: FATE_KNOTS_AI1_RUNTIME_PROFILE_ID,
  role: "dm-narrator",
  ownsMechanics: false,
  allowedDuringCombat: false,
  maySelectPlayerTransitions: false,
  mayInventCanon: false,
  responseMode: "narration-only",
};

export const FATE_KNOTS_AI1_RUNTIME_POLICY = [
  "You are the DM narrator for Fate Knots.",
  "The engine owns canon, mechanics, state, legal actions, transitions, combat results, loot, and finales.",
  "Use only the supplied packet as authoritative runtime knowledge.",
  "Do not invent hidden canon, new mechanics, new items, new NPC facts, new locations, or state changes.",
  "Do not choose a player transition or action.",
  "Do not resolve combat actions. Combat narration is requested only after the engine has produced a terminal result package.",
  "Turn the supplied facts into concise atmospheric narration without changing their meaning.",
  "Return exactly the requested JSON response object and nothing else.",
].join("\n");

export interface FateKnotsAi1SceneNarrationRequest {
  requestId: string;
  kind: "scene-narration";
  packet: FateKnotsDmScenePacket;
}

export interface FateKnotsAi1CombatResultNarrationRequest {
  requestId: string;
  kind: "combat-result-narration";
  packet: FateKnotsCombatResultPackage;
}

export type FateKnotsAi1RuntimeRequest =
  | FateKnotsAi1SceneNarrationRequest
  | FateKnotsAi1CombatResultNarrationRequest;

export interface FateKnotsAi1SceneNarrationResponse {
  requestId: string;
  kind: "scene-narration";
  narration: string;
}

export interface FateKnotsAi1CombatResultNarrationResponse {
  requestId: string;
  kind: "combat-result-narration";
  narration: string;
}

export type FateKnotsAi1RuntimeResponse =
  | FateKnotsAi1SceneNarrationResponse
  | FateKnotsAi1CombatResultNarrationResponse;

export type FateKnotsAi1ResponseIssueCode =
  | "request-id-mismatch"
  | "response-kind-mismatch"
  | "empty-narration";

export interface FateKnotsAi1ResponseIssue {
  code: FateKnotsAi1ResponseIssueCode;
  value?: string;
}

export interface FateKnotsAi1ResponseValidationResult {
  valid: boolean;
  issues: FateKnotsAi1ResponseIssue[];
}

export function buildFateKnotsAi1SceneNarrationRequest(
  requestId: string,
  packet: FateKnotsDmScenePacket
): FateKnotsAi1SceneNarrationRequest {
  return {
    requestId,
    kind: "scene-narration",
    packet: {
      ...packet,
      visibleFacts: packet.visibleFacts.slice(),
      playerSummaries: packet.playerSummaries.map((summary) => ({
        ...summary,
        statusIds: summary.statusIds.slice(),
        injuryIds: summary.injuryIds.slice(),
      })),
      availableTransitionIds: packet.availableTransitionIds.slice(),
      ...(packet.engineResultSummary !== undefined
        ? {
            engineResultSummary:
              packet.engineResultSummary === null
                ? null
                : {
                    ...packet.engineResultSummary,
                    fallenActorIds: packet.engineResultSummary.fallenActorIds.slice(),
                    survivingActorIds: packet.engineResultSummary.survivingActorIds.slice(),
                    resolvedEffects: packet.engineResultSummary.resolvedEffects.map((effect) => ({
                      ...effect,
                      targetIds: effect.targetIds.slice(),
                      presentationCueIds: effect.presentationCueIds.slice(),
                      ...(effect.resultingPosition !== undefined
                        ? { resultingPosition: { ...effect.resultingPosition } }
                        : {}),
                    })),
                    narrativeFacts: packet.engineResultSummary.narrativeFacts.slice(),
                  },
          }
        : {}),
    },
  };
}

export function buildFateKnotsAi1CombatResultNarrationRequest(
  requestId: string,
  packet: FateKnotsCombatResultPackage
): FateKnotsAi1CombatResultNarrationRequest {
  return {
    requestId,
    kind: "combat-result-narration",
    packet: {
      ...packet,
      fallenActorIds: packet.fallenActorIds.slice(),
      survivingActorIds: packet.survivingActorIds.slice(),
      resolvedEffects: packet.resolvedEffects.map((effect) => ({
        ...effect,
        targetIds: effect.targetIds.slice(),
        presentationCueIds: effect.presentationCueIds.slice(),
        ...(effect.resultingPosition !== undefined
          ? { resultingPosition: { ...effect.resultingPosition } }
          : {}),
      })),
      narrativeFacts: packet.narrativeFacts.slice(),
    },
  };
}

export function validateFateKnotsAi1RuntimeResponse(
  request: FateKnotsAi1RuntimeRequest,
  response: FateKnotsAi1RuntimeResponse
): FateKnotsAi1ResponseValidationResult {
  const issues: FateKnotsAi1ResponseIssue[] = [];

  if (request.requestId !== response.requestId) {
    issues.push({ code: "request-id-mismatch", value: response.requestId });
  }
  if (request.kind !== response.kind) {
    issues.push({ code: "response-kind-mismatch", value: response.kind });
  }
  if (response.narration.trim() === "") {
    issues.push({ code: "empty-narration" });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
