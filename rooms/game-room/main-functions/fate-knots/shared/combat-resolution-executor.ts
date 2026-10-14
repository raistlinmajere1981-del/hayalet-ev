import type {
  FateKnotsCardDefinition,
  FateKnotsCombatActionCommit,
  FateKnotsCombatState,
  FateKnotsEquipmentDefinition,
  FateKnotsStatusDefinition,
} from "./contracts.js";
import { evaluateFateKnotsCardLegality, type FateKnotsCardLegalityIssue } from "./card-legality.js";
import {
  applyFateKnotsCombatPatches,
  type FateKnotsCombatPatchIssue,
} from "./combat-patch-apply.js";
import {
  evaluateFateKnotsCombatTerminalState,
  type FateKnotsCombatTerminalIssue,
} from "./combat-result.js";
import type { FateKnotsCombatRuntimeState } from "./combat-runtime.js";
import {
  resolveFateKnotsCardEffects,
  type FateKnotsEffectResolutionContext,
  type FateKnotsEffectResolutionIssue,
  type FateKnotsExecutableCardDefinition,
  type FateKnotsMechanicalPatch,
  type FateKnotsMechanicalResolvedEffect,
} from "./effect-resolution.js";
import {
  buildFateKnotsResolutionQueue,
  canResolveFateKnotsQueueEntryNow,
  type FateKnotsResolutionOrderIssue,
  type FateKnotsResolutionPass,
  type FateKnotsResolutionQueueEntry,
} from "./resolution-order.js";

export type FateKnotsResolvedEntryOutcome = "resolved" | "cancelled-fallen" | "cancelled-illegal";

export interface FateKnotsResolvedQueueEntryRecord {
  pass: FateKnotsResolutionPass;
  actorId: string;
  cardId: string;
  outcome: FateKnotsResolvedEntryOutcome;
  legalityIssues?: FateKnotsCardLegalityIssue[];
  effects: FateKnotsMechanicalResolvedEffect[];
}

export type FateKnotsCombatResolutionExecutorIssueCode =
  | "wrong-phase"
  | "resolution-order-failed"
  | "card-not-found"
  | "commit-not-found"
  | "effect-resolution-failed"
  | "patch-apply-failed"
  | "terminal-evaluation-failed";

export interface FateKnotsCombatResolutionExecutorIssue {
  code: FateKnotsCombatResolutionExecutorIssueCode;
  pass?: FateKnotsResolutionPass;
  actorId?: string;
  cardId?: string;
  orderIssues?: FateKnotsResolutionOrderIssue[];
  effectIssues?: FateKnotsEffectResolutionIssue[];
  patchIssues?: FateKnotsCombatPatchIssue[];
  terminalIssues?: FateKnotsCombatTerminalIssue[];
}

export interface FateKnotsCombatResolutionCatalog {
  cards: readonly FateKnotsCardDefinition[];
  equipment: readonly FateKnotsEquipmentDefinition[];
  statuses: readonly FateKnotsStatusDefinition[];
}

export interface FateKnotsCombatResolutionExecutionResult {
  ok: boolean;
  combat: FateKnotsCombatState;
  runtime: FateKnotsCombatRuntimeState;
  entries: FateKnotsResolvedQueueEntryRecord[];
  deferredRunPatches: Extract<FateKnotsMechanicalPatch, { kind: "run-reveal" }>[];
  issues: FateKnotsCombatResolutionExecutorIssue[];
}

function cloneCommit(commit: FateKnotsCombatActionCommit): FateKnotsCombatActionCommit {
  return { ...commit };
}

function cloneCombat(combat: FateKnotsCombatState): FateKnotsCombatState {
  return {
    ...combat,
    config: { ...combat.config },
    actors: combat.actors.map((actor) => ({
      ...actor,
      position: { ...actor.position },
      ownedCardIds: actor.ownedCardIds.slice(),
      availableCardIds: actor.availableCardIds.slice(),
      equipmentIds: actor.equipmentIds.slice(),
      statusIds: actor.statusIds.slice(),
      injuryIds: actor.injuryIds.slice(),
    })),
    commits: combat.commits.map(cloneCommit),
  };
}

