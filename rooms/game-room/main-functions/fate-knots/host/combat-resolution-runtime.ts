import { normalizeFateKnotsCanonicalUniversePackage } from "../forge/canonical-universe.js";
import { DEFAULT_FATE_KNOTS_RULES } from "../rules/config.js";
import { settleFateKnotsCombatAftermath } from "../shared/combat-aftermath.js";
import {
  openFateKnotsCombatAftermath,
  openNextFateKnotsCombatDiscussion,
} from "../shared/combat-flow.js";
import type { FateKnotsResolvedQueueEntryRecord } from "../shared/combat-resolution-executor.js";
import type {
  FateKnotsPresentationEvent,
  FateKnotsResolvedEffect,
  FateKnotsRunState,
  FateKnotsUniversePackage,
} from "../shared/contracts.js";
import { buildFateKnotsCombatResultPackage } from "../shared/dm-packets.js";
import { executeFateKnotsRunCombatResolution } from "../shared/run-combat-resolution.js";
import { updateFateKnotsActiveCombat } from "../shared/run-flow.js";
import { exitFateKnotsStoryCombat } from "../shared/story-combat-flow.js";
import {
  loadFateKnotsRunStore,
  loadFateKnotsUniverseStore,
  saveFateKnotsRunSnapshot,
  type FateKnotsPersistenceApi,
  type FateKnotsPersistenceIssue,
} from "./persistence.js";
import {
  buildFateKnotsResolvedCardPresentationSnapshot,
  type FateKnotsResolvedCardPresentationSnapshot,
} from "./resolved-card-presentation.js";

export const FATE_KNOTS_COMBAT_RESOLUTION_COMMAND_NAMES = {
  resolveTurn: "GameRoomFateKnotsResolveCombatTurn",
} as const;

export interface FateKnotsResolvedTurnCardPresentation {
  pass: "movement" | "action";
  actorId: string;
  cardId: string;
  outcome: "resolved" | "cancelled-fallen" | "cancelled-illegal";
  targetIds: string[];
  card: FateKnotsResolvedCardPresentationSnapshot;
}

export interface FateKnotsCombatResolutionCommandState {
  runId: string;
  previousRevision: number;
  runRevision: number;
  combatId: string;
  turnIndex: number;
  terminal: boolean;
  nextPhase: FateKnotsRunState["phase"];
  cards: FateKnotsResolvedTurnCardPresentation[];
}

export interface FateKnotsCombatResolutionCommandIssue {
  source: "payload" | "persistence" | "universe" | "combat-resolution" | "presentation";
  code: string;
  value?: string;
}

export type FateKnotsCombatResolutionCommandResult =
  | { ok: true; state: FateKnotsCombatResolutionCommandState; issues: [] }
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
        | "stale-resolution-request"
        | "wrong-phase"
        | "resolution-failed"
        | "aftermath-failed"
        | "story-exit-failed"
        | "presentation-failed"
        | "save-rejected";
      state: null;
      issues: FateKnotsCombatResolutionCommandIssue[];
    };

