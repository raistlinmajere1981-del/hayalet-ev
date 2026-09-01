import type { GameRoomHostApi } from "../../../shared/host/activation.js";
import {
  buildFateKnotsAi0CombatRuntimeRequest,
  buildFateKnotsAi0DialogueRequest,
  type FateKnotsAi0CombatRuntimeResponse,
  type FateKnotsAi0DialogueResponse,
} from "../shared/ai0-runtime.js";
import {
  buildFateKnotsAi1CombatResultNarrationRequest,
  buildFateKnotsAi1SceneNarrationRequest,
  type FateKnotsAi1CombatResultNarrationResponse,
  type FateKnotsAi1SceneNarrationResponse,
} from "../shared/ai1-runtime.js";
import type {
  FateKnotsCombatActionCommit,
  FateKnotsCombatResultPackage,
  FateKnotsCombatState,
  FateKnotsRunState,
  FateKnotsUniversePackage,
} from "../shared/contracts.js";
import {
  buildFateKnotsAi0CombatDecisionRequest,
  toFateKnotsEnemyCombatCommit,
} from "../shared/enemy-controller.js";
import { buildFateKnotsNpcRolePacket } from "../shared/npc-role.js";
import { buildFateKnotsCanonicalDmScenePacket } from "../shared/story-dm.js";
import { buildFateKnotsStoryView } from "../shared/story-progression.js";
import { getFateKnotsDmSession, setFateKnotsDmSession } from "./session-state.js";
import {
  dispatchFateKnotsAi0RuntimeRequest,
  dispatchFateKnotsAi1RuntimeRequest,
  openFateKnotsAi1Session,
  type FateKnotsTransportApi,
} from "./transport.js";

export type FateKnotsRuntimeAiIssueCode =
  | "dm-packet-invalid"
  | "dm-session-failed"
  | "dm-transport-failed"
  | "npc-packet-invalid"
  | "npc-transport-failed"
  | "combat-actor-not-found"
  | "combat-character-not-found"
  | "combat-controller-not-ai0"
  | "combat-packet-invalid"
  | "combat-transport-failed";

export interface FateKnotsRuntimeAiIssue {
  code: FateKnotsRuntimeAiIssueCode;
  message: string;
}

export type FateKnotsSceneNarrationResult =
  | { ok: true; response: FateKnotsAi1SceneNarrationResponse }
  | { ok: false; issues: FateKnotsRuntimeAiIssue[] };

export type FateKnotsCombatNarrationResult =
  | { ok: true; response: FateKnotsAi1CombatResultNarrationResponse }
  | { ok: false; issues: FateKnotsRuntimeAiIssue[] };

export type FateKnotsNpcDialogueRuntimeResult =
  | { ok: true; response: FateKnotsAi0DialogueResponse }
  | { ok: false; issues: FateKnotsRuntimeAiIssue[] };

export type FateKnotsAi0CombatCommitResult =
  | { ok: true; response: FateKnotsAi0CombatRuntimeResponse; commit: FateKnotsCombatActionCommit }
  | { ok: false; issues: FateKnotsRuntimeAiIssue[] };

