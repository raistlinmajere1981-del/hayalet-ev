import { normalizeFateKnotsCanonicalUniversePackage } from "../forge/canonical-universe.js";
import { FATE_KNOTS_CAMP_COMMAND_NAMES, createFateKnotsCampCommands } from "./camp-runtime.js";
import {
  FATE_KNOTS_COMBAT_DISCUSSION_COMMAND_NAMES,
  createFateKnotsCombatDiscussionCommands,
} from "./combat-discussion-runtime.js";
import {
  FATE_KNOTS_COMBAT_OPTION_COMMAND_NAMES,
  createFateKnotsCombatOptionCommands,
} from "./combat-options-runtime.js";
import {
  FATE_KNOTS_EXPLORATION_CONSENSUS_COMMAND_NAMES,
  createFateKnotsExplorationConsensusCommands,
} from "./exploration-consensus-runtime.js";
import { buildFateKnotsGameplayState } from "./gameplay-state.js";
import { FATE_KNOTS_LOOT_COMMAND_NAMES, createFateKnotsLootCommands } from "./loot-runtime.js";
import {
  loadFateKnotsRunStore,
  loadFateKnotsUniverseStore,
  type FateKnotsPersistenceApi,
} from "./persistence.js";
import {
  readFateKnotsRunSetupSeatProjection,
  setFateKnotsRunSetupSeatSelection,
} from "./run-setup-seat-coordination.js";
import { buildFateKnotsRunSetupSnapshot } from "./run-setup-state.js";
import { loadContext } from "../../../shared/host/context-state.js";
import { FATE_KNOTS_FEATURE_ID, ROOM_ID } from "../../../shared/host/feature-meta.js";
import { buildUs1RoomBridgeCommand } from "../../../shared/host/slot-bridge-command.js";

const MIRROR_SCHEMA_VERSION = 1;
const CLIENT_MIRROR_STATE_KEY = "game-room:fate-knots:us1-client-mirror:v1";
const WORLD_TRANSPORT_STATE_KEY = "game-room:fate-knots:us1-world-transport:v1";
const WORLD_SETUP_STATE_KEY = "game-room:fate-knots:us1-world-setup:v1";
const CLIENT_RETURN_TRANSPORT_STATE_KEY = "game-room:fate-knots:us1-client-return-transport:v1";
const LAST_NPC_DIALOGUE_STATE_KEY = "game-room:fate-knots:us1-last-npc-dialogue:v1";

export const FATE_KNOTS_US1_LIFECYCLE_COMMAND_NAMES = {
  requestRunCharacter: "GameRoomFateKnotsRequestUs1RunCharacter",
  cancelRunCharacter: "GameRoomFateKnotsCancelUs1RunCharacter",
  clientSync: "GameRoomFateKnotsUs1ClientSync",
  clientSelectCharacter: "GameRoomFateKnotsUs1ClientSelectCharacter",
  clientSendExplorationMessage: "GameRoomFateKnotsUs1ClientSendExplorationMessage",
  clientChooseExploration: "GameRoomFateKnotsUs1ClientChooseExploration",
  clientSendCombatMessage: "GameRoomFateKnotsUs1ClientSendCombatMessage",
  clientCompleteCombatMove: "GameRoomFateKnotsUs1ClientCompleteCombatMove",
  clientSpeakNpc: "GameRoomFateKnotsUs1ClientSpeakNpc",
  clientProposeLoot: "GameRoomFateKnotsUs1ClientProposeLoot",
  clientApproveLoot: "GameRoomFateKnotsUs1ClientApproveLoot",
  clientSetCampEquipment: "GameRoomFateKnotsUs1ClientSetCampEquipment",
  clientReadyCamp: "GameRoomFateKnotsUs1ClientReadyCamp",
} as const;

export type FateKnotsUs1MirrorSnapshot =
  | {
      schemaVersion: typeof MIRROR_SCHEMA_VERSION;
      kind: "clear";
    }
  | {
      schemaVersion: typeof MIRROR_SCHEMA_VERSION;
      kind: "setup";
      universeId: string;
      setup: ReturnType<typeof buildFateKnotsRunSetupSnapshot>;
      seats: ReturnType<typeof readFateKnotsRunSetupSeatProjection>;
    }
  | {
      schemaVersion: typeof MIRROR_SCHEMA_VERSION;
      kind: "run";
      universeId: string;
      runId: string;
      runRevision: number;
      phase: string;
      result: string;
      gameplay: unknown;
      exploration: unknown;
      combat: unknown;
      camp: unknown;
      loot: unknown;
      lastNpcDialogue: unknown;
    };

