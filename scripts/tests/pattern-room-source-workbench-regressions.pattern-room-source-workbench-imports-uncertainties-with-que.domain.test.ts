import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import {
  importSourcePackage,
  mapSourceKindToPatternSourceType,
  parseSourcePackage,
  SAMPLE_NEWSPAPER_SOURCE_PACKAGE,
  SAMPLE_SUBTITLE_SOURCE_PACKAGE,
  SAMPLE_USER_TEXT_SOURCE_PACKAGE,
  SOURCE_KIND_TO_PATTERN_SOURCE_TYPE,
  SOURCE_KINDS,
  type SourceImportResult,
  type SourceKind,
  type SourcePackage,
} from "../../rooms/pattern-room/shared/source-workbench/index.ts";

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


describe("pattern-room source workbench imports uncertainties with questions edges", () => {
void test("pattern-room source workbench imports uncertainties with questions edges", () => {
  const result = importSourcePackage(
    createMinimalSourcePackage({
      sourcePackageId: "uncertainty-package",
      quotes: [
        {
          quoteId: "uncertainty-quote-1",
          sourceItemId: null,
          segmentId: null,
          label: "Uncertainty quote",
          excerpt: "The sampled archive might be incomplete.",
          context: null,
          page: null,
          timecode: null,
          speaker: null,
          metadata: {},
        },
      ],
      uncertainties: [
        {
          uncertaintyId: "uncertainty-1",
          label: "Archive gap",
          content: "The archive gap needs review.",
          relatedQuoteIds: ["uncertainty-quote-1"],
          metadata: {},
        },
      ],
    })
  );

  assert.equal(result.nodes.length, 1);
  assert.equal(result.nodes[0]?.nodeType, "uncertainty");
  assert.equal(result.edges.length, 1);
  assert.equal(result.edges[0]?.edgeType, "questions");
});
void test("pattern-room source workbench imports references as reference edges", () => {
  const result = importSourcePackage(
    createMinimalSourcePackage({
      sourcePackageId: "reference-package",
      quotes: [
        {
          quoteId: "reference-quote-1",
          sourceItemId: null,
          segmentId: null,
          label: "Reference quote",
          excerpt: "Reference edge targets should stay explicit.",
          context: null,
          page: null,
          timecode: null,
          speaker: null,
          metadata: {},
        },
      ],
      motifs: [
        {
          motifId: "reference-motif-1",
          label: "Reference motif",
          content: "Reference motif content.",
          relatedQuoteIds: [],
          metadata: {},
        },
      ],
      references: [
        {
          referenceId: "reference-edge-1",
          sourceId: "reference-motif-1",
          targetId: "reference-quote-1",
          edgeType: "supports",
          note: "Producer edgeType is intentionally ignored for Source Workbench references.",
          metadata: {},
        },
      ],
    })
  );

  assert.equal(result.edges.length, 1);
  assert.equal(result.edges[0]?.edgeType, "references");
  assert.equal(result.edges[0].sourceDraftId, "import-node-motif-reference-motif-1");
  assert.equal(result.edges[0].targetDraftId, "import-evidence-reference-quote-1");
  assertEdgesResolveToImportDrafts(result);
});
void test("pattern-room source workbench skips unresolved references without dangling edges", () => {
  const result = importSourcePackage(
    createMinimalSourcePackage({
      sourcePackageId: "unresolved-reference-package",
      motifs: [
        {
          motifId: "unresolved-reference-motif-1",
          label: "Unresolved reference motif",
          content: "Reference source exists but target does not.",
          relatedQuoteIds: [],
          metadata: {},
        },
      ],
      references: [
        {
          referenceId: "unresolved-reference-edge-1",
          sourceId: "unresolved-reference-motif-1",
          targetId: "missing-quote",
          edgeType: "references",
          note: null,
          metadata: {},
        },
      ],
    })
  );

  assert.equal(result.edges.length, 0);
  assert.equal(
    result.warnings.some((warning) => warning.code === "unresolved-reference"),
    true
  );
  assert.equal(result.stats.itemsDropped, 1);
  assertEdgesResolveToImportDrafts(result);
});
void test("pattern-room source workbench skips unresolved related quote edges with warnings", () => {
  const result = importSourcePackage(
    createMinimalSourcePackage({
      sourcePackageId: "unresolved-related-quote-package",
      motifs: [
        {
          motifId: "unresolved-related-motif-1",
          label: "Unresolved related motif",
          content: "A motif references a quote that was not imported.",
          relatedQuoteIds: ["missing-quote"],
          metadata: {},
        },
      ],
    })
  );

  assert.equal(result.nodes.length, 1);
  assert.equal(result.edges.length, 0);
  assert.equal(
    result.warnings.some((warning) => warning.code === "unresolved-related-quote"),
    true
  );
  assert.equal(result.stats.itemsDropped, 1);
  assertEdgesResolveToImportDrafts(result);
});
});
