import type { FateKnotsRunState, FateKnotsSeatId } from "../shared/contracts.js";
import {
  appendFateKnotsCombatDiscussionMessage,
  getFateKnotsCombatDiscussion,
  type FateKnotsCombatDiscussionIssue,
  type FateKnotsCombatDiscussionProjection,
} from "./combat-discussion.js";
import {
  loadFateKnotsRunStore,
  type FateKnotsPersistenceApi,
  type FateKnotsPersistenceIssue,
} from "./persistence.js";

export const FATE_KNOTS_COMBAT_DISCUSSION_COMMAND_NAMES = {
  get: "GameRoomFateKnotsGetCombatDiscussion",
  getAi2: "GameRoomFateKnotsAi2GetCombatDiscussion",
  getRemote: "GameRoomFateKnotsRemoteGetCombatDiscussion",
  sendLocal: "GameRoomFateKnotsSendCombatMessage",
  sendAi2: "GameRoomFateKnotsAi2CombatMessage",
  sendRemote: "GameRoomFateKnotsRemoteCombatMessage",
} as const;

export interface FateKnotsCombatDiscussionCommandIssue {
  source: "payload" | "persistence" | "combat-discussion";
  code: string;
  value?: string;
}

export type FateKnotsCombatDiscussionCommandResult =
  | { ok: true; state: FateKnotsCombatDiscussionProjection; issues: [] }
  | {
      ok: false;
      error: "invalid-payload" | "run-not-found" | "persistence-rejected" | "discussion-rejected";
      state: null;
      issues: FateKnotsCombatDiscussionCommandIssue[];
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRunId(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const runId = payload["runId"];
  return typeof runId === "string" && runId.trim() !== "" ? runId.trim() : null;
}

function readText(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const text = payload["text"];
  return typeof text === "string" ? text : null;
}

function persistenceIssues(
  issues: FateKnotsPersistenceIssue[]
): FateKnotsCombatDiscussionCommandIssue[] {
  return issues.map((issue) => ({
    source: "persistence" as const,
    code: issue.code,
    ...(issue.entryId ? { value: issue.entryId } : {}),
  }));
}

function discussionIssues(
  issues: FateKnotsCombatDiscussionIssue[]
): FateKnotsCombatDiscussionCommandIssue[] {
  return issues.map((issue) => ({
    source: "combat-discussion" as const,
    code: issue.code,
    ...(issue.seatId ? { value: issue.seatId } : {}),
  }));
}

function readRun(
  api: FateKnotsPersistenceApi,
  runId: string
):
  | { ok: true; run: FateKnotsRunState }
  | { ok: false; result: FateKnotsCombatDiscussionCommandResult } {
  const loaded = loadFateKnotsRunStore(api);
  if (loaded.issues.length > 0) {
    return {
      ok: false,
      result: {
        ok: false,
        error: "persistence-rejected",
        state: null,
        issues: persistenceIssues(loaded.issues),
      },
    };
  }
  const snapshot = loaded.store.entries.find((entry) => entry.run.runId === runId) ?? null;
  if (!snapshot) {
    return {
      ok: false,
      result: {
        ok: false,
        error: "run-not-found",
        state: null,
        issues: [{ source: "combat-discussion", code: "run-not-found", value: runId }],
      },
    };
  }
  return { ok: true, run: snapshot.run };
}

function seatHasCommittedMove(run: FateKnotsRunState, seatId: FateKnotsSeatId): boolean {
  const combat = run.activeCombat;
  if (!combat) return false;
  const partyIds = new Set(run.partyActorIds);
  const matchingActors = combat.actors.filter(
    (actor) => partyIds.has(actor.actorId) && !actor.fallen && actor.seatId === seatId
  );
  const [actor, secondActor] = matchingActors;
  if (actor === undefined || secondActor !== undefined) return false;
  return combat.commits.some((commit) => commit.actorId === actor.actorId && commit.committed);
}

function project(
  api: FateKnotsPersistenceApi,
  payload: unknown
): FateKnotsCombatDiscussionCommandResult {
  const runId = readRunId(payload);
  if (!runId) {
    return {
      ok: false,
      error: "invalid-payload",
      state: null,
      issues: [{ source: "payload", code: "invalid-run-id" }],
    };
  }
  const read = readRun(api, runId);
  if (!read.ok) return read.result;
  const discussion = getFateKnotsCombatDiscussion(api, read.run);
  return discussion.ok
    ? { ok: true, state: discussion.state, issues: [] }
    : {
        ok: false,
        error: "discussion-rejected",
        state: null,
        issues: discussionIssues(discussion.issues),
      };
}

function append(
  api: FateKnotsPersistenceApi,
  payload: unknown,
  seatId: FateKnotsSeatId
): FateKnotsCombatDiscussionCommandResult {
  const runId = readRunId(payload);
  const text = readText(payload);
  if (!runId || text === null) {
    return {
      ok: false,
      error: "invalid-payload",
      state: null,
      issues: [{ source: "payload", code: !runId ? "invalid-run-id" : "invalid-message-text" }],
    };
  }
  const read = readRun(api, runId);
  if (!read.ok) return read.result;
  if (seatHasCommittedMove(read.run, seatId)) {
    return {
      ok: false,
      error: "discussion-rejected",
      state: null,
      issues: [{ source: "combat-discussion", code: "seat-already-committed", value: seatId }],
    };
  }
  const discussion = appendFateKnotsCombatDiscussionMessage(api, read.run, seatId, text);
  return discussion.ok
    ? { ok: true, state: discussion.state, issues: [] }
    : {
        ok: false,
        error: "discussion-rejected",
        state: null,
        issues: discussionIssues(discussion.issues),
      };
}

/**
 * V1 party-chat command surface. Sender identity is bound by command scope and
 * never accepted from payload, so room UI cannot impersonate AI2/US1 and remote
 * adapters cannot post as the local player. Distinct read commands allow each
 * remote seat to receive the same shared transcript without sharing private
 * combat-option surfaces.
 */
export function createFateKnotsCombatDiscussionCommands(
  api: FateKnotsPersistenceApi
): Record<string, (payload?: unknown) => FateKnotsCombatDiscussionCommandResult> {
  return {
    [FATE_KNOTS_COMBAT_DISCUSSION_COMMAND_NAMES.get](payload?: unknown) {
      return project(api, payload);
    },
    [FATE_KNOTS_COMBAT_DISCUSSION_COMMAND_NAMES.getAi2](payload?: unknown) {
      return project(api, payload);
    },
    [FATE_KNOTS_COMBAT_DISCUSSION_COMMAND_NAMES.getRemote](payload?: unknown) {
      return project(api, payload);
    },
    [FATE_KNOTS_COMBAT_DISCUSSION_COMMAND_NAMES.sendLocal](payload?: unknown) {
      return append(api, payload, "user");
    },
    [FATE_KNOTS_COMBAT_DISCUSSION_COMMAND_NAMES.sendAi2](payload?: unknown) {
      return append(api, payload, "ai2");
    },
    [FATE_KNOTS_COMBAT_DISCUSSION_COMMAND_NAMES.sendRemote](payload?: unknown) {
      return append(api, payload, "us1");
    },
  };
}
