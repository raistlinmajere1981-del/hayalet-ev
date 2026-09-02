import type {
  FateKnotsActorState,
  FateKnotsCardDefinition,
  FateKnotsEquipmentDefinition,
  FateKnotsRunState,
} from "./contracts.js";

export interface FateKnotsLootAllocation {
  /** Index in the unchanged neutral loot pool. */
  poolIndex: number;
  cardId: string;
  /** `null` means the party deliberately leaves/discards this loot entry. */
  recipientActorId: string | null;
}

export interface FateKnotsLootDecision {
  runRevision: number;
  allocations: FateKnotsLootAllocation[];
  approvedActorIds: string[];
}

export type FateKnotsLootDecisionIssueCode =
  | "wrong-phase"
  | "run-not-active"
  | "empty-loot-pool"
  | "stale-run-revision"
  | "allocation-count-mismatch"
  | "duplicate-pool-index"
  | "pool-index-out-of-range"
  | "loot-card-mismatch"
  | "loot-card-not-found"
  | "loot-card-kind-not-inventory"
  | "recipient-not-party-actor"
  | "missing-party-approval";

export interface FateKnotsLootDecisionIssue {
  code: FateKnotsLootDecisionIssueCode;
  poolIndex?: number;
  cardId?: string;
  actorId?: string;
}

export interface FateKnotsLootDecisionResult {
  ok: boolean;
  run: FateKnotsRunState;
  assigned: Array<{
    poolIndex: number;
    cardId: string;
    recipientActorId: string;
  }>;
  leftBehindCardIds: string[];
  issues: FateKnotsLootDecisionIssue[];
}

export type FateKnotsEquipmentChangeIssueCode =
  | "actor-not-found"
  | "card-not-owned"
  | "not-equipment-card"
  | "equipment-source-missing"
  | "equipment-definition-not-found";

export interface FateKnotsEquipmentChangeIssue {
  code: FateKnotsEquipmentChangeIssueCode;
  actorId?: string;
  cardId?: string;
  equipmentId?: string;
}

export interface FateKnotsEquipmentChangeResult {
  ok: boolean;
  actor: FateKnotsActorState;
  equippedEquipmentId?: string;
  unequippedEquipmentIds: string[];
  issues: FateKnotsEquipmentChangeIssue[];
}

function cloneActor(actor: FateKnotsActorState): FateKnotsActorState {
  return {
    ...actor,
    position: { ...actor.position },
    ownedCardIds: actor.ownedCardIds.slice(),
    availableCardIds: actor.availableCardIds.slice(),
    equipmentIds: actor.equipmentIds.slice(),
    statusIds: actor.statusIds.slice(),
    injuryIds: actor.injuryIds.slice(),
  };
}

function cloneRun(run: FateKnotsRunState): FateKnotsRunState {
  return {
    ...run,
    revealedLocationIds: run.revealedLocationIds.slice(),
    revealedKnotIds: run.revealedKnotIds.slice(),
    completedKnotIds: run.completedKnotIds.slice(),
    partyActorIds: run.partyActorIds.slice(),
    actors: run.actors.map(cloneActor),
    teamPoolItemIds: run.teamPoolItemIds.slice(),
    activeCombat: run.activeCombat
      ? {
          ...run.activeCombat,
          config: { ...run.activeCombat.config },
          actors: run.activeCombat.actors.map(cloneActor),
          commits: run.activeCombat.commits.map((commit) => ({ ...commit })),
        }
      : null,
  };
}

