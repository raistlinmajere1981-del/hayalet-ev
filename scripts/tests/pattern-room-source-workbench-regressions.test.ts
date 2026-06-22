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
