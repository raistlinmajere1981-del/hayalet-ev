import type {
  FateKnotsEncounterDefinition,
  FateKnotsRunState,
  FateKnotsStoryKnotDefinition,
  FateKnotsStoryProgressionPatch,
  FateKnotsStoryRequirement,
  FateKnotsStoryTransitionDefinition,
  FateKnotsUniversePackage,
} from "./contracts.js";

export type FateKnotsStoryProgressionIssueCode =
  | "universe-mismatch"
  | "run-not-active"
  | "active-combat-exists"
  | "story-transition-pending"
  | "story-not-initialized"
  | "active-knot-not-found"
  | "transition-not-found"
  | "transition-not-legal"
  | "transition-settle-not-allowed"
  | "encounter-not-found"
  | "combat-transition-required"
  | "combat-outcome-not-terminal";

export interface FateKnotsStoryProgressionIssue {
  code: FateKnotsStoryProgressionIssueCode;
  transitionId?: string;
  encounterId?: string;
  knotId?: string;
}

export interface FateKnotsStoryTransitionView {
  id: string;
  label: string;
  kind: FateKnotsStoryTransitionDefinition["kind"];
}

export interface FateKnotsStoryView {
  activeKnotId: string | null;
  visibleFacts: string[];
  availableTransitions: FateKnotsStoryTransitionView[];
  finaleUnlocked: boolean;
}

export interface FateKnotsStoryMutationResult {
  ok: boolean;
  run: FateKnotsRunState;
  issues: FateKnotsStoryProgressionIssue[];
}

export interface FateKnotsStoryTransitionResult extends FateKnotsStoryMutationResult {
  transition: FateKnotsStoryTransitionDefinition | null;
  encounter: FateKnotsEncounterDefinition | null;
}

