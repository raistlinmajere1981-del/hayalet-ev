import { FATE_KNOTS_MAX_LOG_ENTRIES } from "./constants.js";

function cloneStatus(status) {
  const source = status && typeof status === "object" && Array.isArray(status) === false ? status : {};
  return {
    guard: Number.isFinite(source.guard) ? Number(source.guard) : 0,
    focus: Number.isFinite(source.focus) ? Number(source.focus) : 0,
    counter: Number.isFinite(source.counter) ? Number(source.counter) : 0,
    evasion: Number.isFinite(source.evasion) ? Number(source.evasion) : 0,
    poison: Number.isFinite(source.poison) ? Number(source.poison) : 0,
    stunned: source.stunned === true,
  };
}

function cloneCombatant(candidate) {
  const source = candidate && typeof candidate === "object" && Array.isArray(candidate) === false ? candidate : {};
  return {
    seatId: source.seatId || "unknown",
    nickname: source.nickname || "Unknown",
    classId: source.classId || "",
    backgroundId: source.backgroundId || "",
    maxHp: Number.isFinite(source.maxHp) ? Number(source.maxHp) : 1,
    hp: Number.isFinite(source.hp) ? Number(source.hp) : 1,
    attack: Number.isFinite(source.attack) ? Number(source.attack) : 0,
    defense: Number.isFinite(source.defense) ? Number(source.defense) : 0,
    speed: Number.isFinite(source.speed) ? Number(source.speed) : 0,
    luck: Number.isFinite(source.luck) ? Number(source.luck) : 0,
    maxEnergy: Number.isFinite(source.maxEnergy) ? Number(source.maxEnergy) : 1,
    energy: Number.isFinite(source.energy) ? Number(source.energy) : 0,
    deck: Array.isArray(source.deck) ? source.deck.slice() : [],
    status: cloneStatus(source.status),
  };
}

function cloneEnemy(candidate) {
  const source = candidate && typeof candidate === "object" && Array.isArray(candidate) === false ? candidate : {};
  return {
    id: source.id || "enemy",
    label: source.label || "Enemy",
    assetId: source.assetId || "",
    maxHp: Number.isFinite(source.maxHp) ? Number(source.maxHp) : 1,
    hp: Number.isFinite(source.hp) ? Number(source.hp) : 1,
    attack: Number.isFinite(source.attack) ? Number(source.attack) : 0,
    defense: Number.isFinite(source.defense) ? Number(source.defense) : 0,
    speed: Number.isFinite(source.speed) ? Number(source.speed) : 0,
    luck: Number.isFinite(source.luck) ? Number(source.luck) : 0,
    actionSequence: Array.isArray(source.actionSequence) ? source.actionSequence.slice() : [],
    actionIndex: Number.isFinite(source.actionIndex) ? Number(source.actionIndex) : 0,
    status: cloneStatus(source.status),
  };
}

function pushCombatLog(combat, message) {
  if (typeof message !== "string" || message.trim() === "") {
    return;
  }
  combat.log.push(message.trim());
  if (combat.log.length > FATE_KNOTS_MAX_LOG_ENTRIES) {
    combat.log.splice(0, combat.log.length - FATE_KNOTS_MAX_LOG_ENTRIES);
  }
}

function applyBackgroundBonuses(stats, backgroundId) {
  const next = { ...stats };
  if (backgroundId === "former_soldier") {
    next.maxHp += 2;
  }
  if (backgroundId === "scholar") {
    next.energy += 1;
  }
  if (backgroundId === "traveler") {
    next.speed += 1;
  }
  if (backgroundId === "villager") {
    next.defense += 1;
  }
  return next;
}

function buildTurnOrder(party, enemy) {
  return [
    ...party.map(function (member) {
      return { seatId: member.seatId, side: "party", speed: member.speed };
    }),
    { seatId: "enemy", side: "enemy", speed: enemy.speed },
  ].sort(function (left, right) {
    if (right.speed !== left.speed) {
      return right.speed - left.speed;
    }
    return String(left.seatId).localeCompare(String(right.seatId));
  });
}

