import test from "node:test";
import assert from "node:assert/strict";

import { PATTERN_ROOM_DOMAIN_MOCK } from "../../rooms/pattern-room/shared/data/pattern-room-domain.mock.ts";
import { createLocalState } from "../../rooms/pattern-room/shared/state/pattern-room-local-state.ts";
import {
  createSnapshot,
  restoreFromSnapshot,
} from "../../rooms/pattern-room/shared/state/pattern-room-snapshot.ts";
import { PATTERN_ROOM_SNAPSHOT_VERSION } from "../../rooms/pattern-room/shared/types/pattern-room-snapshot.ts";
import type { SourceImportResult } from "../../rooms/pattern-room/shared/source-workbench/index.ts";

function createSourceImportResult(
  partial: Partial<Omit<SourceImportResult, "stats">> = {}
): SourceImportResult {
  const result = {
    sources: [],
    evidence: [],
    nodes: [],
    edges: [],
    notes: [],
    warnings: [],
    ...partial,
  } satisfies Omit<SourceImportResult, "stats">;

  return {
    ...result,
    stats: {
      sourcesCreated: result.sources.length,
      evidenceCreated: result.evidence.length,
      nodesCreated: result.nodes.length,
      edgesCreated: result.edges.length,
      notesCreated: result.notes.length,
      duplicatesSkipped: 0,
      itemsDropped: 0,
    },
  };
}

function createRichImportResult(): SourceImportResult {
  return createSourceImportResult({
    sources: [
      {
        draftId: "import-source-abc",
        label: "Imported notebook",
        origin: "manual:imported-notebook",
        note: "Imported source note.",
        sourceKind: "user_text",
        patternSourceType: "personal_note",
      },
    ],
    evidence: [
      {
        draftId: "import-evidence-q1",
        label: "Imported quote",
        excerpt: "The imported quote text.",
        interpretation: "A cautious reading of the quote.",
        layer: "evidence",
        sourceQuoteId: "quote-1",
        sourceItemId: "source-item-1",
        page: "42",
        timecode: "00:12:43",
        speaker: "Speaker X",
        context: "Local source context.",
      },
    ],
    nodes: [
      {
        draftId: "import-node-motif-m1",
        nodeType: "inspiration",
        label: "Imported motif",
        content: "Imported motif content.",
        originKind: "motif",
      },
    ],
    edges: [
      {
        draftId: "import-edge-x",
        edgeType: "derived_from",
        sourceDraftId: "import-node-motif-m1",
        targetDraftId: "import-evidence-q1",
        note: "Imported edge note.",
      },
    ],
    notes: [
      {
        draftId: "import-note-summary",
        text: "Imported summary note.",
      },
    ],
  });
}