type TransportMode = "setup" | "run" | "clear";

interface FateKnotsUs1LifecycleApi extends FateKnotsPersistenceApi {
  dispatchBridge?(options: Record<string, unknown>): Promise<unknown> | unknown;
  deleteState?(key: string): void;
  log?(level: string, message: string): void;
}

interface TransportState {
  mode: TransportMode | null;
  lastToken: string | null;
  localSessionId: string | null;
  remoteUserId: string | null;
}

interface TransportResult {
  success: boolean;
  localSessionId: string | null;
  remoteUserId: string | null;
}

export type FateKnotsUs1SetupRequestResult =
  | { ok: true; universeId: string; issues: [] }
  | {
      ok: false;
      error:
        | "invalid-payload"
        | "us1-unavailable"
        | "universe-not-found"
        | "universe-rejected"
        | "dispatch-failed";
      issues: Array<{ code: string; value?: string }>;
    };

export type FateKnotsUs1ClientIntentResult =
  | { ok: true; dispatched: true; issues: [] }
  | {
      ok: false;
      error: "invalid-payload" | "mirror-unavailable" | "us1-unavailable" | "dispatch-failed";
      issues: Array<{ code: string; value?: string }>;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function readNullableString(value: unknown): string | null | "invalid" {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? (value.trim() === "" ? null : value.trim()) : "invalid";
}

function clearStateKey(api: FateKnotsUs1LifecycleApi, key: string): void {
  if (typeof api.deleteState === "function") {
    api.deleteState(key);
    return;
  }
  api.setState(key, null);
}

function readTransportState(api: FateKnotsUs1LifecycleApi, key: string): TransportState {
  const raw = api.getState(key);
  if (!isRecord(raw)) {
    return { mode: null, lastToken: null, localSessionId: null, remoteUserId: null };
  }
  const mode =
    raw["mode"] === "setup" || raw["mode"] === "run" || raw["mode"] === "clear"
      ? raw["mode"]
      : null;
  return {
    mode,
    lastToken: readString(raw["lastToken"]),
    localSessionId: readString(raw["localSessionId"]),
    remoteUserId: readString(raw["remoteUserId"]),
  };
}

function writeTransportState(
  api: FateKnotsUs1LifecycleApi,
  key: string,
  state: TransportState
): void {
  api.setState(key, state);
}

function normalizeTransportResult(value: unknown): TransportResult {
  if (!isRecord(value)) return { success: false, localSessionId: null, remoteUserId: null };
  const session = isRecord(value["session"]) ? value["session"] : {};
  const data = isRecord(value["data"]) ? value["data"] : {};
  return {
    success: value["success"] === true,
    localSessionId: readString(session["id"]),
    remoteUserId: readString(data["remoteUserId"]),
  };
}

function snapshotToken(snapshot: FateKnotsUs1MirrorSnapshot): string {
  const source = JSON.stringify(snapshot);
  let hash = 7;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) % 2147483647;
  }
  return `${snapshot.kind}:${hash.toString(36)}`;
}

function mirrorText(snapshot: FateKnotsUs1MirrorSnapshot): string {
  if (snapshot.kind === "clear") return "Fate Knots remote session closed.";
  if (snapshot.kind === "setup") {
    return "Fate Knots character selection is waiting for you. Open Game Room > Fate Knots.";
  }
  return `Fate Knots remote state synchronized · ${snapshot.phase} · revision ${snapshot.runRevision}.`;
}

