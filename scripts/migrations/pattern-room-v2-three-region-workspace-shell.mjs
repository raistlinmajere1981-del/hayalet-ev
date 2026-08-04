import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const apply = process.argv.includes("--apply");
const changedFiles = [];

async function readRepoFile(path) {
  return await readFile(resolve(repoRoot, path), "utf8");
}

async function writeRepoFile(path, content) {
  const normalized = content.endsWith("\n") ? content : `${content}\n`;
  const current = await readRepoFile(path);
  if (current === normalized) {
    return;
  }
  changedFiles.push(path);
  if (apply) {
    await writeFile(resolve(repoRoot, path), normalized, "utf8");
  }
}

function replaceRequired(content, search, replacement, label) {
  if (!content.includes(search)) {
    throw new Error(`Required three-region shell migration pattern was not found: ${label}`);
  }
  return content.replace(search, replacement);
}

async function updateWorkspaceShell() {
  const path = "rooms/pattern-room/ui/panels/pattern-workspace-shell.ts";
  let source = await readRepoFile(path);
  if (source.includes('inspector.dataset["patternWorkspaceInspector"] = "true";')) {
    return;
  }

  source = replaceRequired(
    source,
    `export type PatternWorkspaceShell = {\n  readonly element: HTMLElement;\n  readonly outlet: HTMLElement;`,
    `export type PatternWorkspaceShell = {\n  readonly element: HTMLElement;\n  readonly outlet: HTMLElement;\n  readonly inspector: HTMLElement;`,
    "shell inspector API"
  );

  source = replaceRequired(
    source,
    `  const rail = createElement("aside", "pattern-room-workspace-rail");`,
    `  const rail = createElement("aside", "pattern-room-workspace-rail");\n  rail.dataset["patternWorkspaceSpine"] = "true";`,
    "left spine dataset"
  );

  const oldWorkspace = `  const workspace = createElement("main", "pattern-room-workspace");
  const outlet = createElement("div", "pattern-room-workspace-outlet");
  outlet.dataset["patternWorkspaceOutlet"] = "true";
  outlet.tabIndex = -1;
  workspace.append(outlet);
  shell.append(rail, workspace);

  const updateSummary = (summary: PatternWorkspaceSummary): void => {
    subject.textContent = summary.subject;
    sourceMetric.textContent = text("shell.sourceMetric", {
      count: String(summary.sourceCount),
    });
    pinMetric.textContent = text("shell.pinMetric", {
      count: String(summary.pinCount),
    });
    reviewMetric.textContent = text("shell.reviewMetric", {
      count: String(summary.reviewCount),
    });
  };`;

  const newWorkspace = `  const workspace = createElement("main", "pattern-room-workspace");
  workspace.dataset["patternWorkspaceCanvas"] = "true";
  const outlet = createElement("div", "pattern-room-workspace-outlet");
  outlet.dataset["patternWorkspaceOutlet"] = "true";
  outlet.tabIndex = -1;
  workspace.append(outlet);

  const inspector = createElement("aside", "pattern-room-workspace-inspector");
  inspector.dataset["patternWorkspaceInspector"] = "true";
  inspector.ariaLabel = text("shell.inspectorLabel");

  const inspectorHeader = createElement("header", "pattern-room-workspace-inspector-header");
  inspectorHeader.append(
    createElement(
      "span",
      "pattern-room-context-inspector-label",
      text("shell.inspectorLabel")
    )
  );
  const inspectorTitle = createElement("strong", "pattern-room-workspace-inspector-title");
  const inspectorDescription = createElement(
    "p",
    "pattern-room-workspace-inspector-description"
  );
  inspectorHeader.append(inspectorTitle, inspectorDescription);

  const inspectorCase = createElement("section", "pattern-room-workspace-inspector-case");
  inspectorCase.append(createElement("span", "pattern-room-kicker", text("shell.caseLabel")));
  const inspectorSubject = createElement("strong", "pattern-room-workspace-inspector-subject");
  const inspectorMetrics = createElement("div", "pattern-room-workspace-inspector-metrics");
  const inspectorSourceMetric = createElement("span");
  const inspectorPinMetric = createElement("span");
  const inspectorReviewMetric = createElement("span");
  inspectorMetrics.append(inspectorSourceMetric, inspectorPinMetric, inspectorReviewMetric);
  inspectorCase.append(inspectorSubject, inspectorMetrics);
  inspector.append(inspectorHeader, inspectorCase);

  shell.append(rail, workspace, inspector);

  const updateSummary = (summary: PatternWorkspaceSummary): void => {
    subject.textContent = summary.subject;
    inspectorSubject.textContent = summary.subject;
    const sourceText = text("shell.sourceMetric", {
      count: String(summary.sourceCount),
    });
    const pinText = text("shell.pinMetric", {
      count: String(summary.pinCount),
    });
    const reviewText = text("shell.reviewMetric", {
      count: String(summary.reviewCount),
    });
    sourceMetric.textContent = sourceText;
    pinMetric.textContent = pinText;
    reviewMetric.textContent = reviewText;
    inspectorSourceMetric.textContent = sourceText;
    inspectorPinMetric.textContent = pinText;
    inspectorReviewMetric.textContent = reviewText;
  };`;

  source = replaceRequired(
    source,
    oldWorkspace,
    newWorkspace,
    "three-region shell construction"
  );

  source = replaceRequired(
    source,
    `  return {\n    element: shell,\n    outlet,\n    updateActiveView(viewId, section): void {`,
    `  return {\n    element: shell,\n    outlet,\n    inspector,\n    updateActiveView(viewId, section): void {`,
    "shell inspector return"
  );

  source = replaceRequired(
    source,
    `      buttons.forEach((button, index) => {\n        const item = NAVIGATION_ITEMS[index];`,
    `      const activeItem = NAVIGATION_ITEMS.find((item) => {\n        return item.viewId === viewId && item.section === section;\n      });\n      if (activeItem !== undefined) {\n        inspector.dataset["patternWorkspaceInspectorView"] = activeItem.id;\n        inspectorTitle.textContent = text(activeItem.labelKey);\n        inspectorDescription.textContent = text(activeItem.descriptionKey);\n      }\n\n      buttons.forEach((button, index) => {\n        const item = NAVIGATION_ITEMS[index];`,
    "active inspector context"
  );

  await writeRepoFile(path, source);
}

