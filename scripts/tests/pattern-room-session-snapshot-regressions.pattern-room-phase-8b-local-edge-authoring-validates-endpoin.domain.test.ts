import test from "node:test";
import assert from "node:assert/strict";

import createPatternRoomHostRuntime from "../../rooms/pattern-room/host/runtime.ts";
import { PATTERN_ROOM_DOMAIN_MOCK } from "../../rooms/pattern-room/shared/data/pattern-room-domain.mock.ts";
import { createLocalState } from "../../rooms/pattern-room/shared/state/pattern-room-local-state.ts";
import {
  createSnapshot,
  restoreFromSnapshot,
} from "../../rooms/pattern-room/shared/state/pattern-room-snapshot.ts";

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


describe("pattern-room phase 8B local edge authoring validates endpoints and stays overlay", () => {
void test("pattern-room phase 8B local edge authoring validates endpoints and stays overlay-only", () => {
  const beforeDomain = JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK);
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  let notificationCount = 0;
  const unsubscribe = localState.subscribe(() => {
    notificationCount += 1;
  });

  localState.addAuthoredClaim("Local claim", "Local claim content.");
  localState.addAuthoredSource("Local source", "Local notebook", "");
  localState.addAuthoredEvidence("Local evidence", "Local excerpt", "");

  assert.equal(localState.resolveEntityExists("node-navigation-source"), true);
  assert.equal(localState.resolveEntityExists("source-shadow-comparison"), true);
  assert.equal(localState.resolveEntityExists("local-node-001"), true);
  assert.equal(localState.resolveEntityExists("local-source-001"), true);
  assert.equal(localState.resolveEntityExists("local-evidence-001"), true);
  assert.equal(localState.resolveEntityLabel("local-evidence-001"), "Local evidence");

  const notificationsBeforeEdge = notificationCount;
  localState.addAuthoredEdge(
    "supports",
    "local-node-001",
    "local-evidence-001",
    "  Local edge note.  "
  );
  assert.equal(notificationCount, notificationsBeforeEdge + 1);
  assert.deepEqual(localState.getOverlay().localAuthoredEdges, [
    {
      id: "local-edge-001",
      edgeType: "supports",
      sourceId: "local-node-001",
      targetId: "local-evidence-001",
      note: "Local edge note.",
      createdAt: localState.getOverlay().localAuthoredEdges[0]?.createdAt,
    },
  ]);

  localState.addAuthoredEdge("supports", "local-node-001", "local-node-001");
  localState.addAuthoredEdge("supports", "", "local-evidence-001");
  localState.addAuthoredEdge("supports", "missing-node", "local-evidence-001");
  localState.addAuthoredEdge(
    "not-an-edge" as Parameters<typeof localState.addAuthoredEdge>[0],
    "local-node-001",
    "local-evidence-001"
  );
  unsubscribe();

  assert.equal(localState.getOverlay().localAuthoredEdges.length, 1);
  assert.equal(notificationCount, notificationsBeforeEdge + 1);
  assert.equal(JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK), beforeDomain);
});
void test("pattern-room phase 7B restores legacy snapshots with missing authored fields", () => {
  const snapshot = createSnapshot(createSnapshotReadyLocalState(), "archive");
  const overlay = { ...snapshot.overlay } as Record<string, unknown>;
  delete overlay["localAuthoredNodes"];
  delete overlay["localAuthoredSources"];
  delete overlay["localAuthoredEvidence"];
  delete overlay["localAuthoredEdges"];

  const restored = restoreFromSnapshot({ ...snapshot, overlay }, PATTERN_ROOM_DOMAIN_MOCK);
  assert.ok(restored);
  assert.deepEqual(restored.overlay.localAuthoredNodes, []);
  assert.deepEqual(restored.overlay.localAuthoredSources, []);
  assert.deepEqual(restored.overlay.localAuthoredEvidence, []);
  assert.deepEqual(restored.overlay.localAuthoredEdges, []);
});
void test("pattern-room phase 7B silently skips invalid restored authored entries", () => {
  const snapshot = createSnapshot(createSnapshotReadyLocalState(), "board");
  const pollutedSnapshot = {
    ...snapshot,
    overlay: {
      ...snapshot.overlay,
      localAuthoredNodes: [
        {
          id: "local-node-001",
          nodeType: "claim",
          label: "Valid local claim",
          content: "Valid local content",
          createdAt: "2026-05-20T12:00:00.000Z",
        },
        {
          id: "node-bad",
          nodeType: "claim",
          label: "Invalid id",
          content: "Should be skipped",
          createdAt: "2026-05-20T12:00:00.000Z",
        },
        {
          id: "local-node-002",
          nodeType: "claim",
          label: " ",
          content: "Empty label should be skipped",
          createdAt: "2026-05-20T12:00:00.000Z",
        },
      ],
      localAuthoredSources: [
        {
          id: "local-source-001",
          label: "Valid local source",
          origin: "Local notebook",
          note: "",
          createdAt: "2026-05-20T12:00:00.000Z",
        },
        {
          id: "local-source-x",
          label: "Invalid local source",
          origin: "Local notebook",
          note: "",
          createdAt: "2026-05-20T12:00:00.000Z",
        },
      ],
      localAuthoredEvidence: [
        {
          id: "local-evidence-001",
          label: "Valid local evidence",
          excerpt: "Valid excerpt",
          interpretation: null,
          layer: "evidence",
          createdAt: "2026-05-20T12:00:00.000Z",
        },
        {
          id: "local-evidence-002",
          label: "Invalid local evidence",
          excerpt: "",
          interpretation: null,
          layer: "evidence",
          createdAt: "2026-05-20T12:00:00.000Z",
        },
      ],
      localAuthoredEdges: [
        {
          id: "local-edge-001",
          edgeType: "supports",
          sourceId: "local-node-001",
          targetId: "local-source-001",
          note: null,
          createdAt: "2026-05-20T12:00:00.000Z",
        },
        {
          id: "edge-002",
          edgeType: "supports",
          sourceId: "local-node-001",
          targetId: "local-source-001",
          note: null,
          createdAt: "2026-05-20T12:00:00.000Z",
        },
        {
          id: "local-edge-003",
          edgeType: "not-valid",
          sourceId: "local-node-001",
          targetId: "local-source-001",
          note: null,
          createdAt: "2026-05-20T12:00:00.000Z",
        },
        {
          id: "local-edge-004",
          edgeType: "supports",
          sourceId: "local-node-001",
          targetId: "local-node-001",
          note: null,
          createdAt: "2026-05-20T12:00:00.000Z",
        },
        {
          id: "local-edge-005",
          edgeType: "supports",
          sourceId: "local-node-001",
          targetId: "missing-target",
          note: null,
          createdAt: "2026-05-20T12:00:00.000Z",
        },
      ],
      debateReferenceIds: [
        "local-node-001",
        "local-source-001",
        "local-evidence-001",
        "local-node-002",
        "local-evidence-002",
      ],
    },
  };

  const restored = restoreFromSnapshot(pollutedSnapshot, PATTERN_ROOM_DOMAIN_MOCK);
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
  assert.deepEqual(restored.overlay.debateReferenceIds, [
    "local-node-001",
    "local-source-001",
    "local-evidence-001",
  ]);
});
void test("pattern-room phase 6B rejects incompatible snapshot schema or topic", () => {
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
});
