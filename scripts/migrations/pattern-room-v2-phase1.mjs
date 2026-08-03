import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const apply = process.argv.includes("--apply");
const changedFiles = [];

async function readRepoFile(path) {
  return await readFile(join(repoRoot, path), "utf8");
}

async function writeRepoFile(path, content) {
  const normalized = content.endsWith("\n") ? content : `${content}\n`;
  const current = await readRepoFile(path);
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

function replaceAll(content, search, replacement) {
  return content.split(search).join(replacement);
}

async function listFiles(path) {
  const absolute = join(repoRoot, path);
  const entries = await readdir(absolute, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = join(absolute, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(relative(repoRoot, child))));
    } else {
      files.push(relative(repoRoot, child).replaceAll("\\", "/"));
    }
  }
  return files;
}

async function migrateUiRuntime() {
  const path = "rooms/pattern-room/ui/pattern-room-ui-runtime.ts";
  let source = await readRepoFile(path);
  source = replaceRequired(
    source,
    'import { PATTERN_ROOM_DOMAIN_MOCK } from "../shared/data/pattern-room-domain.mock.js";',
    'import { PATTERN_ROOM_DOMAIN } from "../shared/data/pattern-room-domain.js";',
    "UI runtime production domain import"
  );
  source = replaceAll(source, "PATTERN_ROOM_DOMAIN_MOCK", "PATTERN_ROOM_DOMAIN");
  source = replaceRequired(
    source,
    "  PATTERN_CASE_REVIEW_DEFAULT_ROLE_SLOT,\n",
    "  PATTERN_CASE_REVIEW_DEFAULT_ROLE_SLOT,\n  createPatternCaseReviewPreviewDraft,\n",
    "UI runtime Case Review preview import"
  );
  source = replaceRequired(
    source,
    `  function prepareCaseReviewPreview(draft: PatternCaseReviewPreviewDraft): void {\n    caseReviewPreviewDraft = draft;\n    selectedCaseReviewRole = draft.roleSlot;\n    caseReviewDispatchStatus = CASE_REVIEW_IDLE_STATUS;\n    caseReviewApplyFeedback = null;\n    render();\n  }`,
    `  function prepareCaseReviewPreview(): void {\n    const draft = createPatternCaseReviewPreviewDraft(\n      {\n        domain: PATTERN_ROOM_DOMAIN,\n        overlay: localState.getOverlay(),\n        topicLabel: viewModels.subject,\n      },\n      selectedCaseReviewRole\n    );\n    caseReviewPreviewDraft = draft;\n    selectedCaseReviewRole = draft.roleSlot;\n    caseReviewDispatchStatus = CASE_REVIEW_IDLE_STATUS;\n    caseReviewApplyFeedback = null;\n    render();\n  }`,
    "UI runtime structured Case Review preview builder"
  );
  await writeRepoFile(path, source);
}

async function migrateHostRuntime() {
  const path = "rooms/pattern-room/host/runtime.ts";
  let source = await readRepoFile(path);
  source = replaceRequired(
    source,
    'import { PATTERN_ROOM_DOMAIN_MOCK } from "../shared/data/pattern-room-domain.mock.js";',
    'import { PATTERN_ROOM_DOMAIN } from "../shared/data/pattern-room-domain.js";',
    "host runtime production domain import"
  );
  source = replaceAll(source, "PATTERN_ROOM_DOMAIN_MOCK", "PATTERN_ROOM_DOMAIN");
  await writeRepoFile(path, source);
}

async function migrateCaseReviewPreview() {
  const path = "rooms/pattern-room/ui/pattern-case-review-preview.ts";
  let source = await readRepoFile(path);
  source = replaceRequired(
    source,
    'import { createPatternRoomCasePacket } from "../shared/adapters/pattern-room-case-packet-adapter.js";',
    `import {\n  createPatternRoomCasePacketFromProjection,\n  type PatternRoomCasePacketProjectionInput,\n} from "../shared/adapters/pattern-room-case-packet-projection.js";`,
    "structured Case Packet projection import"
  );
  source = replaceRequired(
    source,
    'import type { PatternRoomWorkspaceModel } from "../shared/types/pattern-room.js";\n',
    "",
    "remove preview workspace model import"
  );
  source = replaceRequired(
    source,
    `export function createPatternCaseReviewPreviewDraft(\n  data: PatternRoomWorkspaceModel,\n  roleSlot: PatternRoomCaseReviewRoleSlot = PATTERN_CASE_REVIEW_DEFAULT_ROLE_SLOT\n): PatternCaseReviewPreviewDraft {\n  const casePacket = createPatternRoomCasePacket(data);`,
    `export function createPatternCaseReviewPreviewDraft(\n  input: PatternRoomCasePacketProjectionInput,\n  roleSlot: PatternRoomCaseReviewRoleSlot = PATTERN_CASE_REVIEW_DEFAULT_ROLE_SLOT\n): PatternCaseReviewPreviewDraft {\n  const casePacket = createPatternRoomCasePacketFromProjection(input);`,
    "preview structured projection input"
  );
  await writeRepoFile(path, source);
}