interface ResolveTurnPayload {
  runId: string;
  runRevision: number;
  combatId: string;
  turnIndex: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function readNonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function parsePayload(payload: unknown): ResolveTurnPayload | null {
  if (!isRecord(payload)) return null;
  const runId = readNonEmptyString(payload["runId"]);
  const runRevision = readNonNegativeInteger(payload["runRevision"]);
  const combatId = readNonEmptyString(payload["combatId"]);
  const turnIndex = readNonNegativeInteger(payload["turnIndex"]);
  if (!runId || runRevision === null || !combatId || turnIndex === null) return null;
  return { runId, runRevision, combatId, turnIndex };
}

function failed(
  error: Exclude<FateKnotsCombatResolutionCommandResult, { ok: true }>["error"],
  source: FateKnotsCombatResolutionCommandIssue["source"],
  code: string,
  value?: string
): FateKnotsCombatResolutionCommandResult {
  return {
    ok: false,
    error,
    state: null,
    issues: [{ source, code, ...(value ? { value } : {}) }],
  };
}

function persistenceIssues(
  issues: FateKnotsPersistenceIssue[]
): FateKnotsCombatResolutionCommandIssue[] {
  return issues.map((issue) => ({
    source: "persistence" as const,
    code: issue.code,
    ...(issue.entryId ? { value: issue.entryId } : {}),
  }));
}

function cueIdsForCard(universe: FateKnotsUniversePackage, cardId: string): string[] {
  const card = universe.cards.find((candidate) => candidate.id === cardId);
  if (!card) return [];
  return card.presentation
    .filter((cue) => cue.timing === "onResolve" || cue.timing === "afterResolve")
    .map((cue) => cue.cueId);
}

function resolvedEffects(
  universe: FateKnotsUniversePackage,
  entries: readonly FateKnotsResolvedQueueEntryRecord[]
): FateKnotsResolvedEffect[] {
  const result: FateKnotsResolvedEffect[] = [];
  for (const entry of entries) {
    for (const effect of entry.effects) {
      const resolved: FateKnotsResolvedEffect = {
        effectId: effect.effectId,
        cardId: effect.cardId,
        actorId: effect.actorId,
        targetIds: effect.targetIds.slice(),
        kind: effect.kind,
        presentationCueIds: cueIdsForCard(universe, effect.cardId),
      };
      if (effect.value !== undefined) resolved.value = effect.value;
      if (effect.statusId !== undefined) resolved.statusId = effect.statusId;
      result.push(resolved);
    }
  }
  return result;
}

function publicCardPresentations(
  universe: FateKnotsUniversePackage,
  combatId: string,
  turnIndex: number,
  entries: readonly FateKnotsResolvedQueueEntryRecord[]
):
  | { ok: true; cards: FateKnotsResolvedTurnCardPresentation[] }
  | { ok: false; code: string; value?: string } {
  const cards: FateKnotsResolvedTurnCardPresentation[] = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!entry) continue;
    const targetIds = Array.from(new Set(entry.effects.flatMap((effect) => effect.targetIds)));
    const event: FateKnotsPresentationEvent = {
      eventId: `${combatId}:${turnIndex}:resolved-card:${index}`,
      type: "card-resolved",
      actorId: entry.actorId,
      targetIds,
      cardId: entry.cardId,
      cueIds: cueIdsForCard(universe, entry.cardId),
    };
    const snapshot = buildFateKnotsResolvedCardPresentationSnapshot(universe, event);
    if (!snapshot.ok) {
      return {
        ok: false,
        code: snapshot.issues[0]?.code ?? "resolved-card-presentation-failed",
        ...(snapshot.issues[0]?.value ? { value: snapshot.issues[0].value } : {}),
      };
    }
    cards.push({
      pass: entry.pass,
      actorId: entry.actorId,
      cardId: entry.cardId,
      outcome: entry.outcome,
      targetIds,
      card: snapshot.snapshot,
    });
  }
  return { ok: true, cards };
}

