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
    throw new Error(`Required investigation-canvas migration pattern was not found: ${label}`);
  }
  return content.replace(search, replacement);
}

async function updateRuntime() {
  const path = "rooms/pattern-room/ui/pattern-room-ui-runtime.ts";
  let source = await readRepoFile(path);

  if (!source.includes('from "./panels/pattern-investigation-panel.js";')) {
    source = replaceRequired(
      source,
      `import { createArchivePanel } from "./panels/pattern-archive-panel.js";\nimport { createBoardPanel } from "./panels/pattern-board-panel.js";\nimport { createDeskPanel } from "./panels/pattern-desk-panel.js";\nimport { createOverviewPanel } from "./panels/pattern-overview-panel.js";`,
      `import { createArchivePanel } from "./panels/pattern-archive-panel.js";\nimport {\n  createInvestigationPanel,\n  type PatternInvestigationCanvasMode,\n} from "./panels/pattern-investigation-panel.js";\nimport { createOverviewPanel } from "./panels/pattern-overview-panel.js";`,
      "investigation panel imports"
    );
  }

  if (!source.includes('let investigationCanvasMode: PatternInvestigationCanvasMode = "board";')) {
    source = replaceRequired(
      source,
      `  let archiveSearchQuery = "";\n  let archiveSourceTypeFilter = "all";\n  let workspaceShell: PatternWorkspaceShell | null = null;`,
      `  let archiveSearchQuery = "";\n  let archiveSourceTypeFilter = "all";\n  let investigationCanvasMode: PatternInvestigationCanvasMode = "board";\n  let workspaceShell: PatternWorkspaceShell | null = null;`,
      "investigation mode state"
    );
  }

  if (!source.includes("const previousView = activeView;")) {
    source = replaceRequired(
      source,
      `  function setActiveView(\n    viewId: PatternViewId,\n    section: PatternWorkspaceSection = "default"\n  ): void {\n    activeView = viewId;\n    activeWorkspaceSection = section;\n    render(true);\n  }`,
      `  function setActiveView(\n    viewId: PatternViewId,\n    section: PatternWorkspaceSection = "default"\n  ): void {\n    const previousView = activeView;\n    if (viewId === "desk") {\n      investigationCanvasMode = "graph";\n    } else if (viewId === "board" && previousView !== "board" && previousView !== "desk") {\n      investigationCanvasMode = "board";\n    }\n    activeView = viewId;\n    activeWorkspaceSection = section;\n    render(true);\n  }`,
      "mode-aware navigation"
    );
  }

  if (!source.includes("const createInvestigationView = (): HTMLElement =>")) {
    source = replaceRequired(
      source,
      `    const workspaceText = getWorkspaceText();\n    const panelFactories: Record<FocusedPatternViewId, () => HTMLElement> = {`,
      `    const workspaceText = getWorkspaceText();\n    const createInvestigationView = (): HTMLElement =>\n      createInvestigationPanel(\n        viewModels,\n        actions,\n        onBack,\n        {\n          initialMode: investigationCanvasMode,\n          onModeChange(mode) {\n            investigationCanvasMode = mode;\n            activeView = mode === "graph" ? "desk" : "board";\n            renderedView = activeView;\n            workspacePanelCache.clear();\n          },\n        },\n        workspaceText\n      );\n    const panelFactories: Record<FocusedPatternViewId, () => HTMLElement> = {`,
      "investigation view factory"
    );
    source = replaceRequired(
      source,
      `      board: () => createBoardPanel(viewModels, actions, onBack, workspaceText),\n      desk: () => createDeskPanel(viewModels, actions, onBack, workspaceText),`,
      `      board: createInvestigationView,\n      desk: createInvestigationView,`,
      "board and desk factory merge"
    );
  }

  if (!source.includes('investigationCanvasMode = activeView === "desk" ? "graph" : "board";')) {
    source = replaceRequired(
      source,
      `      activeView = restoredState.activeView;\n      activeWorkspaceSection = "default";`,
      `      activeView = restoredState.activeView;\n      investigationCanvasMode = activeView === "desk" ? "graph" : "board";\n      activeWorkspaceSection = "default";`,
      "snapshot mode restore"
    );
  }

  await writeRepoFile(path, source);
}

async function updateWorkspaceShell() {
  const path = "rooms/pattern-room/ui/panels/pattern-workspace-shell.ts";
  let source = await readRepoFile(path);

  const deskNavigation = `  {\n    id: "desk",\n    viewId: "desk",\n    section: "default",\n    labelKey: "nav.connections.label",\n    descriptionKey: "nav.connections.description",\n    icon: "⌁",\n  },\n`;
  if (source.includes(deskNavigation)) {
    source = source.replace(deskNavigation, "");
  }

  if (!source.includes('const navigationViewId = viewId === "desk" ? "board" : viewId;')) {
    source = replaceRequired(
      source,
      `    updateActiveView(viewId, section): void {\n      const activeItem = NAVIGATION_ITEMS.find((item) => {\n        return item.viewId === viewId && item.section === section;\n      });`,
      `    updateActiveView(viewId, section): void {\n      const navigationViewId = viewId === "desk" ? "board" : viewId;\n      const activeItem = NAVIGATION_ITEMS.find((item) => {\n        return item.viewId === navigationViewId && item.section === section;\n      });`,
      "desk navigation normalization"
    );
    source = replaceRequired(
      source,
      `        const isActive = item?.viewId === viewId && item.section === section;`,
      `        const isActive = item?.viewId === navigationViewId && item.section === section;`,
      "active navigation normalization"
    );
  }

  await writeRepoFile(path, source);
}

