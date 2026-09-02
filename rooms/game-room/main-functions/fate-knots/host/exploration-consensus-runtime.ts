import { normalizeFateKnotsCanonicalUniversePackage } from "../forge/canonical-universe.js";
import { DEFAULT_FATE_KNOTS_RULES } from "../rules/config.js";
import { settleFateKnotsCampRecovery, type FateKnotsCampIssue } from "../shared/camp.js";
import type { FateKnotsCombatRuntimeState } from "../shared/combat-runtime.js";
import type {
  FateKnotsRunState,
  FateKnotsSeatId,
  FateKnotsUniversePackage,
} from "../shared/contracts.js";
import { buildFateKnotsEncounterCombat } from "../shared/encounter.js";
import { enterFateKnotsCombat } from "../shared/run-flow.js";
import {
  applyFateKnotsStoryTransition,
  settleFateKnotsStoryTransition,
} from "../shared/story-progression.js";
import {
  appendFateKnotsExplorationMessage,
  chooseFateKnotsExplorationTransition,
  clearFateKnotsExplorationConsensus,
  getFateKnotsExplorationConsensus,
  type FateKnotsExplorationConsensusIssue,
  type FateKnotsExplorationConsensusProjection,
} from "./exploration-consensus.js";
import {
  loadFateKnotsRunStore,
  loadFateKnotsUniverseStore,
  saveFateKnotsRunSnapshot,
  type FateKnotsPersistenceApi,
  type FateKnotsPersistenceIssue,
} from "./persistence.js";

export const FATE_KNOTS_EXPLORATION_CONSENSUS_COMMAND_NAMES = {
  get: "GameRoomFateKnotsGetExplorationConsensus",
  sendLocal: "GameRoomFateKnotsSendExplorationMessage",
  sendAi2: "GameRoomFateKnotsAi2ExplorationMessage",
  sendRemote: "GameRoomFateKnotsRemoteExplorationMessage",
  chooseLocal: "GameRoomFateKnotsChooseExploration",
  chooseAi2: "GameRoomFateKnotsAi2ChooseExploration",
  chooseRemote: "GameRoomFateKnotsRemoteChooseExploration",
} as const;

export interface FateKnotsExplorationConsensusCommandIssue {
  source: "payload" | "persistence" | "universe" | "exploration" | "story" | "encounter" | "camp";
  code: string;
  value?: string;
}

export interface FateKnotsExplorationConsensusCommandState {
  consensus: FateKnotsExplorationConsensusProjection | null;
  advanced: boolean;
  transitionId: string | null;
  runRevision: number;
  phase: FateKnotsRunState["phase"];
}

export type FateKnotsExplorationConsensusCommandResult =
  | { ok: true; state: FateKnotsExplorationConsensusCommandState; issues: [] }
  | {
      ok: false;
      error:
        | "invalid-payload"
        | "run-not-found"
        | "universe-not-found"
        | "universe-rejected"
        | "persistence-rejected"
        | "exploration-rejected"
        | "story-transition-rejected"
        | "encounter-open-rejected"
        | "camp-entry-rejected"
        | "save-rejected";
      state: null;
      issues: FateKnotsExplorationConsensusCommandIssue[];
    };

