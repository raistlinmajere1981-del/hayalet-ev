import type {
  FateKnotsPhase,
  FateKnotsRunState,
  FateKnotsUniversePackage,
} from "./contracts.js";
import type { FateKnotsPlayerTemplateView } from "./run-setup.js";
import { listFateKnotsPlayerTemplates } from "./run-setup.js";

export interface FateKnotsPlayerUniverseView {
  universeId: string;
  title: string;
  premise: string;
  playerTemplates: FateKnotsPlayerTemplateView[];
}

export interface FateKnotsPlayerRunView {
  runId: string;
  universeId: string;
  phase: FateKnotsPhase;
  revision: number;
  result: FateKnotsRunState["result"];
  activeLocationId: string | null;
  finaleUnlocked: boolean;
  party: Array<{
    actorId: string;
    characterId: string;
    seatId: "user" | "ai2" | "us1" | null;
    hp: number;
    maxHp: number;
    energy: number;
    fallen: boolean;
    statusIds: string[];
    injuryIds: string[];
  }>;
}

/**
 * Player-facing Universe projection used by neutral/meta UI.
 *
 * Deliberately absent:
 * story graph, hidden knots, finale definition, NPC role packets, encounters,
 * enemy templates, item/card catalogs and raw asset paths. Gameplay surfaces
 * receive separate scene-scoped packets rather than the canonical package.
 */
export function buildFateKnotsPlayerUniverseView(
  universe: FateKnotsUniversePackage
): FateKnotsPlayerUniverseView {
  return {
    universeId: universe.universeId,
    title: universe.title,
    premise: universe.premise,
    playerTemplates: listFateKnotsPlayerTemplates(universe),
  };
}

/**
 * Spoiler-safe run summary for renderer/Hub state.
 *
 * The canonical run snapshot remains host-only because it contains progression
 * bookkeeping and may be paired with combat-runtime data. Detailed current
 * scene/combat views are emitted through their own bounded packets.
 */
export function buildFateKnotsPlayerRunView(
  run: FateKnotsRunState
): FateKnotsPlayerRunView {
  const partyIds = new Set(run.partyActorIds);
  return {
    runId: run.runId,
    universeId: run.universeId,
    phase: run.phase,
    revision: run.revision,
    result: run.result,
    activeLocationId: run.activeLocationId,
    finaleUnlocked: run.finaleUnlocked,
    party: run.actors
      .filter((actor) => partyIds.has(actor.actorId))
      .map((actor) => ({
        actorId: actor.actorId,
        characterId: actor.characterId,
        seatId:
          actor.seatId === "user" || actor.seatId === "ai2" || actor.seatId === "us1"
            ? actor.seatId
            : null,
        hp: actor.hp,
        maxHp: actor.maxHp,
        energy: actor.energy,
        fallen: actor.fallen,
        statusIds: actor.statusIds.slice(),
        injuryIds: actor.injuryIds.slice(),
      })),
  };
}
