import { normalizeFateKnotsCanonicalUniversePackage } from "../forge/canonical-universe.js";
import type { FateKnotsRunState, FateKnotsUniversePackage } from "../shared/contracts.js";
import {
  getFateKnotsNpcInteractionOptions,
  type FateKnotsNpcInteractionIssue,
} from "../shared/npc-interaction.js";
import {
  loadFateKnotsRunStore,
  loadFateKnotsUniverseStore,
  type FateKnotsPersistenceApi,
  type FateKnotsPersistenceIssue,
} from "./persistence.js";
import { speakFateKnotsNpc, type FateKnotsRuntimeAiIssue } from "./runtime-ai.js";

export type FateKnotsNpcPlayerSeatId = "user" | "ai2" | "us1";

export const FATE_KNOTS_NPC_DIALOGUE_COMMAND_NAMES = {
  speakLocal: "GameRoomFateKnotsSpeakNpc",
  speakAi2: "GameRoomFateKnotsAi2SpeakNpc",
  speakRemote: "GameRoomFateKnotsRemoteSpeakNpc",
} as const;

export interface FateKnotsNpcDialogueProjection {
  runId: string;
  runRevision: number;
  speakerSeatId: FateKnotsNpcPlayerSeatId;
  npcId: string;
  utterance: string;
  suggestedTransitionId: string | null;
  legalInteractionIds: string[];
}

export interface FateKnotsNpcDialogueCommandIssue {
  source: "payload" | "persistence" | "universe" | "npc" | "ai0" | "seat";
  code: string;
  value?: string;
}

export type FateKnotsNpcDialogueCommandResult =
  | { ok: true; state: FateKnotsNpcDialogueProjection; issues: [] }
  | {
      ok: false;
      error:
        | "invalid-payload"
        | "run-not-found"
        | "universe-not-found"
        | "universe-rejected"
        | "persistence-rejected"
        | "seat-not-active"
        | "seat-ambiguous"
        | "npc-interaction-rejected"
        | "ai0-dialogue-failed";
      state: null;
      issues: FateKnotsNpcDialogueCommandIssue[];
    };