async function sendWorldMirrorSnapshot(
  api: FateKnotsUs1LifecycleApi,
  snapshot: FateKnotsUs1MirrorSnapshot,
  mode: TransportMode
): Promise<boolean> {
  if (typeof api.dispatchBridge !== "function") return false;
  const context = loadContext(api);
  const remoteUserId = context.slots.us1.remoteUserId;
  if (context.slots.us1.dispatchable !== true || !remoteUserId) return false;

  const token = snapshotToken(snapshot);
  const previous = readTransportState(api, WORLD_TRANSPORT_STATE_KEY);
  if (previous.lastToken === token && previous.remoteUserId === remoteUserId) return true;
  const reusableSessionId = previous.remoteUserId === remoteUserId ? previous.localSessionId : null;

  const raw = await api.dispatchBridge({
    action: "message.send",
    toSlot: "us1",
    ...(reusableSessionId
      ? {
          sessionRef: {
            id: reusableSessionId,
          },
        }
      : {}),
    payload: {
      text: mirrorText(snapshot),
      remoteUserId,
      roomCommand: buildUs1RoomBridgeCommand({
        roomId: ROOM_ID,
        featureId: FATE_KNOTS_FEATURE_ID,
        commandName: FATE_KNOTS_US1_LIFECYCLE_COMMAND_NAMES.clientSync,
        payload: { snapshot },
      }),
    },
  });
  const result = normalizeTransportResult(raw);
  if (!result.success) return false;

  writeTransportState(api, WORLD_TRANSPORT_STATE_KEY, {
    mode,
    lastToken: token,
    localSessionId: result.localSessionId ?? reusableSessionId,
    remoteUserId: result.remoteUserId ?? remoteUserId,
  });
  return true;
}

function normalizeMirrorSnapshot(value: unknown): FateKnotsUs1MirrorSnapshot | null {
  if (!isRecord(value) || value["schemaVersion"] !== MIRROR_SCHEMA_VERSION) return null;
  if (value["kind"] === "clear") {
    return { schemaVersion: MIRROR_SCHEMA_VERSION, kind: "clear" };
  }
  if (value["kind"] === "setup") {
    const universeId = readString(value["universeId"]);
    if (!universeId || !isRecord(value["setup"]) || !isRecord(value["seats"])) return null;
    return structuredClone(value) as FateKnotsUs1MirrorSnapshot;
  }
  if (value["kind"] === "run") {
    const universeId = readString(value["universeId"]);
    const runId = readString(value["runId"]);
    const runRevision = value["runRevision"];
    const phase = readString(value["phase"]);
    const result = readString(value["result"]);
    if (
      !universeId ||
      !runId ||
      typeof runRevision !== "number" ||
      !Number.isInteger(runRevision) ||
      runRevision < 0 ||
      !phase ||
      !result
    ) {
      return null;
    }
    return structuredClone(value) as FateKnotsUs1MirrorSnapshot;
  }
  return null;
}

export function applyFateKnotsUs1ClientMirrorSync(
  api: FateKnotsUs1LifecycleApi,
  payload: unknown,
  peerRemoteUserId: string | null = null
):
  | { ok: true; state: FateKnotsUs1MirrorSnapshot | null; issues: [] }
  | {
      ok: false;
      error: "invalid-payload";
      state: null;
      issues: Array<{ code: string }>;
    } {
  const snapshot = isRecord(payload) ? normalizeMirrorSnapshot(payload["snapshot"]) : null;
  if (!snapshot) {
    return {
      ok: false,
      error: "invalid-payload",
      state: null,
      issues: [{ code: "invalid-us1-mirror-snapshot" }],
    };
  }

  if (peerRemoteUserId) {
    const previous = readTransportState(api, CLIENT_RETURN_TRANSPORT_STATE_KEY);
    writeTransportState(api, CLIENT_RETURN_TRANSPORT_STATE_KEY, {
      ...previous,
      remoteUserId: peerRemoteUserId,
    });
  }

  if (snapshot.kind === "clear") {
    clearStateKey(api, CLIENT_MIRROR_STATE_KEY);
    return { ok: true, state: null, issues: [] };
  }
  api.setState(CLIENT_MIRROR_STATE_KEY, snapshot);
  return { ok: true, state: snapshot, issues: [] };
}

export function readFateKnotsUs1ClientMirror(
  api: FateKnotsUs1LifecycleApi
): FateKnotsUs1MirrorSnapshot | null {
  return normalizeMirrorSnapshot(api.getState(CLIENT_MIRROR_STATE_KEY));
}

function loadCanonicalUniverse(api: FateKnotsUs1LifecycleApi, universeId: string) {
  const universes = loadFateKnotsUniverseStore(api);
  if (universes.issues.length > 0) return null;
  const stored = universes.store.entries.find(
    (entry) => entry.universe.universeId === universeId
  )?.universe;
  if (!stored) return null;
  const canonical = normalizeFateKnotsCanonicalUniversePackage(stored);
  return canonical.valid && canonical.package ? canonical.package : null;
}

