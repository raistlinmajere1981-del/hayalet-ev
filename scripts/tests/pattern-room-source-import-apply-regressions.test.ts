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
