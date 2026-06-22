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


describe("pattern-room phase 12F-B removeLocalNode leaves domain node ids as safe no-ops", () => {
void test("pattern-room phase 12F-B removeLocalNode leaves domain node ids as safe no-ops", () => {
  const beforeDomain = JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK);
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  localState.sendToDesk("node-navigation-source");
  const beforeOverlay = localState.getOverlay();
  let notificationCount = 0;
  const unsubscribe = localState.subscribe(() => {
    notificationCount += 1;
  });

  assert.deepEqual(localState.removeLocalNode("node-navigation-source"), createCleanupSummary());
  unsubscribe();

  assert.equal(notificationCount, 0);
  assert.deepEqual(localState.getOverlay(), beforeOverlay);
  assert.equal(JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK), beforeDomain);
});
void test("pattern-room phase 12F-B removeLocalEvidence deletes local evidence references and edges", () => {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  localState.addAuthoredClaim("Linked node", "Linked node content.");
  localState.addAuthoredEvidence("Removable evidence", "Removable evidence excerpt.");
  localState.addAuthoredEdge("supports", "local-node-001", "local-evidence-001");
  localState.addToDebate("local-evidence-001");
  localState.restoreOverlay(
    {
      ...localState.getOverlay(),
      debateLocalTurns: [createReferencedTurn(["local-evidence-001", "local-node-001"])],
    },
    localState.getGuards()
  );
  let notificationCount = 0;
  const unsubscribe = localState.subscribe(() => {
    notificationCount += 1;
  });

  const summary = localState.removeLocalEvidence("local-evidence-001");
  unsubscribe();

  assert.deepEqual(
    summary,
    createCleanupSummary({
      evidenceRemoved: 1,
      edgesRemoved: 1,
      refsRemoved: 1,
      turnRefsRemoved: 1,
    })
  );
  assert.equal(notificationCount, 1);
  assert.equal(localState.resolveEntityExists("local-evidence-001"), false);
  assert.equal(localState.resolveEntityExists("local-node-001"), true);
  assert.deepEqual(localState.getOverlay().debateReferenceIds, []);
  assert.deepEqual(localState.getOverlay().debateLocalTurns[0]?.referencedIds, ["local-node-001"]);
  assert.deepEqual(localState.getOverlay().localAuthoredEdges, []);
});
void test("pattern-room phase 12F-A removeLocalSource leaves domain source ids as safe no-ops", () => {
  const beforeDomain = JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK);
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  localState.pinSource("source-shadow-comparison", "analysis");
  const beforeOverlay = localState.getOverlay();
  let notificationCount = 0;
  const unsubscribe = localState.subscribe(() => {
    notificationCount += 1;
  });

  assert.deepEqual(
    localState.removeLocalSource("source-shadow-comparison"),
    createCleanupSummary()
  );
  unsubscribe();

  assert.equal(notificationCount, 0);
  assert.deepEqual(localState.getOverlay(), beforeOverlay);
  assert.equal(JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK), beforeDomain);
});
void test("pattern-room phase 12F-A removeLocalSource sweeps orphan local edges", () => {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  localState.addAuthoredSource("Removable source", "Local notebook", "");
  localState.addAuthoredClaim("Linked claim", "Linked claim content.");
  localState.addAuthoredEvidence("Surviving evidence", "Surviving excerpt.");
  localState.addAuthoredEdge("references", "local-source-001", "local-node-001");
  localState.addAuthoredEdge("supports", "local-node-001", "local-evidence-001");
  const overlay = localState.getOverlay();
  localState.restoreOverlay(
    {
      ...overlay,
      localAuthoredEdges: [
        ...overlay.localAuthoredEdges,
        {
          id: "local-edge-099",
          edgeType: "supports",
          sourceId: "local-node-001",
          targetId: "missing-entity",
          note: null,
          createdAt: overlay.localAuthoredEdges[0]?.createdAt ?? "2026-05-21T00:00:00.000Z",
        },
      ],
    },
    localState.getGuards()
  );

  const summary = localState.removeLocalSource("local-source-001");

  assert.deepEqual(
    summary,
    createCleanupSummary({
      sourcesRemoved: 1,
      edgesRemoved: 2,
    })
  );
  assert.deepEqual(
    localState.getOverlay().localAuthoredEdges.map((edge) => edge.id),
    ["local-edge-002"]
  );
});
});
