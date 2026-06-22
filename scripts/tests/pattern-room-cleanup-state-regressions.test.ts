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