function fail(
  run: FateKnotsRunState,
  issues: FateKnotsLootDecisionIssue[]
): FateKnotsLootDecisionResult {
  return {
    ok: false,
    run: cloneRun(run),
    assigned: [],
    leftBehindCardIds: [],
    issues,
  };
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function getPartyActors(run: FateKnotsRunState): FateKnotsActorState[] {
  const partyIds = new Set(run.partyActorIds);
  return run.actors.filter((actor) => partyIds.has(actor.actorId));
}

function isInventoryCard(card: FateKnotsCardDefinition): boolean {
  return card.kind === "item" || card.kind === "equipment";
}

/**
 * Resolves the neutral loot pool only after every current party actor approves
 * the exact same allocation proposal.
 *
 * `teamPoolItemIds` is intentionally treated as a transient, unowned loot pool
 * in V1 rather than a permanent shared inventory. Every array occurrence is one
 * physical copy, so duplicate card ids naturally represent multiple identical
 * consumables/items without introducing weight or stack-capacity rules.
 *
 * A decision must cover every pool entry exactly once. `recipientActorId=null`
 * is an explicit leave/discard decision. Until unanimity is reached this
 * function makes no state change.
 */
export function resolveFateKnotsLootDecision(
  runInput: FateKnotsRunState,
  decision: FateKnotsLootDecision,
  cards: readonly FateKnotsCardDefinition[]
): FateKnotsLootDecisionResult {
  if (runInput.result !== "active") return fail(runInput, [{ code: "run-not-active" }]);
  if (runInput.phase !== "loot") return fail(runInput, [{ code: "wrong-phase" }]);
  if (runInput.teamPoolItemIds.length === 0) return fail(runInput, [{ code: "empty-loot-pool" }]);
  if (decision.runRevision !== runInput.revision) {
    return fail(runInput, [{ code: "stale-run-revision" }]);
  }

  const issues: FateKnotsLootDecisionIssue[] = [];
  if (decision.allocations.length !== runInput.teamPoolItemIds.length) {
    issues.push({ code: "allocation-count-mismatch" });
  }

  const seenIndexes = new Set<number>();
  const cardById = new Map(cards.map((card) => [card.id, card] as const));
  const partyActors = getPartyActors(runInput);
  const partyIds = new Set(partyActors.map((actor) => actor.actorId));

  for (const allocation of decision.allocations) {
    if (seenIndexes.has(allocation.poolIndex)) {
      issues.push({ code: "duplicate-pool-index", poolIndex: allocation.poolIndex });
      continue;
    }
    seenIndexes.add(allocation.poolIndex);

    if (
      !Number.isInteger(allocation.poolIndex) ||
      allocation.poolIndex < 0 ||
      allocation.poolIndex >= runInput.teamPoolItemIds.length
    ) {
      issues.push({ code: "pool-index-out-of-range", poolIndex: allocation.poolIndex });
      continue;
    }

    const actualCardId = runInput.teamPoolItemIds[allocation.poolIndex];
    if (actualCardId !== allocation.cardId) {
      issues.push({
        code: "loot-card-mismatch",
        poolIndex: allocation.poolIndex,
        cardId: allocation.cardId,
      });
      continue;
    }

    const card = cardById.get(allocation.cardId);
    if (!card) {
      issues.push({
        code: "loot-card-not-found",
        poolIndex: allocation.poolIndex,
        cardId: allocation.cardId,
      });
    } else if (!isInventoryCard(card)) {
      issues.push({
        code: "loot-card-kind-not-inventory",
        poolIndex: allocation.poolIndex,
        cardId: allocation.cardId,
      });
    }

    if (allocation.recipientActorId !== null && !partyIds.has(allocation.recipientActorId)) {
      issues.push({
        code: "recipient-not-party-actor",
        poolIndex: allocation.poolIndex,
        actorId: allocation.recipientActorId,
      });
    }
  }

  const approvals = new Set(decision.approvedActorIds);
  for (const actor of partyActors) {
    if (!approvals.has(actor.actorId)) {
      issues.push({ code: "missing-party-approval", actorId: actor.actorId });
    }
  }

  if (issues.length > 0) return fail(runInput, issues);

  const run = cloneRun(runInput);
  const actorById = new Map(run.actors.map((actor) => [actor.actorId, actor] as const));
  const assigned: FateKnotsLootDecisionResult["assigned"] = [];
  const leftBehindCardIds: string[] = [];

  for (const allocation of decision.allocations) {
    if (allocation.recipientActorId === null) {
      leftBehindCardIds.push(allocation.cardId);
      continue;
    }

    const actor = actorById.get(allocation.recipientActorId);
    if (!actor) continue;
    // Deliberately keep duplicates: two identical potions are two uses.
    actor.ownedCardIds.push(allocation.cardId);
    assigned.push({
      poolIndex: allocation.poolIndex,
      cardId: allocation.cardId,
      recipientActorId: allocation.recipientActorId,
    });
  }

  run.teamPoolItemIds = [];
  run.revision += 1;
  return { ok: true, run, assigned, leftBehindCardIds, issues: [] };
}

function cloneEquipmentResultActor(actor: FateKnotsActorState): FateKnotsActorState {
  return cloneActor(actor);
}

/**
 * Equips an equipment card already owned by the actor. Equipment ownership is
 * represented by the card in `ownedCardIds`; `equipmentIds` represents only the
 * currently equipped definitions that grant/modify combat cards.
 *
 * V1 has no weight system. Equipping a new item replaces any currently equipped
 * definition that uses the same explicit equipment slot.
 */
export function equipFateKnotsInventoryCard(
  actorInput: FateKnotsActorState,
  equipmentCardId: string,
  cards: readonly FateKnotsCardDefinition[],
  equipment: readonly FateKnotsEquipmentDefinition[]
): FateKnotsEquipmentChangeResult {
  const actor = cloneActor(actorInput);
  if (!actor.ownedCardIds.includes(equipmentCardId)) {
    return {
      ok: false,
      actor,
      unequippedEquipmentIds: [],
      issues: [{ code: "card-not-owned", actorId: actor.actorId, cardId: equipmentCardId }],
    };
  }

  const card = cards.find((candidate) => candidate.id === equipmentCardId);
  if (!card || card.kind !== "equipment") {
    return {
      ok: false,
      actor,
      unequippedEquipmentIds: [],
      issues: [{ code: "not-equipment-card", actorId: actor.actorId, cardId: equipmentCardId }],
    };
  }

  const equipmentId = card.sourceId ?? null;
  if (!equipmentId) {
    return {
      ok: false,
      actor,
      unequippedEquipmentIds: [],
      issues: [
        { code: "equipment-source-missing", actorId: actor.actorId, cardId: equipmentCardId },
      ],
    };
  }

  const definition = equipment.find((candidate) => candidate.id === equipmentId);
  if (!definition) {
    return {
      ok: false,
      actor,
      unequippedEquipmentIds: [],
      issues: [{ code: "equipment-definition-not-found", actorId: actor.actorId, equipmentId }],
    };
  }

  const equipmentById = new Map(equipment.map((candidate) => [candidate.id, candidate] as const));
  const unequippedEquipmentIds = actor.equipmentIds.filter(
    (id) => equipmentById.get(id)?.slot === definition.slot && id !== definition.id
  );
  const removed = new Set(unequippedEquipmentIds);
  actor.equipmentIds = uniqueStrings([
    ...actor.equipmentIds.filter((id) => !removed.has(id)),
    definition.id,
  ]);

  return {
    ok: true,
    actor,
    equippedEquipmentId: definition.id,
    unequippedEquipmentIds,
    issues: [],
  };
}

export function unequipFateKnotsEquipment(
  actorInput: FateKnotsActorState,
  equipmentId: string
): FateKnotsEquipmentChangeResult {
  const actor = cloneEquipmentResultActor(actorInput);
  const hadEquipment = actor.equipmentIds.includes(equipmentId);
  actor.equipmentIds = actor.equipmentIds.filter((id) => id !== equipmentId);
  return {
    ok: true,
    actor,
    unequippedEquipmentIds: hadEquipment ? [equipmentId] : [],
    issues: [],
  };
}