async function updateWorkspaceI18n() {
  const path = "rooms/pattern-room/ui/pattern-room-workspace-i18n.ts";
  let source = await readRepoFile(path);
  source = source
    .replace('  "nav.board.label": "Dedektif Panosu",', '  "nav.board.label": "Soruşturma Tuvali",')
    .replace(
      '  "nav.board.description": "İzler ve notlar",',
      '  "nav.board.description": "Pano ve ilişki görünümleri",'
    )
    .replace(
      '  "nav.connections.label": "Bağlantılar",',
      '  "nav.connections.label": "İlişki Görünümü",'
    )
    .replace(
      '  "nav.connections.description": "İlişki haritası",',
      '  "nav.connections.description": "Soruşturma tuvalini grafik modunda aç",'
    )
    .replace(
      '  "nav.board.label": "Detective Board",',
      '  "nav.board.label": "Investigation Canvas",'
    )
    .replace(
      '  "nav.board.description": "Leads and notes",',
      '  "nav.board.description": "Board and relationship views",'
    )
    .replace(
      '  "nav.connections.label": "Connections",',
      '  "nav.connections.label": "Graph View",'
    )
    .replace(
      '  "nav.connections.description": "Relationship map",',
      '  "nav.connections.description": "Open the investigation canvas in graph mode",'
    );
  await writeRepoFile(path, source);
}

async function updateCatalog(path, values) {
  const catalog = JSON.parse(await readRepoFile(path));
  catalog.workspace ??= {};
  catalog.workspace.nav ??= {};
  catalog.workspace.nav.board ??= {};
  catalog.workspace.nav.connections ??= {};
  catalog.workspace.nav.board.label = values.boardLabel;
  catalog.workspace.nav.board.description = values.boardDescription;
  catalog.workspace.nav.connections.label = values.graphLabel;
  catalog.workspace.nav.connections.description = values.graphDescription;
  await writeRepoFile(path, `${JSON.stringify(catalog, null, 2)}\n`);
}

async function updateWorkspaceStyle() {
  const path = "rooms/pattern-room/ui/workspace.css";
  let source = await readRepoFile(path);
  if (source.includes(".pattern-room-investigation-toolbar")) {
    return;
  }

  source += `

/* ─────────────────────────────────────────
   INVESTIGATION CANVAS — board + graph modes
───────────────────────────────────────── */
.pattern-room-investigation-toolbar {
  display: flex;
  gap: var(--pattern-px-16);
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--pattern-px-14);
  padding: var(--pattern-px-12) var(--pattern-px-14);
  border: var(--pattern-px-1) solid var(--pattern-accent-amber-alpha-18);
  border-radius: var(--pattern-px-6);
  background: var(--pattern-surface-panel-alpha-82);
}

.pattern-room-investigation-toolbar-copy {
  display: grid;
  min-width: 0;
  gap: var(--pattern-px-4);
}

.pattern-room-investigation-toolbar-copy .pattern-room-kicker,
.pattern-room-investigation-toolbar-copy p {
  margin: 0;
}

.pattern-room-investigation-toolbar-copy strong {
  font-family: "IBM Plex Mono", monospace;
  color: var(--pattern-text-warm);
}

.pattern-room-investigation-toolbar-copy p {
  color: var(--pattern-text-subtle);
  font-size: var(--pattern-rem-0-82);
}

.pattern-room-investigation-mode-controls {
  display: inline-flex;
  flex: 0 0 auto;
  gap: var(--pattern-px-4);
  padding: var(--pattern-px-4);
  border: var(--pattern-px-1) solid var(--pattern-text-alpha-14);
  border-radius: var(--pattern-px-6);
  background: var(--pattern-surface-inset-alpha-62);
}

.pattern-room-investigation-mode-button {
  min-height: var(--pattern-px-34);
  padding: var(--pattern-px-6) var(--pattern-px-12);
  border: var(--pattern-px-1) solid transparent;
  border-radius: var(--pattern-px-4);
  background: transparent;
  color: var(--pattern-text-subtle);
  font-family: "IBM Plex Mono", monospace;
  font-size: var(--pattern-rem-0-76);
  font-weight: 800;
  cursor: pointer;
}

.pattern-room-investigation-mode-button:hover,
.pattern-room-investigation-mode-button:focus-visible {
  color: var(--pattern-text);
  outline: none;
}

.pattern-room-investigation-mode-button.active {
  border-color: var(--pattern-accent-amber-alpha-38);
  background: var(--pattern-accent-amber-deep-alpha-13);
  color: var(--pattern-accent-amber);
  box-shadow: var(--pattern-glow-amber-action);
}

.pattern-room-investigation-surface {
  min-width: 0;
  min-height: 0;
}

.pattern-room-investigation-mode-surface.pattern-room-panel {
  width: 100%;
  max-width: none;
  min-height: 0;
  margin: 0;
  padding: 0;
}

@media (max-width: 820px) {
  .pattern-room-investigation-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .pattern-room-investigation-mode-controls {
    width: 100%;
  }

  .pattern-room-investigation-mode-button {
    flex: 1 1 0;
  }
}
`;
  await writeRepoFile(path, source);
}