async function migrateTenthManPanel() {
  const path = "rooms/pattern-room/ui/panels/pattern-tenth-man-panel.ts";
  let source = await readRepoFile(path);
  source = replaceRequired(
    source,
    `import {\n  createPatternCaseReviewPreviewDraft,\n  type PatternCaseReviewDispatchStatus,\n  type PatternCaseReviewPreviewDraft,\n} from "../pattern-case-review-preview.js";`,
    `import type {\n  PatternCaseReviewDispatchStatus,\n  PatternCaseReviewPreviewDraft,\n} from "../pattern-case-review-preview.js";`,
    "remove panel-side preview construction"
  );
  source = replaceRequired(
    source,
    "  readonly onPrepare: (preview: PatternCaseReviewPreviewDraft) => void;",
    "  readonly onPrepare: () => void;",
    "panel prepare callback signature"
  );
  source = replaceRequired(
    source,
    `  const prepareButton = createActionButton(previewState.text("actions.prepare"), () => {\n    previewState.onPrepare(createPatternCaseReviewPreviewDraft(data, previewState.selectedRole));\n  });`,
    `  const prepareButton = createActionButton(\n    previewState.text("actions.prepare"),\n    previewState.onPrepare\n  );`,
    "panel structured prepare action"
  );
  await writeRepoFile(path, source);
}

async function migrateWorkspaceModelName() {
  const roomFiles = (await listFiles("rooms/pattern-room")).filter((path) => path.endsWith(".ts"));
  const testFiles = (await listFiles("scripts/tests")).filter(
    (path) => path.endsWith(".ts") && path.includes("pattern-room")
  );
  for (const path of [...roomFiles, ...testFiles]) {
    if (path.endsWith("shared/types/pattern-room.ts")) {
      continue;
    }
    const source = await readRepoFile(path);
    const migrated = replaceAll(source, "PatternRoomMockData", "PatternRoomWorkspaceModel");
    await writeRepoFile(path, migrated);
  }

  const typePath = "rooms/pattern-room/shared/types/pattern-room.ts";
  let typeSource = await readRepoFile(typePath);
  typeSource = typeSource.replace(
    /\n\/\*\*[\s\S]*?@deprecated Use PatternRoomWorkspaceModel\.[\s\S]*?export type PatternRoomMockData = PatternRoomWorkspaceModel;\n/,
    "\n"
  );
  if (typeSource.includes("PatternRoomMockData")) {
    throw new Error("PatternRoomMockData compatibility alias could not be removed.");
  }
  await writeRepoFile(typePath, typeSource);
}

async function migrateRegressionFixtures() {
  const testFiles = (await listFiles("scripts/tests")).filter(
    (path) => path.endsWith(".ts") && path.includes("pattern-room")
  );
  for (const path of testFiles) {
    let source = await readRepoFile(path);
    source = replaceAll(
      source,
      "../../rooms/pattern-room/shared/data/pattern-room-domain.mock.ts",
      "../../rooms/pattern-room/shared/data/testing/pattern-room-domain.fixture.ts"
    );
    source = replaceAll(source, "PATTERN_ROOM_DOMAIN_MOCK", "PATTERN_ROOM_DOMAIN_TEST_FIXTURE");
    await writeRepoFile(path, source);
  }

  const smokePath = "scripts/tests/pattern-room-domain-import-smoke-regressions.test.ts";
  let smoke = await readRepoFile(smokePath);
  smoke = replaceAll(
    smoke,
    'source.includes("PATTERN_ROOM_DOMAIN_TEST_FIXTURE")',
    'source.includes("PATTERN_ROOM_DOMAIN_MOCK")'
  );
  smoke = replaceRequired(
    smoke,
    `  assert.deepEqual(domainMockConsumers, ["rooms/pattern-room/ui/pattern-room-ui-runtime.ts"]);`,
    "  assert.deepEqual(domainMockConsumers, []);",
    "UI mock-consumer expectation"
  );
  smoke = replaceRequired(
    smoke,
    `  assert.deepEqual(domainMockConsumers, ["rooms/pattern-room/host/runtime.ts"]);`,
    "  assert.deepEqual(domainMockConsumers, []);",
    "host mock-consumer expectation"
  );
  await writeRepoFile(smokePath, smoke);
}

async function removeCompatibilityDomain() {
  const path = "rooms/pattern-room/shared/data/pattern-room-domain.mock.ts";
  changedFiles.push(path);
  if (apply) {
    await rm(join(repoRoot, path));
  }
}

async function updateProgress() {
  const path = ".rovo/pattern-room-v2-progress.md";
  let source = await readRepoFile(path);
  source = source.replace(
    /## Current compatibility debt[\s\S]*?## Next implementation steps/,
    `## Phase 1 migration status\n\n- UI and host runtimes now use the production empty domain directly.\n- Regression suites import the isolated fixture explicitly.\n- The compatibility mock-domain module has been removed.\n- Active Case Review preview now builds its packet from structured domain + local overlay data.\n- The old report-string Case Packet adapter remains only for legacy regression coverage and can be retired after those tests move to the structured projection.\n\n## Next implementation steps`
  );
  source = source.replace(
    /1\. Migrate UI runtime[\s\S]*$/,
    `1. Move remaining Case Packet regression cases to the structured projection.\n2. Retire the legacy report-string Case Packet adapter.\n3. Introduce explicit AI suggestion records and evidence-candidate promotion rules.\n4. Begin the three-region Workspace Shell V2.\n`
  );
  await writeRepoFile(path, source);
}

async function main() {
  await migrateWorkspaceModelName();
  await migrateUiRuntime();
  await migrateHostRuntime();
  await migrateCaseReviewPreview();
  await migrateTenthManPanel();
  await migrateRegressionFixtures();
  await removeCompatibilityDomain();
  await updateProgress();

  const mode = apply ? "Applied" : "Would change";
  console.log(`${mode} ${changedFiles.length} files:`);
  for (const path of changedFiles) {
    console.log(`- ${path}`);
  }
  if (!apply) {
    console.log("\nRun again with --apply to write the migration.");
  }
}

await main();
