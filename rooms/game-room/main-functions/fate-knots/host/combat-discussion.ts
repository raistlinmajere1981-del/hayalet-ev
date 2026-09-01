import type { GameRoomHostApi } from "../../../shared/host/activation.js";
import type {
  FateKnotsActorState,
  FateKnotsRunState,
  FateKnotsSeatId,
} from "../shared/contracts.js";

const FATE_KNOTS_COMBAT_DISCUSSION_STATE_KEY = "game-room.fate-knots.combat-discussion.v1";
const FATE_KNOTS_COMBAT_DISCUSSION_STATE_VERSION = 1;
export const FATE_KNOTS_COMBAT_DISCUSSION_MAX_MESSAGES = 80;
export const FATE_KNOTS_COMBAT_DISCUSSION_MAX_TEXT_LENGTH = 2000;

export interface FateKnotsCombatDiscussionMessage {
  id: string;
  index: number;
  seatId: FateKnotsSeatId;
  text: string;
}

interface FateKnotsCombatDiscussionConversation {
  runId: string;
  combatId: string;
  turnIndex: number;
  nextIndex: number;
  messages: FateKnotsCombatDiscussionMessage[];
}

interface FateKnotsCombatDiscussionStore {
  version: typeof FATE_KNOTS_COMBAT_DISCUSSION_STATE_VERSION;
  conversations: FateKnotsCombatDiscussionConversation[];
}

export interface FateKnotsCombatDiscussionProjection {
  runId: string;
  combatId: string;
  turnIndex: number;
  open: boolean;
  activeSeatIds: FateKnotsSeatId[];
  readySeatIds: FateKnotsSeatId[];
  messages: FateKnotsCombatDiscussionMessage[];
}

export type FateKnotsCombatDiscussionIssueCode =
  | "no-active-combat"
  | "discussion-closed"
  | "seat-not-active"
  | "seat-ambiguous"
  | "empty-message"
  | "message-too-long";

export interface FateKnotsCombatDiscussionIssue {
  code: FateKnotsCombatDiscussionIssueCode;
  seatId?: FateKnotsSeatId;
}