function hasExactlyOneUs1PartyActor(run: {
  partyActorIds: string[];
  actors: Array<{ actorId: string; seatId?: string | null }>;
}): boolean {
  const partyIds = new Set(run.partyActorIds);
  return (
    run.actors.filter((actor) => partyIds.has(actor.actorId) && actor.seatId === "us1").length === 1
  );
}

function readLastNpcDialogue(api: FateKnotsUs1LifecycleApi, runId: string): unknown {
  const value = api.getState(LAST_NPC_DIALOGUE_STATE_KEY);
  return isRecord(value) && value["runId"] === runId ? structuredClone(value["state"]) : null;
}

export function recordFateKnotsUs1NpcDialogue(
  api: FateKnotsUs1LifecycleApi,
  state: unknown
): void {
  if (!isRecord(state)) return;
  const runId = readString(state["runId"]);
  if (!runId) return;
  api.setState(LAST_NPC_DIALOGUE_STATE_KEY, { runId, state: structuredClone(state) });
}

function buildSetupMirrorSnapshot(
  api: FateKnotsUs1LifecycleApi,
  universeId: string
): FateKnotsUs1MirrorSnapshot | null {
  const universe = loadCanonicalUniverse(api, universeId);
  if (!universe) return null;
  return {
    schemaVersion: MIRROR_SCHEMA_VERSION,
    kind: "setup",
    universeId,
    setup: buildFateKnotsRunSetupSnapshot(universe),
    seats: readFateKnotsRunSetupSeatProjection(api, universeId),
  };
}

function readPendingSetupUniverseId(api: FateKnotsUs1LifecycleApi): string | null {
  const value = api.getState(WORLD_SETUP_STATE_KEY);
  return isRecord(value) ? readString(value["universeId"]) : null;
}

function setPendingSetupUniverseId(api: FateKnotsUs1LifecycleApi, universeId: string | null): void {
  if (universeId === null) {
    clearStateKey(api, WORLD_SETUP_STATE_KEY);
    return;
  }
  api.setState(WORLD_SETUP_STATE_KEY, { universeId });
}

export function completeFateKnotsUs1RunSetup(api: FateKnotsUs1LifecycleApi): void {
  setPendingSetupUniverseId(api, null);
  const transport = readTransportState(api, WORLD_TRANSPORT_STATE_KEY);
  writeTransportState(api, WORLD_TRANSPORT_STATE_KEY, {
    ...transport,
    mode: null,
    lastToken: null,
  });
}

function buildRunMirrorSnapshot(
  api: FateKnotsUs1LifecycleApi
): FateKnotsUs1MirrorSnapshot | null {
  const runs = loadFateKnotsRunStore(api);
  if (runs.issues.length > 0 || !runs.store.activeRunId) return null;
  const storedRun = runs.store.entries.find((entry) => entry.run.runId === runs.store.activeRunId);
  if (!storedRun || !hasExactlyOneUs1PartyActor(storedRun.run)) return null;
  const run = storedRun.run;
  const universe = loadCanonicalUniverse(api, run.universeId);
  if (!universe) return null;

  const gameplay = buildFateKnotsGameplayState(universe, run);
  if (!gameplay.ok) return null;

  let exploration: unknown = null;
  let combat: unknown = null;
  let camp: unknown = null;
  let loot: unknown = null;

  if (run.result === "active" && run.phase === "exploration") {
    const commands = createFateKnotsExplorationConsensusCommands(api);
    const get = commands[FATE_KNOTS_EXPLORATION_CONSENSUS_COMMAND_NAMES.get];
    const state = get?.({ runId: run.runId });
    if (state?.ok) exploration = state.state.consensus;
  }

  if (
    run.result === "active" &&
    (run.phase === "combat-discussion" || run.phase === "combat-commit")
  ) {
    const optionCommands = createFateKnotsCombatOptionCommands(api);
    const discussionCommands = createFateKnotsCombatDiscussionCommands(api);
    const options = optionCommands[FATE_KNOTS_COMBAT_OPTION_COMMAND_NAMES.getRemoteOptions]?.({
      runId: run.runId,
    });
    const discussion = discussionCommands[
      FATE_KNOTS_COMBAT_DISCUSSION_COMMAND_NAMES.getRemote
    ]?.({ runId: run.runId });
    if (options?.ok && discussion?.ok) {
      combat = {
        options: options.state,
        discussion: discussion.state,
      };
    }
  }

  if (run.result === "active" && run.phase === "camp") {
    const commands = createFateKnotsCampCommands(api);
    const state = commands[FATE_KNOTS_CAMP_COMMAND_NAMES.get]?.({ runId: run.runId });
    if (state?.ok) camp = state.state;
  }

  if (run.result === "active" && run.phase === "loot") {
    const commands = createFateKnotsLootCommands(api);
    const state = commands[FATE_KNOTS_LOOT_COMMAND_NAMES.get]?.({ runId: run.runId });
    if (state?.ok) loot = state.state;
  }

  return {
    schemaVersion: MIRROR_SCHEMA_VERSION,
    kind: "run",
    universeId: run.universeId,
    runId: run.runId,
    runRevision: run.revision,
    phase: run.phase,
    result: run.result,
    gameplay: gameplay.state,
    exploration,
    combat,
    camp,
    loot,
    lastNpcDialogue: readLastNpcDialogue(api, run.runId),
  };
}

