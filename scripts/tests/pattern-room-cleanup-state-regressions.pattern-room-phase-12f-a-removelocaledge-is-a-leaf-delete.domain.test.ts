import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PATTERN_ROOM_DOMAIN_MOCK } from "../../rooms/pattern-room/shared/data/pattern-room-domain.mock.ts";
import {
  createLocalState,
  type CleanupSummary,
  type DebateLocalTurn,
} from "../../rooms/pattern-room/shared/state/pattern-room-local-state.ts";
import {
  createSnapshot,
  restoreFromSnapshot,
} from "../../rooms/pattern-room/shared/state/pattern-room-snapshot.ts";
import { PATTERN_ROOM_SNAPSHOT_VERSION } from "../../rooms/pattern-room/shared/types/pattern-room-snapshot.ts";

function createCleanupSummary(overrides: Partial<CleanupSummary> = {}): CleanupSummary {
  return {
    sourcesRemoved: 0,
    evidenceRemoved: 0,
    nodesRemoved: 0,
    edgesRemoved: 0,
    notesRemoved: 0,
    pinsRemoved: 0,
    refsRemoved: 0,
    turnRefsRemoved: 0,
    batchesRemoved: 0,
    resetPerformed: false,
    warnings: [],
    ...overrides,
  };
}

function createPopulatedLocalState(): ReturnType<typeof createLocalState> {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);

  localState.sendToDesk("node-navigation-source");
  localState.pinSource("source-shadow-comparison", "analysis");
  localState.addAuthoredClaim("Local cleanup claim", "Local cleanup claim content.");
  localState.addAuthoredSource("Local cleanup source", "Local notebook", "Source note.");
  localState.addAuthoredEvidence("Local cleanup evidence", "Local cleanup excerpt.");
  localState.addAuthoredEdge("supports", "local-source-001", "local-node-001", "Cleanup edge.");
  localState.addLocalNote("Cleanup note.");
  localState.addToDebate("local-source-001");
  localState.prepareDebate();
  localState.assignDebateRoles();
  localState.startDebate();

  return localState;
}

function createReferencedTurn(referencedIds: readonly string[]): DebateLocalTurn {
  return {
    id: "turn-local-cleanup-001",
    actorId: "AI0",
    role: "researcher",
    content: "Local cleanup turn.",
    stance: "neutral",
    phaseKey: "opening",
    turnIndex: 0,
    referencedIds,
  };
}


