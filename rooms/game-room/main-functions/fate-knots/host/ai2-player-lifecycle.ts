import { normalizeFateKnotsCanonicalUniversePackage } from "../forge/canonical-universe.js";
import { buildFateKnotsGameplayState } from "./gameplay-state.js";
import {
  FATE_KNOTS_COMBAT_DISCUSSION_COMMAND_NAMES,
  createFateKnotsCombatDiscussionCommands,
} from "./combat-discussion-runtime.js";
import {
  FATE_KNOTS_COMBAT_OPTION_COMMAND_NAMES,
  createFateKnotsCombatOptionCommands,
} from "./combat-options-runtime.js";
import {
  FATE_KNOTS_CAMP_COMMAND_NAMES,
  createFateKnotsCampCommands,
} from "./camp-runtime.js";
import {
  FATE_KNOTS_EXPLORATION_CONSENSUS_COMMAND_NAMES,
  createFateKnotsExplorationConsensusCommands,
} from "./exploration-consensus-runtime.js";
import {
  FATE_KNOTS_LOOT_COMMAND_NAMES,
  createFateKnotsLootCommands,
} from "./loot-runtime.js";
import {
  loadFateKnotsRunStore,
  loadFateKnotsUniverseStore,
  type FateKnotsPersistenceApi,
} from "./persistence.js";
import {
  getFateKnotsRunSetupSeatSelection,
  setFateKnotsRunSetupSeatSelection,
} from "./run-setup-seat-coordination.js";
import { buildFateKnotsRunSetupSnapshot } from "./run-setup-state.js";
import { loadContext } from "../../../shared/host/context-state.js";
import {
  FATE_KNOTS_FEATURE_ID,
  FATE_KNOTS_PAGE_ID,
  ROOM_ID,
} from "../../../shared/host/feature-meta.js";

const EXPECTED_COMMAND_CAPTURE_STATE_KEY = "room.expectedCommandCapture";
const AI2_LIFECYCLE_STATE_KEY = "game-room:fate-knots:ai2-lifecycle:v1";

export const FATE_KNOTS_AI2_LIFECYCLE_COMMAND_NAMES = {
  requestRunCharacter: "GameRoomFateKnotsRequestAi2RunCharacter",
} as const;

interface FateKnotsAi2LifecycleApi extends FateKnotsPersistenceApi {
  dispatchBridge?(options: Record<string, unknown>): Promise<unknown> | unknown;
  deleteState?(key: string): void;
  log?(level: string, message: string): void;
}