function readUniverseId(payload: unknown): string | null {
  return isRecord(payload) ? readString(payload["universeId"]) : null;
}

export async function requestFateKnotsUs1RunCharacter(
  api: FateKnotsUs1LifecycleApi,
  payload: unknown
): Promise<FateKnotsUs1SetupRequestResult> {
  const universeId = readUniverseId(payload);
  if (!universeId) {
    return { ok: false, error: "invalid-payload", issues: [{ code: "invalid-universe-id" }] };
  }
  const context = loadContext(api);
  if (context.slots.us1.dispatchable !== true || !context.slots.us1.remoteUserId) {
    return { ok: false, error: "us1-unavailable", issues: [{ code: "us1-unavailable" }] };
  }

  const snapshot = buildSetupMirrorSnapshot(api, universeId);
  if (!snapshot) {
    const universes = loadFateKnotsUniverseStore(api);
    const exists = universes.store.entries.some(
      (entry) => entry.universe.universeId === universeId
    );
    return exists
      ? { ok: false, error: "universe-rejected", issues: [{ code: "universe-rejected" }] }
      : {
          ok: false,
          error: "universe-not-found",
          issues: [{ code: "universe-not-found", value: universeId }],
        };
  }

  setFateKnotsRunSetupSeatSelection(api, universeId, "us1", null);
  setPendingSetupUniverseId(api, universeId);
  const refreshed = buildSetupMirrorSnapshot(api, universeId);
  if (!refreshed || !(await sendWorldMirrorSnapshot(api, refreshed, "setup"))) {
    return { ok: false, error: "dispatch-failed", issues: [{ code: "dispatch-failed" }] };
  }
  return { ok: true, universeId, issues: [] };
}

export async function cancelFateKnotsUs1RunCharacter(
  api: FateKnotsUs1LifecycleApi,
  payload: unknown
): Promise<FateKnotsUs1SetupRequestResult> {
  const universeId = readUniverseId(payload);
  if (!universeId) {
    return { ok: false, error: "invalid-payload", issues: [{ code: "invalid-universe-id" }] };
  }
  setFateKnotsRunSetupSeatSelection(api, universeId, "us1", null);
  setPendingSetupUniverseId(api, null);
  const context = loadContext(api);
  if (context.slots.us1.dispatchable === true && context.slots.us1.remoteUserId) {
    await sendWorldMirrorSnapshot(
      api,
      { schemaVersion: MIRROR_SCHEMA_VERSION, kind: "clear" },
      "clear"
    );
  }
  return { ok: true, universeId, issues: [] };
}

export async function dispatchFateKnotsUs1LifecycleIfNeeded(
  api: FateKnotsUs1LifecycleApi
): Promise<boolean> {
  const context = loadContext(api);
  if (context.slots.us1.dispatchable !== true || !context.slots.us1.remoteUserId) return false;

  const pendingSetupUniverseId = readPendingSetupUniverseId(api);
  if (pendingSetupUniverseId) {
    const setup = buildSetupMirrorSnapshot(api, pendingSetupUniverseId);
    return setup ? await sendWorldMirrorSnapshot(api, setup, "setup") : false;
  }

  const snapshot = buildRunMirrorSnapshot(api);
  if (snapshot) return await sendWorldMirrorSnapshot(api, snapshot, "run");

  const transport = readTransportState(api, WORLD_TRANSPORT_STATE_KEY);
  if (transport.mode === null || transport.mode === "clear") return true;
  return await sendWorldMirrorSnapshot(
    api,
    { schemaVersion: MIRROR_SCHEMA_VERSION, kind: "clear" },
    "clear"
  );
}