export interface FateKnotsStoryCombatOutcomeResult extends FateKnotsStoryMutationResult {
  nextPhase: "exploration" | "loot" | "finale" | null;
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function cloneRun(run: FateKnotsRunState): FateKnotsRunState {
  return structuredClone(run);
}

function fail(
  run: FateKnotsRunState,
  issue: FateKnotsStoryProgressionIssue
): FateKnotsStoryMutationResult {
  return { ok: false, run: cloneRun(run), issues: [issue] };
}

function getKnot(
  universe: FateKnotsUniversePackage,
  knotId: string | null
): FateKnotsStoryKnotDefinition | null {
  if (!knotId) return null;
  return universe.story.knots.find((knot) => knot.id === knotId) ?? null;
}

function getTransition(
  universe: FateKnotsUniversePackage,
  transitionId: string
): FateKnotsStoryTransitionDefinition | null {
  return universe.story.transitions.find((transition) => transition.id === transitionId) ?? null;
}

function getEncounter(
  universe: FateKnotsUniversePackage,
  encounterId: string | null | undefined
): FateKnotsEncounterDefinition | null {
  if (!encounterId) return null;
  return universe.story.encounters.find((encounter) => encounter.id === encounterId) ?? null;
}

function partyOwnedCardIds(run: FateKnotsRunState): Set<string> {
  const partyIds = new Set(run.partyActorIds);
  return new Set(
    run.actors
      .filter((actor) => partyIds.has(actor.actorId))
      .flatMap((actor) => actor.ownedCardIds)
  );
}

function requirementsMet(
  requirement: FateKnotsStoryRequirement | undefined,
  run: FateKnotsRunState
): boolean {
  if (!requirement) return true;
  const completed = new Set(run.completedKnotIds);
  const revealed = new Set(run.revealedKnotIds);
  const ownedCards = partyOwnedCardIds(run);
  return (
    (requirement.completedKnotIds ?? []).every((id) => completed.has(id)) &&
    (requirement.revealedKnotIds ?? []).every((id) => revealed.has(id)) &&
    (requirement.ownedCardIds ?? []).every((id) => ownedCards.has(id))
  );
}

export function computeFateKnotsFinaleUnlocked(
  universe: FateKnotsUniversePackage,
  run: FateKnotsRunState
): boolean {
  const completed = new Set(run.completedKnotIds);
  const ownedCards = partyOwnedCardIds(run);
  return (
    universe.finale.requiredKnotIds.every((id) => completed.has(id)) &&
    (universe.finale.requiredItemIds ?? []).every((id) => ownedCards.has(id))
  );
}

function refreshFinaleUnlock(universe: FateKnotsUniversePackage, run: FateKnotsRunState): void {
  run.finaleUnlocked = computeFateKnotsFinaleUnlocked(universe, run);
}

function applyPatch(
  universe: FateKnotsUniversePackage,
  run: FateKnotsRunState,
  patch: FateKnotsStoryProgressionPatch | undefined
): void {
  if (!patch) {
    refreshFinaleUnlock(universe, run);
    return;
  }
  if (patch.revealKnotIds) {
    run.revealedKnotIds = unique([...run.revealedKnotIds, ...patch.revealKnotIds]);
  }
  if (patch.completeKnotIds) {
    run.completedKnotIds = unique([...run.completedKnotIds, ...patch.completeKnotIds]);
    run.revealedKnotIds = unique([...run.revealedKnotIds, ...patch.completeKnotIds]);
  }
  if (patch.revealLocationIds) {
    run.revealedLocationIds = unique([...run.revealedLocationIds, ...patch.revealLocationIds]);
  }
  refreshFinaleUnlock(universe, run);
}

function applyDestination(
  universe: FateKnotsUniversePackage,
  run: FateKnotsRunState,
  transition: FateKnotsStoryTransitionDefinition,
  encounter: FateKnotsEncounterDefinition | null
): void {
  const targetKnot = getKnot(universe, transition.toKnotId ?? null);
  if (targetKnot) {
    run.activeKnotId = targetKnot.id;
    run.revealedKnotIds = unique([...run.revealedKnotIds, targetKnot.id]);
  }

  const targetLocationId =
    transition.toLocationId ?? targetKnot?.locationId ?? encounter?.locationId ?? null;
  if (targetLocationId) {
    run.activeLocationId = targetLocationId;
    run.revealedLocationIds = unique([...run.revealedLocationIds, targetLocationId]);
  }
}

function restoreSourceDestination(
  universe: FateKnotsUniversePackage,
  run: FateKnotsRunState,
  transition: FateKnotsStoryTransitionDefinition
): void {
  const sourceKnot = getKnot(universe, transition.fromKnotId);
  if (!sourceKnot) return;
  run.activeKnotId = sourceKnot.id;
  run.activeLocationId = sourceKnot.locationId;
  run.revealedKnotIds = unique([...run.revealedKnotIds, sourceKnot.id]);
  run.revealedLocationIds = unique([...run.revealedLocationIds, sourceKnot.locationId]);
}

function phaseAllowsStoryTransition(
  run: FateKnotsRunState,
  transition: FateKnotsStoryTransitionDefinition
): boolean {
  if (run.phase === "exploration") return true;
  if (run.phase === "finale") return transition.kind === "combat";
  return false;
}

function isTransitionLegal(
  universe: FateKnotsUniversePackage,
  run: FateKnotsRunState,
  transition: FateKnotsStoryTransitionDefinition
): boolean {
  if (run.result !== "active" || run.activeCombat || run.activeStoryTransitionId) return false;
  if (!phaseAllowsStoryTransition(run, transition)) return false;
  if (!run.activeKnotId || transition.fromKnotId !== run.activeKnotId) return false;
  if (!run.revealedKnotIds.includes(run.activeKnotId)) return false;
  if (!requirementsMet(transition.requirements, run)) return false;
  if (transition.kind === "finale" && !computeFateKnotsFinaleUnlocked(universe, run)) return false;
  if (transition.kind === "camp") {
    const location = universe.locations.find((entry) => entry.id === run.activeLocationId);
    if (location?.campAllowed !== true) return false;
  }
  if (transition.kind === "combat" && !getEncounter(universe, transition.encounterId)) return false;
  return true;
}

export function initializeFateKnotsStoryProgression(
  universe: FateKnotsUniversePackage,
  runInput: FateKnotsRunState
): FateKnotsStoryMutationResult {
  if (runInput.universeId !== universe.universeId) {
    return fail(runInput, { code: "universe-mismatch" });
  }
  if (runInput.result !== "active") return fail(runInput, { code: "run-not-active" });
  if (runInput.activeCombat) return fail(runInput, { code: "active-combat-exists" });

  const startKnot = getKnot(universe, universe.story.startKnotId);
  if (!startKnot) return fail(runInput, { code: "active-knot-not-found", knotId: universe.story.startKnotId });

  const initiallyRevealedKnots = universe.story.knots
    .filter((knot) => knot.initiallyRevealed)
    .map((knot) => knot.id);
  const initiallyRevealedLocations = universe.map.nodes
    .filter((node) => node.initiallyRevealed)
    .map((node) => node.locationId);

  const run = cloneRun(runInput);
  run.activeKnotId = startKnot.id;
  run.activeStoryTransitionId = null;
  run.activeEncounterId = null;
  run.activeLocationId = startKnot.locationId;
  run.revealedKnotIds = unique([...run.revealedKnotIds, ...initiallyRevealedKnots, startKnot.id]);
  run.revealedLocationIds = unique([
    ...run.revealedLocationIds,
    ...initiallyRevealedLocations,
    ...initiallyRevealedKnots
      .map((id) => getKnot(universe, id)?.locationId ?? null)
      .filter((id): id is string => id !== null),
    startKnot.locationId,
  ]);
  refreshFinaleUnlock(universe, run);
  run.revision += 1;
  return { ok: true, run, issues: [] };
}

export function getFateKnotsLegalStoryTransitions(
  universe: FateKnotsUniversePackage,
  run: FateKnotsRunState
): FateKnotsStoryTransitionDefinition[] {
  return universe.story.transitions
    .filter((transition) => isTransitionLegal(universe, run, transition))
    .map((transition) => structuredClone(transition));
}

export function buildFateKnotsStoryView(
  universe: FateKnotsUniversePackage,
  run: FateKnotsRunState
): FateKnotsStoryView {
  const activeKnot = getKnot(universe, run.activeKnotId);
  const visibleFacts =
    activeKnot && run.revealedKnotIds.includes(activeKnot.id)
      ? activeKnot.visibleFacts.slice()
      : [];
  const availableTransitions = getFateKnotsLegalStoryTransitions(universe, run).map(
    (transition) => ({
      id: transition.id,
      label: transition.label,
      kind: transition.kind,
    })
  );
  return {
    activeKnotId: activeKnot?.id ?? null,
    visibleFacts,
    availableTransitions,
    finaleUnlocked: computeFateKnotsFinaleUnlocked(universe, run),
  };
}

export function applyFateKnotsStoryTransition(
  universe: FateKnotsUniversePackage,
  runInput: FateKnotsRunState,
  transitionId: string
): FateKnotsStoryTransitionResult {
  if (runInput.universeId !== universe.universeId) {
    return { ...fail(runInput, { code: "universe-mismatch" }), transition: null, encounter: null };
  }
  if (runInput.result !== "active") {
    return { ...fail(runInput, { code: "run-not-active" }), transition: null, encounter: null };
  }
  if (runInput.activeCombat) {
    return { ...fail(runInput, { code: "active-combat-exists" }), transition: null, encounter: null };
  }
  if (runInput.activeStoryTransitionId) {
    return { ...fail(runInput, { code: "story-transition-pending" }), transition: null, encounter: null };
  }
  if (!runInput.activeKnotId) {
    return { ...fail(runInput, { code: "story-not-initialized" }), transition: null, encounter: null };
  }

  const transition = getTransition(universe, transitionId);
  if (!transition) {
    return {
      ...fail(runInput, { code: "transition-not-found", transitionId }),
      transition: null,
      encounter: null,
    };
  }
  if (!isTransitionLegal(universe, runInput, transition)) {
    return {
      ...fail(runInput, { code: "transition-not-legal", transitionId }),
      transition: structuredClone(transition),
      encounter: null,
    };
  }

  const encounter = transition.kind === "combat" ? getEncounter(universe, transition.encounterId) : null;
  if (transition.kind === "combat" && !encounter) {
    return {
      ...fail(runInput, {
        code: "encounter-not-found",
        transitionId,
        ...(transition.encounterId ? { encounterId: transition.encounterId } : {}),
      }),
      transition: structuredClone(transition),
      encounter: null,
    };
  }

  const run = cloneRun(runInput);
  applyPatch(universe, run, transition.onEnter);
  run.activeStoryTransitionId = transition.id;

  if (transition.kind === "combat") {
    run.activeEncounterId = encounter?.id ?? null;
    if (encounter) {
      run.activeLocationId = encounter.locationId;
      run.revealedLocationIds = unique([...run.revealedLocationIds, encounter.locationId]);
    }
    run.phase = "transition";
  } else {
    run.activeEncounterId = null;
    applyDestination(universe, run, transition, null);
    if (transition.kind === "camp") {
      run.phase = "camp";
      run.activeStoryTransitionId = null;
    } else if (transition.kind === "finale") {
      run.phase = "finale";
      run.activeStoryTransitionId = null;
    } else {
      run.phase = "transition";
    }
  }

  refreshFinaleUnlock(universe, run);
  run.revision += 1;
  return {
    ok: true,
    run,
    issues: [],
    transition: structuredClone(transition),
    encounter: encounter ? structuredClone(encounter) : null,
  };
}

export function settleFateKnotsStoryTransition(
  universe: FateKnotsUniversePackage,
  runInput: FateKnotsRunState
): FateKnotsStoryMutationResult {
  if (runInput.universeId !== universe.universeId) return fail(runInput, { code: "universe-mismatch" });
  if (runInput.result !== "active") return fail(runInput, { code: "run-not-active" });
  if (runInput.activeCombat || runInput.activeEncounterId) {
    return fail(runInput, { code: "transition-settle-not-allowed" });
  }
  const transition = runInput.activeStoryTransitionId
    ? getTransition(universe, runInput.activeStoryTransitionId)
    : null;
  if (
    !transition ||
    runInput.phase !== "transition" ||
    (transition.kind !== "scene" && transition.kind !== "travel")
  ) {
    return fail(runInput, { code: "transition-settle-not-allowed" });
  }

  const run = cloneRun(runInput);
  run.activeStoryTransitionId = null;
  run.phase = "exploration";
  refreshFinaleUnlock(universe, run);
  run.revision += 1;
  return { ok: true, run, issues: [] };
}

/**
 * Applies story consequences while terminal combat is still attached. Tracking
 * ids deliberately remain present until run-flow has actually removed combat,
 * keeping every intermediate snapshot persistence-valid.
 */
export function resolveFateKnotsStoryCombatOutcome(
  universe: FateKnotsUniversePackage,
  runInput: FateKnotsRunState
): FateKnotsStoryCombatOutcomeResult {
  if (runInput.universeId !== universe.universeId) {
    return { ...fail(runInput, { code: "universe-mismatch" }), nextPhase: null };
  }
  if (runInput.result !== "active") {
    return { ...fail(runInput, { code: "run-not-active" }), nextPhase: null };
  }
  const combat = runInput.activeCombat;
  if (!combat || combat.result === "active") {
    return { ...fail(runInput, { code: "combat-outcome-not-terminal" }), nextPhase: null };
  }
  if (!runInput.activeStoryTransitionId || !runInput.activeEncounterId) {
    return { ...fail(runInput, { code: "combat-transition-required" }), nextPhase: null };
  }

  const transition = getTransition(universe, runInput.activeStoryTransitionId);
  const encounter = getEncounter(universe, runInput.activeEncounterId);
  if (!transition || transition.kind !== "combat" || !encounter || transition.encounterId !== encounter.id) {
    return { ...fail(runInput, { code: "combat-transition-required" }), nextPhase: null };
  }

  const run = cloneRun(runInput);
  let nextPhase: FateKnotsStoryCombatOutcomeResult["nextPhase"] = null;

  if (combat.result === "party-victory") {
    applyPatch(universe, run, transition.onVictory);
    applyDestination(universe, run, transition, encounter);
    if (encounter.lootCardIds && encounter.lootCardIds.length > 0) {
      run.teamPoolItemIds = [...run.teamPoolItemIds, ...encounter.lootCardIds];
      nextPhase = "loot";
    } else if (universe.finale.finalEncounterId === encounter.id) {
      nextPhase = "finale";
    } else {
      nextPhase = "exploration";
    }
  } else if (combat.result === "retreat") {
    applyPatch(universe, run, transition.onRetreat);
    restoreSourceDestination(universe, run, transition);
    nextPhase = "exploration";
  } else {
    nextPhase = null;
  }

  refreshFinaleUnlock(universe, run);
  run.revision += 1;
  return { ok: true, run, issues: [], nextPhase };
}

export function clearFateKnotsStoryCombatTracking(
  runInput: FateKnotsRunState
): FateKnotsStoryMutationResult {
  if (runInput.activeCombat) return fail(runInput, { code: "active-combat-exists" });
  const run = cloneRun(runInput);
  run.activeStoryTransitionId = null;
  run.activeEncounterId = null;
  run.revision += 1;
  return { ok: true, run, issues: [] };
}

export function getFateKnotsActiveEncounter(
  universe: FateKnotsUniversePackage,
  run: FateKnotsRunState
): FateKnotsEncounterDefinition | null {
  const encounter = getEncounter(universe, run.activeEncounterId);
  return encounter ? structuredClone(encounter) : null;
}
