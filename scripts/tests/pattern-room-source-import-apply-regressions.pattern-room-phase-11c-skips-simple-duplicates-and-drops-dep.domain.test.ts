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


describe("pattern-room phase 11C skips simple duplicates and drops dependent edges", () => {
void test("pattern-room phase 11C skips simple duplicates and drops dependent edges", () => {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  localState.addAuthoredSource("Duplicate source", "manual:duplicate-source", "");
  localState.addAuthoredEvidence("Duplicate evidence", "Duplicate excerpt.", "");
  localState.addAuthoredClaim("Duplicate node", "Duplicate node content.");
  let notificationCount = 0;
  const unsubscribe = localState.subscribe(() => {
    notificationCount += 1;
  });

  const summary = localState.applySourceImportResult(
    createSourceImportResult({
      sources: [
        {
          draftId: "import-source-duplicate",
          label: "Duplicate source",
          origin: "manual:duplicate-source",
          note: "",
          sourceKind: "user_text",
          patternSourceType: "personal_note",
        },
      ],
      evidence: [
        {
          draftId: "import-evidence-duplicate",
          label: "Duplicate evidence changed label",
          excerpt: "Duplicate excerpt.",
          interpretation: null,
          layer: "evidence",
          sourceQuoteId: "quote-duplicate",
          sourceItemId: null,
          page: null,
          timecode: null,
          speaker: null,
          context: null,
        },
      ],
      nodes: [
        {
          draftId: "import-node-duplicate",
          nodeType: "claim",
          label: "Duplicate node",
          content: "Duplicate node content.",
          originKind: "observation",
        },
        {
          draftId: "import-node-new",
          nodeType: "claim",
          label: "New node",
          content: "New node content.",
          originKind: "observation",
        },
      ],
      edges: [
        {
          draftId: "import-edge-dependent",
          edgeType: "supports",
          sourceDraftId: "import-source-duplicate",
          targetDraftId: "import-node-new",
          note: "Dependent edge should drop.",
        },
      ],
    })
  );
  unsubscribe();

  assert.equal(summary.sourcesAdded, 0);
  assert.equal(summary.evidenceAdded, 0);
  assert.equal(summary.nodesAdded, 1);
  assert.equal(summary.edgesAdded, 0);
  assert.equal(summary.edgesDropped, 1);
  assert.equal(summary.duplicatesSkipped, 3);
  assert.equal(notificationCount, 1);
  assert.match(summary.warnings.join("\n"), /Duplicate source draft skipped/);
  assert.match(summary.warnings.join("\n"), /Duplicate evidence draft skipped/);
  assert.match(summary.warnings.join("\n"), /Duplicate node draft skipped/);
  assert.deepEqual(
    localState.getOverlay().localAuthoredEdges.map((edge) => edge.note),
    []
  );
});
void test("pattern-room phase 11C preserves imported overlay entries through snapshot restore", () => {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  localState.applySourceImportResult(createRichImportResult());

  const snapshot = createSnapshot(localState, "board");
  const restored = restoreFromSnapshot(snapshot, PATTERN_ROOM_DOMAIN_MOCK);
  assert.ok(restored);

  const roundTripState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  roundTripState.restoreOverlay(restored.overlay, restored.guards);

  assert.equal(snapshot.schemaVersion, PATTERN_ROOM_SNAPSHOT_VERSION);
  assert.deepEqual(roundTripState.getOverlay(), localState.getOverlay());
});
void test("pattern-room phase 11C keeps overlay shape, snapshot version, and import apply purity", async () => {
  const overlay = createLocalState(PATTERN_ROOM_DOMAIN_MOCK).getOverlay();
  assert.deepEqual(Object.keys(overlay).sort(), [
    "debateLocalTurns",
    "debateLocalVerdict",
    "debatePhase",
    "debateReferenceIds",
    "debateRolesConnected",
    "deskNodeIds",
    "localAuthoredEdges",
    "localAuthoredEvidence",
    "localAuthoredNodes",
    "localAuthoredSources",
    "localNotes",
    "pinnedSourceIds",
    "sourcePinnedLayerById",
  ]);
  assert.equal(PATTERN_ROOM_SNAPSHOT_VERSION, 1);

  const localStateSource = await readFile(
    resolve("rooms/pattern-room/shared/state/pattern-room-local-state.ts"),
    "utf8"
  );
  const snapshotShapeCheck: PatternRoomSessionSnapshot["schemaVersion"] =
    PATTERN_ROOM_SNAPSHOT_VERSION;
  assert.equal(snapshotShapeCheck, 1);

  const prohibitedPatterns = [
    /from\s+["']node:fs/,
    /from\s+["']fs/,
    /ipcRenderer/,
    /roomAPI/,
    /registerCommand/,
    /notifyRoom/,
    /document\./,
    /window\./,
    /fetch\s*\(/,
    /from\s+["'][^"']*(?:host|ui|runtime)/,
  ];

  for (const pattern of prohibitedPatterns) {
    assert.equal(pattern.test(localStateSource), false, String(pattern));
  }
});
});