describe("pattern-room phase 12F-A removeLocalEdge is a leaf delete", () => {
void test("pattern-room phase 12F-A removeLocalEdge is a leaf delete", () => {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  localState.addAuthoredClaim("Linked claim", "Linked claim content.");
  localState.addAuthoredEvidence("Linked evidence", "Linked excerpt.");
  localState.addAuthoredEdge("supports", "local-node-001", "local-evidence-001");
  let notificationCount = 0;
  const unsubscribe = localState.subscribe(() => {
    notificationCount += 1;
  });

  assert.deepEqual(
    localState.removeLocalEdge("local-edge-001"),
    createCleanupSummary({ edgesRemoved: 1 })
  );
  assert.deepEqual(localState.removeLocalEdge("missing-edge"), createCleanupSummary());
  unsubscribe();

  assert.equal(notificationCount, 1);
  assert.deepEqual(localState.getOverlay().localAuthoredEdges, []);
  assert.equal(localState.resolveEntityExists("local-node-001"), true);
  assert.equal(localState.resolveEntityExists("local-evidence-001"), true);
});
void test("pattern-room phase 12F-B removeImportBatch removes only matching batch and cascades references", () => {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  localState.restoreOverlay(
    {
      ...localState.getOverlay(),
      deskNodeIds: ["node-navigation-source", "local-node-001", "local-node-002", "local-node-003"],
      pinnedSourceIds: ["source-shadow-comparison", "local-source-001", "local-source-002"],
      sourcePinnedLayerById: {
        "source-shadow-comparison": "analysis",
        "local-source-001": "evidence",
        "local-source-002": "uncertainty",
      },
      debateReferenceIds: [
        "source-shadow-comparison",
        "local-source-001",
        "local-node-001",
        "local-evidence-001",
        "local-source-002",
        "local-node-003",
      ],
      debateLocalTurns: [
        createReferencedTurn([
          "local-source-001",
          "local-node-001",
          "local-evidence-001",
          "local-source-002",
          "local-node-003",
        ]),
      ],
      localNotes: [
        {
          id: "local-note-001",
          text: "Batch A note.",
          createdAt: "2026-05-21T00:00:00.000Z",
          importBatchId: "batch-a",
        },
        {
          id: "local-note-002",
          text: "Batch B note.",
          createdAt: "2026-05-21T00:00:00.000Z",
          importBatchId: "batch-b",
        },
        {
          id: "local-note-003",
          text: "Manual note.",
          createdAt: "2026-05-21T00:00:00.000Z",
        },
      ],
      localAuthoredSources: [
        {
          id: "local-source-001",
          label: "Batch A source",
          origin: "manual:batch-a",
          note: "",
          createdAt: "2026-05-21T00:00:00.000Z",
          importBatchId: "batch-a",
        },
        {
          id: "local-source-002",
          label: "Batch B source",
          origin: "manual:batch-b",
          note: "",
          createdAt: "2026-05-21T00:00:00.000Z",
          importBatchId: "batch-b",
        },
      ],
      localAuthoredNodes: [
        {
          id: "local-node-001",
          nodeType: "claim",
          label: "Batch A node",
          content: "Batch A node content.",
          createdAt: "2026-05-21T00:00:00.000Z",
          importBatchId: "batch-a",
        },
        {
          id: "local-node-002",
          nodeType: "claim",
          label: "Batch B node",
          content: "Batch B node content.",
          createdAt: "2026-05-21T00:00:00.000Z",
          importBatchId: "batch-b",
        },
        {
          id: "local-node-003",
          nodeType: "claim",
          label: "Manual node",
          content: "Manual node content.",
          createdAt: "2026-05-21T00:00:00.000Z",
        },
      ],
      localAuthoredEvidence: [
        {
          id: "local-evidence-001",
          label: "Batch A evidence",
          excerpt: "Batch A evidence excerpt.",
          interpretation: null,
          layer: "evidence",
          createdAt: "2026-05-21T00:00:00.000Z",
          importBatchId: "batch-a",
        },
        {
          id: "local-evidence-002",
          label: "Batch B evidence",
          excerpt: "Batch B evidence excerpt.",
          interpretation: null,
          layer: "evidence",
          createdAt: "2026-05-21T00:00:00.000Z",
          importBatchId: "batch-b",
        },
        {
          id: "local-evidence-003",
          label: "Manual evidence",
          excerpt: "Manual evidence excerpt.",
          interpretation: null,
          layer: "evidence",
          createdAt: "2026-05-21T00:00:00.000Z",
        },
      ],
      localAuthoredEdges: [
        {
          id: "local-edge-001",
          edgeType: "supports",
          sourceId: "local-source-001",
          targetId: "local-node-001",
          note: null,
          createdAt: "2026-05-21T00:00:00.000Z",
          importBatchId: "batch-a",
        },
        {
          id: "local-edge-002",
          edgeType: "supports",
          sourceId: "local-node-002",
          targetId: "local-evidence-002",
          note: null,
          createdAt: "2026-05-21T00:00:00.000Z",
          importBatchId: "batch-b",
        },
        {
          id: "local-edge-003",
          edgeType: "references",
          sourceId: "local-source-001",
          targetId: "local-node-003",
          note: null,
          createdAt: "2026-05-21T00:00:00.000Z",
        },
        {
          id: "local-edge-004",
          edgeType: "references",
          sourceId: "local-node-003",
          targetId: "local-evidence-003",
          note: null,
          createdAt: "2026-05-21T00:00:00.000Z",
        },
      ],
    },
    {
      debateReportReflected: false,
      noteIndex: 3,
    }
  );
  let notificationCount = 0;
  const unsubscribe = localState.subscribe(() => {
    notificationCount += 1;
  });

  const summary = localState.removeImportBatch("batch-a");
  unsubscribe();

  assert.deepEqual(
    summary,
    createCleanupSummary({
      sourcesRemoved: 1,
      evidenceRemoved: 1,
      nodesRemoved: 1,
      edgesRemoved: 2,
      notesRemoved: 1,
      pinsRemoved: 1,
      refsRemoved: 3,
      turnRefsRemoved: 3,
      batchesRemoved: 1,
    })
  );
  assert.equal(notificationCount, 1);
  assert.deepEqual(
    localState.getOverlay().localAuthoredSources.map((source) => source.id),
    ["local-source-002"]
  );
  assert.deepEqual(
    localState.getOverlay().localAuthoredNodes.map((node) => node.id),
    ["local-node-002", "local-node-003"]
  );
  assert.deepEqual(
    localState.getOverlay().localAuthoredEvidence.map((evidence) => evidence.id),
    ["local-evidence-002", "local-evidence-003"]
  );
  assert.deepEqual(
    localState.getOverlay().localAuthoredEdges.map((edge) => edge.id),
    ["local-edge-002", "local-edge-004"]
  );
  assert.deepEqual(
    localState.getOverlay().localNotes.map((note) => note.id),
    ["local-note-002", "local-note-003"]
  );
  assert.deepEqual(localState.getOverlay().deskNodeIds, [
    "node-navigation-source",
    "local-node-002",
    "local-node-003",
  ]);
  assert.deepEqual(localState.getOverlay().pinnedSourceIds, [
    "source-shadow-comparison",
    "local-source-002",
  ]);
  assert.deepEqual(localState.getOverlay().sourcePinnedLayerById, {
    "source-shadow-comparison": "analysis",
    "local-source-002": "uncertainty",
  });
  assert.deepEqual(localState.getOverlay().debateReferenceIds, [
    "source-shadow-comparison",
    "local-source-002",
    "local-node-003",
  ]);
  assert.deepEqual(localState.getOverlay().debateLocalTurns[0]?.referencedIds, [
    "local-source-002",
    "local-node-003",
  ]);
});
void test("pattern-room phase 12F-B removeImportBatch missing ids are safe no-ops", () => {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  localState.addAuthoredClaim("Manual node", "Manual node content.");
  const beforeOverlay = localState.getOverlay();
  let notificationCount = 0;
  const unsubscribe = localState.subscribe(() => {
    notificationCount += 1;
  });

  assert.doesNotThrow(() => {
    assert.deepEqual(localState.removeImportBatch(""), createCleanupSummary());
    assert.deepEqual(localState.removeImportBatch("missing-batch"), createCleanupSummary());
  });
  unsubscribe();

  assert.equal(notificationCount, 0);
  assert.deepEqual(localState.getOverlay(), beforeOverlay);
});
void test("pattern-room phase 12F-A removeLocalNote is a leaf delete", () => {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  localState.addLocalNote("Cleanup note.");
  let notificationCount = 0;
  const unsubscribe = localState.subscribe(() => {
    notificationCount += 1;
  });

  assert.deepEqual(
    localState.removeLocalNote("local-note-001"),
    createCleanupSummary({ notesRemoved: 1 })
  );
  assert.deepEqual(localState.removeLocalNote("missing-note"), createCleanupSummary());
  unsubscribe();

  assert.equal(notificationCount, 1);
  assert.deepEqual(localState.getOverlay().localNotes, []);
});
});