async function updateWorkspaceI18n() {
  const path = "rooms/pattern-room/ui/pattern-room-workspace-i18n.ts";
  let source = await readRepoFile(path);
  if (source.includes('| "shell.inspectorLabel"')) {
    return;
  }

  source = replaceRequired(
    source,
    `  | "shell.navigationLabel"\n  | "shell.caseLabel"`,
    `  | "shell.navigationLabel"\n  | "shell.inspectorLabel"\n  | "shell.caseLabel"`,
    "inspector text key"
  );
  source = replaceRequired(
    source,
    `  "shell.navigationLabel": "Çalışma alanları",\n  "shell.caseLabel": "Aktif vaka",`,
    `  "shell.navigationLabel": "Çalışma alanları",\n  "shell.inspectorLabel": "Bağlam paneli",\n  "shell.caseLabel": "Aktif vaka",`,
    "Turkish inspector fallback"
  );
  source = replaceRequired(
    source,
    `  "shell.navigationLabel": "Workspaces",\n  "shell.caseLabel": "Active case",`,
    `  "shell.navigationLabel": "Workspaces",\n  "shell.inspectorLabel": "Context inspector",\n  "shell.caseLabel": "Active case",`,
    "English inspector fallback"
  );

  await writeRepoFile(path, source);
}

async function updateCatalog(path, inspectorLabel) {
  const catalog = JSON.parse(await readRepoFile(path));
  catalog.workspace ??= {};
  catalog.workspace.shell ??= {};
  if (catalog.workspace.shell.inspectorLabel === inspectorLabel) {
    return;
  }
  catalog.workspace.shell.inspectorLabel = inspectorLabel;
  await writeRepoFile(path, `${JSON.stringify(catalog, null, 2)}\n`);
}

