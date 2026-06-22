import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

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
import {
  createUserTextProducer,
  produceAndImportSource,
} from "../../rooms/pattern-room/shared/source-producers/index.ts";
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


describe("pattern-room phase 12D applies user text producer import results through local s", () => {
void test("pattern-room phase 12D applies user text producer import results through local state", () => {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  let notificationCount = 0;
  const unsubscribe = localState.subscribe(() => {
    notificationCount += 1;
  });

  const producer = createUserTextProducer({ now: () => "2026-05-21T10:00:00.000Z" });
  const orchestrationResult = produceAndImportSource(producer, {
    inputKind: "pasted_text",
    text: "Kullanıcı metni source producer hattından gelir.",
    title: "Üretici kaynak notu",
    language: "tr",
  });
  const importResult = orchestrationResult.importResults[0]?.importResult;
  assert.ok(importResult);

  const summary = localState.applySourceImportResult(importResult);
  unsubscribe();

  assert.equal(orchestrationResult.importResults[0]?.sourceKind, "user_text");
  assert.deepEqual(summary, {
    sourcesAdded: 1,
    evidenceAdded: 0,
    nodesAdded: 0,
    edgesAdded: 0,
    notesAdded: 0,
    edgesDropped: 0,
    duplicatesSkipped: 0,
    warnings: [],
  });
  assert.equal(notificationCount, 1);
  assert.deepEqual(localState.getOverlay().localAuthoredSources, [
    {
      id: "local-source-001",
      label: "Üretici kaynak notu",
      origin: "Kullanıcı metni",
      note: "Kullanıcı metni source producer hattından gelir.",
      createdAt: localState.getOverlay().localAuthoredSources[0]?.createdAt,
    },
  ]);
});
void test("pattern-room phase 11C continues local ids from restored max indexes", () => {
  const seedState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  const restoredSnapshot = restoreFromSnapshot(
    {
      ...createSnapshot(seedState, "board"),
      overlay: {
        ...seedState.getOverlay(),
        localNotes: [
          {
            id: "local-note-007",
            text: "Existing note.",
            createdAt: "2026-05-21T10:00:00.000Z",
          },
        ],
        localAuthoredNodes: [
          {
            id: "local-node-009",
            nodeType: "claim",
            label: "Existing claim",
            content: "Existing claim content.",
            createdAt: "2026-05-21T10:00:00.000Z",
          },
        ],
        localAuthoredSources: [
          {
            id: "local-source-004",
            label: "Existing source",
            origin: "manual:existing",
            note: "",
            createdAt: "2026-05-21T10:00:00.000Z",
          },
        ],
        localAuthoredEvidence: [
          {
            id: "local-evidence-003",
            label: "Existing evidence",
            excerpt: "Existing excerpt.",
            interpretation: null,
            layer: "evidence",
            createdAt: "2026-05-21T10:00:00.000Z",
          },
        ],
        localAuthoredEdges: [
          {
            id: "local-edge-002",
            edgeType: "supports",
            sourceId: "local-node-009",
            targetId: "local-source-004",
            note: null,
            createdAt: "2026-05-21T10:00:00.000Z",
          },
        ],
      },
      guards: {
        debateReportReflected: false,
        noteIndex: 0,
      },
    },
    PATTERN_ROOM_DOMAIN_MOCK
  );
  assert.ok(restoredSnapshot);
  assert.equal(restoredSnapshot.guards.noteIndex, 7);

  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  localState.restoreOverlay(restoredSnapshot.overlay, restoredSnapshot.guards);

  const summary = localState.applySourceImportResult(createRichImportResult());
  const overlay = localState.getOverlay();

  assert.equal(summary.edgesDropped, 0);
  assert.equal(overlay.localAuthoredSources.at(-1)?.id, "local-source-005");
  assert.equal(overlay.localAuthoredEvidence.at(-1)?.id, "local-evidence-004");
  assert.equal(overlay.localAuthoredNodes.at(-1)?.id, "local-node-010");
  assert.equal(overlay.localAuthoredEdges.at(-1)?.id, "local-edge-003");
  assert.equal(overlay.localNotes.at(-1)?.id, "local-note-008");
  assert.equal(overlay.localAuthoredEdges.at(-1)?.sourceId, "local-node-010");
  assert.equal(overlay.localAuthoredEdges.at(-1)?.targetId, "local-evidence-004");
});
void test("pattern-room phase 11C direct overlay restore continues note ids from max index", () => {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  localState.restoreOverlay(
    {
      ...localState.getOverlay(),
      localNotes: [
        {
          id: "local-note-007",
          text: "Existing note.",
          createdAt: "2026-05-21T10:00:00.000Z",
        },
      ],
      localAuthoredNodes: [
        {
          id: "local-node-009",
          nodeType: "claim",
          label: "Existing claim",
          content: "Existing claim content.",
          createdAt: "2026-05-21T10:00:00.000Z",
        },
      ],
      localAuthoredSources: [
        {
          id: "local-source-004",
          label: "Existing source",
          origin: "manual:existing",
          note: "",
          createdAt: "2026-05-21T10:00:00.000Z",
        },
      ],
      localAuthoredEvidence: [
        {
          id: "local-evidence-003",
          label: "Existing evidence",
          excerpt: "Existing excerpt.",
          interpretation: null,
          layer: "evidence",
          createdAt: "2026-05-21T10:00:00.000Z",
        },
      ],
      localAuthoredEdges: [
        {
          id: "local-edge-002",
          edgeType: "supports",
          sourceId: "local-node-009",
          targetId: "local-source-004",
          note: null,
          createdAt: "2026-05-21T10:00:00.000Z",
        },
      ],
    },
    {
      debateReportReflected: false,
      noteIndex: 0,
    }
  );

  localState.addLocalNote("New local note after stale guard restore.");
  const overlay = localState.getOverlay();

  assert.equal(overlay.localNotes.at(-1)?.id, "local-note-008");
});
void test("pattern-room phase 11C drops unmapped import edges without throwing", () => {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  const result = createSourceImportResult({
    nodes: [
      {
        draftId: "import-node-1",
        nodeType: "claim",
        label: "Mapped node",
        content: "Mapped node content.",
        originKind: "observation",
      },
    ],
    edges: [
      {
        draftId: "import-edge-missing",
        edgeType: "references",
        sourceDraftId: "import-node-1",
        targetDraftId: "missing-draft",
        note: null,
      },
    ],
  });

  const summary = localState.applySourceImportResult(result);

  assert.equal(summary.nodesAdded, 1);
  assert.equal(summary.edgesAdded, 0);
  assert.equal(summary.edgesDropped, 1);
  assert.match(summary.warnings.join("\n"), /import-edge-missing/);
  assert.deepEqual(localState.getOverlay().localAuthoredEdges, []);
});
});
