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


describe("pattern-room phase 13F round-trips source-linked local evidence without schema b", () => {
void test("pattern-room phase 13F round-trips source-linked local evidence without schema bump", () => {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  localState.addAuthoredSource("Snapshot source", "Archive shelf", "Snapshot source note.");
  localState.addAuthoredEvidence(
    "Snapshot linked evidence",
    "Snapshot linked excerpt.",
    "Snapshot linked context.",
    "evidence",
    {
      sourceId: "local-source-001",
      sourceLabel: "Snapshot source",
    }
  );

  const snapshot = createSnapshot(localState, "archive");
  const restored = restoreFromSnapshot(snapshot, PATTERN_ROOM_DOMAIN_MOCK);

  assert.equal(snapshot.schemaVersion, PATTERN_ROOM_SNAPSHOT_VERSION);
  assert.equal(snapshot.overlay.localAuthoredEvidence[0]?.sourceId, "local-source-001");
  assert.equal(snapshot.overlay.localAuthoredEvidence[0].sourceLabel, "Snapshot source");
  assert.ok(restored);
  assert.equal(restored.overlay.localAuthoredEvidence[0]?.sourceId, "local-source-001");
  assert.equal(restored.overlay.localAuthoredEvidence[0].sourceLabel, "Snapshot source");

  const roundTripState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  roundTripState.restoreOverlay(restored.overlay, restored.guards);
  const roundTripSnapshot = createSnapshot(roundTripState, restored.activeView);
  assertRestoredSnapshotStateMatches(roundTripSnapshot, snapshot);
});
void test("pattern-room phase 12D round-trips user text producer sources", () => {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  const producer = createUserTextProducer({ now: () => "2026-05-21T10:00:00.000Z" });
  const orchestrationResult = produceAndImportSource(producer, {
    inputKind: "pasted_text",
    text: "Başlıksız kullanıcı metni snapshot içinde kalmalı.",
    language: "tr",
  });
  const importResult = orchestrationResult.importResults[0]?.importResult;
  assert.ok(importResult);
  localState.applySourceImportResult(importResult);

  const snapshot = createSnapshot(localState, "archive");
  const restored = restoreFromSnapshot(snapshot, PATTERN_ROOM_DOMAIN_MOCK);
  assert.ok(restored);

  assert.equal(snapshot.schemaVersion, PATTERN_ROOM_SNAPSHOT_VERSION);
  assert.deepEqual(restored.overlay.localAuthoredSources, [
    {
      id: "local-source-001",
      label: "Başlıksız kullanıcı metni snapshot içinde kalmalı.",
      origin: "Kullanıcı metni",
      note: "Başlıksız kullanıcı metni snapshot içinde kalmalı.",
      createdAt: restored.overlay.localAuthoredSources[0]?.createdAt,
    },
  ]);

  const roundTripState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  roundTripState.restoreOverlay(restored.overlay, restored.guards);
  const roundTripSnapshot = createSnapshot(roundTripState, restored.activeView);
  assertRestoredSnapshotStateMatches(roundTripSnapshot, snapshot);
});
void test("pattern-room phase 12F-B round-trips optional import batch ids without schema bump", () => {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  const producer = createUserTextProducer({ now: () => "2026-05-21T10:00:00.000Z" });
  const orchestrationResult = produceAndImportSource(producer, {
    inputKind: "pasted_text",
    text: "Batch tracked kullanıcı metni snapshot içinde kalmalı.",
    title: "Batch tracked source",
    language: "tr",
  });
  const importResult = orchestrationResult.importResults[0]?.importResult;
  assert.ok(importResult);
  localState.applySourceImportResult(importResult, {
    importBatchId: "source-package-snapshot-001",
  });

  const snapshot = createSnapshot(localState, "archive");
  const restored = restoreFromSnapshot(snapshot, PATTERN_ROOM_DOMAIN_MOCK);
  assert.ok(restored);

  assert.equal(snapshot.schemaVersion, PATTERN_ROOM_SNAPSHOT_VERSION);
  assert.equal(PATTERN_ROOM_SNAPSHOT_VERSION, 1);
  assert.deepEqual(
    restored.overlay.localAuthoredSources.map((source) => source.importBatchId),
    ["source-package-snapshot-001"]
  );

  const roundTripState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  roundTripState.restoreOverlay(restored.overlay, restored.guards);
  const roundTripSnapshot = createSnapshot(roundTripState, restored.activeView);
  assertRestoredSnapshotStateMatches(roundTripSnapshot, snapshot);
});
void test("pattern-room phase 13C round-trips long text producer sources without schema bump", () => {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  const producer = createLongTextProducer({ now: () => "2026-05-21T10:00:00.000Z" });
  const text =
    "Birinci uzun metin parçası snapshot içinde kaynak notu olarak kalmalı.\n\n" +
    "İkinci uzun metin parçası segment sayısını üretir ama pano kanıtı üretmez.";
  const orchestrationResult = produceAndImportSource(producer, {
    inputKind: "long_text",
    title: "Snapshot uzun metin",
    origin: "Arşiv defteri",
    sourceKind: "archive_text",
    chapter: "Defter I",
    page: "42",
    text,
    language: "tr",
  });
  const importResult = orchestrationResult.importResults[0]?.importResult;
  assert.ok(importResult);
  const producedSegments = orchestrationResult.packagesProduced[0]?.segments ?? [];
  assert.equal(producedSegments.length, 2);
  localState.applySourceImportResult(importResult);

  const snapshot = createSnapshot(localState, "archive");
  const restored = restoreFromSnapshot(snapshot, PATTERN_ROOM_DOMAIN_MOCK);
  assert.ok(restored);

  assert.equal(snapshot.schemaVersion, PATTERN_ROOM_SNAPSHOT_VERSION);
  assert.equal(PATTERN_ROOM_SNAPSHOT_VERSION, 1);
  const restoredSource = restored.overlay.localAuthoredSources[0];
  assert.equal(restoredSource?.id, "local-source-001");
  assert.equal(restoredSource.label, "Snapshot uzun metin");
  assert.equal(restoredSource.origin, "Arşiv defteri");
  assert.equal(restoredSource.note, text);
  assert.deepEqual(
    restoredSource.segments,
    producedSegments.map((segment, index) => {
      return {
        id: segment.segmentId,
        label: segment.label,
        text: segment.text,
        order: segment.order ?? index,
      };
    })
  );
  assert.deepEqual(restored.overlay.localAuthoredEvidence, []);
  assert.deepEqual(restored.overlay.localAuthoredNodes, []);
  assert.deepEqual(restored.overlay.pinnedSourceIds, []);
  assert.deepEqual(restored.overlay.sourcePinnedLayerById, {});

  const roundTripState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  roundTripState.restoreOverlay(restored.overlay, restored.guards);
  const roundTripSnapshot = createSnapshot(roundTripState, restored.activeView);
  assertRestoredSnapshotStateMatches(roundTripSnapshot, snapshot);
});
});