interface FateKnotsNpcDialogueContext {
  run: FateKnotsRunState;
  universe: FateKnotsUniversePackage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function readPayload(payload: unknown): { runId: string; npcId: string; text: string } | null {
  if (!isRecord(payload)) return null;
  const runId = readNonEmptyString(payload["runId"]);
  const npcId = readNonEmptyString(payload["npcId"]);
  const text = readNonEmptyString(payload["text"]);
  if (!runId || !npcId || !text || text.length > 2000) return null;
  return { runId, npcId, text };
}

function fail(
  error: Exclude<FateKnotsNpcDialogueCommandResult, { ok: true }>["error"],
  issues: FateKnotsNpcDialogueCommandIssue[]
): FateKnotsNpcDialogueCommandResult {
  return { ok: false, error, state: null, issues };
}

function persistenceIssues(
  issues: FateKnotsPersistenceIssue[]
): FateKnotsNpcDialogueCommandIssue[] {
  return issues.map((issue) => ({
    source: "persistence" as const,
    code: issue.code,
    ...(issue.entryId ? { value: issue.entryId } : {}),
  }));
}

function npcIssues(issues: FateKnotsNpcInteractionIssue[]): FateKnotsNpcDialogueCommandIssue[] {
  return issues.map((issue) => ({
    source: "npc" as const,
    code: issue.code,
    ...(issue.npcId ? { value: issue.npcId } : {}),
  }));
}

function ai0Issues(issues: FateKnotsRuntimeAiIssue[]): FateKnotsNpcDialogueCommandIssue[] {
  return issues.map((issue) => ({ source: "ai0" as const, code: issue.code }));
}

function loadContext(
  api: FateKnotsPersistenceApi,
  runId: string
):
  | { ok: true; context: FateKnotsNpcDialogueContext }
  | { ok: false; result: FateKnotsNpcDialogueCommandResult } {
  const runs = loadFateKnotsRunStore(api);
  if (runs.issues.length > 0) {
    return { ok: false, result: fail("persistence-rejected", persistenceIssues(runs.issues)) };
  }
  const snapshot = runs.store.entries.find((entry) => entry.run.runId === runId) ?? null;
  if (!snapshot) {
    return {
      ok: false,
      result: fail("run-not-found", [{ source: "npc", code: "run-not-found", value: runId }]),
    };
  }

  const universes = loadFateKnotsUniverseStore(api);
  if (universes.issues.length > 0) {
    return {
      ok: false,
      result: fail("persistence-rejected", persistenceIssues(universes.issues)),
    };
  }
  const storedUniverse = universes.store.entries.find(
    (entry) => entry.universe.universeId === snapshot.run.universeId
  )?.universe;
  if (!storedUniverse) {
    return {
      ok: false,
      result: fail("universe-not-found", [
        { source: "universe", code: "universe-not-found", value: snapshot.run.universeId },
      ]),
    };
  }

  const canonical = normalizeFateKnotsCanonicalUniversePackage(storedUniverse);
  if (!canonical.valid || !canonical.package) {
    return {
      ok: false,
      result: fail(
        "universe-rejected",
        canonical.issues.map((issue) => ({
          source: "universe" as const,
          code: issue.code,
          value: issue.path,
        }))
      ),
    };
  }
  return { ok: true, context: { run: snapshot.run, universe: canonical.package } };
}

function validateSeat(
  run: FateKnotsRunState,
  seatId: FateKnotsNpcPlayerSeatId
): FateKnotsNpcDialogueCommandResult | null {
  const partyIds = new Set(run.partyActorIds);
  const matches = run.actors.filter(
    (actor) => partyIds.has(actor.actorId) && actor.seatId === seatId
  );
  if (matches.length === 0) {
    return fail("seat-not-active", [{ source: "seat", code: "seat-not-active", value: seatId }]);
  }
  if (matches.length > 1) {
    return fail("seat-ambiguous", [{ source: "seat", code: "seat-ambiguous", value: seatId }]);
  }
  return null;
}

async function speak(
  api: FateKnotsPersistenceApi,
  payload: unknown,
  seatId: FateKnotsNpcPlayerSeatId
): Promise<FateKnotsNpcDialogueCommandResult> {
  const request = readPayload(payload);
  if (!request) {
    return fail("invalid-payload", [{ source: "payload", code: "invalid-npc-dialogue-request" }]);
  }
  const loaded = loadContext(api, request.runId);
  if (!loaded.ok) return loaded.result;
  const seatFailure = validateSeat(loaded.context.run, seatId);
  if (seatFailure) return seatFailure;

  const interactions = getFateKnotsNpcInteractionOptions(
    loaded.context.universe,
    loaded.context.run,
    request.npcId
  );
  if (!interactions.ok) {
    return fail("npc-interaction-rejected", npcIssues(interactions.issues));
  }
  const legalInteractionIds = interactions.options.map((option) => option.id);
  const dialogue = await speakFateKnotsNpc(
    loaded.context.universe,
    loaded.context.run,
    request.npcId,
    request.text,
    legalInteractionIds
  );
  if (!dialogue.ok) return fail("ai0-dialogue-failed", ai0Issues(dialogue.issues));

  const selected = dialogue.response.selectedInteractionId ?? null;
  return {
    ok: true,
    state: {
      runId: loaded.context.run.runId,
      runRevision: loaded.context.run.revision,
      speakerSeatId: seatId,
      npcId: request.npcId,
      utterance: dialogue.response.utterance,
      suggestedTransitionId: selected,
      legalInteractionIds,
    },
    issues: [],
  };
}

export function createFateKnotsNpcDialogueCommands(
  api: FateKnotsPersistenceApi
): Record<string, (payload?: unknown) => Promise<FateKnotsNpcDialogueCommandResult>> {
  return {
    [FATE_KNOTS_NPC_DIALOGUE_COMMAND_NAMES.speakLocal](payload?: unknown) {
      return speak(api, payload, "user");
    },
    [FATE_KNOTS_NPC_DIALOGUE_COMMAND_NAMES.speakAi2](payload?: unknown) {
      return speak(api, payload, "ai2");
    },
    [FATE_KNOTS_NPC_DIALOGUE_COMMAND_NAMES.speakRemote](payload?: unknown) {
      return speak(api, payload, "us1");
    },
  };
}
