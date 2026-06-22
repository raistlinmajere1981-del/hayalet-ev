import test from "node:test";
import assert from "node:assert/strict";

import { PATTERN_ROOM_DOMAIN_MOCK } from "../../rooms/pattern-room/shared/data/pattern-room-domain.mock.ts";
import { createLocalState } from "../../rooms/pattern-room/shared/state/pattern-room-local-state.ts";

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


describe("pattern-room phase 12F-A resetOverlayToEmpty clears local overlay without mutati", () => {
void test("pattern-room phase 12F-A resetOverlayToEmpty clears local overlay without mutating domain mock", () => {
  const beforeDomain = JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK);
  const localState = createPopulatedLocalState();
  let notificationCount = 0;
  const unsubscribe = localState.subscribe(() => {
    notificationCount += 1;
  });

  const summary = localState.resetOverlayToEmpty();
  unsubscribe();

  assert.deepEqual(summary, {
    sourcesRemoved: 1,
    evidenceRemoved: 1,
    nodesRemoved: 1,
    edgesRemoved: 1,
    notesRemoved: 1,
    pinsRemoved: 1,
    refsRemoved: 1,
    turnRefsRemoved: 0,
    batchesRemoved: 0,
    resetPerformed: true,
    warnings: [],
  });
  assert.equal(notificationCount, 1);
  assert.deepEqual(localState.getOverlay(), {
    deskNodeIds: [],
    pinnedSourceIds: [],
    sourcePinnedLayerById: {},
    debateReferenceIds: [],
    debatePhase: "idle",
    debateLocalTurns: [],
    debateRolesConnected: {
      AI0: false,
      AI1: false,
      AI2: false,
      US1: false,
    },
    debateLocalVerdict: null,
    localNotes: [],
    localAuthoredNodes: [],
    localAuthoredSources: [],
    localAuthoredEvidence: [],
    localAuthoredEdges: [],
  });
  assert.deepEqual(localState.getGuards(), {
    debateReportReflected: false,
    noteIndex: 0,
  });
  assert.equal(JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK), beforeDomain);
});
void test("pattern-room phase 12F-A removeLocalSource deletes only local source references", () => {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  localState.addAuthoredSource("Removable source", "Local notebook", "");
  localState.addAuthoredClaim("Linked claim", "Linked claim content.");
  localState.addAuthoredEdge("references", "local-source-001", "local-node-001");
  localState.addToDebate("local-source-001");
  localState.restoreOverlay(
    {
      ...localState.getOverlay(),
      pinnedSourceIds: ["local-source-001"],
      sourcePinnedLayerById: {
        "local-source-001": "analysis",
      },
    },
    localState.getGuards()
  );
  let notificationCount = 0;
  const unsubscribe = localState.subscribe(() => {
    notificationCount += 1;
  });

  const summary = localState.removeLocalSource("local-source-001");
  unsubscribe();

  assert.deepEqual(
    summary,
    createCleanupSummary({
      sourcesRemoved: 1,
      edgesRemoved: 1,
      pinsRemoved: 1,
      refsRemoved: 1,
    })
  );
  assert.equal(notificationCount, 1);
  assert.equal(localState.resolveEntityExists("local-source-001"), false);
  assert.equal(localState.resolveEntityExists("local-node-001"), true);
  assert.deepEqual(localState.getOverlay().localAuthoredSources, []);
  assert.deepEqual(localState.getOverlay().localAuthoredEdges, []);
  assert.deepEqual(localState.getOverlay().pinnedSourceIds, []);
  assert.deepEqual(localState.getOverlay().sourcePinnedLayerById, {});
  assert.deepEqual(localState.getOverlay().debateReferenceIds, []);
});
void test("pattern-room phase 13F removeLocalSource deletes source-linked local evidence", () => {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  localState.addAuthoredSource("Removable source", "Local notebook", "Source note.");
  localState.addAuthoredEvidence(
    "Linked evidence",
    "Linked evidence excerpt.",
    "Linked evidence context.",
    "evidence",
    {
      sourceId: "local-source-001",
      sourceLabel: "Removable source",
    }
  );
  localState.addAuthoredClaim("Surviving claim", "Surviving claim content.");
  localState.addAuthoredEdge("supports", "local-evidence-001", "local-node-001");
  localState.addToDebate("local-source-001");
  localState.addToDebate("local-evidence-001");
  localState.restoreOverlay(
    {
      ...localState.getOverlay(),
      debateLocalTurns: [
        createReferencedTurn(["local-source-001", "local-evidence-001", "local-node-001"]),
      ],
    },
    localState.getGuards()
  );

  const summary = localState.removeLocalSource("local-source-001");

  assert.deepEqual(
    summary,
    createCleanupSummary({
      sourcesRemoved: 1,
      evidenceRemoved: 1,
      edgesRemoved: 1,
      refsRemoved: 2,
      turnRefsRemoved: 2,
    })
  );
  assert.equal(localState.resolveEntityExists("local-source-001"), false);
  assert.equal(localState.resolveEntityExists("local-evidence-001"), false);
  assert.equal(localState.resolveEntityExists("local-node-001"), true);
  assert.deepEqual(localState.getOverlay().localAuthoredSources, []);
  assert.deepEqual(localState.getOverlay().localAuthoredEvidence, []);
  assert.deepEqual(localState.getOverlay().localAuthoredEdges, []);
  assert.deepEqual(localState.getOverlay().debateReferenceIds, []);
  assert.deepEqual(localState.getOverlay().debateLocalTurns[0]?.referencedIds, ["local-node-001"]);
});
void test("pattern-room phase 12F-B removeLocalNode deletes local node references and edges", () => {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  localState.addAuthoredClaim("Removable node", "Removable node content.");
  localState.addAuthoredEvidence("Linked evidence", "Linked evidence excerpt.");
  localState.addAuthoredEdge("supports", "local-node-001", "local-evidence-001");
  localState.addToDebate("local-node-001");
  localState.restoreOverlay(
    {
      ...localState.getOverlay(),
      deskNodeIds: ["node-navigation-source", "local-node-001"],
      debateLocalTurns: [
        createReferencedTurn(["local-node-001", "local-evidence-001", "node-shadow-analysis"]),
      ],
    },
    localState.getGuards()
  );
  let notificationCount = 0;
  const unsubscribe = localState.subscribe(() => {
    notificationCount += 1;
  });

  const summary = localState.removeLocalNode("local-node-001");
  unsubscribe();

  assert.deepEqual(
    summary,
    createCleanupSummary({
      nodesRemoved: 1,
      edgesRemoved: 1,
      refsRemoved: 1,
      turnRefsRemoved: 1,
    })
  );
  assert.equal(notificationCount, 1);
  assert.equal(localState.resolveEntityExists("local-node-001"), false);
  assert.equal(localState.resolveEntityExists("local-evidence-001"), true);
  assert.deepEqual(localState.getOverlay().deskNodeIds, ["node-navigation-source"]);
  assert.deepEqual(localState.getOverlay().debateReferenceIds, []);
  assert.deepEqual(localState.getOverlay().debateLocalTurns[0]?.referencedIds, [
    "local-evidence-001",
    "node-shadow-analysis",
  ]);
  assert.deepEqual(localState.getOverlay().localAuthoredEdges, []);
});
});
