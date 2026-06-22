import test from "node:test";
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { importSourcePackage, mapSourceKindToPatternSourceType, parseSourcePackage, SOURCE_KIND_TO_PATTERN_SOURCE_TYPE, SOURCE_KINDS } from "../../rooms/pattern-room/shared/source-workbench/index.ts";

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


describe("pattern-room source workbench exposes source kinds and pattern source mapping", () => {
void test("pattern-room source workbench exposes source kinds and pattern source mapping", () => {
  assert.deepEqual(SOURCE_KINDS, EXPECTED_SOURCE_KINDS);
  assert.deepEqual(SOURCE_KIND_TO_PATTERN_SOURCE_TYPE, EXPECTED_SOURCE_KIND_MAPPING);

  for (const sourceKind of SOURCE_KINDS) {
    assert.equal(
      mapSourceKindToPatternSourceType(sourceKind),
      EXPECTED_SOURCE_KIND_MAPPING[sourceKind]
    );
  }
});
void test("pattern-room source workbench parses valid packages and defaults optional arrays", () => {
  const parsed = parseSourcePackage({
    sourcePackageId: "parse-valid",
    sourceKind: "book",
    title: "Valid parse package",
    origin: "book:valid",
    language: "en",
    createdAt: "2026-05-21T11:05:00.000Z",
  });

  assert.ok(parsed);
  assert.equal(parsed.sourcePackageId, "parse-valid");
  assert.equal(parsed.cleanedText, null);
  assert.deepEqual(parsed.sourceItems, []);
  assert.deepEqual(parsed.segments, []);
  assert.deepEqual(parsed.quotes, []);
  assert.deepEqual(parsed.observations, []);
  assert.deepEqual(parsed.motifs, []);
  assert.deepEqual(parsed.uncertainties, []);
  assert.deepEqual(parsed.numericPatterns, []);
  assert.deepEqual(parsed.references, []);
  assert.deepEqual(parsed.metadata, {});
});
void test("pattern-room source workbench rejects invalid package shapes defensively", () => {
  assert.equal(parseSourcePackage(null), null);
  assert.equal(parseSourcePackage({}), null);
  assert.equal(
    parseSourcePackage({
      sourcePackageId: "parse-invalid-kind",
      sourceKind: "not-a-kind",
      title: "Invalid kind",
      origin: "manual:invalid-kind",
      language: "en",
      createdAt: "2026-05-21T11:10:00.000Z",
    }),
    null
  );
  assert.equal(
    parseSourcePackage({
      sourcePackageId: "parse-missing-title",
      sourceKind: "book",
      origin: "manual:missing-title",
      language: "en",
      createdAt: "2026-05-21T11:10:00.000Z",
    }),
    null
  );
});
void test("pattern-room source workbench imports a minimal package as a source draft only", () => {
  const result = importSourcePackage(createMinimalSourcePackage());

  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0]?.draftId, "import-source-minimal-package");
  assert.equal(result.sources[0].patternSourceType, "personal_note");
  assert.deepEqual(result.evidence, []);
  assert.deepEqual(result.nodes, []);
  assert.deepEqual(result.edges, []);
  assert.deepEqual(result.notes, []);
  assert.deepEqual(result.stats, {
    sourcesCreated: 1,
    evidenceCreated: 0,
    nodesCreated: 0,
    edgesCreated: 0,
    notesCreated: 0,
    duplicatesSkipped: 0,
    itemsDropped: 0,
  });
});
});
