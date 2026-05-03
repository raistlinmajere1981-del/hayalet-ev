import {
  applyDamage,
  applyTurnStartEffects,
  findCombatant,
  getLivingPartyMembers,
  pushCombatLog,
  refreshCombatOutcome,
  resolveCounter,
} from "./combat-state.js";
import type {
  FateKnotsCombatState,
  FateKnotsCombatant,
  FateKnotsTurnEntry,
} from "./combat-state.js";

export interface FateKnotsCombatCard {
  id: string;
  label: string;
  type: string;
  power: number;
  cost: number;
  guard: number;
  counter: number;
  evasion: number;
  focus: number;
  heal: number;
  poison: number;
  stun: boolean;
  selfDamage: number;
}

export interface FateKnotsEnemyAction {
  id: string;
  label: string;
  power: number;
  stun: boolean;
}

export function getCurrentFateKnotsCombatTurn(
  combat: FateKnotsCombatState
): FateKnotsTurnEntry | null {
  if (combat.outcome !== "pending" || combat.turnOrder.length === 0) {
    return null;
  }
  return combat.turnOrder[combat.activeTurnIndex] ?? null;
}

function advanceCombatTurn(combat: FateKnotsCombatState): FateKnotsTurnEntry | null {
  if (!combat.turnOrder.length) {
    return null;
  }

  let attempts = 0;
  while (attempts < combat.turnOrder.length + 1) {
    const previousIndex = combat.activeTurnIndex;
    combat.activeTurnIndex = (combat.activeTurnIndex + 1) % combat.turnOrder.length;
    if (combat.activeTurnIndex <= previousIndex) {
      combat.round += 1;
    }
    const turn = getCurrentFateKnotsCombatTurn(combat);
    if (!turn) {
      return null;
    }
    if (turn.side === "enemy") {
      if (combat.enemy.hp > 0) {
        return turn;
      }
    } else {
      const actor = findCombatant(combat, turn.seatId);
      if (actor && actor.hp > 0) {
        actor.energy = Math.min(actor.maxEnergy, actor.energy + 1);
        return turn;
      }
    }
    attempts += 1;
  }
  return getCurrentFateKnotsCombatTurn(combat);
}

function buildEnemyAction(
  combat: FateKnotsCombatState,
  enemyActionsById: Map<string, FateKnotsEnemyAction>
): FateKnotsEnemyAction {
  const enemy = combat.enemy;
  const actionId =
    enemy.actionSequence[enemy.actionIndex % Math.max(enemy.actionSequence.length, 1)] || "lash";
  const action = enemyActionsById.get(actionId) || {
    id: actionId,
    label: actionId,
    power: enemy.attack,
    stun: false,
  };
  enemy.actionIndex += 1;
  return action;
}

export function getAvailableFateKnotsCombatActions(
  combat: FateKnotsCombatState,
  seatId: string,
  cardsById: Map<string, FateKnotsCombatCard>
): Array<FateKnotsCombatCard & { available: boolean }> {
  const actor = findCombatant(combat, seatId);
  if (!actor || actor.hp <= 0) {
    return [];
  }
  return actor.deck
    .map(function (cardId: string) {
      return cardsById.get(cardId) ?? null;
    })
    .filter((card): card is FateKnotsCombatCard => card !== null)
    .map(function (card: FateKnotsCombatCard) {
      return {
        ...card,
        available: actor.energy >= card.cost,
      };
    });
}