describe("pattern-room phase 11C applies SourceImportResult drafts to local overlay", () => {
void test("pattern-room phase 11C applies SourceImportResult drafts to local overlay", () => {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  let notificationCount = 0;
  const unsubscribe = localState.subscribe(() => {
    notificationCount += 1;
  });

  const summary = localState.applySourceImportResult(createRichImportResult());
  unsubscribe();

  assert.deepEqual(summary, {
    sourcesAdded: 1,
    evidenceAdded: 1,
    nodesAdded: 1,
    edgesAdded: 1,
    notesAdded: 1,
    edgesDropped: 0,
    duplicatesSkipped: 0,
    warnings: [],
  });
  assert.equal(notificationCount, 1);

  const overlay = localState.getOverlay();
  assert.deepEqual(overlay.localAuthoredSources, [
    {
      id: "local-source-001",
      label: "Imported notebook",
      origin: "manual:imported-notebook",
      note: "Imported source note.",
      createdAt: overlay.localAuthoredSources[0]?.createdAt,
    },
  ]);
  assert.deepEqual(overlay.localAuthoredNodes, [
    {
      id: "local-node-001",
      nodeType: "inspiration",
      label: "Imported motif",
      content: "Imported motif content.",
      createdAt: overlay.localAuthoredNodes[0]?.createdAt,
    },
  ]);
  assert.equal(overlay.localAuthoredEvidence[0]?.id, "local-evidence-001");
  assert.equal(overlay.localAuthoredEvidence[0].label, "Imported quote");
  assert.equal(overlay.localAuthoredEvidence[0].excerpt, "The imported quote text.");
  assert.match(
    overlay.localAuthoredEvidence[0].interpretation ?? "",
    /Kaynak bağlamı: Zaman: 00:12:43 · Sayfa: 42 · Konuşmacı: Speaker X/
  );
  assert.deepEqual(overlay.localAuthoredEdges, [
    {
      id: "local-edge-001",
      edgeType: "derived_from",
      sourceId: "local-node-001",
      targetId: "local-evidence-001",
      note: "Imported edge note.",
      createdAt: overlay.localAuthoredEdges[0]?.createdAt,
    },
  ]);
  assert.deepEqual(overlay.localNotes, [
    {
      id: "local-note-001",
      text: "Imported summary note.",
      createdAt: overlay.localNotes[0]?.createdAt,
    },
  ]);
  assert.equal("importBatchId" in (overlay.localAuthoredSources[0] ?? {}), false);
  assert.equal("importBatchId" in (overlay.localAuthoredEvidence[0] ), false);
  assert.equal("importBatchId" in (overlay.localAuthoredNodes[0] ?? {}), false);
  assert.equal("importBatchId" in (overlay.localAuthoredEdges[0] ?? {}), false);
  assert.equal("importBatchId" in (overlay.localNotes[0] ?? {}), false);
});
void test("pattern-room phase 14B-1 applies source segments to local source records only", () => {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);

  const summary = localState.applySourceImportResult(
    createSourceImportResult({
      sources: [
        {
          draftId: "import-source-segmented",
          label: "Segmented source",
          origin: "manual:segmented-source",
          note: "Full segmented source text.",
          sourceKind: "archive_text",
          patternSourceType: "unknown",
          segments: [
            {
              id: "segment-001",
              label: "Segment one",
              text: "First source segment text.",
              order: 0,
            },
            {
              id: "segment-002",
              label: "Segment two",
              text: "Second source segment text.",
              order: 1,
            },
          ],
        },
      ],
    })
  );

  const overlay = localState.getOverlay();
  assert.equal(summary.sourcesAdded, 1);
  assert.deepEqual(overlay.localAuthoredSources[0]?.segments, [
    {
      id: "segment-001",
      label: "Segment one",
      text: "First source segment text.",
      order: 0,
    },
    {
      id: "segment-002",
      label: "Segment two",
      text: "Second source segment text.",
      order: 1,
    },
  ]);
  assert.deepEqual(overlay.localAuthoredEvidence, []);
  assert.deepEqual(overlay.localAuthoredNodes, []);
  assert.deepEqual(overlay.localAuthoredEdges, []);
  assert.deepEqual(overlay.pinnedSourceIds, []);
});
void test("pattern-room phase 12F-B applies optional importBatchId to imported overlay entries", () => {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);

  const summary = localState.applySourceImportResult(createRichImportResult(), {
    importBatchId: "source-package-123",
  });
  const overlay = localState.getOverlay();

  assert.deepEqual(summary, {
    sourcesAdded: 1,
    evidenceAdded: 1,
    nodesAdded: 1,
    edgesAdded: 1,
    notesAdded: 1,
    edgesDropped: 0,
    duplicatesSkipped: 0,
    warnings: [],
  });
  assert.deepEqual(
    overlay.localAuthoredSources.map((source) => source.importBatchId),
    ["source-package-123"]
  );
  assert.deepEqual(
    overlay.localAuthoredEvidence.map((evidence) => evidence.importBatchId),
    ["source-package-123"]
  );
  assert.deepEqual(
    overlay.localAuthoredNodes.map((node) => node.importBatchId),
    ["source-package-123"]
  );
  assert.deepEqual(
    overlay.localAuthoredEdges.map((edge) => edge.importBatchId),
    ["source-package-123"]
  );
  assert.deepEqual(
    overlay.localNotes.map((note) => note.importBatchId),
    ["source-package-123"]
  );
});
void test("pattern-room phase 12F-B preserves importBatchId through snapshot round-trip", () => {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  localState.applySourceImportResult(createRichImportResult(), {
    importBatchId: "source-package-round-trip",
  });

  const snapshot = createSnapshot(localState, "board");
  const restored = restoreFromSnapshot(snapshot, PATTERN_ROOM_DOMAIN_MOCK);
  assert.ok(restored);

  assert.equal(snapshot.schemaVersion, PATTERN_ROOM_SNAPSHOT_VERSION);
  assert.deepEqual(
    restored.overlay.localAuthoredSources.map((source) => source.importBatchId),
    ["source-package-round-trip"]
  );
  assert.deepEqual(
    restored.overlay.localAuthoredEvidence.map((evidence) => evidence.importBatchId),
    ["source-package-round-trip"]
  );
  assert.deepEqual(
    restored.overlay.localAuthoredNodes.map((node) => node.importBatchId),
    ["source-package-round-trip"]
  );
  assert.deepEqual(
    restored.overlay.localAuthoredEdges.map((edge) => edge.importBatchId),
    ["source-package-round-trip"]
  );
  assert.deepEqual(
    restored.overlay.localNotes.map((note) => note.importBatchId),
    ["source-package-round-trip"]
  );
});
});
