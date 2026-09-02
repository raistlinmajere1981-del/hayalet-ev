import { normalizeFateKnotsCanonicalUniversePackage } from "../forge/canonical-universe.js";
import {
  beginFateKnotsCombatResolution,
  openFateKnotsCombatCommitPhase,
  setFateKnotsCombatCommit,
} from "../shared/combat-flow.js";
import type {
  FateKnotsCombatActionCommit,
  FateKnotsCombatState,
  FateKnotsRunState,
  FateKnotsSeatId,
  FateKnotsUniversePackage,
} from "../shared/contracts.js";
import { chooseFateKnotsEnemyCombatCommit } from "./enemy-runtime.js";
import {
  loadFateKnotsRunStore,
  loadFateKnotsUniverseStore,
  saveFateKnotsRunSnapshot,
  type FateKnotsPersistenceApi,
  type FateKnotsPersistenceIssue,
} from "./persistence.js";

export const FATE_KNOTS_COMBAT_TURN_COMMAND_NAMES = {
  completeLocal: "GameRoomFateKnotsCompleteCombatMove",
  completeAi2: "GameRoomFateKnotsAi2CompleteCombatMove",
  completeRemote: "GameRoomFateKnotsRemoteCompleteCombatMove",
} as const;

export interface FateKnotsCompleteCombatMoveState {
  runId: string;
  runRevision: number;
  combatId: string;
  turnIndex: number;
  phase: FateKnotsCombatState["phase"];
  seatId: FateKnotsSeatId;
  readySeatIds: FateKnotsSeatId[];
  pendingSeatIds: FateKnotsSeatId[];
  resolutionReady: boolean;
}

export interface FateKnotsCombatTurnCommandIssue {
  source: "payload" | "persistence" | "universe" | "combat-turn" | "enemy";
  code: string;
  value?: string;
}

export type FateKnotsCombatTurnCommandResult =
  | { ok: true; state: FateKnotsCompleteCombatMoveState; issues: [] }
  | {
      ok: false;
      error:
        | "invalid-payload"
        | "run-not-found"
        | "universe-not-found"
        | "universe-rejected"
        | "persistence-rejected"
        | "no-active-combat"
        | "combat-runtime-missing"
        | "seat-not-active"
        | "seat-ambiguous"
        | "seat-already-committed"
        | "wrong-phase"
        | "commit-rejected"
        | "enemy-commit-failed"
        | "resolution-transition-rejected"
        | "save-rejected";
      state: null;
      issues: FateKnotsCombatTurnCommandIssue[];
    };

