import { normalizeFateKnotsCanonicalUniversePackage } from "../forge/canonical-universe.js";
import type { FateKnotsRunState, FateKnotsUniversePackage } from "../shared/contracts.js";
import { resolveFateKnotsStoryLootDecision } from "../shared/story-loot-flow.js";
import {
  loadFateKnotsRunStore,
  loadFateKnotsUniverseStore,
  saveFateKnotsRunSnapshot,
  type FateKnotsPersistenceApi,
  type FateKnotsPersistenceIssue,
} from "./persistence.js";

export type FateKnotsLootPlayerSeatId = "user" | "ai2" | "us1";

export const FATE_KNOTS_LOOT_COMMAND_NAMES = {
  get: "GameRoomFateKnotsGetLootState",
  proposeLocal: "GameRoomFateKnotsProposeLoot",
  proposeAi2: "GameRoomFateKnotsAi2ProposeLoot",
  proposeRemote: "GameRoomFateKnotsRemoteProposeLoot",
  approveLocal: "GameRoomFateKnotsApproveLoot",
  approveAi2: "GameRoomFateKnotsAi2ApproveLoot",
  approveRemote: "GameRoomFateKnotsRemoteApproveLoot",
} as const;

const LOOT_COORDINATION_STATE_KEY = "game-room:fate-knots:loot-coordination:v1";
const PLAYER_SEATS: readonly FateKnotsLootPlayerSeatId[] = ["user", "ai2", "us1"];

export interface FateKnotsLootAllocationProjection {
  poolIndex: number;
  cardId: string;
  recipientActorId: string | null;
}

interface FateKnotsLootHotState {
  runId: string;
  runRevision: number;
  poolSignature: string;
  proposalRevision: number;
  proposedBySeatId: FateKnotsLootPlayerSeatId | null;
  allocations: FateKnotsLootAllocationProjection[];
  approvedSeatIds: FateKnotsLootPlayerSeatId[];
}

export interface FateKnotsLootStateProjection {
  runId: string;
  runRevision: number;
  pool: Array<{ poolIndex: number; cardId: string }>;
  activeSeatIds: FateKnotsLootPlayerSeatId[];
  proposalRevision: number;
  proposedBySeatId: FateKnotsLootPlayerSeatId | null;
  allocations: FateKnotsLootAllocationProjection[];
  approvedSeatIds: FateKnotsLootPlayerSeatId[];
  resolved: boolean;
  nextPhase: "exploration" | null;
}

export interface FateKnotsLootCommandIssue {
  source: "payload" | "persistence" | "universe" | "loot" | "seat";
  code: string;
  value?: string;
}

export type FateKnotsLootCommandResult =
  | { ok: true; state: FateKnotsLootStateProjection; issues: [] }
  | {
      ok: false;
      error:
        | "invalid-payload"
        | "run-not-found"
        | "universe-not-found"
        | "universe-rejected"
        | "persistence-rejected"
        | "loot-phase-required"
        | "seat-not-active"
        | "seat-ambiguous"
        | "party-seat-unmapped"
        | "proposal-required"
        | "loot-proposal-rejected"
        | "loot-resolution-rejected"
        | "save-rejected";
      state: null;
      issues: FateKnotsLootCommandIssue[];
    };

interface FateKnotsLootContext {
  run: FateKnotsRunState;
  universe: FateKnotsUniversePackage;
}

