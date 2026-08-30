import type {
  FateKnotsCombatState,
  FateKnotsTeamId,
} from "./contracts.js";
import type { FateKnotsCombatRuntimeState } from "./combat-runtime.js";

export type FateKnotsCombatTerminalIssueCode =
  | "combat-not-active"
  | "missing-party"
  | "missing-opposition"
  | "simultaneous-party-and-opposition-fall"
  | "multiple-retreat-teams"
  | "retreat-conflicts-with-fall-result";

export interface FateKnotsCombatTerminalIssue {
  code: FateKnotsCombatTerminalIssueCode;
}

export interface FateKnotsCombatTerminalEvaluation {
  ok: boolean;
  terminal: boolean;
  state: FateKnotsCombatState;
  result: "active" | "party-victory" | "party-defeat" | "retreat";
  retreatingTeamId?: FateKnotsTeamId;
  issues: FateKnotsCombatTerminalIssue[];
}

function cloneCombat(state: FateKnotsCombatState): FateKnotsCombatState {
  return {
    ...state,
    config: { ...state.config },
    actors: state.actors.map((actor) => ({
      ...actor,
      position: { ...actor.position },
      ownedCardIds: actor.ownedCardIds.slice(),
      availableCardIds: actor.availableCardIds.slice(),
      equipmentIds: actor.equipmentIds.slice(),
      statusIds: actor.statusIds.slice(),
      injuryIds: actor.injuryIds.slice(),
    })),
    commits: state.commits.map((commit) => ({ ...commit })),
  };
}

function allFallen(state: FateKnotsCombatState, teamId: FateKnotsTeamId): boolean {
  const actors = state.actors.filter((actor) => actor.teamId === teamId);
  return actors.length > 0 && actors.every((actor) => actor.fallen);
}

function teamCount(state: FateKnotsCombatState, teamId: FateKnotsTeamId): number {
  return state.actors.filter((actor) => actor.teamId === teamId).length;
}

function uniqueTeams(values: readonly FateKnotsTeamId[]): FateKnotsTeamId[] {
  return Array.from(new Set(values));
}

/**
 * Evaluates only terminal facts that are already explicit in canonical combat
 * state/runtime. It does not resolve cards, choose initiative, decide whether a
 * retreat card was legal, or invent a draw/mutual-destruction rule.
 *
 * Ambiguous terminal combinations are deliberately rejected instead of silently
 * choosing a winner. This keeps future balancing/design decisions out of the
 * renderer and local Codex work.
 */
export function evaluateFateKnotsCombatTerminalState(
  state: FateKnotsCombatState,
  runtime: FateKnotsCombatRuntimeState
): FateKnotsCombatTerminalEvaluation {
  const next = cloneCombat(state);
  const issues: FateKnotsCombatTerminalIssue[] = [];

  if (state.result !== "active") {
    return {
      ok: false,
      terminal: true,
      state: next,
      result: state.result,
      issues: [{ code: "combat-not-active" }],
    };
  }

  if (teamCount(state, "party") === 0) issues.push({ code: "missing-party" });
  if (teamCount(state, "opposition") === 0) issues.push({ code: "missing-opposition" });
  if (issues.length > 0) {
    return { ok: false, terminal: false, state: next, result: "active", issues };
  }

  const partyFallen = allFallen(state, "party");
  const oppositionFallen = allFallen(state, "opposition");
  const retreatTeams = uniqueTeams(runtime.retreatRequestedTeamIds);

  if (partyFallen && oppositionFallen) {
    issues.push({ code: "simultaneous-party-and-opposition-fall" });
  }
  if (retreatTeams.length > 1) {
    issues.push({ code: "multiple-retreat-teams" });
  }
  if (retreatTeams.length === 1 && (partyFallen || oppositionFallen)) {
    issues.push({ code: "retreat-conflicts-with-fall-result" });
  }

  if (issues.length > 0) {
    return { ok: false, terminal: false, state: next, result: "active", issues };
  }

  if (partyFallen) {
    next.result = "party-defeat";
    return {
      ok: true,
      terminal: true,
      state: next,
      result: "party-defeat",
      issues: [],
    };
  }

  if (oppositionFallen) {
    next.result = "party-victory";
    return {
      ok: true,
      terminal: true,
      state: next,
      result: "party-victory",
      issues: [],
    };
  }

  const retreatingTeamId = retreatTeams[0];
  if (retreatingTeamId !== undefined) {
    next.result = "retreat";
    return {
      ok: true,
      terminal: true,
      state: next,
      result: "retreat",
      retreatingTeamId,
      issues: [],
    };
  }

  return {
    ok: true,
    terminal: false,
    state: next,
    result: "active",
    issues: [],
  };
}
