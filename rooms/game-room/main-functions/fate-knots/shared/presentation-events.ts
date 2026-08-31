import type {
  FateKnotsCombatState,
  FateKnotsPresentationEvent,
} from "./contracts.js";

export interface FateKnotsPresentationEventSequence {
  scopeId: string;
  nextIndex: number;
}

export interface FateKnotsPresentationEventBatch {
  events: FateKnotsPresentationEvent[];
  sequence: FateKnotsPresentationEventSequence;
}

export interface FateKnotsCardPresentationContext {
  cardId: string;
  actorId: string;
  targetIds: readonly string[];
  cueIds: readonly string[];
}

function cloneSequence(sequence: FateKnotsPresentationEventSequence): FateKnotsPresentationEventSequence {
  return { ...sequence };
}

function nextEventId(sequence: FateKnotsPresentationEventSequence): string {
  const eventId = `${sequence.scopeId}:${sequence.nextIndex}`;
  sequence.nextIndex += 1;
  return eventId;
}

function samePosition(
  left: FateKnotsCombatState["actors"][number]["position"],
  right: FateKnotsCombatState["actors"][number]["position"]
): boolean {
  return left.row === right.row && left.range === right.range;
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

/**
 * Converts canonical before/after combat state into presentation semantics.
 * It does not calculate mechanics or choose animations. Renderer/Babylon code
 * consumes these events and maps cue ids/state changes to visual/audio assets.
 */
export function buildFateKnotsCardPresentationEvents(
  before: FateKnotsCombatState,
  after: FateKnotsCombatState,
  sequenceInput: FateKnotsPresentationEventSequence,
  context: FateKnotsCardPresentationContext
): FateKnotsPresentationEventBatch {
  const sequence = cloneSequence(sequenceInput);
  const events: FateKnotsPresentationEvent[] = [];

  events.push({
    eventId: nextEventId(sequence),
    type: "card-resolved",
    actorId: context.actorId,
    targetIds: context.targetIds.slice(),
    cardId: context.cardId,
    cueIds: uniqueStrings(context.cueIds),
  });

  const beforeByActorId = new Map(before.actors.map((actor) => [actor.actorId, actor] as const));

  for (const actor of after.actors) {
    const previous = beforeByActorId.get(actor.actorId);
    if (!previous) continue;

    if (!previous.fallen && actor.fallen) {
      events.push({
        eventId: nextEventId(sequence),
        type: "actor-fallen",
        actorId: actor.actorId,
      });
    }

    const previousStatuses = new Set(previous.statusIds);
    const currentStatuses = new Set(actor.statusIds);

    for (const statusId of actor.statusIds) {
      if (previousStatuses.has(statusId)) continue;
      events.push({
        eventId: nextEventId(sequence),
        type: "status-applied",
        actorId: actor.actorId,
        payload: { statusId },
      });
    }

    for (const statusId of previous.statusIds) {
      if (currentStatuses.has(statusId)) continue;
      events.push({
        eventId: nextEventId(sequence),
        type: "status-removed",
        actorId: actor.actorId,
        payload: { statusId },
      });
    }

    if (!samePosition(previous.position, actor.position)) {
      events.push({
        eventId: nextEventId(sequence),
        type: "position-changed",
        actorId: actor.actorId,
        payload: {
          before: { ...previous.position },
          after: { ...actor.position },
        },
      });
    }
  }

  return { events, sequence };
}

export function buildFateKnotsCombatStartedPresentationEvent(
  combat: FateKnotsCombatState,
  sequenceInput: FateKnotsPresentationEventSequence
): FateKnotsPresentationEventBatch {
  const sequence = cloneSequence(sequenceInput);
  return {
    events: [
      {
        eventId: nextEventId(sequence),
        type: "combat-started",
        targetIds: combat.actors.map((actor) => actor.actorId),
        payload: { combatId: combat.combatId },
      },
    ],
    sequence,
  };
}

export function buildFateKnotsCombatEndedPresentationEvent(
  combat: FateKnotsCombatState,
  sequenceInput: FateKnotsPresentationEventSequence
): FateKnotsPresentationEventBatch {
  const sequence = cloneSequence(sequenceInput);
  if (combat.result === "active") return { events: [], sequence };

  return {
    events: [
      {
        eventId: nextEventId(sequence),
        type: "combat-ended",
        targetIds: combat.actors.map((actor) => actor.actorId),
        payload: { combatId: combat.combatId, result: combat.result },
      },
    ],
    sequence,
  };
}

export function buildFateKnotsPageTransitionPresentationEvent(
  sequenceInput: FateKnotsPresentationEventSequence,
  fromPhase: string,
  toPhase: string
): FateKnotsPresentationEventBatch {
  const sequence = cloneSequence(sequenceInput);
  return {
    events: [
      {
        eventId: nextEventId(sequence),
        type: "page-transition",
        payload: { fromPhase, toPhase },
      },
    ],
    sequence,
  };
}
