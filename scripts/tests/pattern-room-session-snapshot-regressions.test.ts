import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import createPatternRoomHostRuntime from "../../rooms/pattern-room/host/runtime.ts";
import { PATTERN_ROOM_DOMAIN_MOCK } from "../../rooms/pattern-room/shared/data/pattern-room-domain.mock.ts";
import { createLocalState } from "../../rooms/pattern-room/shared/state/pattern-room-local-state.ts";
import {
  createSnapshot,
  restoreFromSnapshot,
} from "../../rooms/pattern-room/shared/state/pattern-room-snapshot.ts";
import {
  PATTERN_ROOM_SNAPSHOT_VERSION,
  type PatternRoomSessionSnapshot,
} from "../../rooms/pattern-room/shared/types/pattern-room-snapshot.ts";

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

test("pattern-room phase 6B creates a local session snapshot from local mutations", () => {
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

test("pattern-room phase 6B restores valid snapshot pieces and applies them to local state", () => {
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

test("pattern-room phase 6B round-trips snapshot state excluding metadata", () => {
  const snapshot = createSnapshot(createSnapshotReadyLocalState(), "board");
  const restored = restoreFromSnapshot(snapshot, PATTERN_ROOM_DOMAIN_MOCK);
  assert.ok(restored);

  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  localState.restoreOverlay(restored.overlay, restored.guards);
  const roundTripSnapshot = createSnapshot(localState, restored.activeView);

  assertRestoredSnapshotStateMatches(roundTripSnapshot, snapshot);
});

test("pattern-room phase 6B rejects incompatible snapshot schema or topic", () => {
  const snapshot = createSnapshot(createSnapshotReadyLocalState(), "archive");
  const wrongSchemaSnapshot = {
    ...snapshot,
    schemaVersion: 2,
  } as unknown as PatternRoomSessionSnapshot;
  const wrongTopicSnapshot: PatternRoomSessionSnapshot = {
    ...snapshot,
    topicId: "topic-other",
  };

  assert.equal(restoreFromSnapshot(wrongSchemaSnapshot, PATTERN_ROOM_DOMAIN_MOCK), null);
  assert.equal(restoreFromSnapshot(wrongTopicSnapshot, PATTERN_ROOM_DOMAIN_MOCK), null);
});

test("pattern-room phase 6B rejects malformed runtime snapshot input", () => {
  const snapshot = createSnapshot(createSnapshotReadyLocalState(), "archive");
  const firstTurn = snapshot.overlay.debateLocalTurns[0];
  assert.ok(firstTurn);
  const malformedSnapshots: unknown[] = [
    null,
    {},
    [],
    { ...snapshot, activeView: "missing-view" },
    { ...snapshot, overlay: { ...snapshot.overlay, deskNodeIds: [42] } },
    { ...snapshot, overlay: { ...snapshot.overlay, debatePhase: "future-phase" } },
    {
      ...snapshot,
      overlay: {
        ...snapshot.overlay,
        debateLocalTurns: [{ ...firstTurn, turnIndex: "0" }],
      },
    },
    { ...snapshot, guards: { ...snapshot.guards, noteIndex: Number.NaN } },
  ];

  malformedSnapshots.forEach((malformedSnapshot) => {
    assert.equal(restoreFromSnapshot(malformedSnapshot, PATTERN_ROOM_DOMAIN_MOCK), null);
  });
});

test("pattern-room phase 6B defensively filters stale snapshot ids without mutating domain mock", () => {
  const beforeDomain = JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK);
  const snapshot = createSnapshot(createSnapshotReadyLocalState(), "tenth-man");
  const firstTurn = snapshot.overlay.debateLocalTurns[0];
  assert.ok(firstTurn);

  const pollutedSnapshot: PatternRoomSessionSnapshot = {
    ...snapshot,
    overlay: {
      ...snapshot.overlay,
      deskNodeIds: ["node-navigation-source", "missing-node", "node-navigation-source"],
      pinnedSourceIds: ["source-shadow-comparison", "missing-source"],
      sourcePinnedLayerById: {
        "source-shadow-comparison": "uncertainty",
        "missing-source": "analysis",
      },
      debateReferenceIds: ["node-shadow-analysis", "missing-reference", "source-shadow-comparison"],
      debateLocalTurns: [
        {
          ...firstTurn,
          referencedIds: ["node-shadow-analysis", "missing-reference", "source-shadow-comparison"],
        },
      ],
    },
    guards: {
      debateReportReflected: true,
      noteIndex: 0,
    },
  };
  const restored = restoreFromSnapshot(pollutedSnapshot, PATTERN_ROOM_DOMAIN_MOCK);

  assert.ok(restored);
  assert.deepEqual(restored.overlay.deskNodeIds, ["node-navigation-source"]);
  assert.deepEqual(restored.overlay.pinnedSourceIds, ["source-shadow-comparison"]);
  assert.deepEqual(restored.overlay.sourcePinnedLayerById, {
    "source-shadow-comparison": "uncertainty",
  });
  assert.deepEqual(restored.overlay.debateReferenceIds, [
    "node-shadow-analysis",
    "source-shadow-comparison",
  ]);
  assert.equal(restored.overlay.debatePhase, "completed");
  assert.deepEqual(restored.overlay.debateLocalTurns[0]?.referencedIds, [
    "node-shadow-analysis",
    "source-shadow-comparison",
  ]);
  assert.equal(
    ["AI0", "AI1", "AI2", "US1"].every((roleId) => {
      return restored.overlay.debateRolesConnected[roleId] === true;
    }),
    true
  );
  assert.equal(restored.guards.noteIndex, restored.overlay.localNotes.length);
  assert.equal(JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK), beforeDomain);
});

test("pattern-room phase 6B self-heals advanced debate phase with no turns", () => {
  const snapshot = createSnapshot(createSnapshotReadyLocalState(), "tenth-man");
  const inconsistentSnapshot: PatternRoomSessionSnapshot = {
    ...snapshot,
    overlay: {
      ...snapshot.overlay,
      debatePhase: "judge_mapping",
      debateLocalTurns: [],
      debateRolesConnected: {
        AI0: true,
        AI1: true,
        AI2: true,
        US1: true,
      },
      debateLocalVerdict: "stale local verdict",
    },
    guards: {
      debateReportReflected: false,
      noteIndex: 0,
    },
  };
  const restored = restoreFromSnapshot(inconsistentSnapshot, PATTERN_ROOM_DOMAIN_MOCK);

  assert.ok(restored);
  assert.equal(restored.overlay.debatePhase, "preparation");
  assert.deepEqual(restored.overlay.debateRolesConnected, {
    AI0: false,
    AI1: false,
    AI2: false,
    US1: false,
  });
  assert.equal(restored.overlay.debateLocalVerdict, null);
  assert.equal(restored.guards.noteIndex, restored.overlay.localNotes.length);
});

test("pattern-room phase 6B snapshot layer stays free of storage, IPC, and host commands", async () => {
  const sourcePaths = [
    "rooms/pattern-room/shared/types/pattern-room-snapshot.ts",
    "rooms/pattern-room/shared/state/pattern-room-snapshot.ts",
    "rooms/pattern-room/shared/state/pattern-room-local-state.ts",
    "rooms/pattern-room/ui/pattern-room-ui-runtime.ts",
  ];

  for (const sourcePath of sourcePaths) {
    const source = await readFile(resolve(sourcePath), "utf8");
    assert.equal(source.includes("localStorage"), false, sourcePath);
    assert.equal(source.includes("sessionStorage"), false, sourcePath);
    assert.equal(source.includes("IndexedDB"), false, sourcePath);
    assert.equal(source.includes("indexedDB"), false, sourcePath);
  }

  const activation = createPatternRoomHostRuntime().activate({});
  assert.deepEqual(activation.commands, {});
});