export function createFateKnotsCombatState(options) {
  const participants = Array.isArray(options.participants) ? options.participants : [];
  const encounter = options.encounter || {};
  const classesById = options.classesById || new Map();
  const startingEnergy = Number.isFinite(options.startingEnergy) ? Number(options.startingEnergy) : 3;

  const party = participants.map(function (participant) {
    const classDef = classesById.get(participant.selection.classId) || { stats: {}, startingDeck: [] };
    const boostedStats = applyBackgroundBonuses(
      {
        maxHp: Number.isFinite(classDef.stats?.maxHp) ? Number(classDef.stats.maxHp) : 16,
        attack: Number.isFinite(classDef.stats?.attack) ? Number(classDef.stats.attack) : 3,
        defense: Number.isFinite(classDef.stats?.defense) ? Number(classDef.stats.defense) : 1,
        speed: Number.isFinite(classDef.stats?.speed) ? Number(classDef.stats.speed) : 2,
        luck: Number.isFinite(classDef.stats?.luck) ? Number(classDef.stats.luck) : 1,
        energy: Number.isFinite(classDef.stats?.energy) ? Number(classDef.stats.energy) : startingEnergy,
      },
      participant.selection.backgroundId
    );

    return {
      seatId: participant.seatId,
      nickname: participant.nickname,
      classId: participant.selection.classId,
      backgroundId: participant.selection.backgroundId,
      maxHp: boostedStats.maxHp,
      hp: boostedStats.maxHp,
      attack: boostedStats.attack,
      defense: boostedStats.defense,
      speed: boostedStats.speed,
      luck: boostedStats.luck,
      maxEnergy: Math.max(1, boostedStats.energy),
      energy: Math.max(1, boostedStats.energy),
      deck: Array.isArray(classDef.startingDeck) ? classDef.startingDeck.slice() : [],
      status: cloneStatus(),
    };
  });

  const enemy = {
    id: encounter.id || "enemy",
    label: encounter.label || "Enemy",
    assetId: encounter.assetId || "",
    maxHp: Number.isFinite(encounter.stats?.maxHp) ? Number(encounter.stats.maxHp) : 20,
    hp: Number.isFinite(encounter.stats?.maxHp) ? Number(encounter.stats.maxHp) : 20,
    attack: Number.isFinite(encounter.stats?.attack) ? Number(encounter.stats.attack) : 4,
    defense: Number.isFinite(encounter.stats?.defense) ? Number(encounter.stats.defense) : 1,
    speed: Number.isFinite(encounter.stats?.speed) ? Number(encounter.stats.speed) : 2,
    luck: Number.isFinite(encounter.stats?.luck) ? Number(encounter.stats.luck) : 1,
    actionSequence: Array.isArray(encounter.actionSequence) ? encounter.actionSequence.slice() : [],
    actionIndex: 0,
    status: cloneStatus(),
  };

  const combat = {
    encounterId: enemy.id,
    round: 1,
    turnOrder: buildTurnOrder(party, enemy),
    activeTurnIndex: 0,
    party,
    enemy,
    log: [],
    outcome: "pending",
  };

  if (typeof encounter.introLog === "string" && encounter.introLog.trim() !== "") {
    pushCombatLog(combat, encounter.introLog.trim());
  }

  return combat;
}

export function cloneFateKnotsCombatState(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }
  return {
    encounterId: candidate.encounterId || "enemy",
    round: Number.isFinite(candidate.round) ? Number(candidate.round) : 1,
    turnOrder: Array.isArray(candidate.turnOrder)
      ? candidate.turnOrder.map(function (turn) {
          return {
            seatId: turn?.seatId || "unknown",
            side: turn?.side === "enemy" ? "enemy" : "party",
            speed: Number.isFinite(turn?.speed) ? Number(turn.speed) : 0,
          };
        })
      : [],
    activeTurnIndex: Number.isFinite(candidate.activeTurnIndex) ? Number(candidate.activeTurnIndex) : 0,
    party: Array.isArray(candidate.party) ? candidate.party.map(cloneCombatant) : [],
    enemy: cloneEnemy(candidate.enemy),
    log: Array.isArray(candidate.log) ? candidate.log.filter(Boolean).map(String).slice(-FATE_KNOTS_MAX_LOG_ENTRIES) : [],
    outcome: candidate.outcome || "pending",
  };
}

function getLivingPartyMembers(combat) {
  return combat.party.filter(function (member) {
    return member.hp > 0;
  });
}

function findCombatant(combat, seatId) {
  return combat.party.find(function (member) {
    return member.seatId === seatId;
  }) || null;
}

