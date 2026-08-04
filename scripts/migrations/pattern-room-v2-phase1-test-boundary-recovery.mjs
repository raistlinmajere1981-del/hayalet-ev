import { access, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const apply = process.argv.includes("--apply");
const changedFiles = [];

async function fileExists(path) {
  try {
    await access(join(repoRoot, path));
    return true;
  } catch {
    return false;
  }
}

async function readRepoFile(path) {
  return await readFile(join(repoRoot, path), "utf8");
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

function ensureImport(source, importLine) {
  return source.includes(importLine) ? source : `${importLine}\n${source}`;
}

async function injectFixtureIntoDirectRuntimeSmokeTests() {
  const path = "scripts/tests/pattern-room-installed-ui-smoke-regressions-part6.test.ts";
  let source = await readRepoFile(path);
  const fixtureImport =
    'import { PATTERN_ROOM_DOMAIN_TEST_FIXTURE } from "../../rooms/pattern-room/shared/data/testing/pattern-room-domain.fixture.ts";';
  source = ensureImport(source, fixtureImport);

  source = source.replace(
    `type PatternRoomUiRuntimeModule = {\n  createPatternRoomUiRuntime: () => PatternRoomUiRuntime;\n};`,
    `type PatternRoomUiRuntimeModule = {\n  createPatternRoomUiRuntime: (options?: {\n    readonly domain?: typeof PATTERN_ROOM_DOMAIN_TEST_FIXTURE;\n  }) => PatternRoomUiRuntime;\n};`
  );

  source = source.replace(
    /runtimeModule\.createPatternRoomUiRuntime\(\);/g,
    `runtimeModule.createPatternRoomUiRuntime({\n      domain: PATTERN_ROOM_DOMAIN_TEST_FIXTURE,\n    });`
  );

  if (!source.includes("domain: PATTERN_ROOM_DOMAIN_TEST_FIXTURE")) {
    throw new Error("Part 6 direct runtime tests were not migrated to the fixture domain.");
  }

  await writeRepoFile(path, source);
}

async function repairHostProductionTopicExpectation() {
  const path = "scripts/tests/pattern-room-persistence-host-wiring-regressions.test.ts";
  let source = await readRepoFile(path);
  const productionImport =
    'import { PATTERN_ROOM_DOMAIN } from "../../rooms/pattern-room/shared/data/pattern-room-domain.ts";';
  source = ensureImport(source, productionImport);

  const testBlockPattern =
    /void test\("pattern-room host ready lifecycle best-effort loads the (?:mock|production) topic", async \(\) => \{[\s\S]*?\n\}\);/;
  const match = source.match(testBlockPattern);
  if (match === null) {
    throw new Error("Host ready lifecycle topic test block was not found.");
  }

  const repairedBlock = match[0]
    .replace(
      'void test("pattern-room host ready lifecycle best-effort loads the mock topic", async () => {',
      'void test("pattern-room host ready lifecycle best-effort loads the production topic", async () => {'
    )
    .replace(
      /\[PATTERN_ROOM_DOMAIN_(?:MOCK|TEST_FIXTURE)\.topic\.id\]/g,
      "[PATTERN_ROOM_DOMAIN.topic.id]"
    );

  if (!repairedBlock.includes("[PATTERN_ROOM_DOMAIN.topic.id]")) {
    throw new Error("Host ready lifecycle test still does not assert the production topic.");
  }

  source = source.replace(testBlockPattern, repairedBlock);
  await writeRepoFile(path, source);
}

async function updateProgress() {
  const path = ".rovo/pattern-room-v2-progress.md";
  if (!(await fileExists(path))) {
    return;
  }
  let source = await readRepoFile(path);
  const line =
    "- Direct-runtime Case Review smoke tests now inject the isolated fixture, while the host lifecycle test asserts the production empty topic.";
  if (!source.includes(line)) {
    source = `${source.trimEnd()}\n${line}\n`;
  }
  await writeRepoFile(path, source);
}

async function main() {
  await injectFixtureIntoDirectRuntimeSmokeTests();
  await repairHostProductionTopicExpectation();
  await updateProgress();

  const mode = apply ? "Applied" : "Would change";
  console.log(`${mode} ${changedFiles.length} files:`);
  for (const path of changedFiles) {
    console.log(`- ${path}`);
  }
  if (!apply) {
    console.log("\nRun again with --apply to write the recovery migration.");
  }
}

await main();
