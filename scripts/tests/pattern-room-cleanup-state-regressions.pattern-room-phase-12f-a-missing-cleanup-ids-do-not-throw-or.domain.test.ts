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


describe("pattern-room phase 12F-A missing cleanup ids do not throw or notify", () => {
void test("pattern-room phase 12F-A missing cleanup ids do not throw or notify", () => {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  let notificationCount = 0;
  const unsubscribe = localState.subscribe(() => {
    notificationCount += 1;
  });

  assert.doesNotThrow(() => {
    assert.deepEqual(localState.removeLocalSource("missing-source"), createCleanupSummary());
    assert.deepEqual(localState.removeLocalNode("missing-node"), createCleanupSummary());
    assert.deepEqual(localState.removeLocalEvidence("missing-evidence"), createCleanupSummary());
    assert.deepEqual(localState.removeLocalEdge("missing-edge"), createCleanupSummary());
    assert.deepEqual(localState.removeLocalNote("missing-note"), createCleanupSummary());
    assert.deepEqual(localState.removeImportBatch("missing-batch"), createCleanupSummary());
  });
  unsubscribe();

  assert.equal(notificationCount, 0);
});
void test("pattern-room phase 12F-A reset snapshots round-trip with stable schema version", () => {
  const localState = createPopulatedLocalState();
  localState.resetOverlayToEmpty();

  const snapshot = createSnapshot(localState, "board");
  const restored = restoreFromSnapshot(snapshot, PATTERN_ROOM_DOMAIN_MOCK);
  assert.ok(restored);

  assert.equal(snapshot.schemaVersion, PATTERN_ROOM_SNAPSHOT_VERSION);
  assert.equal(PATTERN_ROOM_SNAPSHOT_VERSION, 1);
  assert.deepEqual(restored.overlay, localState.getOverlay());
  assert.deepEqual(restored.guards, localState.getGuards());
  assert.equal(restored.activeView, "board");
});
void test("pattern-room phase 12G-A removed local sources stay removed after snapshot round-trip", () => {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  localState.addAuthoredSource("Round-trip source", "Local notebook", "Deleted before save.");
  localState.addAuthoredClaim("Round-trip claim", "Round-trip claim content.");
  localState.addAuthoredEdge("references", "local-source-001", "local-node-001");
  localState.removeLocalSource("local-source-001");

  const snapshot = createSnapshot(localState, "archive");
  const restored = restoreFromSnapshot(snapshot, PATTERN_ROOM_DOMAIN_MOCK);

  assert.ok(restored);
  assert.equal(snapshot.schemaVersion, PATTERN_ROOM_SNAPSHOT_VERSION);
  assert.deepEqual(restored.overlay.localAuthoredSources, []);
  assert.deepEqual(restored.overlay.localAuthoredEdges, []);
});
void test("pattern-room phase 12G-C cleanup helpers stay scoped to approved UI actions", async () => {
  const localStateOnlyHelperNames = ["removeLocalEdge", "removeLocalNote", "removeImportBatch"];
  const integrationPaths = [
    "rooms/pattern-room/manifest.json",
    "rooms/pattern-room/host/runtime.ts",
    "rooms/pattern-room/ui/pattern-room-ui-runtime.ts",
    "rooms/pattern-room/ui/panels/pattern-archive-panel.ts",
    "rooms/pattern-room/ui/panels/pattern-board-panel.ts",
    "rooms/pattern-room/ui/panels/pattern-report-panel.ts",
  ];

  const integrationSources = await Promise.all(
    integrationPaths.map(async (sourcePath) => {
      const source = await readFile(resolve(sourcePath), "utf8");
      return { sourcePath, source };
    })
  );
  for (const { sourcePath, source } of integrationSources) {
    localStateOnlyHelperNames.forEach((helperName) => {
      assert.equal(source.includes(helperName), false, `${sourcePath} wires ${helperName}`);
    });
  }

  const uiRuntimeSource = await readFile(
    resolve("rooms/pattern-room/ui/pattern-room-ui-runtime.ts"),
    "utf8"
  );
  const archivePanelSource = await readFile(
    resolve("rooms/pattern-room/ui/panels/pattern-archive-panel.ts"),
    "utf8"
  );
  const boardPanelSource = await readFile(
    resolve("rooms/pattern-room/ui/panels/pattern-board-panel.ts"),
    "utf8"
  );
  const hostRuntimeSource = await readFile(resolve("rooms/pattern-room/host/runtime.ts"), "utf8");

  assert.equal(uiRuntimeSource.includes("removeLocalSource(sourceId"), true);
  assert.equal(uiRuntimeSource.includes("removeLocalNode(nodeId"), true);
  assert.equal(uiRuntimeSource.includes("removeLocalEvidence(evidenceId"), true);
  assert.equal(uiRuntimeSource.includes("resetLocalSession(): void"), true);
  assert.equal(uiRuntimeSource.includes("localState.resetOverlayToEmpty();"), true);
  assert.equal(archivePanelSource.includes("patternRemoveLocalSource"), true);
  assert.equal(archivePanelSource.includes("patternResetLocalSession"), true);
  assert.equal(boardPanelSource.includes("patternRemoveBoardItem"), true);
  assert.equal(hostRuntimeSource.includes("removeLocalSource"), false);
  assert.equal(hostRuntimeSource.includes("removeLocalNode"), false);
  assert.equal(hostRuntimeSource.includes("removeLocalEvidence"), false);
  assert.equal(hostRuntimeSource.includes("resetOverlayToEmpty"), false);

  const localStateSource = await readFile(
    resolve("rooms/pattern-room/shared/state/pattern-room-local-state.ts"),
    "utf8"
  );
  const forbiddenRuntimePatterns = [
    "ipcRenderer",
    "ipcMain",
    "roomAPI",
    "registerCommand",
    "notifyRoom",
    "document.",
    "window.",
    "fetch(",
  ];

  forbiddenRuntimePatterns.forEach((pattern) => {
    assert.equal(localStateSource.includes(pattern), false, pattern);
  });
});
});