async function updateWorkspaceStyle() {
  const path = "rooms/pattern-room/ui/workspace.css";
  let source = await readRepoFile(path);
  if (source.includes(".pattern-room-workspace-inspector-header")) {
    return;
  }

  source = replaceRequired(
    source,
    `   APP SHELL — iki sütunlu ana iskelet`,
    `   APP SHELL — üç bölgeli ana iskelet`,
    "shell comment"
  );
  source = replaceRequired(
    source,
    `  grid-template-columns: var(--pattern-px-260) minmax(0, 1fr);`,
    `  grid-template-columns:\n    var(--pattern-px-260)\n    minmax(0, 1fr)\n    minmax(var(--pattern-px-260), var(--pattern-px-320));`,
    "shell columns"
  );

  source += `

/* ─────────────────────────────────────────
   WORKSPACE CONTEXT INSPECTOR — kalıcı sağ bölge
───────────────────────────────────────── */
.pattern-room-workspace-inspector {
  position: relative;
  z-index: 18;
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  gap: var(--pattern-px-18);
  overflow: auto;
  padding: var(--pattern-px-20) var(--pattern-px-16);
  border-left: var(--pattern-px-1) solid var(--pattern-accent-amber-alpha-14);
  background:
    linear-gradient(180deg, rgba(84, 174, 196, 0.05), transparent 30%),
    var(--pattern-surface-depth-alpha-96);
  box-shadow: calc(var(--pattern-px-18) * -1) 0 var(--pattern-px-48)
    var(--pattern-black-alpha-20);
  scrollbar-color: var(--pattern-accent-amber-alpha-22) transparent;
  scrollbar-width: thin;
}

.pattern-room-workspace-inspector-header {
  display: grid;
  gap: var(--pattern-px-8);
  padding-bottom: var(--pattern-px-16);
  border-bottom: var(--pattern-px-1) solid var(--pattern-accent-amber-alpha-14);
}

.pattern-room-workspace-inspector-header .pattern-room-context-inspector-label {
  margin: 0;
}

.pattern-room-workspace-inspector-title,
.pattern-room-workspace-inspector-subject {
  font-family: "IBM Plex Mono", monospace;
  color: var(--pattern-text-warm);
}

.pattern-room-workspace-inspector-title {
  font-size: var(--pattern-rem-1);
}

.pattern-room-workspace-inspector-description {
  margin: 0;
  color: var(--pattern-text-subtle);
  font-size: var(--pattern-rem-0-82);
  line-height: 1.45;
}

.pattern-room-workspace-inspector-case {
  display: grid;
  gap: var(--pattern-px-10);
  padding: var(--pattern-px-14);
  border: var(--pattern-px-1) solid var(--pattern-accent-amber-alpha-18);
  border-radius: var(--pattern-px-6);
  background: var(--pattern-surface-panel-alpha-82);
}

.pattern-room-workspace-inspector-case .pattern-room-kicker {
  margin: 0;
}

.pattern-room-workspace-inspector-subject {
  font-size: var(--pattern-rem-0-88);
  line-height: 1.4;
}

.pattern-room-workspace-inspector-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: var(--pattern-px-6);
}

.pattern-room-workspace-inspector-metrics span {
  display: inline-flex;
  width: fit-content;
  padding: var(--pattern-px-4) var(--pattern-px-8);
  border: var(--pattern-px-1) solid var(--pattern-text-alpha-14);
  border-radius: var(--pattern-px-999);
  font-family: "IBM Plex Mono", monospace;
  color: var(--pattern-text-subtle);
  font-size: var(--pattern-rem-0-72);
  font-weight: 700;
}

@media (max-width: 1180px) {
  .pattern-room-app-shell {
    grid-template-columns:
      var(--pattern-px-230)
      minmax(0, 1fr)
      var(--pattern-px-260);
  }
}

@media (max-width: 960px) {
  .pattern-room-app-shell {
    grid-template-columns: var(--pattern-px-220) minmax(0, 1fr);
  }

  .pattern-room-workspace-inspector {
    display: none;
  }
}
`;

  await writeRepoFile(path, source);
}

