import test from "node:test";
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { importSourcePackage, SAMPLE_USER_TEXT_SOURCE_PACKAGE } from "../../rooms/pattern-room/shared/source-workbench/index.ts";

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


describe("pattern-room source workbench keeps every generated edge linked to import drafts", () => {
void test("pattern-room source workbench keeps every generated edge linked to import drafts", () => {
  const result = importSourcePackage(
    createMinimalSourcePackage({
      sourcePackageId: "edge-integrity-package",
      quotes: [
        {
          quoteId: "edge-integrity-quote-1",
          sourceItemId: null,
          segmentId: null,
          label: "Edge integrity quote",
          excerpt: "All generated edges must point at emitted drafts.",
          context: null,
          page: null,
          timecode: null,
          speaker: null,
          metadata: {},
        },
      ],
      motifs: [
        {
          motifId: "edge-integrity-motif-1",
          label: "Edge integrity motif",
          content: "Motif with a valid related quote.",
          relatedQuoteIds: ["edge-integrity-quote-1"],
          metadata: {},
        },
      ],
      observations: [
        {
          observationId: "edge-integrity-observation-1",
          observationType: "pattern",
          label: "Edge integrity observation",
          content: "Observation with a valid related quote.",
          relatedQuoteIds: ["edge-integrity-quote-1"],
          metadata: {},
        },
      ],
      uncertainties: [
        {
          uncertaintyId: "edge-integrity-uncertainty-1",
          label: "Edge integrity uncertainty",
          content: "Uncertainty with a valid related quote.",
          relatedQuoteIds: ["edge-integrity-quote-1"],
          metadata: {},
        },
      ],
      references: [
        {
          referenceId: "edge-integrity-reference-1",
          sourceId: "edge-integrity-motif-1",
          targetId: "edge-integrity-observation-1",
          edgeType: "supports",
          note: null,
          metadata: {},
        },
      ],
    })
  );

  assert.equal(result.edges.length, 4);
  assertEdgesResolveToImportDrafts(result);
});
void test("pattern-room source workbench skips duplicate packages with a warning", () => {
  const result = importSourcePackage(createMinimalSourcePackage(), {
    existingPackageIds: ["minimal-package"],
  });

  assert.deepEqual(result.sources, []);
  assert.deepEqual(result.evidence, []);
  assert.deepEqual(result.nodes, []);
  assert.deepEqual(result.edges, []);
  assert.equal(result.warnings[0]?.code, "duplicate-package");
  assert.equal(result.stats.duplicatesSkipped, 1);
});
void test("pattern-room source workbench applies quote limits without throwing", () => {
  const quotes = Array.from({ length: 101 }, (_, index) => {
    const quoteIndex = index + 1;
    return {
      quoteId: `bulk-quote-${String(quoteIndex)}`,
      sourceItemId: null,
      segmentId: null,
      label: `Bulk quote ${String(quoteIndex)}`,
      excerpt: `Bulk quote excerpt ${String(quoteIndex)}.`,
      context: null,
      page: null,
      timecode: null,
      speaker: null,
      metadata: {},
    };
  });

  const result = importSourcePackage(
    createMinimalSourcePackage({
      sourcePackageId: "bulk-quote-package",
      quotes,
    })
  );

  assert.equal(result.evidence.length, 100);
  assert.equal(result.stats.itemsDropped, 1);
  assert.equal(
    result.warnings.some((warning) => warning.code === "limit-exceeded"),
    true
  );
});
void test("pattern-room source workbench import adapter does not mutate input packages", () => {
  const pkg = createMinimalSourcePackage({
    sourcePackageId: "purity-package",
    quotes: SAMPLE_USER_TEXT_SOURCE_PACKAGE.quotes,
    motifs: SAMPLE_USER_TEXT_SOURCE_PACKAGE.motifs,
    metadata: { summary: "A package summary note." },
  });
  const before = JSON.stringify(pkg);

  const result = importSourcePackage(pkg);

  assert.equal(result.notes.length, 1);
  assert.equal(JSON.stringify(pkg), before);
});
});