function applyTurnStartEffects(target, combat, label) {
  if (target.hp <= 0) {
    return;
  }
  if (target.status.poison > 0) {
    const damage = Math.max(1, target.status.poison);
    target.hp = Math.max(0, target.hp - damage);
    pushCombatLog(combat, `${label} suffers ${damage} poison damage.`);
  }
}

function applyDamage(target, amount) {
  if (target.status.evasion > 0) {
    target.status.evasion -= 1;
    return {
      applied: 0,
      absorbed: 0,
      evaded: true,
    };
  }

  let remaining = Math.max(0, Math.trunc(amount));
  const absorbed = Math.min(remaining, target.status.guard);
  target.status.guard -= absorbed;
  remaining -= absorbed;
  target.hp = Math.max(0, target.hp - remaining);
  return {
    applied: remaining,
    absorbed,
    evaded: false,
  };
}

function resolveCounter(attacker, defender, combat) {
  if (defender.status.counter > 0 && attacker.hp > 0) {
    const counterDamage = defender.status.counter;
    defender.status.counter = 0;
    attacker.hp = Math.max(0, attacker.hp - counterDamage);
    pushCombatLog(combat, `${defender.nickname || defender.label} counters for ${counterDamage} damage.`);
  }
}

function setCombatOutcome(combat, outcome, message) {
  combat.outcome = outcome;
  if (message) {
    pushCombatLog(combat, message);
  }
}

function refreshCombatOutcome(combat) {
  if (combat.enemy.hp <= 0) {
    setCombatOutcome(combat, "victory", `${combat.enemy.label} falls back into the dark.`);
    return combat.outcome;
  }
  if (getLivingPartyMembers(combat).length === 0) {
    setCombatOutcome(combat, "defeat", `The party can no longer hold the square.`);
    return combat.outcome;
  }
  combat.outcome = "pending";
  return combat.outcome;
}

export function getCurrentFateKnotsCombatTurn(combat) {
  if (!combat || combat.outcome !== "pending" || !Array.isArray(combat.turnOrder) || combat.turnOrder.length === 0) {
    return null;
  }
  return combat.turnOrder[combat.activeTurnIndex] || null;
}

function advanceCombatTurn(combat) {
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

function buildEnemyAction(combat, enemyActionsById) {
  const enemy = combat.enemy;
  const actionId = enemy.actionSequence[enemy.actionIndex % Math.max(enemy.actionSequence.length, 1)] || "lash";
  const action = enemyActionsById.get(actionId) || { id: actionId, label: actionId, power: enemy.attack, stun: false };
  enemy.actionIndex += 1;
  return action;
}

export function getAvailableFateKnotsCombatActions(combat, seatId, cardsById) {
  const actor = findCombatant(combat, seatId);
  if (!actor || actor.hp <= 0) {
    return [];
  }
  return actor.deck
    .map(function (cardId) {
      return cardsById.get(cardId) || null;
    })
    .filter(Boolean)
    .map(function (card) {
      return {
        ...card,
        available: actor.energy >= card.cost,
      };
    });
}

export function applyFateKnotsCombatAction(combat, seatId, actionId, cardsById) {
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
      pushCombatLog(combat, `${actor.nickname} uses ${card.label} for ${damageResult.applied} damage.`);
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

export function settleAutomaticFateKnotsCombatTurns(combat, enemyActionsById) {
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

    const target = getLivingPartyMembers(combat).sort(function (left, right) {
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
      pushCombatLog(combat, `${combat.enemy.label} uses ${action.label} on ${target.nickname} for ${damageResult.applied} damage.`);
    }
    if (action.stun === true && target.hp > 0) {
      target.status.stunned = true;
      pushCombatLog(combat, `${target.nickname} is stunned.`);
    }
    resolveCounter(combat.enemy, target, combat);
    refreshCombatOutcome(combat);
    if (combat.outcome === "pending") {
      advanceCombatTurn(combat);
    }
  }

  return combat;
}

export function buildFateKnotsCombatTurnId(combat) {
  const turn = getCurrentFateKnotsCombatTurn(combat);
  if (!turn) {
    return null;
  }
  return `${combat.encounterId}:${combat.round}:${combat.activeTurnIndex}:${turn.seatId}`;
}