async function updateInstalledUiRegression() {
  const path = "scripts/tests/pattern-room-installed-ui-smoke-regressions-part1.test.ts";
  let source = await readRepoFile(path);
  source = source.replace(
    "    assert.equal(navigationItems.length, 7);",
    "    assert.equal(navigationItems.length, 6);"
  );

  if (!source.includes("switches board and graph inside one investigation canvas")) {
    source += `

void test("pattern-room installed UI switches board and graph inside one investigation canvas", async () => {
  const environment = createMinimalForgeUiEnvironment();
  const installedCopy = await createRoomInstalledCopy("pattern-room");

  try {
    await startPatternRoomInstalledUi(installedCopy.rootDir);

    const boardNavigation = environment.app.querySelector(
      "[data-pattern-workspace-nav='board']"
    );
    assert.ok(boardNavigation);
    fireEvent(boardNavigation, "click");

    const canvas = environment.app.querySelector("[data-pattern-investigation-canvas='true']");
    const boardMode = environment.app.querySelector(
      "[data-pattern-investigation-mode='board']"
    );
    const graphMode = environment.app.querySelector(
      "[data-pattern-investigation-mode='graph']"
    );
    assert.ok(canvas);
    assert.ok(boardMode);
    assert.ok(graphMode);
    assert.equal(canvas.dataset["patternInvestigationActiveMode"], "board");
    assert.ok(environment.app.querySelector("[data-pattern-view='board']"));
    assert.ok(environment.app.querySelector("[data-pattern-board-pin]"));

    fireEvent(graphMode, "click");
    assert.equal(canvas.dataset["patternInvestigationActiveMode"], "graph");
    assert.ok(environment.app.querySelector("[data-pattern-view='desk']"));
    assert.ok(environment.app.querySelector("[data-pattern-connection-map='true']"));
    assert.equal(boardNavigation.dataset["patternWorkspaceNavActive"], "true");

    fireEvent(boardMode, "click");
    assert.equal(canvas.dataset["patternInvestigationActiveMode"], "board");
    assert.ok(environment.app.querySelector("[data-pattern-view='board']"));
    assert.ok(environment.app.querySelector("[data-pattern-board-pin]"));
    assert.equal(environment.app.querySelectorAll("[data-pattern-view]").length, 1);
    assert.deepEqual(environment.sentCommands, []);
  } finally {
    environment.restore();
    await installedCopy.cleanup();
  }
});
`;
  }

  await writeRepoFile(path, source);
}

async function updateProgress() {
  const path = ".rovo/pattern-room-v2-progress.md";
  let source = await readRepoFile(path);
  if (!source.includes("## Completed: unified Investigation Canvas boundary")) {
    source = replaceRequired(
      source,
      "## Next implementation steps",
      `## Completed: unified Investigation Canvas boundary\n\n- Board and Connections now open as board and graph modes of one Investigation Canvas.\n- The persistent workspace navigation exposes one canvas destination instead of separate Board and Connections products.\n- Existing desk snapshots and overview shortcuts remain compatible and open the graph mode.\n- Switching canvas modes does not mutate investigation data and keeps the Board navigation item active.\n- Installed UI regressions cover board/graph mode switching, one active view and compatibility entry points.\n\n## Next implementation steps`
    );
  }
  source = source.replace(
    `1. Merge Board and Connections into the Investigation Canvas.\n2. Move selection-specific source, node and evidence details into the persistent right context inspector.`,
    `1. Move selection-specific source, node and evidence details into the persistent right context inspector.\n2. Remove the temporary panel-local inspectors after the context inspector owns selection details.`
  );
  await writeRepoFile(path, source);
}

await updateRuntime();
await updateWorkspaceShell();
await updateWorkspaceI18n();
await updateCatalog("rooms/pattern-room/i18n/tr.json", {
  boardLabel: "Soruşturma Tuvali",
  boardDescription: "Pano ve ilişki görünümleri",
  graphLabel: "İlişki Görünümü",
  graphDescription: "Soruşturma tuvalini grafik modunda aç",
});
await updateCatalog("rooms/pattern-room/i18n/en.json", {
  boardLabel: "Investigation Canvas",
  boardDescription: "Board and relationship views",
  graphLabel: "Graph View",
  graphDescription: "Open the investigation canvas in graph mode",
});
await updateWorkspaceStyle();
await updateInstalledUiRegression();
await updateProgress();

if (changedFiles.length === 0) {
  console.log("Pattern Room Investigation Canvas is already current.");
} else {
  console.log(`${apply ? "Applied" : "Would apply"}:`);
  changedFiles.forEach((path) => {
    console.log(`- ${path}`);
  });
}