export type FateKnotsAi2RunSetupRequestResult =
  | { ok: true; dispatched: boolean; universeId: string; issues: [] }
  | {
      ok: false;
      error:
        | "invalid-payload"
        | "ai2-unavailable"
        | "universe-not-found"
        | "universe-rejected"
        | "dispatch-failed";
      issues: Array<{ code: string; value?: string }>;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function readUniverseId(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  return readString(payload["universeId"]);
}

function normalizeTransportSuccess(value: unknown): boolean {
  return isRecord(value) && value["success"] === true;
}

function clearStateKey(api: FateKnotsAi2LifecycleApi, key: string): void {
  if (typeof api.deleteState === "function") {
    api.deleteState(key);
    return;
  }
  api.setState(key, null);
}

function clearExpectedAi2Command(api: FateKnotsAi2LifecycleApi): void {
  const current = api.getState(EXPECTED_COMMAND_CAPTURE_STATE_KEY);
  if (
    isRecord(current) &&
    current["provider"] === "ai2" &&
    typeof current["commandName"] === "string" &&
    current["commandName"].startsWith("GameRoomFateKnots")
  ) {
    clearStateKey(api, EXPECTED_COMMAND_CAPTURE_STATE_KEY);
  }
}

function setExpectedAi2Command(api: FateKnotsAi2LifecycleApi, commandName: string): void {
  api.setState(EXPECTED_COMMAND_CAPTURE_STATE_KEY, {
    provider: "ai2",
    commandName,
    message: "Fate Knots AI2 player turn did not return the expected room command.",
  });
}

function getLastDispatchToken(api: FateKnotsAi2LifecycleApi): string | null {
  const value = api.getState(AI2_LIFECYCLE_STATE_KEY);
  return isRecord(value) ? readString(value["token"]) : null;
}

function setLastDispatchToken(api: FateKnotsAi2LifecycleApi, token: string): void {
  api.setState(AI2_LIFECYCLE_STATE_KEY, { token });
}

function clearLastDispatchToken(api: FateKnotsAi2LifecycleApi): void {
  clearStateKey(api, AI2_LIFECYCLE_STATE_KEY);
}

function buildSlotBridgeCommand(commandName: string, args: Record<string, unknown>): string {
  return `++cmd:SlotBridge(${JSON.stringify({
    action: "room.command",
    payload: { commandName, ...args },
  })})`;
}

async function dispatchAi2Message(
  api: FateKnotsAi2LifecycleApi,
  token: string,
  commandName: string,
  text: string,
  context: Record<string, unknown>
): Promise<boolean> {
  if (getLastDispatchToken(api) === token) return true;
  if (typeof api.dispatchBridge !== "function") return false;

  const roomContext = loadContext(api);
  if (roomContext.slots.ai2.dispatchable !== true) return false;

  const raw = await api.dispatchBridge({
    action: "message.send",
    toSlot: "ai2",
    connectPolicy: "ensure",
    payload: {
      text,
      page: FATE_KNOTS_PAGE_ID,
      protocol: {
        room: ROOM_ID,
        scenario: "fate-knots-ai2-player-turn",
        context: {
          featureId: FATE_KNOTS_FEATURE_ID,
          ...context,
        },
      },
    },
  });
  if (!normalizeTransportSuccess(raw)) return false;

  setLastDispatchToken(api, token);
  setExpectedAi2Command(api, commandName);
  return true;
}

function loadCanonicalUniverseForRun(api: FateKnotsAi2LifecycleApi, universeId: string) {
  const universes = loadFateKnotsUniverseStore(api);
  if (universes.issues.length > 0) return null;
  const stored = universes.store.entries.find(
    (entry) => entry.universe.universeId === universeId
  )?.universe;
  if (!stored) return null;
  const canonical = normalizeFateKnotsCanonicalUniversePackage(stored);
  return canonical.valid && canonical.package ? canonical.package : null;
}

function activeAi2ActorId(run: { partyActorIds: string[]; actors: Array<{ actorId: string; seatId?: string | null }> }): string | null {
  const partyIds = new Set(run.partyActorIds);
  const matches = run.actors.filter(
    (actor) => partyIds.has(actor.actorId) && actor.seatId === "ai2"
  );
  return matches.length === 1 ? (matches[0]?.actorId ?? null) : null;
}

export async function requestFateKnotsAi2RunCharacter(
  api: FateKnotsAi2LifecycleApi,
  payload: unknown
): Promise<FateKnotsAi2RunSetupRequestResult> {
  const universeId = readUniverseId(payload);
  if (!universeId) {
    return { ok: false, error: "invalid-payload", issues: [{ code: "invalid-universe-id" }] };
  }
  if (loadContext(api).slots.ai2.dispatchable !== true) {
    return { ok: false, error: "ai2-unavailable", issues: [{ code: "ai2-unavailable" }] };
  }

  const universes = loadFateKnotsUniverseStore(api);
  const stored = universes.store.entries.find(
    (entry) => entry.universe.universeId === universeId
  )?.universe;
  if (!stored) {
    return {
      ok: false,
      error: "universe-not-found",
      issues: [{ code: "universe-not-found", value: universeId }],
    };
  }
  const canonical = normalizeFateKnotsCanonicalUniversePackage(stored);
  if (!canonical.valid || !canonical.package) {
    return {
      ok: false,
      error: "universe-rejected",
      issues: canonical.issues.map((issue) => ({ code: issue.code, value: issue.path })),
    };
  }

  setFateKnotsRunSetupSeatSelection(api, universeId, "ai2", null);
  clearLastDispatchToken(api);
  const setup = buildFateKnotsRunSetupSnapshot(canonical.package);
  const commandName = "GameRoomFateKnotsAi2SelectRunCharacter";
  const command = buildSlotBridgeCommand(commandName, {
    universeId,
    characterId: "<CHARACTER_ID>",
  });
  const characterLines = setup.characters.map((character) =>
    `${character.characterId}: ${character.name} · HP ${character.baseStats.maxHp} · ATK ${character.baseStats.attack} · DEF ${character.baseStats.defense} · SPD ${character.baseStats.speed} · ENG ${character.baseStats.energy}`
  );
  const text = [
    "[SETUP][GAME-ROOM][FATE-KNOTS][AI2]",
    `Universe: ${setup.title}`,
    "You are AI2, an independent player. Choose exactly one player-selectable character for your own seat.",
    ...characterLines,
    "Reply with only the SlotBridge command below, replacing <CHARACTER_ID> with one listed id:",
    command,
    "Do not choose for USER or US1. The host validates ownership and duplicate character choices.",
  ].join("\n");

  const dispatched = await dispatchAi2Message(
    api,
    `setup:${universeId}:${setup.characters.map((entry) => entry.characterId).join(",")}`,
    commandName,
    text,
    { phase: "run-setup", universeId }
  );
  if (!dispatched) {
    return { ok: false, error: "dispatch-failed", issues: [{ code: "dispatch-failed" }] };
  }
  return { ok: true, dispatched: true, universeId, issues: [] };
}

async function dispatchExploration(
  api: FateKnotsAi2LifecycleApi,
  runId: string,
  runRevision: number,
  universe: NonNullable<ReturnType<typeof loadCanonicalUniverseForRun>>,
  run: Parameters<typeof buildFateKnotsGameplayState>[1]
): Promise<boolean> {
  const commands = createFateKnotsExplorationConsensusCommands(api);
  const get = commands[FATE_KNOTS_EXPLORATION_CONSENSUS_COMMAND_NAMES.get];
  if (!get) return false;
  const result = get({ runId });
  if (!result.ok || !result.state.consensus) return false;
  const consensus = result.state.consensus;
  const ai2Choice = consensus.choices.find((choice) => choice.seatId === "ai2");
  if (!ai2Choice || ai2Choice.transitionId !== null || consensus.availableTransitions.length === 0) {
    clearExpectedAi2Command(api);
    return true;
  }

  const gameplay = buildFateKnotsGameplayState(universe, run);
  if (!gameplay.ok) return false;
  const commandName = FATE_KNOTS_EXPLORATION_CONSENSUS_COMMAND_NAMES.chooseAi2;
  const command = buildSlotBridgeCommand(commandName, {
    runId,
    transitionId: "<TRANSITION_ID>",
  });
  const token = `exploration:${runId}:${runRevision}:${consensus.activeKnotId}:${JSON.stringify(consensus.choices)}:${consensus.messages.length}`;
  const text = [
    "[TURN][GAME-ROOM][FATE-KNOTS][AI2][EXPLORATION]",
    `Location: ${gameplay.state.activeLocation?.name ?? "Unknown"}`,
    `Visible facts are represented only by the legal transition list and player-safe scene state.`,
    `Party: ${JSON.stringify(gameplay.state.partyActors)}`,
    `Visible NPCs: ${JSON.stringify(gameplay.state.visibleNpcs)}`,
    `Shared discussion: ${JSON.stringify(consensus.messages)}`,
    `Current public choices: ${JSON.stringify(consensus.choices)}`,
    `Legal transitions: ${JSON.stringify(consensus.availableTransitions)}`,
    "Choose exactly one legal transition id for your own seat. Unanimity advances canon; there is no extra confirm step.",
    "Reply with only this command, replacing <TRANSITION_ID> with one legal id:",
    command,
  ].join("\n");
  return await dispatchAi2Message(api, token, commandName, text, {
    phase: "exploration",
    runId,
    runRevision,
  });
}

async function dispatchCombat(
  api: FateKnotsAi2LifecycleApi,
  runId: string,
  runRevision: number,
  universe: NonNullable<ReturnType<typeof loadCanonicalUniverseForRun>>,
  run: Parameters<typeof buildFateKnotsGameplayState>[1],
  ai2ActorId: string
): Promise<boolean> {
  const combat = run.activeCombat;
  if (!combat) return false;
  const alreadyCommitted = combat.commits.some(
    (commit) => commit.actorId === ai2ActorId && commit.committed
  );
  if (alreadyCommitted) {
    clearExpectedAi2Command(api);
    return true;
  }

  const optionCommands = createFateKnotsCombatOptionCommands(api);
  const getOptions = optionCommands[FATE_KNOTS_COMBAT_OPTION_COMMAND_NAMES.getAi2Options];
  const discussionCommands = createFateKnotsCombatDiscussionCommands(api);
  const getDiscussion =
    discussionCommands[FATE_KNOTS_COMBAT_DISCUSSION_COMMAND_NAMES.getAi2];
  if (!getOptions || !getDiscussion) return false;
  const options = getOptions({ runId });
  const discussion = getDiscussion({ runId });
  if (!options.ok || !discussion.ok) return false;

  const gameplay = buildFateKnotsGameplayState(universe, run);
  if (!gameplay.ok) return false;
  const commandName = "GameRoomFateKnotsAi2CompleteCombatMove";
  const command = buildSlotBridgeCommand(commandName, {
    runId,
    movementCardId: "<MOVEMENT_CARD_ID_OR_NULL>",
    actionCardId: "<ACTION_CARD_ID_OR_NULL>",
    primaryTargetId: "<PRIMARY_TARGET_ID_OR_NULL>",
    secondaryTargetId: null,
  });
  const token = `combat:${runId}:${runRevision}:${combat.combatId}:${combat.turnIndex}:${discussion.state.messages.length}`;
  const text = [
    "[TURN][GAME-ROOM][FATE-KNOTS][AI2][COMBAT]",
    `Public combat state: ${JSON.stringify(gameplay.state.combat)}`,
    `Shared party discussion: ${JSON.stringify(discussion.state.messages)}`,
    `Your private legal movement options: ${JSON.stringify(options.state.movementOptions)}`,
    `Your private legal action options: ${JSON.stringify(options.state.actionOptions)}`,
    "Choose one legal move for your own actor. Use null for an omitted movement/action/target only when that combination is legal.",
    "Reply with only this command, replacing placeholders with ids from the legal options:",
    command,
    "The host owns enemy decisions and turn resolution. Do not invent hidden cards, actor ids, or results.",
  ].join("\n");
  return await dispatchAi2Message(api, token, commandName, text, {
    phase: combat.phase,
    runId,
    runRevision,
    combatId: combat.combatId,
    turnIndex: combat.turnIndex,
  });
}

async function dispatchCamp(
  api: FateKnotsAi2LifecycleApi,
  runId: string,
  runRevision: number
): Promise<boolean> {
  const commands = createFateKnotsCampCommands(api);
  const get = commands[FATE_KNOTS_CAMP_COMMAND_NAMES.get];
  if (!get) return false;
  const result = get({ runId });
  if (!result.ok || !result.state.activeSeatIds.includes("ai2")) return false;
  if (result.state.readySeatIds.includes("ai2")) {
    clearExpectedAi2Command(api);
    return true;
  }
  const commandName = FATE_KNOTS_CAMP_COMMAND_NAMES.readyAi2;
  const command = buildSlotBridgeCommand(commandName, { runId });
  const token = `camp:${runId}:${runRevision}:${result.state.readySeatIds.join(",")}`;
  const text = [
    "[TURN][GAME-ROOM][FATE-KNOTS][AI2][CAMP]",
    "Camp recovery is already canonical. V1 AI2 keeps its current equipment unless a later strategy layer explicitly changes it.",
    "Mark your own seat ready. Camp exits only after every active player seat is ready.",
    "Reply with only this command:",
    command,
  ].join("\n");
  return await dispatchAi2Message(api, token, commandName, text, {
    phase: "camp",
    runId,
    runRevision,
  });
}

async function dispatchLoot(
  api: FateKnotsAi2LifecycleApi,
  runId: string,
  runRevision: number
): Promise<boolean> {
  const commands = createFateKnotsLootCommands(api);
  const get = commands[FATE_KNOTS_LOOT_COMMAND_NAMES.get];
  if (!get) return false;
  const result = get({ runId });
  if (!result.ok || !result.state.activeSeatIds.includes("ai2")) return false;
  if (result.state.approvedSeatIds.includes("ai2")) {
    clearExpectedAi2Command(api);
    return true;
  }
  if (result.state.allocations.length === 0) {
    clearExpectedAi2Command(api);
    return true;
  }

  const commandName = FATE_KNOTS_LOOT_COMMAND_NAMES.approveAi2;
  const command = buildSlotBridgeCommand(commandName, { runId });
  const token = `loot:${runId}:${runRevision}:${result.state.proposalRevision}:${JSON.stringify(result.state.allocations)}:${result.state.approvedSeatIds.join(",")}`;
  const text = [
    "[TURN][GAME-ROOM][FATE-KNOTS][AI2][LOOT]",
    `Loot pool: ${JSON.stringify(result.state.pool)}`,
    `Current allocation proposal: ${JSON.stringify(result.state.allocations)}`,
    `Already approved seats: ${JSON.stringify(result.state.approvedSeatIds)}`,
    "V1 AI2 does not replace an existing player proposal automatically. Approve this exact proposal for your own seat.",
    "Reply with only this command:",
    command,
  ].join("\n");
  return await dispatchAi2Message(api, token, commandName, text, {
    phase: "loot",
    runId,
    runRevision,
    proposalRevision: result.state.proposalRevision,
  });
}

/**
 * Dispatches exactly the next bounded AI2 player decision, if any. The token
 * makes repeated lifecycle probes idempotent while still allowing a new prompt
 * after public discussion/choice state changes.
 */
export async function dispatchFateKnotsAi2LifecycleIfNeeded(
  api: FateKnotsAi2LifecycleApi
): Promise<boolean> {
  const runs = loadFateKnotsRunStore(api);
  if (runs.issues.length > 0 || !runs.store.activeRunId) {
    clearExpectedAi2Command(api);
    return true;
  }
  const snapshot = runs.store.entries.find(
    (entry) => entry.run.runId === runs.store.activeRunId
  );
  if (!snapshot) {
    clearExpectedAi2Command(api);
    return true;
  }
  const run = snapshot.run;
  if (run.result !== "active") {
    clearExpectedAi2Command(api);
    return true;
  }
  const ai2ActorId = activeAi2ActorId(run);
  if (!ai2ActorId) {
    clearExpectedAi2Command(api);
    return true;
  }
  if (loadContext(api).slots.ai2.dispatchable !== true) return false;

  const universe = loadCanonicalUniverseForRun(api, run.universeId);
  if (!universe) return false;

  if (run.phase === "exploration") {
    return await dispatchExploration(api, run.runId, run.revision, universe, run);
  }
  if (run.phase === "combat-discussion" || run.phase === "combat-commit") {
    return await dispatchCombat(api, run.runId, run.revision, universe, run, ai2ActorId);
  }
  if (run.phase === "camp") {
    return await dispatchCamp(api, run.runId, run.revision);
  }
  if (run.phase === "loot") {
    return await dispatchLoot(api, run.runId, run.revision);
  }

  clearExpectedAi2Command(api);
  return true;
}

export function clearFateKnotsAi2Lifecycle(api: FateKnotsAi2LifecycleApi): void {
  clearExpectedAi2Command(api);
  clearLastDispatchToken(api);
}

export function getFateKnotsAi2RunSetupSelection(
  api: FateKnotsAi2LifecycleApi,
  universeId: string
): string | null {
  return getFateKnotsRunSetupSeatSelection(api, universeId, "ai2");
}
