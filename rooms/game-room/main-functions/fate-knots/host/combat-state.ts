import { FATE_KNOTS_MAX_LOG_ENTRIES } from "./constants.js";

export interface FateKnotsCombatStatus {
  guard: number;
  focus: number;
  counter: number;
  evasion: number;
  poison: number;
  stunned: boolean;
}

export interface FateKnotsCombatant {
  seatId: string;
  nickname: string;
  classId: string;
  backgroundId: string;
  maxHp: number;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  luck: number;
  maxEnergy: number;
  energy: number;
  deck: string[];
  status: FateKnotsCombatStatus;
}

export interface FateKnotsEnemy {
  id: string;
  label: string;
  assetId: string;
  maxHp: number;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  luck: number;
  actionSequence: string[];
  actionIndex: number;
  status: FateKnotsCombatStatus;
}

export interface FateKnotsTurnEntry {
  seatId: string;
  side: string;
  speed: number;
}

export interface FateKnotsCombatState {
  encounterId: string;
  round: number;
  turnOrder: FateKnotsTurnEntry[];
  activeTurnIndex: number;
  party: FateKnotsCombatant[];
  enemy: FateKnotsEnemy;
  log: string[];
  outcome: string;
}

interface FateKnotsStatusRecord extends Record<string, unknown> {
  guard?: unknown;
  focus?: unknown;
  counter?: unknown;
  evasion?: unknown;
  poison?: unknown;
  stunned?: unknown;
}

interface FateKnotsCombatantRecord extends Record<string, unknown> {
  seatId?: unknown;
  nickname?: unknown;
  classId?: unknown;
  backgroundId?: unknown;
  maxHp?: unknown;
  hp?: unknown;
  attack?: unknown;
  defense?: unknown;
  speed?: unknown;
  luck?: unknown;
  maxEnergy?: unknown;
  energy?: unknown;
  deck?: unknown;
  status?: FateKnotsStatusRecord | null;
}

interface FateKnotsEnemyRecord extends Record<string, unknown> {
  id?: unknown;
  label?: unknown;
  assetId?: unknown;
  maxHp?: unknown;
  hp?: unknown;
  attack?: unknown;
  defense?: unknown;
  speed?: unknown;
  luck?: unknown;
  actionSequence?: unknown;
  actionIndex?: unknown;
  status?: FateKnotsStatusRecord | null;
}

interface FateKnotsEncounterStatsRecord extends Record<string, unknown> {
  maxHp?: unknown;
  attack?: unknown;
  defense?: unknown;
  speed?: unknown;
  luck?: unknown;
}

interface FateKnotsEncounterRecord extends Record<string, unknown> {
  id?: unknown;
  label?: unknown;
  assetId?: unknown;
  stats?: FateKnotsEncounterStatsRecord;
  actionSequence?: unknown;
  introLog?: unknown;
}

interface FateKnotsCombatStateRecord extends Record<string, unknown> {
  encounterId?: unknown;
  round?: unknown;
  turnOrder?: unknown;
  activeTurnIndex?: unknown;
  party?: unknown;
  enemy?: unknown;
  log?: unknown;
  outcome?: unknown;
}

type FateKnotsClassStatsRecord = Record<string, unknown> & {
  maxHp?: unknown;
  attack?: unknown;
  defense?: unknown;
  speed?: unknown;
  luck?: unknown;
  energy?: unknown;
};

type FateKnotsClassDefinition = {
  stats: FateKnotsClassStatsRecord;
  startingDeck: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}

function cloneStatus(status: FateKnotsStatusRecord | null = null) {
  const source = isRecord(status) ? status : {};
  return {
    guard: Number.isFinite(source.guard) ? Number(source.guard) : 0,
    focus: Number.isFinite(source.focus) ? Number(source.focus) : 0,
    counter: Number.isFinite(source.counter) ? Number(source.counter) : 0,
    evasion: Number.isFinite(source.evasion) ? Number(source.evasion) : 0,
    poison: Number.isFinite(source.poison) ? Number(source.poison) : 0,
    stunned: source.stunned === true,
  };
}