export type FateKnotsCombatDiscussionResult =
  | { ok: true; state: FateKnotsCombatDiscussionProjection; issues: [] }
  | { ok: false; state: null; issues: FateKnotsCombatDiscussionIssue[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function emptyStore(): FateKnotsCombatDiscussionStore {
  return { version: FATE_KNOTS_COMBAT_DISCUSSION_STATE_VERSION, conversations: [] };
}

function normalizeMessage(value: unknown): FateKnotsCombatDiscussionMessage | null {
  if (!isRecord(value)) return null;
  const id = typeof value["id"] === "string" ? value["id"].trim() : "";
  const index = value["index"];
  const seatId = value["seatId"];
  const text = typeof value["text"] === "string" ? value["text"].trim() : "";
  if (
    id === "" ||
    typeof index !== "number" ||
    !Number.isInteger(index) ||
    index < 0 ||
    (seatId !== "user" && seatId !== "ai2" && seatId !== "us1") ||
    text === "" ||
    text.length > FATE_KNOTS_COMBAT_DISCUSSION_MAX_TEXT_LENGTH
  ) {
    return null;
  }
  return { id, index, seatId, text };
}

function loadStore(api: Pick<GameRoomHostApi, "getState">): FateKnotsCombatDiscussionStore {
  const raw = api.getState(FATE_KNOTS_COMBAT_DISCUSSION_STATE_KEY);
  if (!isRecord(raw) || raw["version"] !== FATE_KNOTS_COMBAT_DISCUSSION_STATE_VERSION) {
    return emptyStore();
  }
  const conversations = Array.isArray(raw["conversations"])
    ? raw["conversations"].flatMap((entry) => {
        if (!isRecord(entry)) return [];
        const runId = typeof entry["runId"] === "string" ? entry["runId"].trim() : "";
        const combatId = typeof entry["combatId"] === "string" ? entry["combatId"].trim() : "";
        const turnIndex = entry["turnIndex"];
        const nextIndex = entry["nextIndex"];
        if (
          runId === "" ||
          combatId === "" ||
          typeof turnIndex !== "number" ||
          !Number.isInteger(turnIndex) ||
          turnIndex < 0 ||
          typeof nextIndex !== "number" ||
          !Number.isInteger(nextIndex) ||
          nextIndex < 0
        ) {
          return [];
        }
        const messages = Array.isArray(entry["messages"])
          ? entry["messages"].map(normalizeMessage).filter((message): message is FateKnotsCombatDiscussionMessage => message !== null)
          : [];
        return [{ runId, combatId, turnIndex, nextIndex, messages: messages.slice(-FATE_KNOTS_COMBAT_DISCUSSION_MAX_MESSAGES) }];
      })
    : [];
  const byRunId = new Map<string, FateKnotsCombatDiscussionConversation>();
  conversations.forEach((entry) => byRunId.set(entry.runId, entry));
  return { version: FATE_KNOTS_COMBAT_DISCUSSION_STATE_VERSION, conversations: Array.from(byRunId.values()) };
}

function saveStore(
  api: Pick<GameRoomHostApi, "setState">,
  store: FateKnotsCombatDiscussionStore
): void {
  api.setState(FATE_KNOTS_COMBAT_DISCUSSION_STATE_KEY, {
    version: FATE_KNOTS_COMBAT_DISCUSSION_STATE_VERSION,
    conversations: store.conversations.map((entry) => ({
      runId: entry.runId,
      combatId: entry.combatId,
      turnIndex: entry.turnIndex,
      nextIndex: entry.nextIndex,
      messages: entry.messages.map((message) => ({ ...message })),
    })),
  });
}

function isDiscussionOpen(run: FateKnotsRunState): boolean {
  return run.phase === "combat-discussion" || run.phase === "combat-commit";
}

function activePartyActors(run: FateKnotsRunState): FateKnotsActorState[] {
  if (!run.activeCombat) return [];
  const partyIds = new Set(run.partyActorIds);
  return run.activeCombat.actors.filter(
    (actor) => partyIds.has(actor.actorId) && !actor.fallen && actor.seatId !== null
  );
}

function seatActors(run: FateKnotsRunState, seatId: FateKnotsSeatId): FateKnotsActorState[] {
  return activePartyActors(run).filter((actor) => actor.seatId === seatId);
}

function getConversation(
  api: Pick<GameRoomHostApi, "getState" | "setState">,
  run: FateKnotsRunState
): FateKnotsCombatDiscussionConversation | null {
  const combat = run.activeCombat;
  if (!combat) return null;
  const store = loadStore(api);
  const existing = store.conversations.find((entry) => entry.runId === run.runId) ?? null;
  if (existing && existing.combatId === combat.combatId && existing.turnIndex === combat.turnIndex) {
    return existing;
  }
  const conversation: FateKnotsCombatDiscussionConversation = {
    runId: run.runId,
    combatId: combat.combatId,
    turnIndex: combat.turnIndex,
    nextIndex: 0,
    messages: [],
  };
  saveStore(api, {
    ...store,
    conversations: [
      ...store.conversations.filter((entry) => entry.runId !== run.runId),
      conversation,
    ],
  });
  return conversation;
}

function project(
  api: Pick<GameRoomHostApi, "getState" | "setState">,
  run: FateKnotsRunState
): FateKnotsCombatDiscussionResult {
  const combat = run.activeCombat;
  if (!combat) return { ok: false, state: null, issues: [{ code: "no-active-combat" }] };
  if (!isDiscussionOpen(run)) {
    return { ok: false, state: null, issues: [{ code: "discussion-closed" }] };
  }
  const conversation = getConversation(api, run);
  if (!conversation) return { ok: false, state: null, issues: [{ code: "no-active-combat" }] };
  const actors = activePartyActors(run);
  const activeSeatIds = Array.from(new Set(actors.map((actor) => actor.seatId).filter((seat): seat is FateKnotsSeatId => seat !== null)));
  const committedActorIds = new Set(
    combat.commits.filter((commit) => commit.committed).map((commit) => commit.actorId)
  );
  const readySeatIds = activeSeatIds.filter((seatId) => {
    const matchingActors = actors.filter((actor) => actor.seatId === seatId);
    return matchingActors.length === 1 && committedActorIds.has(matchingActors[0].actorId);
  });
  return {
    ok: true,
    state: {
      runId: run.runId,
      combatId: combat.combatId,
      turnIndex: combat.turnIndex,
      open: true,
      activeSeatIds,
      readySeatIds,
      messages: conversation.messages.map((message) => ({ ...message })),
    },
    issues: [],
  };
}

export function getFateKnotsCombatDiscussion(
  api: Pick<GameRoomHostApi, "getState" | "setState">,
  run: FateKnotsRunState
): FateKnotsCombatDiscussionResult {
  return project(api, run);
}

export function appendFateKnotsCombatDiscussionMessage(
  api: Pick<GameRoomHostApi, "getState" | "setState">,
  run: FateKnotsRunState,
  seatId: FateKnotsSeatId,
  textInput: string
): FateKnotsCombatDiscussionResult {
  if (!run.activeCombat) return { ok: false, state: null, issues: [{ code: "no-active-combat" }] };
  if (!isDiscussionOpen(run)) return { ok: false, state: null, issues: [{ code: "discussion-closed" }] };
  const actors = seatActors(run, seatId);
  if (actors.length === 0) return { ok: false, state: null, issues: [{ code: "seat-not-active", seatId }] };
  if (actors.length > 1) return { ok: false, state: null, issues: [{ code: "seat-ambiguous", seatId }] };

  const text = textInput.trim();
  if (text === "") return { ok: false, state: null, issues: [{ code: "empty-message", seatId }] };
  if (text.length > FATE_KNOTS_COMBAT_DISCUSSION_MAX_TEXT_LENGTH) {
    return { ok: false, state: null, issues: [{ code: "message-too-long", seatId }] };
  }

  const conversation = getConversation(api, run);
  if (!conversation) return { ok: false, state: null, issues: [{ code: "no-active-combat" }] };
  const message: FateKnotsCombatDiscussionMessage = {
    id: `${conversation.combatId}:${conversation.turnIndex}:${conversation.nextIndex}`,
    index: conversation.nextIndex,
    seatId,
    text,
  };
  const nextConversation: FateKnotsCombatDiscussionConversation = {
    ...conversation,
    nextIndex: conversation.nextIndex + 1,
    messages: [...conversation.messages, message].slice(-FATE_KNOTS_COMBAT_DISCUSSION_MAX_MESSAGES),
  };
  const store = loadStore(api);
  saveStore(api, {
    ...store,
    conversations: [
      ...store.conversations.filter((entry) => entry.runId !== run.runId),
      nextConversation,
    ],
  });
  return project(api, run);
}

export function deleteFateKnotsCombatDiscussionForRun(
  api: Pick<GameRoomHostApi, "getState" | "setState">,
  runId: string
): void {
  const normalizedRunId = runId.trim();
  const store = loadStore(api);
  saveStore(api, {
    ...store,
    conversations: store.conversations.filter((entry) => entry.runId !== normalizedRunId),
  });
}
