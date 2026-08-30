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
    /**
     * V1 recovery floor for a party actor that was fallen when combat ended in
     * party victory. Defaults to 1 HP and may be tuned explicitly later.
     */
    fallenRecoveryHp: number;
    /**
     * V1 deliberately does not invent a generic injury automatically. Lasting
     * injuries remain explicit card/status content so their removal/effects are
     * visible in canon instead of becoming a hidden second health model.
     */
    fallenInjuryCardCount: 0;
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
 * Stable rebuild defaults contain only rules intentionally locked in the design
 * contract. V1 party-victory recovery is intentionally severe and simple:
 * fallen party actors stand back up at 1 HP; max HP is not silently reduced.
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
    fallenRecoveryHp: 1,
    fallenInjuryCardCount: 0,
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

function readPositiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

/**
 * Normalizes persisted/external configuration without broadening the design
 * contract. Locked booleans and the V1 zero automatic-injury rule remain
 * locked; only explicitly configurable numeric values are accepted.
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
      fallenRecoveryHp: readPositiveInteger(
        combat["fallenRecoveryHp"],
        DEFAULT_FATE_KNOTS_RULES.combat.fallenRecoveryHp
      ),
      fallenInjuryCardCount: 0,
    },
  };
}

export function hasResolvedFallenRecoveryRules(config: FateKnotsRulesConfig): boolean {
  return config.combat.fallenRecoveryHp > 0 && config.combat.fallenInjuryCardCount === 0;
}
