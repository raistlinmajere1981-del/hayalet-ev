import { FATE_KNOTS_MAX_LOG_ENTRIES } from "./constants.js";
function isRecord(value) {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}
function cloneStatus(status = null) {
  const source = isRecord(status) ? status : {};
  return {
    guard: Number.isFinite(source.guard) ? Number(source.guard) : 0,
    focus: Number.isFinite(source.focus) ? Number(source.focus) : 0,
    counter: Number.isFinite(source.counter) ? Number(source.counter) : 0,
    evasion: Number.isFinite(source.evasion) ? Number(source.evasion) : 0,
    poison: Number.isFinite(source.poison) ? Number(source.poison) : 0,
    stunned: source.stunned === true
  };
}
function cloneCombatant(candidate) {
  const source = isRecord(candidate) ? candidate : {};
  return {
    seatId: typeof source.seatId === "string" ? source.seatId : "unknown",
    nickname: typeof source.nickname === "string" ? source.nickname : "Unknown",
    classId: typeof source.classId === "string" ? source.classId : "",
    backgroundId: typeof source.backgroundId === "string" ? source.backgroundId : "",
    maxHp: Number.isFinite(source.maxHp) ? Number(source.maxHp) : 1,
    hp: Number.isFinite(source.hp) ? Number(source.hp) : 1,
    attack: Number.isFinite(source.attack) ? Number(source.attack) : 0,
    defense: Number.isFinite(source.defense) ? Number(source.defense) : 0,
    speed: Number.isFinite(source.speed) ? Number(source.speed) : 0,
    luck: Number.isFinite(source.luck) ? Number(source.luck) : 0,
    maxEnergy: Number.isFinite(source.maxEnergy) ? Number(source.maxEnergy) : 1,
    energy: Number.isFinite(source.energy) ? Number(source.energy) : 0,
    deck: Array.isArray(source.deck) ? source.deck.map(String) : [],
    status: cloneStatus(source.status || null)
  };
}
function cloneEnemy(candidate) {
  const source = isRecord(candidate) ? candidate : {};
  return {
    id: typeof source.id === "string" ? source.id : "enemy",
    label: typeof source.label === "string" ? source.label : "Enemy",
    assetId: typeof source.assetId === "string" ? source.assetId : "",
    maxHp: Number.isFinite(source.maxHp) ? Number(source.maxHp) : 1,
    hp: Number.isFinite(source.hp) ? Number(source.hp) : 1,
    attack: Number.isFinite(source.attack) ? Number(source.attack) : 0,
    defense: Number.isFinite(source.defense) ? Number(source.defense) : 0,
    speed: Number.isFinite(source.speed) ? Number(source.speed) : 0,
    luck: Number.isFinite(source.luck) ? Number(source.luck) : 0,
    actionSequence: Array.isArray(source.actionSequence) ? source.actionSequence.map(String) : [],
    actionIndex: Number.isFinite(source.actionIndex) ? Number(source.actionIndex) : 0,
    status: cloneStatus(source.status || null)
  };
}
export function pushCombatLog(combat, message) {
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
    ...party.map(function(member) {
      return { seatId: member.seatId, side: "party", speed: member.speed };
    }),
    { seatId: "enemy", side: "enemy", speed: enemy.speed }
  ].sort(function(left, right) {
    if (right.speed !== left.speed) {
      return right.speed - left.speed;
    }
    return String(left.seatId).localeCompare(String(right.seatId));
  });
}
export function createFateKnotsCombatState(options) {
  const participants = Array.isArray(options.participants) ? options.participants : [];
  const encounter = isRecord(options.encounter) ? options.encounter : {};
  const classesById = options.classesById || /* @__PURE__ */ new Map();
  const startingEnergy = Number.isFinite(options.startingEnergy) ? Number(options.startingEnergy) : 3;
  const party = participants.map(function(participant) {
    const classDef = classesById.get(participant.selection.classId) || {
      stats: {},
      startingDeck: []
    };
    const boostedStats = applyBackgroundBonuses(
      {
        maxHp: Number.isFinite(classDef.stats.maxHp) ? Number(classDef.stats.maxHp) : 16,
        attack: Number.isFinite(classDef.stats.attack) ? Number(classDef.stats.attack) : 3,
        defense: Number.isFinite(classDef.stats.defense) ? Number(classDef.stats.defense) : 1,
        speed: Number.isFinite(classDef.stats.speed) ? Number(classDef.stats.speed) : 2,
        luck: Number.isFinite(classDef.stats.luck) ? Number(classDef.stats.luck) : 1,
        energy: Number.isFinite(classDef.stats.energy) ? Number(classDef.stats.energy) : startingEnergy
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
      status: cloneStatus()
    };
  });
  const enemy = {
    id: typeof encounter.id === "string" && encounter.id ? encounter.id : "enemy",
    label: typeof encounter.label === "string" && encounter.label ? encounter.label : "Enemy",
    assetId: typeof encounter.assetId === "string" ? encounter.assetId : "",
    maxHp: Number.isFinite(encounter.stats?.maxHp) ? Number(encounter.stats?.maxHp) : 20,
    hp: Number.isFinite(encounter.stats?.maxHp) ? Number(encounter.stats?.maxHp) : 20,
    attack: Number.isFinite(encounter.stats?.attack) ? Number(encounter.stats?.attack) : 4,
    defense: Number.isFinite(encounter.stats?.defense) ? Number(encounter.stats?.defense) : 1,
    speed: Number.isFinite(encounter.stats?.speed) ? Number(encounter.stats?.speed) : 2,
    luck: Number.isFinite(encounter.stats?.luck) ? Number(encounter.stats?.luck) : 1,
    actionSequence: Array.isArray(encounter.actionSequence) ? encounter.actionSequence.map(String) : [],
    actionIndex: 0,
    status: cloneStatus()
  };
  const combat = {
    encounterId: enemy.id,
    round: 1,
    turnOrder: buildTurnOrder(party, enemy),
    activeTurnIndex: 0,
    party,
    enemy,
    log: [],
    outcome: "pending"
  };
  if (typeof encounter.introLog === "string" && encounter.introLog.trim() !== "") {
    pushCombatLog(combat, encounter.introLog.trim());
  }
  return combat;
}
export function cloneFateKnotsCombatState(candidate) {
  if (typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }
  const source = candidate;
  return {
    encounterId: typeof source.encounterId === "string" ? source.encounterId : "enemy",
    round: Number.isFinite(source.round) ? Number(source.round) : 1,
    turnOrder: Array.isArray(source.turnOrder) ? source.turnOrder.map(function(turn) {
      return {
        seatId: typeof turn.seatId === "string" ? turn.seatId : "unknown",
        side: turn.side === "enemy" ? "enemy" : "party",
        speed: Number.isFinite(turn.speed) ? Number(turn.speed) : 0
      };
    }) : [],
    activeTurnIndex: Number.isFinite(source.activeTurnIndex) ? Number(source.activeTurnIndex) : 0,
    party: Array.isArray(source.party) ? source.party.map(cloneCombatant) : [],
    enemy: cloneEnemy(source.enemy ?? {}),
    log: Array.isArray(source.log) ? source.log.filter(Boolean).map(String).slice(-FATE_KNOTS_MAX_LOG_ENTRIES) : [],
    outcome: typeof source.outcome === "string" ? source.outcome : "pending"
  };
}
export function getLivingPartyMembers(combat) {
  return combat.party.filter(function(member) {
    return member.hp > 0;
  });
}
export function findCombatant(combat, seatId) {
  return combat.party.find(function(member) {
    return member.seatId === seatId;
  }) || null;
}
export function applyTurnStartEffects(target, combat, label) {
  if (target.hp <= 0) {
    return;
  }
  if (target.status.poison > 0) {
    const damage = Math.max(1, target.status.poison);
    target.hp = Math.max(0, target.hp - damage);
    pushCombatLog(combat, `${label} suffers ${damage} poison damage.`);
  }
}
export function applyDamage(target, amount) {
  if (target.status.evasion > 0) {
    target.status.evasion -= 1;
    return {
      applied: 0,
      absorbed: 0,
      evaded: true
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
    evaded: false
  };
}
export function resolveCounter(attacker, defender, combat) {
  if (defender.status.counter > 0 && attacker.hp > 0) {
    const counterDamage = defender.status.counter;
    defender.status.counter = 0;
    attacker.hp = Math.max(0, attacker.hp - counterDamage);
    pushCombatLog(
      combat,
      `${"nickname" in defender ? defender.nickname : defender.label} counters for ${counterDamage} damage.`
    );
  }
}
function setCombatOutcome(combat, outcome, message) {
  combat.outcome = outcome;
  if (message) {
    pushCombatLog(combat, message);
  }
}
export function refreshCombatOutcome(combat) {
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