function mirrorRunId(mirror: FateKnotsUs1MirrorSnapshot): string | null {
  return mirror.kind === "run" ? mirror.runId : null;
}

function mirrorUniverseId(mirror: FateKnotsUs1MirrorSnapshot): string | null {
  return mirror.kind === "setup" ? mirror.universeId : null;
}

function readText(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const text = readString(payload["text"]);
  return text && text.length <= 2000 ? text : null;
}

function buildClientIntent(
  mirror: FateKnotsUs1MirrorSnapshot,
  clientCommandName: string,
  payload: unknown
): { worldCommandName: string; roomArgs: Record<string, unknown> } | null {
  const source = isRecord(payload) ? payload : {};

  if (clientCommandName === FATE_KNOTS_US1_LIFECYCLE_COMMAND_NAMES.clientSelectCharacter) {
    const universeId = mirrorUniverseId(mirror);
    if (!universeId) return null;
    const characterId = readNullableString(source["characterId"]);
    if (characterId === "invalid") return null;
    return {
      worldCommandName: "GameRoomFateKnotsRemoteSelectRunCharacter",
      roomArgs: { universeId, characterId },
    };
  }

  const runId = mirrorRunId(mirror);
  if (!runId) return null;

  if (clientCommandName === FATE_KNOTS_US1_LIFECYCLE_COMMAND_NAMES.clientSendExplorationMessage) {
    const text = readText(source);
    return text
      ? {
          worldCommandName: "GameRoomFateKnotsRemoteExplorationMessage",
          roomArgs: { runId, text },
        }
      : null;
  }
  if (clientCommandName === FATE_KNOTS_US1_LIFECYCLE_COMMAND_NAMES.clientChooseExploration) {
    const transitionId = readNullableString(source["transitionId"]);
    if (transitionId === "invalid") return null;
    return {
      worldCommandName: "GameRoomFateKnotsRemoteChooseExploration",
      roomArgs: { runId, transitionId },
    };
  }
  if (clientCommandName === FATE_KNOTS_US1_LIFECYCLE_COMMAND_NAMES.clientSendCombatMessage) {
    const text = readText(source);
    return text
      ? {
          worldCommandName: "GameRoomFateKnotsRemoteCombatMessage",
          roomArgs: { runId, text },
        }
      : null;
  }
  if (clientCommandName === FATE_KNOTS_US1_LIFECYCLE_COMMAND_NAMES.clientCompleteCombatMove) {
    const movementCardId = readNullableString(source["movementCardId"]);
    const actionCardId = readNullableString(source["actionCardId"]);
    const primaryTargetId = readNullableString(source["primaryTargetId"]);
    if (
      movementCardId === "invalid" ||
      actionCardId === "invalid" ||
      primaryTargetId === "invalid"
    ) {
      return null;
    }
    return {
      worldCommandName: "GameRoomFateKnotsRemoteCompleteCombatMove",
      roomArgs: {
        runId,
        ...(movementCardId ? { movementCardId } : {}),
        ...(actionCardId ? { actionCardId } : {}),
        ...(primaryTargetId ? { primaryTargetId } : {}),
      },
    };
  }
  if (clientCommandName === FATE_KNOTS_US1_LIFECYCLE_COMMAND_NAMES.clientSpeakNpc) {
    const npcId = readString(source["npcId"]);
    const text = readText(source);
    return npcId && text
      ? {
          worldCommandName: "GameRoomFateKnotsRemoteSpeakNpc",
          roomArgs: { runId, npcId, text },
        }
      : null;
  }
  if (clientCommandName === FATE_KNOTS_US1_LIFECYCLE_COMMAND_NAMES.clientProposeLoot) {
    if (!Array.isArray(source["allocations"])) return null;
    const allocations: Array<{ poolIndex: number; recipientActorId: string | null }> = [];
    for (const value of source["allocations"]) {
      if (!isRecord(value)) return null;
      const poolIndex = value["poolIndex"];
      const recipientActorId = readNullableString(value["recipientActorId"]);
      if (
        typeof poolIndex !== "number" ||
        !Number.isInteger(poolIndex) ||
        poolIndex < 0 ||
        recipientActorId === "invalid"
      ) {
        return null;
      }
      allocations.push({ poolIndex, recipientActorId });
    }
    return {
      worldCommandName: "GameRoomFateKnotsRemoteProposeLoot",
      roomArgs: { runId, allocations },
    };
  }
  if (clientCommandName === FATE_KNOTS_US1_LIFECYCLE_COMMAND_NAMES.clientApproveLoot) {
    return {
      worldCommandName: "GameRoomFateKnotsRemoteApproveLoot",
      roomArgs: { runId },
    };
  }
  if (clientCommandName === FATE_KNOTS_US1_LIFECYCLE_COMMAND_NAMES.clientSetCampEquipment) {
    const slot = readString(source["slot"]);
    const equipmentId = readNullableString(source["equipmentId"]);
    if (!slot || equipmentId === "invalid") return null;
    return {
      worldCommandName: "GameRoomFateKnotsRemoteSetCampEquipment",
      roomArgs: { runId, slot, equipmentId },
    };
  }
  if (clientCommandName === FATE_KNOTS_US1_LIFECYCLE_COMMAND_NAMES.clientReadyCamp) {
    return {
      worldCommandName: "GameRoomFateKnotsRemoteReadyCamp",
      roomArgs: { runId },
    };
  }
  return null;
}