interface CompleteMovePayload {
  runId: string;
  movementCardId?: string | null;
  actionCardId?: string | null;
  primaryTargetId?: string | null;
  secondaryTargetId?: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readOptionalId(
  payload: Record<string, unknown>,
  key: keyof Omit<CompleteMovePayload, "runId">
): string | null | undefined | "invalid" {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return "invalid";
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function parsePayload(payload: unknown): CompleteMovePayload | null {
  if (!isRecord(payload)) return null;
  const runId = typeof payload["runId"] === "string" ? payload["runId"].trim() : "";
  if (runId === "") return null;
  const movementCardId = readOptionalId(payload, "movementCardId");
  const actionCardId = readOptionalId(payload, "actionCardId");
  const primaryTargetId = readOptionalId(payload, "primaryTargetId");
  const secondaryTargetId = readOptionalId(payload, "secondaryTargetId");
  if (
    movementCardId === "invalid" ||
    actionCardId === "invalid" ||
    primaryTargetId === "invalid" ||
    secondaryTargetId === "invalid"
  ) {
    return null;
  }
  return {
    runId,
    ...(movementCardId !== undefined ? { movementCardId } : {}),
    ...(actionCardId !== undefined ? { actionCardId } : {}),
    ...(primaryTargetId !== undefined ? { primaryTargetId } : {}),
    ...(secondaryTargetId !== undefined ? { secondaryTargetId } : {}),
  };
}

function persistenceIssues(
  issues: FateKnotsPersistenceIssue[]
): FateKnotsCombatTurnCommandIssue[] {
  return issues.map((issue) => ({
    source: "persistence" as const,
    code: issue.code,
    ...(issue.entryId ? { value: issue.entryId } : {}),
  }));
}

function failed(
  error: Exclude<FateKnotsCombatTurnCommandResult, { ok: true }>["error"],
  source: FateKnotsCombatTurnCommandIssue["source"],
  code: string,
  value?: string
): FateKnotsCombatTurnCommandResult {
  return {
    ok: false,
    error,
    state: null,
    issues: [{ source, code, ...(value ? { value } : {}) }],
  };
}

function partyStandingActors(run: FateKnotsRunState): FateKnotsCombatState["actors"] {
  if (!run.activeCombat) return [];
  const partyIds = new Set(run.partyActorIds);
  return run.activeCombat.actors.filter((actor) => partyIds.has(actor.actorId) && !actor.fallen);
}

function playerPartyActors(run: FateKnotsRunState): FateKnotsCombatState["actors"] {
  return partyStandingActors(run).filter(
    (actor) => actor.seatId === "user" || actor.seatId === "ai2" || actor.seatId === "us1"
  );
}

function findSeatActor(
  run: FateKnotsRunState,
  seatId: FateKnotsSeatId
): { actorId: string } | "missing" | "ambiguous" {
  const matching = playerPartyActors(run).filter((actor) => actor.seatId === seatId);
  if (matching.length === 0) return "missing";
  if (matching.length > 1) return "ambiguous";
  const actor = matching[0];
  return actor ? { actorId: actor.actorId } : "missing";
}

function hasCommit(combat: FateKnotsCombatState, actorId: string): boolean {
  return combat.commits.some((commit) => commit.actorId === actorId && commit.committed);
}

function allPlayerPartyCommitted(run: FateKnotsRunState): boolean {
  const combat = run.activeCombat;
  if (!combat) return false;
  return playerPartyActors(run).every((actor) => hasCommit(combat, actor.actorId));
}

function readiness(run: FateKnotsRunState): { ready: FateKnotsSeatId[]; pending: FateKnotsSeatId[] } {
  const combat = run.activeCombat;
  if (!combat) return { ready: [], pending: [] };
  const ready: FateKnotsSeatId[] = [];
  const pending: FateKnotsSeatId[] = [];
  for (const actor of playerPartyActors(run)) {
    const seatId = actor.seatId;
    if (seatId !== "user" && seatId !== "ai2" && seatId !== "us1") continue;
    (hasCommit(combat, actor.actorId) ? ready : pending).push(seatId);
  }
  return { ready, pending };
}

function withCombat(run: FateKnotsRunState, combat: FateKnotsCombatState): FateKnotsRunState {
  return {
    ...run,
    phase: combat.phase,
    activeCombat: structuredClone(combat),
  };
}

function buildCommit(
  actorId: string,
  payload: CompleteMovePayload
): FateKnotsCombatActionCommit {
  return {
    actorId,
    committed: true,
    ...(payload.movementCardId !== undefined ? { movementCardId: payload.movementCardId } : {}),
    ...(payload.actionCardId !== undefined ? { actionCardId: payload.actionCardId } : {}),
    ...(payload.primaryTargetId !== undefined ? { primaryTargetId: payload.primaryTargetId } : {}),
    ...(payload.secondaryTargetId !== undefined ? { secondaryTargetId: payload.secondaryTargetId } : {}),
  };
}

async function fillOppositionCommits(
  universe: FateKnotsUniversePackage,
  combatInput: FateKnotsCombatState
): Promise<
  | { ok: true; combat: FateKnotsCombatState }
  | { ok: false; actorId: string; code: string }
> {
  let combat = structuredClone(combatInput);
  const opposition = combat.actors.filter(
    (actor) => actor.teamId === "opposition" && !actor.fallen && !hasCommit(combat, actor.actorId)
  );
  for (const actor of opposition) {
    const chosen = await chooseFateKnotsEnemyCombatCommit(universe, combat, actor.actorId);
    if (!chosen.ok) return { ok: false, actorId: actor.actorId, code: chosen.code };
    const stored = setFateKnotsCombatCommit(combat, chosen.commit, universe);
    if (!stored.ok) return { ok: false, actorId: actor.actorId, code: "enemy-commit-rejected" };
    combat = stored.state;
  }
  return { ok: true, combat };
}

async function completeMove(
  api: FateKnotsPersistenceApi,
  payloadInput: unknown,
  seatId: FateKnotsSeatId
): Promise<FateKnotsCombatTurnCommandResult> {
  const payload = parsePayload(payloadInput);
  if (!payload) return failed("invalid-payload", "payload", "invalid-complete-move-payload");

  const runs = loadFateKnotsRunStore(api);
  if (runs.issues.length > 0) {
    return {
      ok: false,
      error: "persistence-rejected",
      state: null,
      issues: persistenceIssues(runs.issues),
    };
  }
  const snapshot = runs.store.entries.find((entry) => entry.run.runId === payload.runId) ?? null;
  if (!snapshot) return failed("run-not-found", "combat-turn", "run-not-found", payload.runId);
  if (!snapshot.run.activeCombat) return failed("no-active-combat", "combat-turn", "no-active-combat");
  if (!snapshot.combatRuntime) return failed("combat-runtime-missing", "combat-turn", "combat-runtime-missing");

  let run = structuredClone(snapshot.run);
  if (run.phase !== "combat-discussion" && run.phase !== "combat-commit") {
    return failed("wrong-phase", "combat-turn", "wrong-phase", run.phase);
  }

  const seatActor = findSeatActor(run, seatId);
  if (seatActor === "missing") return failed("seat-not-active", "combat-turn", "seat-not-active", seatId);
  if (seatActor === "ambiguous") return failed("seat-ambiguous", "combat-turn", "seat-ambiguous", seatId);
  if (hasCommit(run.activeCombat, seatActor.actorId)) {
    return failed("seat-already-committed", "combat-turn", "seat-already-committed", seatId);
  }

  const universes = loadFateKnotsUniverseStore(api);
  if (universes.issues.length > 0) {
    return {
      ok: false,
      error: "persistence-rejected",
      state: null,
      issues: persistenceIssues(universes.issues),
    };
  }
  const storedUniverse = universes.store.entries.find(
    (entry) => entry.universe.universeId === run.universeId
  )?.universe ?? null;
  if (!storedUniverse) return failed("universe-not-found", "universe", "universe-not-found", run.universeId);
  const canonical = normalizeFateKnotsCanonicalUniversePackage(storedUniverse);
  if (!canonical.valid || !canonical.package) {
    return {
      ok: false,
      error: "universe-rejected",
      state: null,
      issues: canonical.issues.map((issue) => ({
        source: "universe" as const,
        code: issue.code,
        value: issue.path,
      })),
    };
  }
  const universe = canonical.package;

  if (run.activeCombat.phase === "combat-discussion") {
    const opened = openFateKnotsCombatCommitPhase(run.activeCombat);
    if (!opened.ok) return failed("commit-rejected", "combat-turn", "open-commit-rejected");
    run = withCombat(run, opened.state);
  }

  const committed = setFateKnotsCombatCommit(
    run.activeCombat!,
    buildCommit(seatActor.actorId, payload),
    universe
  );
  if (!committed.ok) {
    return {
      ok: false,
      error: "commit-rejected",
      state: null,
      issues: committed.issues.map((issue) => ({
        source: "combat-turn" as const,
        code: issue.code,
        ...(issue.cardId ? { value: issue.cardId } : {}),
      })),
    };
  }
  run = withCombat(run, committed.state);

  if (allPlayerPartyCommitted(run)) {
    const enemyCommits = await fillOppositionCommits(universe, run.activeCombat!);
    if (!enemyCommits.ok) {
      return failed(
        "enemy-commit-failed",
        "enemy",
        enemyCommits.code,
        enemyCommits.actorId
      );
    }
    run = withCombat(run, enemyCommits.combat);
    const resolving = beginFateKnotsCombatResolution(run.activeCombat!);
    if (!resolving.ok) {
      return failed(
        "resolution-transition-rejected",
        "combat-turn",
        resolving.issues[0]?.code ?? "resolution-transition-rejected"
      );
    }
    run = withCombat(run, resolving.state);
  }

  run.revision += 1;
  const saved = saveFateKnotsRunSnapshot(api, run, snapshot.combatRuntime);
  if (!saved.ok || !saved.value) {
    return {
      ok: false,
      error: "save-rejected",
      state: null,
      issues: persistenceIssues(saved.issues),
    };
  }
  const nextRun = saved.value.run;
  const readyState = readiness(nextRun);
  return {
    ok: true,
    state: {
      runId: nextRun.runId,
      runRevision: nextRun.revision,
      combatId: nextRun.activeCombat?.combatId ?? run.activeCombat!.combatId,
      turnIndex: nextRun.activeCombat?.turnIndex ?? run.activeCombat!.turnIndex,
      phase: nextRun.activeCombat?.phase ?? run.activeCombat!.phase,
      seatId,
      readySeatIds: readyState.ready,
      pendingSeatIds: readyState.pending,
      resolutionReady: nextRun.phase === "combat-resolution",
    },
    issues: [],
  };
}

/**
 * Seat identity is command-bound. Payload never contains actorId or seatId.
 * This prevents room UI from impersonating AI2/US1 and keeps hidden commit
 * ownership separate from the shared party discussion channel.
 */
export function createFateKnotsCombatTurnCommands(
  api: FateKnotsPersistenceApi
): Record<string, (payload?: unknown) => Promise<FateKnotsCombatTurnCommandResult>> {
  return {
    [FATE_KNOTS_COMBAT_TURN_COMMAND_NAMES.completeLocal](payload?: unknown) {
      return completeMove(api, payload, "user");
    },
    [FATE_KNOTS_COMBAT_TURN_COMMAND_NAMES.completeAi2](payload?: unknown) {
      return completeMove(api, payload, "ai2");
    },
    [FATE_KNOTS_COMBAT_TURN_COMMAND_NAMES.completeRemote](payload?: unknown) {
      return completeMove(api, payload, "us1");
    },
  };
}
