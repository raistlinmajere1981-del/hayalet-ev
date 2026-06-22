import test from "node:test";
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { importSourcePackage, SAMPLE_SUBTITLE_SOURCE_PACKAGE } from "../../rooms/pattern-room/shared/source-workbench/index.ts";

const EXPECTED_SOURCE_KINDS = [
  "user_text",
  "book",
  "article",
  "religious_text",
  "newspaper",
  "archive_text",
  "youtube_channel_subtitles",
  "video_subtitles",
  "subtitle_archive",
  "web_archive",
  "laboratory_result",
  "number_analysis",
  "personal_note",
] as const satisfies readonly SourceKind[];

const EXPECTED_SOURCE_KIND_MAPPING = {
  user_text: "personal_note",
  book: "book",
  article: "unknown",
  religious_text: "religious_text",
  newspaper: "newspaper",
  archive_text: "unknown",
  youtube_channel_subtitles: "subtitle_archive",
  video_subtitles: "subtitle_archive",
  subtitle_archive: "subtitle_archive",
  web_archive: "web_archive",
  laboratory_result: "laboratory_result",
  number_analysis: "number_analysis",
  personal_note: "personal_note",
} as const;

function createMinimalSourcePackage(partial: Partial<SourcePackage> = {}): SourcePackage {
  return {
    sourcePackageId: "minimal-package",
    sourceKind: "user_text",
    title: "Minimal package",
    origin: "manual:minimal-package",
    language: "en",
    createdAt: "2026-05-21T11:00:00.000Z",
    sourceItems: [],
    cleanedText: null,
    segments: [],
    quotes: [],
    observations: [],
    motifs: [],
    uncertainties: [],
    numericPatterns: [],
    references: [],
    metadata: {},
    ...partial,
  };
}

function collectImportDraftIds(result: SourceImportResult): Set<string> {
  return new Set([
    ...result.sources.map((source) => source.draftId),
    ...result.evidence.map((evidence) => evidence.draftId),
    ...result.nodes.map((node) => node.draftId),
    ...result.notes.map((note) => note.draftId),
  ]);
}

function assertEdgesResolveToImportDrafts(result: SourceImportResult): void {
  const draftIds = collectImportDraftIds(result);

  for (const edge of result.edges) {
    assert.equal(draftIds.has(edge.sourceDraftId), true, edge.draftId);
    assert.equal(draftIds.has(edge.targetDraftId), true, edge.draftId);
  }
}

async function walkTypeScriptFiles(baseDir: string): Promise<string[]> {
  const entries = await readdir(baseDir, { withFileTypes: true });
  const files: string[] = [];

  const dirResults = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => await walkTypeScriptFiles(join(baseDir, entry.name)))
  );
  for (const dirResult of dirResults) {
    files.push(...dirResult);
  }

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(join(baseDir, entry.name));
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}


describe("pattern-room source workbench preserves source package segments on the source dr", () => {
void test("pattern-room source workbench preserves source package segments on the source draft", () => {
  const result = importSourcePackage(
    createMinimalSourcePackage({
      sourcePackageId: "segmented-package",
      segments: [
        {
          segmentId: "segment-001",
          sourceItemId: "source-item-001",
          label: "Segment one",
          text: "First source segment text.",
          order: 0,
          page: null,
          timecode: null,
          speaker: null,
          metadata: {},
        },
        {
          segmentId: "segment-002",
          sourceItemId: "source-item-001",
          label: "Segment two",
          text: "Second source segment text.",
          order: null,
          page: null,
          timecode: null,
          speaker: null,
          metadata: {},
        },
      ],
    })
  );

  assert.deepEqual(result.sources[0]?.segments, [
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
  assert.deepEqual(result.evidence, []);
  assert.deepEqual(result.nodes, []);
  assert.deepEqual(result.edges, []);
});
void test("pattern-room source workbench maps quotes and motifs into evidence, nodes, and derived edges", () => {
  const result = importSourcePackage(
    createMinimalSourcePackage({
      sourcePackageId: "quote-motif-package",
      quotes: [
        {
          quoteId: "quote-1",
          sourceItemId: "item-1",
          segmentId: null,
          label: "Quote 1",
          excerpt: "First quote.",
          context: null,
          page: null,
          timecode: null,
          speaker: null,
          metadata: {},
        },
        {
          quoteId: "quote-2",
          sourceItemId: "item-1",
          segmentId: null,
          label: "Quote 2",
          excerpt: "Second quote.",
          context: null,
          page: null,
          timecode: null,
          speaker: null,
          metadata: {},
        },
        {
          quoteId: "quote-3",
          sourceItemId: "item-1",
          segmentId: null,
          label: "Quote 3",
          excerpt: "Third quote.",
          context: null,
          page: null,
          timecode: null,
          speaker: null,
          metadata: {},
        },
      ],
      motifs: [
        {
          motifId: "motif-1",
          label: "Motif 1",
          content: "First motif.",
          relatedQuoteIds: ["quote-1", "quote-2"],
          metadata: {},
        },
        {
          motifId: "motif-2",
          label: "Motif 2",
          content: "Second motif.",
          relatedQuoteIds: ["quote-3"],
          metadata: {},
        },
      ],
    })
  );

  assert.equal(result.evidence.length, 3);
  assert.equal(result.nodes.length, 2);
  assert.equal(
    result.nodes.every((node) => node.nodeType === "inspiration"),
    true
  );
  assert.equal(result.edges.length, 3);
  assert.equal(
    result.edges.every((edge) => edge.edgeType === "derived_from"),
    true
  );
  assertEdgesResolveToImportDrafts(result);
});
void test("pattern-room source workbench preserves quote timecodes in evidence drafts", () => {
  const result = importSourcePackage(SAMPLE_SUBTITLE_SOURCE_PACKAGE);

  assert.equal(result.evidence.length, 1);
  assert.equal(result.evidence[0]?.timecode, "00:01:12");
  assert.equal(result.evidence[0].speaker, "Narrator");
});
void test("pattern-room source workbench imports numeric patterns as inspiration nodes", () => {
  const result = importSourcePackage(
    createMinimalSourcePackage({
      sourcePackageId: "numeric-package",
      numericPatterns: [
        {
          patternId: "number-1",
          label: "Seven-count cadence",
          content: "A repeated count appears.",
          value: "7",
          relatedQuoteIds: [],
          metadata: {},
        },
      ],
    })
  );

  assert.equal(result.nodes.length, 1);
  assert.equal(result.nodes[0]?.draftId, "import-node-number-number-1");
  assert.equal(result.nodes[0].nodeType, "inspiration");
  assert.equal(result.nodes[0].originKind, "numeric_pattern");
});
});