function getCard(
  cards: readonly FateKnotsCardDefinition[],
  cardId: string
): FateKnotsCardDefinition | null {
  return cards.find((card) => card.id === cardId) ?? null;
}

function getCommit(
  combat: FateKnotsCombatState,
  actorId: string
): FateKnotsCombatActionCommit | null {
  return combat.commits.find((commit) => commit.actorId === actorId) ?? null;
}

function getPrimaryTarget(combat: FateKnotsCombatState, commit: FateKnotsCombatActionCommit) {
  const targetId = commit.primaryTargetId ?? null;
  if (!targetId) return null;
  return combat.actors.find((actor) => actor.actorId === targetId) ?? null;
}

function buildEffectContext(
  card: FateKnotsCardDefinition,
  actor: FateKnotsCombatState["actors"][number],
  combat: FateKnotsCombatState,
  commit: FateKnotsCombatActionCommit
): FateKnotsEffectResolutionContext {
  const context: FateKnotsEffectResolutionContext = {
    card: card as FateKnotsExecutableCardDefinition,
    actor,
    actors: combat.actors,
  };
  if (commit.primaryTargetId !== undefined) context.primaryTargetId = commit.primaryTargetId;
  if (commit.secondaryTargetId !== undefined) context.secondaryTargetId = commit.secondaryTargetId;
  return context;
}

function recordCancelledFallen(
  entry: FateKnotsResolutionQueueEntry
): FateKnotsResolvedQueueEntryRecord {
  return {
    pass: entry.pass,
    actorId: entry.actorId,
    cardId: entry.cardId,
    outcome: "cancelled-fallen",
    effects: [],
  };
}

function recordCancelledIllegal(
  entry: FateKnotsResolutionQueueEntry,
  legalityIssues: FateKnotsCardLegalityIssue[]
): FateKnotsResolvedQueueEntryRecord {
  return {
    pass: entry.pass,
    actorId: entry.actorId,
    cardId: entry.cardId,
    outcome: "cancelled-illegal",
    legalityIssues,
    effects: [],
  };
}

interface PassExecutionState {
  combat: FateKnotsCombatState;
  runtime: FateKnotsCombatRuntimeState;
  entries: FateKnotsResolvedQueueEntryRecord[];
  deferredRunPatches: Extract<FateKnotsMechanicalPatch, { kind: "run-reveal" }>[];
}

interface PassExecutionResult extends PassExecutionState {
  ok: boolean;
  issues: FateKnotsCombatResolutionExecutorIssue[];
}