export function applyFateKnotsCombatAction(
  combat: FateKnotsCombatState,
  seatId: string,
  actionId: string,
  cardsById: Map<string, FateKnotsCombatCard>
): { success: boolean; reason?: string; combat?: FateKnotsCombatState } {
  const turn = getCurrentFateKnotsCombatTurn(combat);
  if (!turn || turn.side !== "party" || turn.seatId !== seatId) {
    return { success: false, reason: "turn-mismatch" };
  }

  const actor = findCombatant(combat, seatId);
  const card = cardsById.get(actionId);
  if (!actor || !card) {
    return { success: false, reason: "invalid-card" };
  }
  if (actor.hp <= 0) {
    return { success: false, reason: "actor-down" };
  }
  if (actor.energy < card.cost) {
    return { success: false, reason: "insufficient-energy" };
  }

  actor.energy -= card.cost;
  applyTurnStartEffects(actor, combat, actor.nickname);
  if (refreshCombatOutcome(combat) !== "pending") {
    return { success: true, combat };
  }

  if (actor.status.stunned === true) {
    actor.status.stunned = false;
    pushCombatLog(combat, `${actor.nickname} loses the turn while stunned.`);
    advanceCombatTurn(combat);
    return { success: true, combat };
  }

  if (card.type === "attack") {
    const focusBonus = actor.status.focus;
    actor.status.focus = 0;
    const rawDamage = Math.max(1, card.power + actor.attack + focusBonus - combat.enemy.defense);
    const damageResult = applyDamage(combat.enemy, rawDamage);
    if (damageResult.evaded) {
      pushCombatLog(combat, `${combat.enemy.label} slips away from ${card.label}.`);
    } else {
      pushCombatLog(
        combat,
        `${actor.nickname} uses ${card.label} for ${damageResult.applied} damage.`
      );
    }
    if (card.poison > 0) {
      combat.enemy.status.poison += card.poison;
      pushCombatLog(combat, `${combat.enemy.label} is poisoned.`);
    }
    if (card.stun === true) {
      combat.enemy.status.stunned = true;
      pushCombatLog(combat, `${combat.enemy.label} is staggered.`);
    }
    if (card.selfDamage > 0) {
      actor.hp = Math.max(0, actor.hp - card.selfDamage);
      pushCombatLog(combat, `${actor.nickname} takes ${card.selfDamage} backlash damage.`);
    }
  } else if (card.type === "defend") {
    actor.status.guard += card.guard;
    actor.status.counter += card.counter;
    actor.status.evasion += card.evasion;
    pushCombatLog(combat, `${actor.nickname} braces with ${card.label}.`);
  } else {
    actor.status.focus += card.focus;
    actor.status.guard += card.guard;
    actor.hp = Math.min(actor.maxHp, actor.hp + card.heal);
    pushCombatLog(combat, `${actor.nickname} uses ${card.label} to stabilize the line.`);
  }

  refreshCombatOutcome(combat);
  if (combat.outcome === "pending") {
    advanceCombatTurn(combat);
  }
  return { success: true, combat };
}

export function settleAutomaticFateKnotsCombatTurns(
  combat: FateKnotsCombatState,
  enemyActionsById: Map<string, FateKnotsEnemyAction>
): FateKnotsCombatState {
  while (combat.outcome === "pending") {
    const turn = getCurrentFateKnotsCombatTurn(combat);
    if (!turn) {
      break;
    }
    if (turn.side !== "enemy") {
      const actor = findCombatant(combat, turn.seatId);
      if (!actor || actor.hp <= 0) {
        advanceCombatTurn(combat);
        continue;
      }
      applyTurnStartEffects(actor, combat, actor.nickname);
      if (refreshCombatOutcome(combat) !== "pending") {
        break;
      }
      if (actor.status.stunned === true) {
        actor.status.stunned = false;
        pushCombatLog(combat, `${actor.nickname} loses the turn while stunned.`);
        advanceCombatTurn(combat);
        continue;
      }
      break;
    }

    applyTurnStartEffects(combat.enemy, combat, combat.enemy.label);
    if (refreshCombatOutcome(combat) !== "pending") {
      break;
    }
    if (combat.enemy.status.stunned === true) {
      combat.enemy.status.stunned = false;
      pushCombatLog(combat, `${combat.enemy.label} is stunned and misses the turn.`);
      advanceCombatTurn(combat);
      continue;
    }

    const target = getLivingPartyMembers(combat).sort(function (
      left: FateKnotsCombatant,
      right: FateKnotsCombatant
    ) {
      if (left.hp !== right.hp) {
        return left.hp - right.hp;
      }
      return left.seatId.localeCompare(right.seatId);
    })[0];
    if (!target) {
      refreshCombatOutcome(combat);
      break;
    }
    const action = buildEnemyAction(combat, enemyActionsById);
    const rawDamage = Math.max(1, action.power + combat.enemy.attack - target.defense);
    const damageResult = applyDamage(target, rawDamage);
    if (damageResult.evaded) {
      pushCombatLog(combat, `${target.nickname} evades ${action.label}.`);
    } else {
      pushCombatLog(
        combat,
        `${combat.enemy.label} uses ${action.label} on ${target.nickname} for ${damageResult.applied} damage.`
      );
    }
    if (action.stun === true && target.hp > 0) {
      target.status.stunned = true;
      pushCombatLog(combat, `${target.nickname} is stunned.`);
    }
    resolveCounter(combat.enemy, target, combat);
    refreshCombatOutcome(combat);
    advanceCombatTurn(combat);
  }

  return combat;
}

export function buildFateKnotsCombatTurnId(combat: FateKnotsCombatState): string | null {
  const turn = getCurrentFateKnotsCombatTurn(combat);
  if (!turn) {
    return null;
  }
  return `${combat.encounterId}:${combat.round}:${combat.activeTurnIndex}:${turn.seatId}`;
}
