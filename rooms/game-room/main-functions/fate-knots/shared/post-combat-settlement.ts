import type { FateKnotsActorState, FateKnotsCombatState } from "./contracts.js";
import type { FateKnotsRulesConfig } from "../rules/config.js";

export type FateKnotsPostCombatSettlementIssueCode =
  | "combat-not-party-victory"
  | "invalid-recovery-hp";

export interface FateKnotsPostCombatSettlementIssue {
  code: FateKnotsPostCombatSettlementIssueCode;
}

export interface FateKnotsPostCombatSettlementResult {
  ok: boolean;
  combat: FateKnotsCombatState;
  recoveredActorIds: string[];
  issues: FateKnotsPostCombatSettlementIssue[];
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

/**
 * Settles the deliberately small V1 survival rule after party victory.
 *
 * - standing party actors keep the exact HP they finished combat with
 * - party actors that were fallen return at the configured low recovery HP
 * - recovered actors are no longer `fallen`
 * - canonical max HP is not silently reduced
 * - opposition state is left untouched
 * - no generic injury is invented by the engine
 *
 * Lasting wounds remain explicit injury/status content. This avoids creating a
 * second hidden max-HP restoration system while preserving a severe cost for
 * reaching zero HP.
 */
export function settleFateKnotsPartyVictory(
  combatInput: FateKnotsCombatState,
  rules: FateKnotsRulesConfig
): FateKnotsPostCombatSettlementResult {
  const combat = cloneCombat(combatInput);

  if (combat.result !== "party-victory") {
    return {
      ok: false,
      combat,
      recoveredActorIds: [],
      issues: [{ code: "combat-not-party-victory" }],
    };
  }

  if (!Number.isInteger(rules.combat.fallenRecoveryHp) || rules.combat.fallenRecoveryHp <= 0) {
    return {
      ok: false,
      combat,
      recoveredActorIds: [],
      issues: [{ code: "invalid-recovery-hp" }],
    };
  }

  const recoveredActorIds: string[] = [];

  for (const actor of combat.actors) {
    if (actor.teamId !== "party" || actor.fallen === false) continue;

    actor.hp = Math.min(Math.max(actor.maxHp, 1), rules.combat.fallenRecoveryHp);
    actor.fallen = false;
    recoveredActorIds.push(actor.actorId);
  }

  return {
    ok: true,
    combat,
    recoveredActorIds,
    issues: [],
  };
}
