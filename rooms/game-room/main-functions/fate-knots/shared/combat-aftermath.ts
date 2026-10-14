import type {
  FateKnotsActorState,
  FateKnotsCombatState,
  FateKnotsStatusDefinition,
} from "./contracts.js";
import {
  cloneFateKnotsCombatRuntimeState,
  reconcileFateKnotsCombatRuntimeState,
  type FateKnotsCombatRuntimeState,
} from "./combat-runtime.js";

export type FateKnotsCombatAftermathIssueCode =
  "wrong-phase" | "combat-not-active" | "status-definition-not-found";

export interface FateKnotsCombatAftermathIssue {
  code: FateKnotsCombatAftermathIssueCode;
  actorId?: string;
  statusId?: string;
}

export interface FateKnotsExpiredCombatStatus {
  actorId: string;
  statusId: string;
  reason: "timed-expired" | "turn-scoped-expired";
}

export interface FateKnotsCombatAftermathResult {
  ok: boolean;
  combat: FateKnotsCombatState;
  runtime: FateKnotsCombatRuntimeState;
  expiredStatuses: FateKnotsExpiredCombatStatus[];
  clearedShieldActorIds: string[];
  clearedModifierActorIds: string[];
  issues: FateKnotsCombatAftermathIssue[];
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

function cloneCombat(combat: FateKnotsCombatState): FateKnotsCombatState {
  return {
    ...combat,
    config: { ...combat.config },
    actors: combat.actors.map(cloneActor),
    commits: combat.commits.map((commit) => ({ ...commit })),
  };
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

/**
 * V1 duration law:
 *
 * - shields exist only for the turn in which they are created and clear here
 * - direct combat stat modifiers are turn-scoped and clear here
 * - non-persistent statuses without duration are turn-scoped and clear here
 * - `durationTurns: N` survives the application turn and then N complete future
 *   turns; its counter starts decreasing only on a later turn's aftermath
 * - timed status reapplication is non-stacking and refreshes duration
 * - persistent statuses without duration remain until an explicit remove effect
 *
 * This deliberately avoids a second generic timer engine. Longer-lived stat
 * behavior should be represented by status definitions rather than ad-hoc
 * modifier lifetime rules.
 */
export function settleFateKnotsCombatAftermath(
  combatInput: FateKnotsCombatState,
  runtimeInput: FateKnotsCombatRuntimeState,
  statuses: readonly FateKnotsStatusDefinition[]
): FateKnotsCombatAftermathResult {
  const combat = cloneCombat(combatInput);
  const runtime = cloneFateKnotsCombatRuntimeState(
    reconcileFateKnotsCombatRuntimeState(combat, runtimeInput)
  );

  if (combat.phase !== "combat-aftermath") {
    return {
      ok: false,
      combat,
      runtime,
      expiredStatuses: [],
      clearedShieldActorIds: [],
      clearedModifierActorIds: [],
      issues: [{ code: "wrong-phase" }],
    };
  }

  if (combat.result !== "active") {
    return {
      ok: false,
      combat,
      runtime,
      expiredStatuses: [],
      clearedShieldActorIds: [],
      clearedModifierActorIds: [],
      issues: [{ code: "combat-not-active" }],
    };
  }

  const statusById = new Map(statuses.map((status) => [status.id, status] as const));
  const issues: FateKnotsCombatAftermathIssue[] = [];

  for (const actor of combat.actors) {
    for (const statusId of actor.statusIds) {
      if (!statusById.has(statusId)) {
        issues.push({ code: "status-definition-not-found", actorId: actor.actorId, statusId });
      }
    }
  }

  if (issues.length > 0) {
    return {
      ok: false,
      combat,
      runtime,
      expiredStatuses: [],
      clearedShieldActorIds: [],
      clearedModifierActorIds: [],
      issues,
    };
  }

  const expiredStatuses: FateKnotsExpiredCombatStatus[] = [];
  const clearedShieldActorIds: string[] = [];
  const clearedModifierActorIds: string[] = [];

  for (const runtimeActor of runtime.actorRuntime) {
    const actor = combat.actors.find((candidate) => candidate.actorId === runtimeActor.actorId);
    if (!actor) continue;

    if (runtimeActor.shield > 0) {
      runtimeActor.shield = 0;
      clearedShieldActorIds.push(actor.actorId);
    }

    if (runtimeActor.statModifiers.length > 0) {
      runtimeActor.statModifiers = [];
      actor.hp = Math.min(actor.hp, Math.max(0, actor.maxHp));
      if (actor.hp === 0) actor.fallen = true;
      clearedModifierActorIds.push(actor.actorId);
    }

    const expiredTimedIds = new Set<string>();
    runtimeActor.timedStatuses = runtimeActor.timedStatuses.flatMap((timed) => {
      if (!actor.statusIds.includes(timed.statusId)) return [];

      // A status created during this turn must survive this aftermath. For
      // durationTurns=1 this means it remains active for the next complete turn.
      if (timed.appliedTurnIndex >= combat.turnIndex) return [{ ...timed }];

      const remainingTurns = timed.remainingTurns - 1;
      if (remainingTurns <= 0) {
        expiredTimedIds.add(timed.statusId);
        expiredStatuses.push({
          actorId: actor.actorId,
          statusId: timed.statusId,
          reason: "timed-expired",
        });
        return [];
      }

      return [{ ...timed, remainingTurns }];
    });

    if (expiredTimedIds.size > 0) {
      actor.statusIds = actor.statusIds.filter((statusId) => !expiredTimedIds.has(statusId));
    }

    const timedIds = new Set(runtimeActor.timedStatuses.map((timed) => timed.statusId));
    const turnScopedIds = actor.statusIds.filter((statusId) => {
      if (timedIds.has(statusId)) return false;
      const definition = statusById.get(statusId);
      return definition !== undefined && definition.persistent === false;
    });

    if (turnScopedIds.length > 0) {
      const turnScopedSet = new Set(turnScopedIds);
      actor.statusIds = actor.statusIds.filter((statusId) => !turnScopedSet.has(statusId));
      for (const statusId of turnScopedIds) {
        expiredStatuses.push({
          actorId: actor.actorId,
          statusId,
          reason: "turn-scoped-expired",
        });
      }
    }
  }

  runtime.retreatRequestedTeamIds = [];

  return {
    ok: true,
    combat,
    runtime,
    expiredStatuses,
    clearedShieldActorIds: uniqueStrings(clearedShieldActorIds),
    clearedModifierActorIds: uniqueStrings(clearedModifierActorIds),
    issues: [],
  };
}