interface FateKnotsLootSeatMap {
  seats: FateKnotsLootPlayerSeatId[];
  actorIdBySeat: Map<FateKnotsLootPlayerSeatId, string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function readRunId(payload: unknown): string | null {
  return isRecord(payload) ? readNonEmptyString(payload["runId"]) : null;
}

function fail(
  error: Exclude<FateKnotsLootCommandResult, { ok: true }>["error"],
  issues: FateKnotsLootCommandIssue[]
): FateKnotsLootCommandResult {
  return { ok: false, error, state: null, issues };
}

function persistenceIssues(issues: FateKnotsPersistenceIssue[]): FateKnotsLootCommandIssue[] {
  return issues.map((issue) => ({
    source: "persistence" as const,
    code: issue.code,
    ...(issue.entryId ? { value: issue.entryId } : {}),
  }));
}

function loadContext(
  api: FateKnotsPersistenceApi,
  runId: string
): { ok: true; context: FateKnotsLootContext } | { ok: false; result: FateKnotsLootCommandResult } {
  const runs = loadFateKnotsRunStore(api);
  if (runs.issues.length > 0) {
    return { ok: false, result: fail("persistence-rejected", persistenceIssues(runs.issues)) };
  }
  const snapshot = runs.store.entries.find((entry) => entry.run.runId === runId) ?? null;
  if (!snapshot) {
    return {
      ok: false,
      result: fail("run-not-found", [{ source: "loot", code: "run-not-found", value: runId }]),
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

function buildSeatMap(
  run: FateKnotsRunState
): { ok: true; value: FateKnotsLootSeatMap } | { ok: false; result: FateKnotsLootCommandResult } {
  const partyIds = new Set(run.partyActorIds);
  const actorIdBySeat = new Map<FateKnotsLootPlayerSeatId, string>();

  for (const actor of run.actors) {
    if (!partyIds.has(actor.actorId)) continue;
    const seatId = actor.seatId;
    if (!seatId || !PLAYER_SEATS.includes(seatId as FateKnotsLootPlayerSeatId)) {
      return {
        ok: false,
        result: fail("party-seat-unmapped", [
          { source: "seat", code: "party-seat-unmapped", value: actor.actorId },
        ]),
      };
    }
    const playerSeatId = seatId as FateKnotsLootPlayerSeatId;
    if (actorIdBySeat.has(playerSeatId)) {
      return {
        ok: false,
        result: fail("seat-ambiguous", [
          { source: "seat", code: "seat-ambiguous", value: playerSeatId },
        ]),
      };
    }
    actorIdBySeat.set(playerSeatId, actor.actorId);
  }

  if (actorIdBySeat.size !== run.partyActorIds.length) {
    return {
      ok: false,
      result: fail("party-seat-unmapped", [{ source: "seat", code: "party-seat-unmapped" }]),
    };
  }

  return {
    ok: true,
    value: {
      seats: PLAYER_SEATS.filter((seatId) => actorIdBySeat.has(seatId)),
      actorIdBySeat,
    },
  };
}

function requireLootPhase(run: FateKnotsRunState): FateKnotsLootCommandResult | null {
  if (run.result !== "active" || run.phase !== "loot" || run.teamPoolItemIds.length === 0) {
    return fail("loot-phase-required", [{ source: "loot", code: "loot-phase-required" }]);
  }
  return null;
}

function poolSignature(run: FateKnotsRunState): string {
  return run.teamPoolItemIds.map((cardId, index) => `${index}:${cardId}`).join("|");
}

function readHotState(value: unknown): FateKnotsLootHotState | null {
  if (!isRecord(value)) return null;
  const runId = readNonEmptyString(value["runId"]);
  const runRevision = value["runRevision"];
  const signature = readNonEmptyString(value["poolSignature"]);
  const proposalRevision = value["proposalRevision"];
  const proposedBySeatId = value["proposedBySeatId"];
  const allocations = value["allocations"];
  const approvedSeatIds = value["approvedSeatIds"];

  if (
    !runId ||
    typeof runRevision !== "number" ||
    !Number.isInteger(runRevision) ||
    runRevision < 0 ||
    !signature ||
    typeof proposalRevision !== "number" ||
    !Number.isInteger(proposalRevision) ||
    proposalRevision < 0 ||
    !Array.isArray(allocations) ||
    !Array.isArray(approvedSeatIds)
  ) {
    return null;
  }

  const normalizedProposedBy =
    proposedBySeatId === null
      ? null
      : typeof proposedBySeatId === "string" &&
          PLAYER_SEATS.includes(proposedBySeatId as FateKnotsLootPlayerSeatId)
        ? (proposedBySeatId as FateKnotsLootPlayerSeatId)
        : undefined;
  if (normalizedProposedBy === undefined) return null;

  const normalizedAllocations: FateKnotsLootAllocationProjection[] = [];
  for (const allocation of allocations) {
    if (!isRecord(allocation)) return null;
    const poolIndex = allocation["poolIndex"];
    const cardId = readNonEmptyString(allocation["cardId"]);
    const recipientActorId = allocation["recipientActorId"];
    if (
      typeof poolIndex !== "number" ||
      !Number.isInteger(poolIndex) ||
      poolIndex < 0 ||
      !cardId ||
      (recipientActorId !== null && typeof recipientActorId !== "string")
    ) {
      return null;
    }
    normalizedAllocations.push({
      poolIndex,
      cardId,
      recipientActorId:
        typeof recipientActorId === "string" && recipientActorId.trim() !== ""
          ? recipientActorId.trim()
          : null,
    });
  }

  const normalizedApprovals = approvedSeatIds.filter(
    (seatId): seatId is FateKnotsLootPlayerSeatId =>
      typeof seatId === "string" && PLAYER_SEATS.includes(seatId as FateKnotsLootPlayerSeatId)
  );

  return {
    runId,
    runRevision,
    poolSignature: signature,
    proposalRevision,
    proposedBySeatId: normalizedProposedBy,
    allocations: normalizedAllocations,
    approvedSeatIds: Array.from(new Set(normalizedApprovals)),
  };
}

function scopedHotState(
  api: FateKnotsPersistenceApi,
  run: FateKnotsRunState
): FateKnotsLootHotState {
  const signature = poolSignature(run);
  const stored = readHotState(api.getState(LOOT_COORDINATION_STATE_KEY));
  if (
    stored &&
    stored.runId === run.runId &&
    stored.runRevision === run.revision &&
    stored.poolSignature === signature
  ) {
    return stored;
  }

  const fresh: FateKnotsLootHotState = {
    runId: run.runId,
    runRevision: run.revision,
    poolSignature: signature,
    proposalRevision: 0,
    proposedBySeatId: null,
    allocations: [],
    approvedSeatIds: [],
  };
  api.setState(LOOT_COORDINATION_STATE_KEY, fresh);
  return fresh;
}

function project(
  run: FateKnotsRunState,
  seats: FateKnotsLootSeatMap,
  hot: FateKnotsLootHotState,
  resolved = false,
  nextPhase: "exploration" | null = null
): FateKnotsLootStateProjection {
  return {
    runId: run.runId,
    runRevision: run.revision,
    pool: run.teamPoolItemIds.map((cardId, poolIndex) => ({ poolIndex, cardId })),
    activeSeatIds: seats.seats.slice(),
    proposalRevision: hot.proposalRevision,
    proposedBySeatId: hot.proposedBySeatId,
    allocations: hot.allocations.map((allocation) => ({ ...allocation })),
    approvedSeatIds: hot.approvedSeatIds.filter((seatId) => seats.seats.includes(seatId)),
    resolved,
    nextPhase,
  };
}

function requireSeat(
  seats: FateKnotsLootSeatMap,
  seatId: FateKnotsLootPlayerSeatId
): FateKnotsLootCommandResult | null {
  if (!seats.seats.includes(seatId)) {
    return fail("seat-not-active", [{ source: "seat", code: "seat-not-active", value: seatId }]);
  }
  return null;
}

function readProposal(
  payload: unknown,
  run: FateKnotsRunState
): FateKnotsLootAllocationProjection[] | null {
  if (!isRecord(payload) || !Array.isArray(payload["allocations"])) return null;
  const rawAllocations = payload["allocations"];
  if (rawAllocations.length !== run.teamPoolItemIds.length) return null;

  const partyIds = new Set(run.partyActorIds);
  const seen = new Set<number>();
  const allocations: FateKnotsLootAllocationProjection[] = [];
  for (const raw of rawAllocations) {
    if (!isRecord(raw)) return null;
    const poolIndex = raw["poolIndex"];
    const recipientActorId = raw["recipientActorId"];
    if (
      typeof poolIndex !== "number" ||
      !Number.isInteger(poolIndex) ||
      poolIndex < 0 ||
      poolIndex >= run.teamPoolItemIds.length ||
      seen.has(poolIndex) ||
      (recipientActorId !== null && typeof recipientActorId !== "string")
    ) {
      return null;
    }
    const normalizedRecipient =
      typeof recipientActorId === "string" && recipientActorId.trim() !== ""
        ? recipientActorId.trim()
        : null;
    if (normalizedRecipient !== null && !partyIds.has(normalizedRecipient)) return null;
    const cardId = run.teamPoolItemIds[poolIndex];
    if (!cardId) return null;
    seen.add(poolIndex);
    allocations.push({ poolIndex, cardId, recipientActorId: normalizedRecipient });
  }

  if (seen.size !== run.teamPoolItemIds.length) return null;
  return allocations.sort((left, right) => left.poolIndex - right.poolIndex);
}

function sameAllocations(
  left: readonly FateKnotsLootAllocationProjection[],
  right: readonly FateKnotsLootAllocationProjection[]
): boolean {
  if (left.length !== right.length) return false;
  return left.every((allocation, index) => {
    const other = right[index];
    return (
      other !== undefined &&
      allocation.poolIndex === other.poolIndex &&
      allocation.cardId === other.cardId &&
      allocation.recipientActorId === other.recipientActorId
    );
  });
}

function getState(api: FateKnotsPersistenceApi, payload: unknown): FateKnotsLootCommandResult {
  const runId = readRunId(payload);
  if (!runId) return fail("invalid-payload", [{ source: "payload", code: "invalid-run-id" }]);
  const loaded = loadContext(api, runId);
  if (!loaded.ok) return loaded.result;
  const phaseFailure = requireLootPhase(loaded.context.run);
  if (phaseFailure) return phaseFailure;
  const seatMap = buildSeatMap(loaded.context.run);
  if (!seatMap.ok) return seatMap.result;
  const hot = scopedHotState(api, loaded.context.run);
  return { ok: true, state: project(loaded.context.run, seatMap.value, hot), issues: [] };
}

function propose(
  api: FateKnotsPersistenceApi,
  payload: unknown,
  seatId: FateKnotsLootPlayerSeatId
): FateKnotsLootCommandResult {
  const runId = readRunId(payload);
  if (!runId) return fail("invalid-payload", [{ source: "payload", code: "invalid-run-id" }]);
  const loaded = loadContext(api, runId);
  if (!loaded.ok) return loaded.result;
  const phaseFailure = requireLootPhase(loaded.context.run);
  if (phaseFailure) return phaseFailure;
  const seatMap = buildSeatMap(loaded.context.run);
  if (!seatMap.ok) return seatMap.result;
  const seatFailure = requireSeat(seatMap.value, seatId);
  if (seatFailure) return seatFailure;

  const allocations = readProposal(payload, loaded.context.run);
  if (!allocations) {
    return fail("loot-proposal-rejected", [{ source: "payload", code: "invalid-loot-proposal" }]);
  }

  const hot = scopedHotState(api, loaded.context.run);
  if (sameAllocations(hot.allocations, allocations)) {
    hot.approvedSeatIds = Array.from(new Set([...hot.approvedSeatIds, seatId]));
    hot.proposedBySeatId ??= seatId;
  } else {
    hot.proposalRevision += 1;
    hot.proposedBySeatId = seatId;
    hot.allocations = allocations;
    hot.approvedSeatIds = [seatId];
  }
  api.setState(LOOT_COORDINATION_STATE_KEY, hot);

  return resolveIfUnanimous(api, loaded.context, seatMap.value, hot);
}

function resolveIfUnanimous(
  api: FateKnotsPersistenceApi,
  context: FateKnotsLootContext,
  seats: FateKnotsLootSeatMap,
  hot: FateKnotsLootHotState
): FateKnotsLootCommandResult {
  const unanimous =
    seats.seats.length > 0 && seats.seats.every((seatId) => hot.approvedSeatIds.includes(seatId));
  if (!unanimous) {
    return { ok: true, state: project(context.run, seats, hot), issues: [] };
  }
  if (hot.allocations.length !== context.run.teamPoolItemIds.length) {
    return fail("proposal-required", [{ source: "loot", code: "proposal-required" }]);
  }

  const approvedActorIds: string[] = [];
  for (const seatId of seats.seats) {
    const actorId = seats.actorIdBySeat.get(seatId);
    if (!actorId) {
      return fail("party-seat-unmapped", [
        { source: "seat", code: "party-seat-unmapped", value: seatId },
      ]);
    }
    approvedActorIds.push(actorId);
  }

  const resolved = resolveFateKnotsStoryLootDecision(context.universe, context.run, {
    runRevision: context.run.revision,
    allocations: hot.allocations.map((allocation) => ({ ...allocation })),
    approvedActorIds,
  });
  if (!resolved.ok) {
    const first = resolved.issues[0];
    return fail("loot-resolution-rejected", [
      {
        source: "loot",
        code: first?.code ?? "loot-resolution-rejected",
      },
    ]);
  }

  const saved = saveFateKnotsRunSnapshot(api, resolved.run, null);
  if (!saved.ok) return fail("save-rejected", persistenceIssues(saved.issues));

  return {
    ok: true,
    state: {
      ...project(context.run, seats, hot, true, "exploration"),
      runRevision: saved.value.run.revision,
    },
    issues: [],
  };
}

function approve(
  api: FateKnotsPersistenceApi,
  payload: unknown,
  seatId: FateKnotsLootPlayerSeatId
): FateKnotsLootCommandResult {
  const runId = readRunId(payload);
  if (!runId) return fail("invalid-payload", [{ source: "payload", code: "invalid-run-id" }]);
  const loaded = loadContext(api, runId);
  if (!loaded.ok) return loaded.result;
  const phaseFailure = requireLootPhase(loaded.context.run);
  if (phaseFailure) return phaseFailure;
  const seatMap = buildSeatMap(loaded.context.run);
  if (!seatMap.ok) return seatMap.result;
  const seatFailure = requireSeat(seatMap.value, seatId);
  if (seatFailure) return seatFailure;

  const hot = scopedHotState(api, loaded.context.run);
  if (hot.allocations.length === 0) {
    return fail("proposal-required", [{ source: "loot", code: "proposal-required" }]);
  }
  hot.approvedSeatIds = Array.from(new Set([...hot.approvedSeatIds, seatId]));
  api.setState(LOOT_COORDINATION_STATE_KEY, hot);
  return resolveIfUnanimous(api, loaded.context, seatMap.value, hot);
}

export function createFateKnotsLootCommands(
  api: FateKnotsPersistenceApi
): Record<string, (payload?: unknown) => FateKnotsLootCommandResult> {
  return {
    [FATE_KNOTS_LOOT_COMMAND_NAMES.get](payload?: unknown) {
      return getState(api, payload);
    },
    [FATE_KNOTS_LOOT_COMMAND_NAMES.proposeLocal](payload?: unknown) {
      return propose(api, payload, "user");
    },
    [FATE_KNOTS_LOOT_COMMAND_NAMES.proposeAi2](payload?: unknown) {
      return propose(api, payload, "ai2");
    },
    [FATE_KNOTS_LOOT_COMMAND_NAMES.proposeRemote](payload?: unknown) {
      return propose(api, payload, "us1");
    },
    [FATE_KNOTS_LOOT_COMMAND_NAMES.approveLocal](payload?: unknown) {
      return approve(api, payload, "user");
    },
    [FATE_KNOTS_LOOT_COMMAND_NAMES.approveAi2](payload?: unknown) {
      return approve(api, payload, "ai2");
    },
    [FATE_KNOTS_LOOT_COMMAND_NAMES.approveRemote](payload?: unknown) {
      return approve(api, payload, "us1");
    },
  };
}

export function clearFateKnotsLootCoordinationAfterResolve(api: FateKnotsPersistenceApi): void {
  api.setState(LOOT_COORDINATION_STATE_KEY, null);
}
