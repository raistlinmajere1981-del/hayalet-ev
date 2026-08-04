import { access, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const apply = process.argv.includes("--apply");
const changedFiles = [];

const INSTALLED_UI_TEST_FILES = [
  "scripts/tests/pattern-room-installed-ui-smoke-regressions-part1.test.ts",
  "scripts/tests/pattern-room-installed-ui-smoke-regressions-part2.test.ts",
  "scripts/tests/pattern-room-installed-ui-smoke-regressions-part3.test.ts",
  "scripts/tests/pattern-room-installed-ui-smoke-regressions-part4.test.ts",
  "scripts/tests/pattern-room-installed-ui-smoke-regressions-part5.test.ts",
  "scripts/tests/pattern-room-installed-ui-smoke-regressions-part6.test.ts",
];

async function readRepoFile(path) {
  return await readFile(join(repoRoot, path), "utf8");
}

async function fileExists(path) {
  try {
    await access(join(repoRoot, path));
    return true;
  } catch {
    return false;
  }
}

async function writeRepoFile(path, content) {
  const normalized = content.endsWith("\n") ? content : `${content}\n`;
  const current = (await fileExists(path)) ? await readRepoFile(path) : null;
  if (current === normalized) {
    return;
  }
  changedFiles.push(path);
  if (apply) {
    await writeFile(join(repoRoot, path), normalized, "utf8");
  }
}

function replaceRequired(content, search, replacement, label) {
  if (!content.includes(search)) {
    throw new Error(`Required migration pattern was not found: ${label}`);
  }
  return content.replace(search, replacement);
}

async function removeUnusedPanelInput() {
  const path = "rooms/pattern-room/ui/panels/pattern-tenth-man-panel.ts";
  let source = await readRepoFile(path);
  source = replaceRequired(
    source,
    `function appendCaseReviewPreview(\n  device: HTMLElement,\n  data: PatternRoomWorkspaceModel,\n  previewState: PatternCaseReviewPreviewPanelState\n): void {`,
    `function appendCaseReviewPreview(\n  device: HTMLElement,\n  previewState: PatternCaseReviewPreviewPanelState\n): void {`,
    "unused Case Review panel data parameter"
  );
  source = replaceRequired(
    source,
    "  appendCaseReviewPreview(reviewSurface, data, caseReviewPreviewState);",
    "  appendCaseReviewPreview(reviewSurface, caseReviewPreviewState);",
    "Case Review panel call site"
  );
  await writeRepoFile(path, source);
}

async function addUiRuntimeDomainInjection() {
  const path = "rooms/pattern-room/ui/pattern-room-ui-runtime.ts";
  let source = await readRepoFile(path);
  source = replaceRequired(
    source,
    `export function createPatternRoomUiRuntime(): PatternRoomUiRuntime {\n  const root = resolveRoot();\n  const localState = createLocalState(PATTERN_ROOM_DOMAIN);`,
    `export type PatternRoomUiRuntimeOptions = {\n  readonly domain?: typeof PATTERN_ROOM_DOMAIN;\n};\n\nexport function createPatternRoomUiRuntime(\n  options: PatternRoomUiRuntimeOptions = {}\n): PatternRoomUiRuntime {\n  const root = resolveRoot();\n  const domain = options.domain ?? PATTERN_ROOM_DOMAIN;\n  const localState = createLocalState(domain);`,
    "UI runtime injectable domain boundary"
  );
  source = source.replace(
    /adaptDomainToViewModels\(\s*PATTERN_ROOM_DOMAIN,/g,
    "adaptDomainToViewModels(domain,"
  );
  source = source.replace(/domain: PATTERN_ROOM_DOMAIN,/g, "domain,");
  source = source.replace(
    /restoreFromSnapshot\(snapshot, PATTERN_ROOM_DOMAIN\)/g,
    "restoreFromSnapshot(snapshot, domain)"
  );

  const productionDomainUses = source.match(/PATTERN_ROOM_DOMAIN/g)?.length ?? 0;
  if (productionDomainUses !== 3) {
    throw new Error(
      `Expected exactly import/type/default uses of PATTERN_ROOM_DOMAIN after injection; found ${String(
        productionDomainUses
      )}.`
    );
  }
  await writeRepoFile(path, source);
}

async function createInstalledUiTestHelper() {
  const path = "scripts/tests/pattern-room-installed-ui-smoke.helpers.ts";
  const source = `import { resolve } from "node:path";\nimport { pathToFileURL } from "node:url";\n\nimport { PATTERN_ROOM_DOMAIN_TEST_FIXTURE } from "../../rooms/pattern-room/shared/data/testing/pattern-room-domain.fixture.ts";\n\ntype PatternRoomInstalledUiRuntime = {\n  start: () => void;\n  dispose: () => void;\n};\n\ntype PatternRoomInstalledUiRuntimeModule = {\n  createPatternRoomUiRuntime: (options: {\n    readonly domain: typeof PATTERN_ROOM_DOMAIN_TEST_FIXTURE;\n  }) => PatternRoomInstalledUiRuntime;\n};\n\nlet importSequence = 0;\n\nexport async function startPatternRoomInstalledUi(\n  installedRootDir: string\n): Promise<PatternRoomInstalledUiRuntime> {\n  importSequence += 1;\n  const moduleUrl = \`\${\n    pathToFileURL(resolve(installedRootDir, "ui/pattern-room-ui-runtime.js")).href\n  }?smoke=\${Date.now()}-\${importSequence}\`;\n  const runtimeModule = (await import(moduleUrl)) as PatternRoomInstalledUiRuntimeModule;\n  const runtime = runtimeModule.createPatternRoomUiRuntime({\n    domain: PATTERN_ROOM_DOMAIN_TEST_FIXTURE,\n  });\n  runtime.start();\n  return runtime;\n}\n`;
  await writeRepoFile(path, source);
}

function removeUnusedNamedImport(source, name) {
  if (source.includes(`${name}(`)) {
    return source;
  }
  return source.replace(new RegExp(`^\\s{2}${name},\\n`, "m"), "");
}

async function migrateInstalledUiTests() {
  const importPattern = /await import\(\s*`\$\{pathToFileURL\(resolve\(installedCopy\.rootDir,\s*"ui\/index\.js"\)\)\.href\}\?[^`]+`\s*\);/g;

  for (const path of INSTALLED_UI_TEST_FILES) {
    let source = await readRepoFile(path);
    const matches = source.match(importPattern)?.length ?? 0;
    if (matches === 0) {
      throw new Error(`No Pattern Room installed UI bootstrap imports found in ${path}.`);
    }
    source = source.replace(
      importPattern,
      "await startPatternRoomInstalledUi(installedCopy.rootDir);"
    );
    if (!source.includes("pattern-room-installed-ui-smoke.helpers.ts")) {
      source = `import { startPatternRoomInstalledUi } from "./pattern-room-installed-ui-smoke.helpers.ts";\n${source}`;
    }
    source = removeUnusedNamedImport(source, "pathToFileURL");
    source = removeUnusedNamedImport(source, "resolve");
    if (source.includes('"ui/index.js"')) {
      throw new Error(`Legacy Pattern Room index bootstrap remains in ${path}.`);
    }
    await writeRepoFile(path, source);
  }
}

async function updateHostProductionTopicTest() {
  const path = "scripts/tests/pattern-room-persistence-host-wiring-regressions.test.ts";
  let source = await readRepoFile(path);
  if (!source.includes('shared/data/pattern-room-domain.ts"')) {
    source = `import { PATTERN_ROOM_DOMAIN } from "../../rooms/pattern-room/shared/data/pattern-room-domain.ts";\n${source}`;
  }
  source = replaceRequired(
    source,
    'void test("pattern-room host ready lifecycle best-effort loads the mock topic", async () => {',
    'void test("pattern-room host ready lifecycle best-effort loads the production topic", async () => {',
    "host lifecycle test title"
  );
  source = replaceRequired(
    source,
    "  assert.deepEqual(loadedTopicIds, [PATTERN_ROOM_DOMAIN_TEST_FIXTURE.topic.id]);",
    "  assert.deepEqual(loadedTopicIds, [PATTERN_ROOM_DOMAIN.topic.id]);",
    "host production topic expectation"
  );
  await writeRepoFile(path, source);
}

async function updateProgress() {
  const path = ".rovo/pattern-room-v2-progress.md";
  let source = await readRepoFile(path);
  const marker =
    "- Active Case Review preview now builds its packet from structured domain + local overlay data.";
  if (!source.includes(marker)) {
    throw new Error("Phase 1 progress marker was not found.");
  }
  source = source.replace(
    marker,
    `${marker}\n- UI smoke tests now inject the isolated regression fixture through the runtime factory; production still opens the empty domain.\n- Host lifecycle coverage now asserts the production empty topic explicitly.`
  );
  await writeRepoFile(path, source);
}

async function main() {
  await removeUnusedPanelInput();
  await addUiRuntimeDomainInjection();
  await createInstalledUiTestHelper();
  await migrateInstalledUiTests();
  await updateHostProductionTopicTest();
  await updateProgress();

  const mode = apply ? "Applied" : "Would change";
  console.log(`${mode} ${changedFiles.length} files:`);
  for (const path of changedFiles) {
    console.log(`- ${path}`);
  }
  if (!apply) {
    console.log("\nRun again with --apply to write the follow-up migration.");
  }
}

await main();