function runtimeRequestId(prefix: string): string {
  const runtimeCrypto: { randomUUID?: () => string } = globalThis.crypto;
  const uuid = runtimeCrypto.randomUUID?.();
  const suffix = uuid
    ? uuid.replace(/-/g, "")
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${suffix}`;
}

async function ensureDmSession(api: GameRoomHostApi & FateKnotsTransportApi, runId: string) {
  const existing = getFateKnotsDmSession(api, runId);
  if (existing) return { ok: true as const, sessionRef: existing };

  const opened = await openFateKnotsAi1Session(api, `Fate Knots DM · ${runId}`);
  if (!opened.ok) {
    return {
      ok: false as const,
      issue: {
        code: "dm-session-failed" as const,
        message: opened.message,
      },
    };
  }
  setFateKnotsDmSession(api, runId, opened.sessionRef);
  return { ok: true as const, sessionRef: opened.sessionRef };
}

export async function narrateFateKnotsScene(
  api: GameRoomHostApi & FateKnotsTransportApi,
  universe: FateKnotsUniversePackage,
  run: FateKnotsRunState,
  engineResultSummary: FateKnotsCombatResultPackage | null = null
): Promise<FateKnotsSceneNarrationResult> {
  const packet = buildFateKnotsCanonicalDmScenePacket(universe, run, engineResultSummary);
  if (!packet.ok || !packet.packet) {
    return {
      ok: false,
      issues: [
        { code: "dm-packet-invalid", message: "Canonical DM scene packet could not be built." },
      ],
    };
  }

  const session = await ensureDmSession(api, run.runId);
  if (!session.ok) return { ok: false, issues: [session.issue] };

  const request = buildFateKnotsAi1SceneNarrationRequest(
    runtimeRequestId("dm-scene"),
    packet.packet
  );
  const transported = await dispatchFateKnotsAi1RuntimeRequest(api, request, {
    sessionRef: session.sessionRef,
  });
  if (!transported.ok) {
    return {
      ok: false,
      issues: [{ code: "dm-transport-failed", message: transported.message }],
    };
  }
  if (transported.sessionRef) setFateKnotsDmSession(api, run.runId, transported.sessionRef);
  return { ok: true, response: transported.response as FateKnotsAi1SceneNarrationResponse };
}

export async function narrateFateKnotsCombatResult(
  api: GameRoomHostApi & FateKnotsTransportApi,
  runId: string,
  resultPackage: FateKnotsCombatResultPackage
): Promise<FateKnotsCombatNarrationResult> {
  const session = await ensureDmSession(api, runId);
  if (!session.ok) return { ok: false, issues: [session.issue] };

  const request = buildFateKnotsAi1CombatResultNarrationRequest(
    runtimeRequestId("dm-combat-result"),
    resultPackage
  );
  const transported = await dispatchFateKnotsAi1RuntimeRequest(api, request, {
    sessionRef: session.sessionRef,
  });
  if (!transported.ok) {
    return {
      ok: false,
      issues: [{ code: "dm-transport-failed", message: transported.message }],
    };
  }
  if (transported.sessionRef) setFateKnotsDmSession(api, runId, transported.sessionRef);
  return {
    ok: true,
    response: transported.response as FateKnotsAi1CombatResultNarrationResponse,
  };
}

export async function speakFateKnotsNpc(
  universe: FateKnotsUniversePackage,
  run: FateKnotsRunState,
  npcId: string,
  playerInput: string | null,
  legalInteractionIds: readonly string[] = []
): Promise<FateKnotsNpcDialogueRuntimeResult> {
  const role = buildFateKnotsNpcRolePacket(universe, run, npcId, legalInteractionIds);
  if (!role.ok || !role.packet) {
    return {
      ok: false,
      issues: [
        { code: "npc-packet-invalid", message: "Canonical NPC role packet could not be built." },
      ],
    };
  }
  const story = buildFateKnotsStoryView(universe, run);
  const request = buildFateKnotsAi0DialogueRequest(
    runtimeRequestId("npc-dialogue"),
    role.packet,
    story.visibleFacts,
    playerInput
  );
  const transported = await dispatchFateKnotsAi0RuntimeRequest(request, universe.universeId);
  if (!transported.ok) {
    return {
      ok: false,
      issues: [{ code: "npc-transport-failed", message: transported.message }],
    };
  }
  return { ok: true, response: transported.response as FateKnotsAi0DialogueResponse };
}

export async function chooseFateKnotsAi0CombatCommit(
  universe: FateKnotsUniversePackage,
  combat: FateKnotsCombatState,
  actorId: string
): Promise<FateKnotsAi0CombatCommitResult> {
  const actor = combat.actors.find((candidate) => candidate.actorId === actorId);
  if (!actor) {
    return {
      ok: false,
      issues: [
        { code: "combat-actor-not-found", message: `Combat actor ${actorId} was not found.` },
      ],
    };
  }
  const character = universe.characters.find((candidate) => candidate.id === actor.characterId);
  if (!character) {
    return {
      ok: false,
      issues: [
        {
          code: "combat-character-not-found",
          message: `Character ${actor.characterId} was not found.`,
        },
      ],
    };
  }
  if (character.combatController?.kind !== "ai0") {
    return {
      ok: false,
      issues: [
        { code: "combat-controller-not-ai0", message: `Actor ${actorId} is not AI0-controlled.` },
      ],
    };
  }

  const built = buildFateKnotsAi0CombatDecisionRequest(
    combat,
    actorId,
    character.combatController,
    {
      cards: universe.cards,
      equipment: universe.equipment,
      statuses: universe.statuses,
    }
  );
  if (!built.ok || !built.request) {
    return {
      ok: false,
      issues: [
        {
          code: "combat-packet-invalid",
          message: "AI0 combat decision packet could not be built.",
        },
      ],
    };
  }

  const request = buildFateKnotsAi0CombatRuntimeRequest(
    runtimeRequestId("npc-combat"),
    built.request
  );
  const transported = await dispatchFateKnotsAi0RuntimeRequest(request, universe.universeId);
  if (!transported.ok) {
    return {
      ok: false,
      issues: [{ code: "combat-transport-failed", message: transported.message }],
    };
  }

  const response = transported.response as FateKnotsAi0CombatRuntimeResponse;
  return {
    ok: true,
    response,
    commit: toFateKnotsEnemyCombatCommit({
      actorId: response.actorId,
      ...(response.movementCardId !== undefined ? { movementCardId: response.movementCardId } : {}),
      ...(response.actionCardId !== undefined ? { actionCardId: response.actionCardId } : {}),
      ...(response.primaryTargetId !== undefined
        ? { primaryTargetId: response.primaryTargetId }
        : {}),
      ...(response.secondaryTargetId !== undefined
        ? { secondaryTargetId: response.secondaryTargetId }
        : {}),
    }),
  };
}
