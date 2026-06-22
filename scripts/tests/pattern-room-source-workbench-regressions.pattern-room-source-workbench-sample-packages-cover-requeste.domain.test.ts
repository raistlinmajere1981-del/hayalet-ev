import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { importSourcePackage, parseSourcePackage, SAMPLE_NEWSPAPER_SOURCE_PACKAGE, SAMPLE_SUBTITLE_SOURCE_PACKAGE, SAMPLE_USER_TEXT_SOURCE_PACKAGE } from "../../rooms/pattern-room/shared/source-workbench/index.ts";

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


describe("pattern-room source workbench sample packages cover requested source varieties", () => {
void test("pattern-room source workbench sample packages cover requested source varieties", () => {
  const userTextResult = importSourcePackage(SAMPLE_USER_TEXT_SOURCE_PACKAGE);
  const newspaperResult = importSourcePackage(SAMPLE_NEWSPAPER_SOURCE_PACKAGE);
  const subtitleResult = importSourcePackage(SAMPLE_SUBTITLE_SOURCE_PACKAGE);

  assert.equal(
    userTextResult.nodes.some((node) => node.originKind === "motif"),
    true
  );
  assert.equal(
    newspaperResult.nodes.some((node) => node.originKind === "uncertainty"),
    true
  );
  assert.equal(
    newspaperResult.nodes.some((node) => node.originKind === "numeric_pattern"),
    true
  );
  assert.equal(subtitleResult.evidence[0]?.timecode, "00:01:12");
});
void test("pattern-room source workbench stays disconnected from overlay, snapshot, UI, host, and IPC surfaces", async () => {
  const protectedFiles = [
    "rooms/pattern-room/shared/state/pattern-room-snapshot.ts",
    "rooms/pattern-room/shared/types/pattern-room-snapshot.ts",
    "rooms/pattern-room/host/runtime.ts",
  ];

  const protectedSources = await Promise.all(
    protectedFiles.map(async (filePath) => {
      const source = await readFile(resolve(filePath), "utf8");
      return { filePath, source };
    })
  );
  for (const { filePath, source } of protectedSources) {
    assert.equal(source.includes("source-workbench"), false, filePath);
    assert.equal(source.includes("SourcePackage"), false, filePath);
  }

  const uiRuntimeSource = await readFile(
    resolve("rooms/pattern-room/ui/pattern-room-ui-runtime.ts"),
    "utf8"
  );
  assert.equal(uiRuntimeSource.includes("source-workbench"), false);
  assert.equal(uiRuntimeSource.includes("importSourcePackage("), false);
  assert.match(uiRuntimeSource, /pattern-source-import-demo/);

  const localStateSource = await readFile(
    resolve("rooms/pattern-room/shared/state/pattern-room-local-state.ts"),
    "utf8"
  );
  assert.match(localStateSource, /import type\s+\{[\s\S]*SourceImportResult[\s\S]*\}/);
  const localStateWithoutTypeImports = localStateSource.replace(
    /import type\s+\{[\s\S]*?\}\s+from\s+["'][^"']*source-workbench[^"']*["'];/g,
    ""
  );
  assert.equal(localStateWithoutTypeImports.includes("source-workbench"), false);
  assert.equal(localStateSource.includes("parseSourcePackage"), false);
  assert.equal(localStateSource.includes("importSourcePackage"), false);

  const sourceImportDemoSource = await readFile(
    resolve("rooms/pattern-room/ui/pattern-source-import-demo.ts"),
    "utf8"
  );
  assert.match(sourceImportDemoSource, /SAMPLE_SOURCE_PACKAGES/);
  assert.match(sourceImportDemoSource, /importSourcePackage/);

  const prohibitedDemoActionPatterns = [
    /from\s+["']node:fs/,
    /from\s+["']fs/,
    /readFile\s*\(/,
    /writeFile\s*\(/,
    /ipcRenderer/,
    /roomAPI/,
    /registerCommand/,
    /notifyRoom/,
    /fetch\s*\(/,
    /yt-dlp/,
    /provider/i,
    /relay/i,
    /laboratory\//,
  ];

  for (const pattern of prohibitedDemoActionPatterns) {
    assert.equal(pattern.test(sourceImportDemoSource), false, String(pattern));
  }

  const sourceWorkbenchFiles = await walkTypeScriptFiles(
    resolve("rooms/pattern-room/shared/source-workbench")
  );
  const prohibitedPatterns = [
    /from\s+["']node:fs/,
    /from\s+["']fs/,
    /readFile\s*\(/,
    /writeFile\s*\(/,
    /ipcRenderer/,
    /roomAPI/,
    /registerCommand/,
    /notifyRoom/,
    /document\./,
    /window\./,
    /fetch\s*\(/,
    /yt-dlp/,
    /provider/i,
    /relay/i,
    /laboratory\//,
    /PatternRoomLocalOverlay/,
    /LocalAuthored/,
  ];

  const workbenchSources = await Promise.all(
    sourceWorkbenchFiles.map(async (filePath) => {
      const source = await readFile(filePath, "utf8");
      return { filePath, source };
    })
  );
  for (const { filePath, source } of workbenchSources) {
    const relativePath = relative(process.cwd(), filePath);
    for (const pattern of prohibitedPatterns) {
      assert.equal(pattern.test(source), false, `${relativePath} matched ${String(pattern)}`);
    }
  }
});
});