function resolveTurn(
  api: FateKnotsPersistenceApi,
  payloadInput: unknown
): FateKnotsCombatResolutionCommandResult {
  const payload = parsePayload(payloadInput);
  if (!payload) {
    return failed("invalid-payload", "payload", "invalid-resolution-payload");
  }

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
  if (!snapshot) {
    return failed("run-not-found", "combat-resolution", "run-not-found", payload.runId);
  }
  if (!snapshot.run.activeCombat) {
    return failed("no-active-combat", "combat-resolution", "no-active-combat");
  }
  if (!snapshot.combatRuntime) {
    return failed("combat-runtime-missing", "combat-resolution", "combat-runtime-missing");
  }

  const combat = snapshot.run.activeCombat;
  if (
    snapshot.run.revision !== payload.runRevision ||
    combat.combatId !== payload.combatId ||
    combat.turnIndex !== payload.turnIndex
  ) {
    return failed("stale-resolution-request", "combat-resolution", "stale-resolution-request");
  }
  if (snapshot.run.phase !== "combat-resolution" || combat.phase !== "combat-resolution") {
    return failed("wrong-phase", "combat-resolution", "wrong-phase", snapshot.run.phase);
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
  const storedUniverse =
    universes.store.entries.find((entry) => entry.universe.universeId === snapshot.run.universeId)
      ?.universe ?? null;
  if (!storedUniverse) {
    return failed("universe-not-found", "universe", "universe-not-found", snapshot.run.universeId);
  }
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

  const resolved = executeFateKnotsRunCombatResolution(
    universe,
    snapshot.run,
    snapshot.combatRuntime,
    universe
  );
  if (!resolved.ok || !resolved.execution) {
    return failed(
      "resolution-failed",
      "combat-resolution",
      resolved.issues[0]?.code ?? "resolution-failed"
    );
  }

  const presentation = publicCardPresentations(
    universe,
    combat.combatId,
    combat.turnIndex,
    resolved.execution.entries
  );
  if (!presentation.ok) {
    return failed("presentation-failed", "presentation", presentation.code, presentation.value);
  }

  let nextRun: FateKnotsRunState;
  let nextRuntime = resolved.runtime;
  const terminal = resolved.execution.combat.result !== "active";

  if (terminal) {
    const resultPackage = buildFateKnotsCombatResultPackage(resolved.execution.combat, {
      resolvedEffects: resolvedEffects(universe, resolved.execution.entries),
      narrativeFacts: [],
    });
    if (!resultPackage.ok || !resultPackage.packet) {
      return failed(
        "story-exit-failed",
        "combat-resolution",
        resultPackage.issues[0]?.code ?? "combat-result-package-failed"
      );
    }
    const exited = exitFateKnotsStoryCombat(universe, resolved.run, {
      runtime: resolved.runtime,
      statuses: universe.statuses,
      rules: DEFAULT_FATE_KNOTS_RULES,
      resultPackage: resultPackage.packet,
    });
    if (!exited.ok) {
      return failed(
        "story-exit-failed",
        "combat-resolution",
        exited.issues[0]?.code ?? "story-exit-failed"
      );
    }
    nextRun = exited.run;
  } else {
    const aftermathPhase = openFateKnotsCombatAftermath(resolved.execution.combat);
    if (!aftermathPhase.ok) {
      return failed(
        "aftermath-failed",
        "combat-resolution",
        aftermathPhase.issues[0]?.code ?? "open-aftermath-failed"
      );
    }
    const aftermath = settleFateKnotsCombatAftermath(
      aftermathPhase.state,
      resolved.runtime,
      universe.statuses
    );
    if (!aftermath.ok) {
      return failed(
        "aftermath-failed",
        "combat-resolution",
        aftermath.issues[0]?.code ?? "settle-aftermath-failed"
      );
    }
    const nextDiscussion = openNextFateKnotsCombatDiscussion(aftermath.combat);
    if (!nextDiscussion.ok) {
      return failed(
        "aftermath-failed",
        "combat-resolution",
        nextDiscussion.issues[0]?.code ?? "open-next-discussion-failed"
      );
    }
    const updatedRun = updateFateKnotsActiveCombat(resolved.run, nextDiscussion.state);
    if (!updatedRun.ok) {
      return failed(
        "aftermath-failed",
        "combat-resolution",
        updatedRun.issues[0]?.code ?? "update-active-combat-failed"
      );
    }
    nextRun = updatedRun.run;
    nextRuntime = aftermath.runtime;
  }

  const saved = saveFateKnotsRunSnapshot(api, nextRun, terminal ? null : nextRuntime);
  if (!saved.ok) {
    return {
      ok: false,
      error: "save-rejected",
      state: null,
      issues: persistenceIssues(saved.issues),
    };
  }

  return {
    ok: true,
    state: {
      runId: saved.value.run.runId,
      previousRevision: payload.runRevision,
      runRevision: saved.value.run.revision,
      combatId: payload.combatId,
      turnIndex: payload.turnIndex,
      terminal,
      nextPhase: saved.value.run.phase,
      cards: presentation.cards,
    },
    issues: [],
  };
}

/**
 * Renderer handshake only. The room UI supplies optimistic identity/version
 * values from the safe gameplay projection; it never supplies mechanics or a
 * replacement Run State. The host rejects stale replays before deterministic
 * execution, making duplicate renderer notifications idempotent at the run
 * authority boundary.
 */
export function createFateKnotsCombatResolutionCommands(
  api: FateKnotsPersistenceApi
): Record<string, (payload?: unknown) => FateKnotsCombatResolutionCommandResult> {
  return {
    [FATE_KNOTS_COMBAT_RESOLUTION_COMMAND_NAMES.resolveTurn](payload?: unknown) {
      return resolveTurn(api, payload);
    },
  };
}
