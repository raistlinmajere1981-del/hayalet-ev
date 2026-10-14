import type {
  FateKnotsCardDefinition,
  FateKnotsCombatState,
  FateKnotsResolutionPriorityTier,
} from "./contracts.js";
import {
  getFateKnotsCombatStatModifierTotal,
  type FateKnotsCombatRuntimeState,
} from "./combat-runtime.js";

export type FateKnotsResolutionPass = "movement" | "action";

export interface FateKnotsResolutionQueueEntry {
  pass: FateKnotsResolutionPass;
  actorId: string;
  cardId: string;
  priority: FateKnotsResolutionPriorityTier;
  effectiveSpeed: number;
  tieBreakKey: string;
}

export type FateKnotsResolutionOrderIssueCode =
  | "wrong-phase"
  | "card-not-found"
  | "movement-slot-card-kind-mismatch"
  | "action-slot-card-kind-mismatch";

export interface FateKnotsResolutionOrderIssue {
  code: FateKnotsResolutionOrderIssueCode;
  actorId?: string;
  cardId?: string;
}

export interface FateKnotsResolutionOrderResult {
  ok: boolean;
  queue: FateKnotsResolutionQueueEntry[];
  issues: FateKnotsResolutionOrderIssue[];
}

const PRIORITY_RANK: Readonly<Record<FateKnotsResolutionPriorityTier, number>> = {
  fast: 3,
  normal: 2,
  heavy: 1,
};

const ACTION_KINDS = new Set<FateKnotsCardDefinition["kind"]>([
  "attack",
  "defense",
  "ability",
  "item",
]);

function getCard(
  cards: readonly FateKnotsCardDefinition[],
  cardId: string
): FateKnotsCardDefinition | null {
  return cards.find((card) => card.id === cardId) ?? null;
}

export function getFateKnotsCardResolutionPriority(
  card: FateKnotsCardDefinition
): FateKnotsResolutionPriorityTier {
  return card.resolutionPriority ?? "normal";
}

export function getFateKnotsEffectiveSpeed(
  state: FateKnotsCombatState,
  runtime: FateKnotsCombatRuntimeState,
  actorId: string
): number | null {
  const actor = state.actors.find((candidate) => candidate.actorId === actorId);
  if (!actor) return null;
  return actor.speed + getFateKnotsCombatStatModifierTotal(runtime, actorId, "speed");
}

function compareStableText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function compareEntries(
  left: FateKnotsResolutionQueueEntry,
  right: FateKnotsResolutionQueueEntry
): number {
  const priorityDelta = PRIORITY_RANK[right.priority] - PRIORITY_RANK[left.priority];
  if (priorityDelta !== 0) return priorityDelta;

  const speedDelta = right.effectiveSpeed - left.effectiveSpeed;
  if (speedDelta !== 0) return speedDelta;

  return compareStableText(left.tieBreakKey, right.tieBreakKey);
}

function getCommittedCardId(
  state: FateKnotsCombatState,
  actorId: string,
  pass: FateKnotsResolutionPass
): string | null {
  const commit = state.commits.find((candidate) => candidate.actorId === actorId);
  if (!commit) return null;
  if (pass === "movement") return commit.movementCardId ?? null;
  return commit.actionCardId ?? null;
}

/**
 * Builds one deterministic resolution pass.
 *
 * Resolution law:
 * 1. movement pass is built/resolved before the action pass
 * 2. card priority: fast -> normal -> heavy
 * 3. higher effective speed resolves first within the same priority
 * 4. exact ties use actorId as a stable non-random key
 *
 * The queue is rebuilt for the action pass after movement has resolved. This is
 * intentional: an actor that became fallen before its action turn is omitted.
 */
export function buildFateKnotsResolutionQueue(
  state: FateKnotsCombatState,
  runtime: FateKnotsCombatRuntimeState,
  cards: readonly FateKnotsCardDefinition[],
  pass: FateKnotsResolutionPass
): FateKnotsResolutionOrderResult {
  if (state.phase !== "combat-resolution") {
    return { ok: false, queue: [], issues: [{ code: "wrong-phase" }] };
  }

  const queue: FateKnotsResolutionQueueEntry[] = [];
  const issues: FateKnotsResolutionOrderIssue[] = [];

  for (const actor of state.actors) {
    if (actor.fallen) continue;

    const cardId = getCommittedCardId(state, actor.actorId, pass);
    if (!cardId) continue;

    const card = getCard(cards, cardId);
    if (!card) {
      issues.push({ code: "card-not-found", actorId: actor.actorId, cardId });
      continue;
    }

    if (pass === "movement" && card.kind !== "movement") {
      issues.push({
        code: "movement-slot-card-kind-mismatch",
        actorId: actor.actorId,
        cardId,
      });
      continue;
    }

    if (pass === "action" && !ACTION_KINDS.has(card.kind)) {
      issues.push({
        code: "action-slot-card-kind-mismatch",
        actorId: actor.actorId,
        cardId,
      });
      continue;
    }

    const effectiveSpeed = getFateKnotsEffectiveSpeed(state, runtime, actor.actorId);
    if (effectiveSpeed === null) continue;

    queue.push({
      pass,
      actorId: actor.actorId,
      cardId,
      priority: getFateKnotsCardResolutionPriority(card),
      effectiveSpeed,
      tieBreakKey: actor.actorId,
    });
  }

  if (issues.length > 0) return { ok: false, queue: [], issues };

  queue.sort(compareEntries);
  return { ok: true, queue, issues: [] };
}

/**
 * Must be checked immediately before resolving an entry, not only when the
 * queue is created. A faster action may have made the actor fallen meanwhile.
 */
export function canResolveFateKnotsQueueEntryNow(
  state: FateKnotsCombatState,
  entry: FateKnotsResolutionQueueEntry
): boolean {
  const actor = state.actors.find((candidate) => candidate.actorId === entry.actorId);
  return actor !== undefined && actor.fallen === false && state.result === "active";
}
