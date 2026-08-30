import type { FateKnotsCombatTurnConfig } from "../shared/contracts.js";

export const FATE_KNOTS_RULES_SCHEMA_VERSION = 1;

export interface FateKnotsRulesConfig {
  schemaVersion: number;
  deterministic: true;
  combat: {
    turn: FateKnotsCombatTurnConfig;
    fallenAtZeroHp: true;
    partyDefeatEndsRun: true;
    retreatRequiresCardOrRule: true;
    fallenRecoveryHp: number | null;
    fallenInjuryCardCount: number | null;
  };
  cards: {
    requirementSetMode: "all";
    emptyRequirementsAreLegal: true;
    fallenActorsCannotUseNormalCards: true;
  };
  position: {
    rows: readonly ["front", "rear"];
    ranges: readonly ["engaged", "near", "far"];
    coordinateGridEnabled: false;
  };
}

/**
 * Stable rebuild defaults only contain rules that were explicitly locked in the
 * design contract. Balancing values that remain undecided intentionally stay
 * null so a renderer or local implementation cannot silently invent them.
 */
export const DEFAULT_FATE_KNOTS_RULES: FateKnotsRulesConfig = {
  schemaVersion: FATE_KNOTS_RULES_SCHEMA_VERSION,
  deterministic: true,
  combat: {
    turn: {
      maxMovementCards: 1,
      maxActionCards: 1,
    },
    fallenAtZeroHp: true,
    partyDefeatEndsRun: true,
    retreatRequiresCardOrRule: true,
    fallenRecoveryHp: null,
    fallenInjuryCardCount: null,
  },
  cards: {
    requirementSetMode: "all",
    emptyRequirementsAreLegal: true,
    fallenActorsCannotUseNormalCards: true,
  },
  position: {
    rows: ["front", "rear"],
    ranges: ["engaged", "near", "far"],
    coordinateGridEnabled: false,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}

function readNonNegativeInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : fallback;
}

function readNullablePositiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

/**
 * Normalizes persisted/external configuration without broadening the design
 * contract. Locked booleans remain locked; only explicitly configurable numeric
 * values are accepted from outside.
 */
export function normalizeFateKnotsRules(candidate: unknown): FateKnotsRulesConfig {
  const source = isRecord(candidate) ? candidate : {};
  const combat = isRecord(source["combat"]) ? source["combat"] : {};
  const turn = isRecord(combat["turn"]) ? combat["turn"] : {};

  return {
    ...DEFAULT_FATE_KNOTS_RULES,
    combat: {
      ...DEFAULT_FATE_KNOTS_RULES.combat,
      turn: {
        maxMovementCards: readNonNegativeInteger(
          turn["maxMovementCards"],
          DEFAULT_FATE_KNOTS_RULES.combat.turn.maxMovementCards
        ),
        maxActionCards: readNonNegativeInteger(
          turn["maxActionCards"],
          DEFAULT_FATE_KNOTS_RULES.combat.turn.maxActionCards
        ),
      },
      fallenRecoveryHp: readNullablePositiveInteger(combat["fallenRecoveryHp"]),
      fallenInjuryCardCount: readNullablePositiveInteger(combat["fallenInjuryCardCount"]),
    },
  };
}

export function hasResolvedFallenRecoveryRules(config: FateKnotsRulesConfig): boolean {
  return config.combat.fallenRecoveryHp !== null && config.combat.fallenInjuryCardCount !== null;
}