export async function forwardFateKnotsUs1ClientIntent(
  api: FateKnotsUs1LifecycleApi,
  clientCommandName: string,
  payload: unknown
): Promise<FateKnotsUs1ClientIntentResult> {
  const mirror = readFateKnotsUs1ClientMirror(api);
  if (!mirror) {
    return { ok: false, error: "mirror-unavailable", issues: [{ code: "mirror-unavailable" }] };
  }
  const intent = buildClientIntent(mirror, clientCommandName, payload);
  if (!intent) {
    return { ok: false, error: "invalid-payload", issues: [{ code: "invalid-client-intent" }] };
  }
  if (typeof api.dispatchBridge !== "function") {
    return { ok: false, error: "dispatch-failed", issues: [{ code: "dispatch-failed" }] };
  }

  const context = loadContext(api);
  const transport = readTransportState(api, CLIENT_RETURN_TRANSPORT_STATE_KEY);
  const remoteUserId = transport.remoteUserId ?? context.slots.us1.remoteUserId;
  if (!remoteUserId) {
    return { ok: false, error: "us1-unavailable", issues: [{ code: "us1-unavailable" }] };
  }
  const reusableSessionId =
    transport.remoteUserId === remoteUserId ? transport.localSessionId : null;
  const raw = await api.dispatchBridge({
    action: "message.send",
    toSlot: "us1",
    ...(reusableSessionId
      ? {
          sessionRef: {
            id: reusableSessionId,
          },
        }
      : {}),
    payload: {
      text: `Fate Knots remote player intent: ${intent.worldCommandName}`,
      remoteUserId,
      roomCommand: buildUs1RoomBridgeCommand({
        roomId: ROOM_ID,
        featureId: FATE_KNOTS_FEATURE_ID,
        commandName: intent.worldCommandName,
        payload: intent.roomArgs,
      }),
    },
  });
  const result = normalizeTransportResult(raw);
  if (!result.success) {
    return { ok: false, error: "dispatch-failed", issues: [{ code: "dispatch-failed" }] };
  }
  writeTransportState(api, CLIENT_RETURN_TRANSPORT_STATE_KEY, {
    mode: null,
    lastToken: null,
    localSessionId: result.localSessionId ?? reusableSessionId,
    remoteUserId: result.remoteUserId ?? remoteUserId,
  });
  return { ok: true, dispatched: true, issues: [] };
}

export function clearFateKnotsUs1Lifecycle(api: FateKnotsUs1LifecycleApi): void {
  clearStateKey(api, WORLD_TRANSPORT_STATE_KEY);
  clearStateKey(api, WORLD_SETUP_STATE_KEY);
  clearStateKey(api, CLIENT_RETURN_TRANSPORT_STATE_KEY);
  clearStateKey(api, CLIENT_MIRROR_STATE_KEY);
  clearStateKey(api, LAST_NPC_DIALOGUE_STATE_KEY);
}