async function updateInstalledUiRegression() {
  const path = "scripts/tests/pattern-room-installed-ui-smoke-regressions-part1.test.ts";
  let source = await readRepoFile(path);
  if (source.includes("exposes a persistent three-region workspace shell")) {
    return;
  }

  const testSource = [
    "",
    'void test("pattern-room installed UI exposes a persistent three-region workspace shell", async () => {',
    "  const environment = createMinimalForgeUiEnvironment();",
    '  const installedCopy = await createRoomInstalledCopy("pattern-room");',
    "",
    "  try {",
    "    await startPatternRoomInstalledUi(installedCopy.rootDir);",
    "",
    '    const shell = environment.app.querySelector("[data-pattern-workspace-shell=\'true\']");',
    '    const spine = environment.app.querySelector("[data-pattern-workspace-spine=\'true\']");',
    '    const canvas = environment.app.querySelector("[data-pattern-workspace-canvas=\'true\']");',
    '    const outlet = environment.app.querySelector("[data-pattern-workspace-outlet=\'true\']");',
    '    const inspector = environment.app.querySelector("[data-pattern-workspace-inspector=\'true\']");',
    "    assert.ok(shell);",
    "    assert.ok(spine);",
    "    assert.ok(canvas);",
    "    assert.ok(outlet);",
    "    assert.ok(inspector);",
    '    assert.equal(inspector.dataset["patternWorkspaceInspectorView"], "overview");',
    '    assert.match(readTreeText(inspector), /Vaka Merkezi|Case Hub/);',
    "",
    "    const archiveNavigation = environment.app.querySelector(",
    '      "[data-pattern-workspace-nav=\'archive\']"',
    "    );",
    "    assert.ok(archiveNavigation);",
    '    fireEvent(archiveNavigation, "click");',
    '    assert.equal(environment.app.querySelector("[data-pattern-workspace-spine=\'true\']"), spine);',
    '    assert.equal(environment.app.querySelector("[data-pattern-workspace-canvas=\'true\']"), canvas);',
    '    assert.equal(environment.app.querySelector("[data-pattern-workspace-inspector=\'true\']"), inspector);',
    '    assert.equal(inspector.dataset["patternWorkspaceInspectorView"], "archive");',
    '    assert.match(readTreeText(inspector), /Arşiv|Archive/);',
    '    assert.ok(environment.app.querySelector("[data-pattern-view=\'archive\']"));',
    "",
    "    const reportNavigation = environment.app.querySelector(",
    '      "[data-pattern-workspace-nav=\'report\']"',
    "    );",
    "    assert.ok(reportNavigation);",
    '    fireEvent(reportNavigation, "click");',
    '    assert.equal(inspector.dataset["patternWorkspaceInspectorView"], "report");',
    '    assert.match(readTreeText(inspector), /Rapor|Report/);',
    '    assert.ok(environment.app.querySelector("[data-pattern-view=\'report\']"));',
    "    assert.deepEqual(environment.sentCommands, []);",
    "  } finally {",
    "    environment.restore();",
    "    await installedCopy.cleanup();",
    "  }",
    "});",
    "",
  ].join("\n");

  source += testSource;
  await writeRepoFile(path, source);
}

async function updateProgress() {
  const path = ".rovo/pattern-room-v2-progress.md";
  let source = await readRepoFile(path);
  if (!source.includes("## Completed: three-region Workspace Shell V2 boundary")) {
    const marker = "## Next implementation steps";
    source = replaceRequired(
      source,
      marker,
      `## Completed: three-region Workspace Shell V2 boundary\n\n- The application shell now exposes a persistent left case/source spine, center workspace canvas and right context inspector.\n- Navigation, center outlet and context inspector remain mounted while focused views change.\n- The right inspector tracks the active workspace and repeats the current case summary without mutating room state.\n- Desktop layouts use all three regions; narrower layouts collapse the context inspector without changing navigation or data.\n- Installed UI regressions verify region persistence and active-view context updates.\n\n${marker}`,
      "three-region progress section"
    );
  }

  source = source.replace(
    `1. Begin the three-region Workspace Shell V2.\n2. Merge Board and Connections into the Investigation Canvas after the shell boundary is green.`,
    `1. Merge Board and Connections into the Investigation Canvas.\n2. Move selection-specific source, node and evidence details into the persistent right context inspector.`
  );
  await writeRepoFile(path, source);
}

await updateWorkspaceShell();
await updateWorkspaceI18n();
await updateCatalog("rooms/pattern-room/i18n/tr.json", "Bağlam paneli");
await updateCatalog("rooms/pattern-room/i18n/en.json", "Context inspector");
await updateWorkspaceStyle();
await updateInstalledUiRegression();
await updateProgress();

if (changedFiles.length === 0) {
  console.log("Pattern Room three-region Workspace Shell V2 is already current.");
} else {
  console.log(`${apply ? "Applied" : "Would apply"}:`);
  changedFiles.forEach((path) => {
    console.log(`- ${path}`);
  });
}
