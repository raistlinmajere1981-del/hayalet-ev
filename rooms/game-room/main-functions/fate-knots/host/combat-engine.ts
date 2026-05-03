export { cloneFateKnotsCombatState, createFateKnotsCombatState } from "./combat-state.js";
export type {
  FateKnotsCombatState,
  FateKnotsCombatant,
  FateKnotsEnemy,
  FateKnotsCombatStatus,
  FateKnotsTurnEntry,
} from "./combat-state.js";
export {
  applyFateKnotsCombatAction,
  buildFateKnotsCombatTurnId,
  getAvailableFateKnotsCombatActions,
  getCurrentFateKnotsCombatTurn,
  settleAutomaticFateKnotsCombatTurns,
} from "./combat-turns.js";
export type { FateKnotsCombatCard, FateKnotsEnemyAction } from "./combat-turns.js";
