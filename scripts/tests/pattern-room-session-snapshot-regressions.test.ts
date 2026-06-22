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
import { PATTERN_ROOM_CASE_REVIEW_DISPATCH_COMMAND } from "../../rooms/pattern-room/shared/types/pattern-room-case-review-dispatch.ts";
import {
  PATTERN_ROOM_LOAD_COMMAND,
  PATTERN_ROOM_SAVE_COMMAND,
} from "../../rooms/pattern-room/shared/types/pattern-room-persistence.ts";
import {
  createLongTextProducer,
  createUserTextProducer,
  produceAndImportSource,
} from "../../rooms/pattern-room/shared/source-producers/index.ts";

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
