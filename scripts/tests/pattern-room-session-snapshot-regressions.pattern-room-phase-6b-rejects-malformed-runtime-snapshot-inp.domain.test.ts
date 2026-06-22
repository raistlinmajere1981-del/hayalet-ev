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


describe("pattern-room phase 6B rejects malformed runtime snapshot input", () => {
void test("pattern-room phase 6B rejects malformed runtime snapshot input", () => {
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
void test("pattern-room phase 6B defensively filters stale snapshot ids without mutating domain mock", () => {
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
void test("pattern-room phase 6B self-heals advanced debate phase with no turns", () => {
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
void test("pattern-room phase 6B snapshot and UI layer stay free of storage and IPC wiring", async () => {
  const sourcePaths = [
    "rooms/pattern-room/shared/types/pattern-room-snapshot.ts",
    "rooms/pattern-room/shared/state/pattern-room-snapshot.ts",
    "rooms/pattern-room/shared/state/pattern-room-local-state.ts",
    "rooms/pattern-room/shared/adapters/pattern-room-view-adapters.ts",
    "rooms/pattern-room/ui/pattern-room-ui-runtime.ts",
    "rooms/pattern-room/ui/panels/pattern-board-panel.ts",
    "rooms/pattern-room/ui/panels/pattern-archive-panel.ts",
  ];
  const forbiddenRuntimeApis = [
    "localStorage",
    "sessionStorage",
    "IndexedDB",
    "indexedDB",
    "ipcRenderer",
    "ipcMain",
    "fetch(",
    "XMLHttpRequest",
    "WebSocket",
    "better-sqlite3",
  ];

  const sourceContents = await Promise.all(
    sourcePaths.map(async (sourcePath) => {
      const source = await readFile(resolve(sourcePath), "utf8");
      return { sourcePath, source };
    })
  );
  for (const { sourcePath, source } of sourceContents) {
    forbiddenRuntimeApis.forEach((runtimeApi) => {
      assert.equal(source.includes(runtimeApi), false, `${sourcePath} includes ${runtimeApi}`);
    });
  }

  const activation = createPatternRoomHostRuntime().activate({});
  assert.deepEqual(Object.keys(activation.commands).sort(), [
    PATTERN_ROOM_CASE_REVIEW_DISPATCH_COMMAND,
    PATTERN_ROOM_LOAD_COMMAND,
    PATTERN_ROOM_SAVE_COMMAND,
  ]);
});
});