function executeResolutionPass(
  input: PassExecutionState,
  pass: FateKnotsResolutionPass,
  catalog: FateKnotsCombatResolutionCatalog
): PassExecutionResult {
  const order = buildFateKnotsResolutionQueue(input.combat, input.runtime, catalog.cards, pass);
  if (!order.ok) {
    return {
      ...input,
      ok: false,
      issues: [{ code: "resolution-order-failed", pass, orderIssues: order.issues }],
    };
  }

  let combat = input.combat;
  let runtime = input.runtime;
  const entries = input.entries.slice();
  const deferredRunPatches = input.deferredRunPatches.slice();

  for (const entry of order.queue) {
    if (combat.result !== "active") break;

    if (!canResolveFateKnotsQueueEntryNow(combat, entry)) {
      entries.push(recordCancelledFallen(entry));
      continue;
    }

    const card = getCard(catalog.cards, entry.cardId);
    if (!card) {
      return {
        ok: false,
        combat,
        runtime,
        entries,
        deferredRunPatches,
        issues: [
          {
            code: "card-not-found",
            pass,
            actorId: entry.actorId,
            cardId: entry.cardId,
          },
        ],
      };
    }

    const commit = getCommit(combat, entry.actorId);
    if (!commit) {
      return {
        ok: false,
        combat,
        runtime,
        entries,
        deferredRunPatches,
        issues: [
          {
            code: "commit-not-found",
            pass,
            actorId: entry.actorId,
            cardId: entry.cardId,
          },
        ],
      };
    }

    const actor = combat.actors.find((candidate) => candidate.actorId === entry.actorId);
    if (!actor || actor.fallen) {
      entries.push(recordCancelledFallen(entry));
      continue;
    }

    // Reuse commit-phase legality semantics against the *current* combat state.
    // This deliberately catches range/row/status changes caused by faster cards.
    const legality = evaluateFateKnotsCardLegality(card, {
      phase: "combat-commit",
      actor,
      target: getPrimaryTarget(combat, commit),
      cards: catalog.cards,
      equipment: catalog.equipment,
      statuses: catalog.statuses,
    });

    if (!legality.legal) {
      entries.push(recordCancelledIllegal(entry, legality.issues));
      continue;
    }

    const effectPlan = resolveFateKnotsCardEffects(buildEffectContext(card, actor, combat, commit));

    if (!effectPlan.resolved) {
      return {
        ok: false,
        combat,
        runtime,
        entries,
        deferredRunPatches,
        issues: [
          {
            code: "effect-resolution-failed",
            pass,
            actorId: entry.actorId,
            cardId: entry.cardId,
            effectIssues: effectPlan.issues,
          },
        ],
      };
    }

    const applied = applyFateKnotsCombatPatches(combat, runtime, effectPlan.patches);
    if (!applied.ok) {
      return {
        ok: false,
        combat,
        runtime,
        entries,
        deferredRunPatches,
        issues: [
          {
            code: "patch-apply-failed",
            pass,
            actorId: entry.actorId,
            cardId: entry.cardId,
            patchIssues: applied.issues,
          },
        ],
      };
    }

    combat = applied.combat;
    runtime = applied.runtime;
    deferredRunPatches.push(...applied.deferredRunPatches);
    entries.push({
      pass,
      actorId: entry.actorId,
      cardId: entry.cardId,
      outcome: "resolved",
      effects: effectPlan.effects,
    });

    const terminal = evaluateFateKnotsCombatTerminalState(combat, runtime);
    if (!terminal.ok) {
      return {
        ok: false,
        combat,
        runtime,
        entries,
        deferredRunPatches,
        issues: [
          {
            code: "terminal-evaluation-failed",
            pass,
            actorId: entry.actorId,
            cardId: entry.cardId,
            terminalIssues: terminal.issues,
          },
        ],
      };
    }

    combat = terminal.state;
    if (terminal.terminal) break;
  }

  return {
    ok: true,
    combat,
    runtime,
    entries,
    deferredRunPatches,
    issues: [],
  };
}

/**
 * Executes a complete committed turn resolution without AI1 involvement.
 *
 * Pass 1 resolves movement. Pass 2 is then built from the updated positions and
 * actor life states. Every queued card is revalidated immediately before it
 * resolves. Becoming illegal because another committed card changed the state
 * is a normal tactical cancellation, not a malformed-engine error.
 */
export function executeFateKnotsCombatResolution(
  combatInput: FateKnotsCombatState,
  runtimeInput: FateKnotsCombatRuntimeState,
  catalog: FateKnotsCombatResolutionCatalog
): FateKnotsCombatResolutionExecutionResult {
  const combat = cloneCombat(combatInput);
  if (combat.phase !== "combat-resolution") {
    return {
      ok: false,
      combat,
      runtime: runtimeInput,
      entries: [],
      deferredRunPatches: [],
      issues: [{ code: "wrong-phase" }],
    };
  }

  const initial: PassExecutionState = {
    combat,
    runtime: runtimeInput,
    entries: [],
    deferredRunPatches: [],
  };

  const movement = executeResolutionPass(initial, "movement", catalog);
  if (!movement.ok || movement.combat.result !== "active") return movement;

  return executeResolutionPass(movement, "action", catalog);
}