function cloneCombatant(candidate: unknown): FateKnotsCombatant {
  const source: FateKnotsCombatantRecord = isRecord(candidate) ? candidate : {};
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
    status: cloneStatus(source.status || null),
  };
}

function cloneEnemy(candidate: unknown): FateKnotsEnemy {
  const source: FateKnotsEnemyRecord = isRecord(candidate) ? candidate : {};
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
    status: cloneStatus(source.status || null),
  };
}

export function pushCombatLog(combat: FateKnotsCombatState, message: unknown): void {
  if (typeof message !== "string" || message.trim() === "") {
    return;
  }
  combat.log.push(message.trim());
  if (combat.log.length > FATE_KNOTS_MAX_LOG_ENTRIES) {
    combat.log.splice(0, combat.log.length - FATE_KNOTS_MAX_LOG_ENTRIES);
  }
}

function applyBackgroundBonuses(
  stats: {
    maxHp: number;
    attack: number;
    defense: number;
    speed: number;
    luck: number;
    energy: number;
  },
  backgroundId: string
) {
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

function buildTurnOrder(party: Array<{ seatId: string; speed: number }>, enemy: { speed: number }) {
  return [
    ...party.map(function (member: { seatId: string; speed: number }) {
      return { seatId: member.seatId, side: "party", speed: member.speed };
    }),
    { seatId: "enemy", side: "enemy", speed: enemy.speed },
  ].sort(function (
    left: { seatId: string | number; speed: number },
    right: { seatId: string | number; speed: number }
  ) {
    if (right.speed !== left.speed) {
      return right.speed - left.speed;
    }
    return String(left.seatId).localeCompare(String(right.seatId));
  });
}

export function createFateKnotsCombatState(options: {
  participants?: Array<{
    seatId: string;
    nickname: string;
    selection: { classId: string; backgroundId: string };
  }>;
  encounter?: Record<string, unknown>;
  classesById?: Map<string, { stats: FateKnotsClassStatsRecord; startingDeck: string[] }>;
  startingEnergy?: number;
}): FateKnotsCombatState {
  const participants = Array.isArray(options.participants) ? options.participants : [];
  const encounter: FateKnotsEncounterRecord = isRecord(options.encounter) ? options.encounter : {};
  const classesById =
    options.classesById || new Map<string, FateKnotsClassDefinition>();
  const startingEnergy = Number.isFinite(options.startingEnergy)
    ? Number(options.startingEnergy)
    : 3;

  const party = participants.map(function (participant: {
    seatId: string;
    nickname: string;
    selection: { classId: string; backgroundId: string };
  }) {
    const classDef: FateKnotsClassDefinition = classesById.get(participant.selection.classId) || {
      stats: {},
      startingDeck: [],
    };
    const boostedStats = applyBackgroundBonuses(
      {
        maxHp: Number.isFinite(classDef.stats.maxHp) ? Number(classDef.stats.maxHp) : 16,
        attack: Number.isFinite(classDef.stats.attack) ? Number(classDef.stats.attack) : 3,
        defense: Number.isFinite(classDef.stats.defense) ? Number(classDef.stats.defense) : 1,
        speed: Number.isFinite(classDef.stats.speed) ? Number(classDef.stats.speed) : 2,
        luck: Number.isFinite(classDef.stats.luck) ? Number(classDef.stats.luck) : 1,
        energy: Number.isFinite(classDef.stats.energy)
          ? Number(classDef.stats.energy)
          : startingEnergy,
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

  const enemy: FateKnotsEnemy = {
    id: typeof encounter.id === "string" && encounter.id ? encounter.id : "enemy",
    label: typeof encounter.label === "string" && encounter.label ? encounter.label : "Enemy",
    assetId: typeof encounter.assetId === "string" ? encounter.assetId : "",
    maxHp: Number.isFinite(encounter.stats?.maxHp) ? Number(encounter.stats?.maxHp) : 20,
    hp: Number.isFinite(encounter.stats?.maxHp) ? Number(encounter.stats?.maxHp) : 20,
    attack: Number.isFinite(encounter.stats?.attack) ? Number(encounter.stats?.attack) : 4,
    defense: Number.isFinite(encounter.stats?.defense) ? Number(encounter.stats?.defense) : 1,
    speed: Number.isFinite(encounter.stats?.speed) ? Number(encounter.stats?.speed) : 2,
    luck: Number.isFinite(encounter.stats?.luck) ? Number(encounter.stats?.luck) : 1,
    actionSequence: Array.isArray(encounter.actionSequence)
      ? encounter.actionSequence.map(String)
      : [],
    actionIndex: 0,
    status: cloneStatus(),
  };

  const combat: FateKnotsCombatState = {
    encounterId: enemy.id,
    round: 1,
    turnOrder: buildTurnOrder(party, enemy),
    activeTurnIndex: 0,
    party,
    enemy,
    log: [] as string[],
    outcome: "pending",
  };

  if (typeof encounter.introLog === "string" && encounter.introLog.trim() !== "") {
    pushCombatLog(combat, encounter.introLog.trim());
  }

  return combat;
}

export function cloneFateKnotsCombatState(
  candidate: Record<string, unknown>
): FateKnotsCombatState | null {
  if (typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }
  const source = candidate as FateKnotsCombatStateRecord;
  return {
    encounterId: typeof source.encounterId === "string" ? source.encounterId : "enemy",
    round: Number.isFinite(source.round) ? Number(source.round) : 1,
    turnOrder: Array.isArray(source.turnOrder)
      ? source.turnOrder.map(function (turn: { seatId?: string; side?: string; speed?: number }) {
          return {
            seatId: typeof turn.seatId === "string" ? turn.seatId : "unknown",
            side: turn.side === "enemy" ? "enemy" : "party",
            speed: Number.isFinite(turn.speed) ? Number(turn.speed) : 0,
          };
        })
      : [],
    activeTurnIndex: Number.isFinite(source.activeTurnIndex) ? Number(source.activeTurnIndex) : 0,
    party: Array.isArray(source.party) ? source.party.map(cloneCombatant) : [],
    enemy: cloneEnemy((source.enemy ?? {}) as FateKnotsEnemyRecord),
    log: Array.isArray(source.log)
      ? source.log.filter(Boolean).map(String).slice(-FATE_KNOTS_MAX_LOG_ENTRIES)
      : [],
    outcome: typeof source.outcome === "string" ? source.outcome : "pending",
  };
}

export function getLivingPartyMembers(combat: FateKnotsCombatState): FateKnotsCombatant[] {
  return combat.party.filter(function (member: FateKnotsCombatant) {
    return member.hp > 0;
  });
}

export function findCombatant(
  combat: FateKnotsCombatState,
  seatId: string
): FateKnotsCombatant | null {
  return (
    combat.party.find(function (member: FateKnotsCombatant) {
      return member.seatId === seatId;
    }) || null
  );
}

export function applyTurnStartEffects(
  target: FateKnotsCombatant | FateKnotsEnemy,
  combat: FateKnotsCombatState,
  label: string
): void {
  if (target.hp <= 0) {
    return;
  }
  if (target.status.poison > 0) {
    const damage = Math.max(1, target.status.poison);
    target.hp = Math.max(0, target.hp - damage);
    pushCombatLog(combat, `${label} suffers ${damage} poison damage.`);
  }
}

export function applyDamage(
  target: FateKnotsCombatant | FateKnotsEnemy,
  amount: number
): { applied: number; absorbed: number; evaded: boolean } {
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

export function resolveCounter(
  attacker: FateKnotsCombatant | FateKnotsEnemy,
  defender: FateKnotsCombatant | FateKnotsEnemy,
  combat: FateKnotsCombatState
): void {
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

function setCombatOutcome(combat: FateKnotsCombatState, outcome: string, message: string): void {
  combat.outcome = outcome;
  if (message) {
    pushCombatLog(combat, message);
  }
}

export function refreshCombatOutcome(combat: FateKnotsCombatState): string {
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