interface FateKnotsExplorationContext {
  run: FateKnotsRunState;
  universe: FateKnotsUniversePackage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRunId(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const value = payload["runId"];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function readText(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const value = payload["text"];
  return typeof value === "string" ? value : null;
}

function readTransitionId(payload: unknown): string | null | "invalid" {
  if (!isRecord(payload)) return "invalid";
  const value = payload["transitionId"];
  if (value === null) return null;
  if (typeof value !== "string") return "invalid";
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function withOptionalValue(
  source: FateKnotsExplorationConsensusCommandIssue["source"],
  code: string,
  value: string | undefined
): FateKnotsExplorationConsensusCommandIssue {
  return value ? { source, code, value } : { source, code };
}

function persistenceIssues(
  issues: FateKnotsPersistenceIssue[]
): FateKnotsExplorationConsensusCommandIssue[] {
  return issues.map((issue) => withOptionalValue("persistence", issue.code, issue.entryId));
}

function explorationIssues(
  issues: FateKnotsExplorationConsensusIssue[]
): FateKnotsExplorationConsensusCommandIssue[] {
  return issues.map((issue) =>
    withOptionalValue("exploration", issue.code, issue.transitionId ?? issue.seatId)
  );
}

function campIssues(issues: FateKnotsCampIssue[]): FateKnotsExplorationConsensusCommandIssue[] {
  return issues.map((issue) =>
    withOptionalValue(
      "camp",
      issue.code,
      issue.locationId ?? issue.actorId ?? issue.equipmentId ?? issue.characterId ?? issue.slot
    )
  );
}

function fail(
  error: Exclude<FateKnotsExplorationConsensusCommandResult, { ok: true }>["error"],
  issues: FateKnotsExplorationConsensusCommandIssue[]
): FateKnotsExplorationConsensusCommandResult {
  return { ok: false, error, state: null, issues };
}

function loadContext(
  api: FateKnotsPersistenceApi,
  runId: string
):
  | { ok: true; context: FateKnotsExplorationContext }
  | { ok: false; result: FateKnotsExplorationConsensusCommandResult } {
  const runs = loadFateKnotsRunStore(api);
  if (runs.issues.length > 0) {
    return { ok: false, result: fail("persistence-rejected", persistenceIssues(runs.issues)) };
  }
  const snapshot = runs.store.entries.find((entry) => entry.run.runId === runId) ?? null;
  if (!snapshot) {
    return {
      ok: false,
      result: fail("run-not-found", [
        { source: "exploration", code: "run-not-found", value: runId },
      ]),
    };
  }

  const universes = loadFateKnotsUniverseStore(api);
  if (universes.issues.length > 0) {
    return { ok: false, result: fail("persistence-rejected", persistenceIssues(universes.issues)) };
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
        canonical.issues.map((issue) => withOptionalValue("universe", issue.code, issue.path))
      ),
    };
  }

  return {
    ok: true,
    context: { run: snapshot.run, universe: canonical.package },
  };
}

function currentState(
  run: FateKnotsRunState,
  consensus: FateKnotsExplorationConsensusProjection | null,
  advanced = false,
  transitionId: string | null = null
): FateKnotsExplorationConsensusCommandState {
  return {
    consensus,
    advanced,
    transitionId,
    runRevision: run.revision,
    phase: run.phase,
  };
}

function combatIdFor(run: FateKnotsRunState, encounterId: string): string {
  return `${run.runId}:${encounterId}:r${run.revision}`;
}

function advanceUnanimousTransition(
  api: FateKnotsPersistenceApi,
  universe: FateKnotsUniversePackage,
  runInput: FateKnotsRunState,
  transitionId: string
): FateKnotsExplorationConsensusCommandResult {
  const applied = applyFateKnotsStoryTransition(universe, runInput, transitionId);
  if (!applied.ok || !applied.transition) {
    return fail(
      "story-transition-rejected",
      applied.issues.map((issue) =>
        withOptionalValue(
          "story",
          issue.code,
          issue.transitionId ?? issue.encounterId ?? issue.knotId
        )
      )
    );
  }

  let nextRun = applied.run;
  let combatRuntime: FateKnotsCombatRuntimeState | null = null;

  if (applied.transition.kind === "scene" || applied.transition.kind === "travel") {
    const settled = settleFateKnotsStoryTransition(universe, nextRun);
    if (!settled.ok) {
      return fail(
        "story-transition-rejected",
        settled.issues.map((issue) =>
          withOptionalValue(
            "story",
            issue.code,
            issue.transitionId ?? issue.encounterId ?? issue.knotId
          )
        )
      );
    }
    nextRun = settled.run;
  } else if (applied.transition.kind === "combat") {
    const encounter = applied.encounter;
    if (!encounter) {
      return fail("encounter-open-rejected", [
        { source: "encounter", code: "encounter-not-found" },
      ]);
    }
    const built = buildFateKnotsEncounterCombat(
      universe,
      nextRun,
      encounter.id,
      combatIdFor(nextRun, encounter.id),
      DEFAULT_FATE_KNOTS_RULES.combat.turn
    );
    if (!built.ok || !built.combat || !built.runtime) {
      return fail(
        "encounter-open-rejected",
        built.issues.map((issue) =>
          withOptionalValue(
            "encounter",
            issue.code,
            issue.encounterId ?? issue.characterId ?? issue.actorId
          )
        )
      );
    }
    const entered = enterFateKnotsCombat(nextRun, built.combat);
    if (!entered.ok) {
      return fail(
        "encounter-open-rejected",
        entered.issues.map((issue) => ({ source: "encounter" as const, code: issue.code }))
      );
    }
    nextRun = entered.run;
    combatRuntime = built.runtime;
  } else if (applied.transition.kind === "camp") {
    const recovered = settleFateKnotsCampRecovery(universe, nextRun);
    if (!recovered.ok) return fail("camp-entry-rejected", campIssues(recovered.issues));
    nextRun = recovered.run;
  }

  const saved = saveFateKnotsRunSnapshot(api, nextRun, combatRuntime);
  if (!saved.ok) {
    return fail("save-rejected", persistenceIssues(saved.issues));
  }

  return {
    ok: true,
    state: currentState(saved.value.run, null, true, transitionId),
    issues: [],
  };
}

function getState(
  api: FateKnotsPersistenceApi,
  payload: unknown
): FateKnotsExplorationConsensusCommandResult {
  const runId = readRunId(payload);
  if (!runId) return fail("invalid-payload", [{ source: "payload", code: "invalid-run-id" }]);
  const loaded = loadContext(api, runId);
  if (!loaded.ok) return loaded.result;
  const projected = getFateKnotsExplorationConsensus(
    api,
    loaded.context.universe,
    loaded.context.run
  );
  if (!projected.ok) return fail("exploration-rejected", explorationIssues(projected.issues));
  return {
    ok: true,
    state: currentState(loaded.context.run, projected.state),
    issues: [],
  };
}

function appendMessage(
  api: FateKnotsPersistenceApi,
  payload: unknown,
  seatId: FateKnotsSeatId
): FateKnotsExplorationConsensusCommandResult {
  const runId = readRunId(payload);
  const text = readText(payload);
  if (!runId || text === null) {
    return fail("invalid-payload", [
      { source: "payload", code: !runId ? "invalid-run-id" : "invalid-message-text" },
    ]);
  }
  const loaded = loadContext(api, runId);
  if (!loaded.ok) return loaded.result;
  const appended = appendFateKnotsExplorationMessage(
    api,
    loaded.context.universe,
    loaded.context.run,
    seatId,
    text
  );
  if (!appended.ok) return fail("exploration-rejected", explorationIssues(appended.issues));
  return {
    ok: true,
    state: currentState(loaded.context.run, appended.state),
    issues: [],
  };
}

function choose(
  api: FateKnotsPersistenceApi,
  payload: unknown,
  seatId: FateKnotsSeatId
): FateKnotsExplorationConsensusCommandResult {
  const runId = readRunId(payload);
  const transitionId = readTransitionId(payload);
  if (!runId || transitionId === "invalid") {
    return fail("invalid-payload", [
      { source: "payload", code: !runId ? "invalid-run-id" : "invalid-transition-id" },
    ]);
  }
  const loaded = loadContext(api, runId);
  if (!loaded.ok) return loaded.result;
  const chosen = chooseFateKnotsExplorationTransition(
    api,
    loaded.context.universe,
    loaded.context.run,
    seatId,
    transitionId
  );
  if (!chosen.ok) return fail("exploration-rejected", explorationIssues(chosen.issues));

  const unanimous = chosen.state.unanimousTransitionId;
  if (!unanimous) {
    return {
      ok: true,
      state: currentState(loaded.context.run, chosen.state),
      issues: [],
    };
  }
  return advanceUnanimousTransition(api, loaded.context.universe, loaded.context.run, unanimous);
}

/**
 * Host-bound V1 exploration coordination commands. Sender identity is selected
 * by command name, never accepted from the payload. Public choices stay in hot
 * coordination state until unanimity; only the unanimous canonical transition
 * enters the persisted Run.
 */
export function createFateKnotsExplorationConsensusCommands(
  api: FateKnotsPersistenceApi
): Record<string, (payload?: unknown) => FateKnotsExplorationConsensusCommandResult> {
  return {
    [FATE_KNOTS_EXPLORATION_CONSENSUS_COMMAND_NAMES.get](payload?: unknown) {
      return getState(api, payload);
    },
    [FATE_KNOTS_EXPLORATION_CONSENSUS_COMMAND_NAMES.sendLocal](payload?: unknown) {
      return appendMessage(api, payload, "user");
    },
    [FATE_KNOTS_EXPLORATION_CONSENSUS_COMMAND_NAMES.sendAi2](payload?: unknown) {
      return appendMessage(api, payload, "ai2");
    },
    [FATE_KNOTS_EXPLORATION_CONSENSUS_COMMAND_NAMES.sendRemote](payload?: unknown) {
      return appendMessage(api, payload, "us1");
    },
    [FATE_KNOTS_EXPLORATION_CONSENSUS_COMMAND_NAMES.chooseLocal](payload?: unknown) {
      return choose(api, payload, "user");
    },
    [FATE_KNOTS_EXPLORATION_CONSENSUS_COMMAND_NAMES.chooseAi2](payload?: unknown) {
      return choose(api, payload, "ai2");
    },
    [FATE_KNOTS_EXPLORATION_CONSENSUS_COMMAND_NAMES.chooseRemote](payload?: unknown) {
      return choose(api, payload, "us1");
    },
  };
}

export function clearFateKnotsExplorationConsensusAfterAdvance(api: FateKnotsPersistenceApi): void {
  clearFateKnotsExplorationConsensus(api);
}
