import test from "node:test";
import assert from "node:assert/strict";

import createPatternRoomHostRuntime from "../../rooms/pattern-room/host/runtime.ts";
import { PATTERN_ROOM_DOMAIN_MOCK } from "../../rooms/pattern-room/shared/data/pattern-room-domain.mock.ts";
import { createLocalState } from "../../rooms/pattern-room/shared/state/pattern-room-local-state.ts";
import {
  createSnapshot,
  restoreFromSnapshot,
} from "../../rooms/pattern-room/shared/state/pattern-room-snapshot.ts";
import { PATTERN_ROOM_SNAPSHOT_VERSION } from "../../rooms/pattern-room/shared/types/pattern-room-snapshot.ts";

function createSnapshotReadyLocalState(): ReturnType<typeof createLocalState> {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);

  localState.sendToDesk("node-navigation-source");
  localState.pinSource("source-shadow-comparison", "analysis");
  localState.addToDebate("node-shadow-analysis");
  localState.addToDebate("source-shadow-comparison");
  localState.addLocalNote("Snapshot smoke note");
  localState.prepareDebate();
  localState.assignDebateRoles();
  localState.startDebate();
  localState.advanceDebatePhase();
  localState.advanceDebatePhase();
  localState.advanceDebatePhase();
  localState.advanceDebatePhase();
  localState.completeDebate();
  localState.reflectDebateToReport();

  return localState;
}

function assertRestoredSnapshotStateMatches(
  left: {
    overlay: unknown;
    activeView: unknown;
    guards: unknown;
  },
  right: {
    overlay: unknown;
    activeView: unknown;
    guards: unknown;
  }
): void {
  assert.deepEqual(left.overlay, right.overlay);
  assert.equal(left.activeView, right.activeView);
  assert.deepEqual(left.guards, right.guards);
}


describe("pattern-room phase 6B creates a local session snapshot from local mutations", () => {
void test("pattern-room phase 6B creates a local session snapshot from local mutations", () => {
  const localState = createSnapshotReadyLocalState();
  const snapshot = createSnapshot(localState, "tenth-man");

  assert.match(snapshot.snapshotId, /^pattern-room-snapshot-topic-earth-shape-mock-/);
  assert.equal(snapshot.roomId, "pattern-room");
  assert.equal(snapshot.topicId, PATTERN_ROOM_DOMAIN_MOCK.topic.id);
  assert.equal(snapshot.schemaVersion, PATTERN_ROOM_SNAPSHOT_VERSION);
  assert.equal(snapshot.activeView, "tenth-man");
  assert.equal(snapshot.createdAt, snapshot.updatedAt);
  assert.deepEqual(snapshot.overlay.deskNodeIds, ["node-navigation-source"]);
  assert.deepEqual(snapshot.overlay.pinnedSourceIds, ["source-shadow-comparison"]);
  assert.deepEqual(snapshot.overlay.debateReferenceIds, [
    "node-shadow-analysis",
    "source-shadow-comparison",
  ]);
  assert.equal(snapshot.overlay.debatePhase, "completed");
  assert.equal(snapshot.overlay.debateLocalTurns.length, 5);
  assert.equal(snapshot.overlay.localNotes.length, 2);
  assert.deepEqual(snapshot.guards, {
    debateReportReflected: true,
    noteIndex: 2,
  });
});
void test("pattern-room phase 6B restores valid snapshot pieces and applies them to local state", () => {
  const snapshot = createSnapshot(createSnapshotReadyLocalState(), "report");
  const restored = restoreFromSnapshot(snapshot, PATTERN_ROOM_DOMAIN_MOCK);

  assert.ok(restored);
  assertRestoredSnapshotStateMatches(restored, snapshot);

  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  let notificationCount = 0;
  const unsubscribe = localState.subscribe(() => {
    notificationCount += 1;
  });

  localState.restoreOverlay(restored.overlay, restored.guards);
  unsubscribe();

  assert.equal(notificationCount, 1);
  assert.deepEqual(localState.getOverlay(), restored.overlay);
  assert.deepEqual(localState.getGuards(), restored.guards);

  localState.reflectDebateToReport();
  assert.equal(localState.getOverlay().localNotes.length, restored.overlay.localNotes.length);
});
void test("pattern-room phase 6B round-trips snapshot state excluding metadata", () => {
  const snapshot = createSnapshot(createSnapshotReadyLocalState(), "board");
  const restored = restoreFromSnapshot(snapshot, PATTERN_ROOM_DOMAIN_MOCK);
  assert.ok(restored);

  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  localState.restoreOverlay(restored.overlay, restored.guards);
  const roundTripSnapshot = createSnapshot(localState, restored.activeView);

  assertRestoredSnapshotStateMatches(roundTripSnapshot, snapshot);
});
void test("pattern-room phase 7B round-trips local authored overlay entries", () => {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);

  localState.addAuthoredClaim("Snapshot iddia", "Snapshot içinde kalacak local iddia.");
  localState.addAuthoredSource("Snapshot kaynak", "Local defter", "Snapshot source note.");
  localState.addAuthoredEvidence("Snapshot kanıt", "Snapshot excerpt", "Snapshot interpretation");
  localState.addAuthoredEdge(
    "supports",
    "local-node-001",
    "local-source-001",
    "Snapshot connection note."
  );
  localState.addToDebate("local-node-001");
  localState.addToDebate("local-source-001");
  localState.addToDebate("local-evidence-001");

  const snapshot = createSnapshot(localState, "board");
  const restored = restoreFromSnapshot(snapshot, PATTERN_ROOM_DOMAIN_MOCK);
  assert.ok(restored);

  assert.deepEqual(
    restored.overlay.localAuthoredNodes.map((node) => node.id),
    ["local-node-001"]
  );
  assert.deepEqual(
    restored.overlay.localAuthoredSources.map((source) => source.id),
    ["local-source-001"]
  );
  assert.deepEqual(
    restored.overlay.localAuthoredEvidence.map((evidence) => evidence.id),
    ["local-evidence-001"]
  );
  assert.deepEqual(
    restored.overlay.localAuthoredEdges.map((edge) => edge.id),
    ["local-edge-001"]
  );
  assert.deepEqual(restored.overlay.localAuthoredEdges[0], {
    id: "local-edge-001",
    edgeType: "supports",
    sourceId: "local-node-001",
    targetId: "local-source-001",
    note: "Snapshot connection note.",
    createdAt: restored.overlay.localAuthoredEdges[0]?.createdAt,
  });
  assert.deepEqual(restored.overlay.debateReferenceIds, [
    "local-node-001",
    "local-source-001",
    "local-evidence-001",
  ]);

  const roundTripState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  roundTripState.restoreOverlay(restored.overlay, restored.guards);
  const roundTripSnapshot = createSnapshot(roundTripState, restored.activeView);
  assertRestoredSnapshotStateMatches(roundTripSnapshot, snapshot);
});
});
