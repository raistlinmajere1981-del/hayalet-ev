import { normalizeFateKnotsCanonicalUniversePackage } from "../forge/canonical-universe.js";
import {
  buildFateKnotsCombatLegalOptions,
  type FateKnotsCombatLegalCardOption,
  type FateKnotsCombatOptionsIssue,
} from "../shared/combat-options.js";
import type { FateKnotsCombatState } from "../shared/contracts.js";
import {
  readFateKnotsRunLibrary,
  readFateKnotsUniverseLibrary,
  type FateKnotsPersistenceApi,
  type FateKnotsPersistenceIssue,
} from "./persistence.js";

export const FATE_KNOTS_COMBAT_OPTION_COMMAND_NAMES = {
  getLocalOptions: "GameRoomFateKnotsGetCombatOptions",
} as const;

export interface FateKnotsLocalCombatOptionsState {
  runId: string;
  runRevision: number;
  combatId: string;
  turnIndex: number;
  phase: Extract<FateKnotsCombatState["phase"], "combat-discussion" | "combat-commit">;
  actorId: string;
  movementOptions: FateKnotsCombatLegalCardOption[];
  actionOptions: FateKnotsCombatLegalCardOption[];
}

export interface FateKnotsCombatOptionsCommandIssue {
  source: "payload" | "persistence" | "universe" | "combat-options";
  code: string;
  value?: string;
}

export type FateKnotsCombatOptionsCommandResult =
  | { ok: true; state: FateKnotsLocalCombatOptionsState; issues: [] }
  | {
      ok: false;
      error:
        | "invalid-payload"
        | "run-not-found"
        | "universe-not-found"
        | "universe-rejected"
        | "no-active-combat"
        | "local-player-not-found"
        | "local-player-ambiguous"
        | "combat-options-rejected"
        | "persistence-rejected";
      state: null;
      issues: FateKnotsCombatOptionsCommandIssue[];
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRunId(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const value = payload["runId"];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function persistenceIssues(
  issues: FateKnotsPersistenceIssue[]
): FateKnotsCombatOptionsCommandIssue[] {
  return issues.map((entry) => ({
    source: "persistence" as const,
    code: entry.code,
    ...(entry.entryId ? { value: entry.entryId } : {}),
  }));
}

function optionIssues(issues: FateKnotsCombatOptionsIssue[]): FateKnotsCombatOptionsCommandIssue[] {
  return issues.map((entry) => ({
    source: "combat-options" as const,
    code: entry.code,
    ...(entry.actorId ? { value: entry.actorId } : {}),
  }));
}

/**
 * Room-UI read surface for the local user's own combat options.
 *
 * The browser supplies only a run id. Actor identity is resolved host-side from
 * the canonical run's `seatId: "user"` party actor, preventing the local room UI
 * from querying AI2/US1/opposition private card options by actor id.
 *
 * This command does not close discussion, enter commit phase or store a commit.
 */
export function createFateKnotsCombatOptionCommands(
  api: FateKnotsPersistenceApi
): Record<string, (payload?: unknown) => FateKnotsCombatOptionsCommandResult> {
  return {
    [FATE_KNOTS_COMBAT_OPTION_COMMAND_NAMES.getLocalOptions](payload?: unknown) {
      const runId = readRunId(payload);
      if (!runId) {
        return {
          ok: false,
          error: "invalid-payload",
          state: null,
          issues: [{ source: "payload", code: "invalid-run-id" }],
        };
      }

      const runRead = readFateKnotsRunLibrary(api);
      if (runRead.issues.length > 0) {
        return {
          ok: false,
          error: "persistence-rejected",
          state: null,
          issues: persistenceIssues(runRead.issues),
        };
      }
      const run = runRead.value.runs.find((entry) => entry.runId === runId) ?? null;
      if (!run) {
        return {
          ok: false,
          error: "run-not-found",
          state: null,
          issues: [{ source: "combat-options", code: "run-not-found", value: runId }],
        };
      }
      if (!run.activeCombat) {
        return {
          ok: false,
          error: "no-active-combat",
          state: null,
          issues: [{ source: "combat-options", code: "no-active-combat" }],
        };
      }

      const localPartyActors = run.actors.filter(
        (actor) => actor.seatId === "user" && run.partyActorIds.includes(actor.actorId)
      );
      const [localPartyActor, secondLocalPartyActor] = localPartyActors;
      if (localPartyActor === undefined) {
        return {
          ok: false,
          error: "local-player-not-found",
          state: null,
          issues: [{ source: "combat-options", code: "local-player-not-found" }],
        };
      }
      if (secondLocalPartyActor !== undefined) {
        return {
          ok: false,
          error: "local-player-ambiguous",
          state: null,
          issues: [{ source: "combat-options", code: "local-player-ambiguous" }],
        };
      }
      const localActorId = localPartyActor.actorId;

      const universeRead = readFateKnotsUniverseLibrary(api);
      if (universeRead.issues.length > 0) {
        return {
          ok: false,
          error: "persistence-rejected",
          state: null,
          issues: persistenceIssues(universeRead.issues),
        };
      }
      const storedUniverse = universeRead.value.universes.find(
        (universe) => universe.universeId === run.universeId
      );
      if (!storedUniverse) {
        return {
          ok: false,
          error: "universe-not-found",
          state: null,
          issues: [{ source: "universe", code: "universe-not-found", value: run.universeId }],
        };
      }

      const canonical = normalizeFateKnotsCanonicalUniversePackage(storedUniverse);
      if (!canonical.valid || !canonical.package) {
        return {
          ok: false,
          error: "universe-rejected",
          state: null,
          issues: canonical.issues.map((entry) => ({
            source: "universe" as const,
            code: entry.code,
            value: entry.path,
          })),
        };
      }

      const options = buildFateKnotsCombatLegalOptions(
        run.activeCombat,
        localActorId,
        canonical.package
      );
      if (!options.ok) {
        return {
          ok: false,
          error: "combat-options-rejected",
          state: null,
          issues: optionIssues(options.issues),
        };
      }

      const phase = run.activeCombat.phase;
      if (phase !== "combat-discussion" && phase !== "combat-commit") {
        return {
          ok: false,
          error: "combat-options-rejected",
          state: null,
          issues: [{ source: "combat-options", code: "wrong-phase" }],
        };
      }

      return {
        ok: true,
        state: {
          runId: run.runId,
          runRevision: run.revision,
          combatId: run.activeCombat.combatId,
          turnIndex: run.activeCombat.turnIndex,
          phase,
          actorId: localActorId,
          movementOptions: options.options.movementOptions.map((entry) => ({
            ...entry,
            legalPrimaryTargetIds: entry.legalPrimaryTargetIds.slice(),
          })),
          actionOptions: options.options.actionOptions.map((entry) => ({
            ...entry,
            legalPrimaryTargetIds: entry.legalPrimaryTargetIds.slice(),
          })),
        },
        issues: [],
      };
    },
  };
}
