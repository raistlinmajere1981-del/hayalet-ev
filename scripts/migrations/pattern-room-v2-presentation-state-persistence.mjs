import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const apply = process.argv.includes("--apply");
const changedFiles = [];

async function updateFile(path, transform) {
  const absolutePath = resolve(repoRoot, path);
  const current = await readFile(absolutePath, "utf8");
  const next = transform(current);
  const normalized = next.endsWith("\n") ? next : `${next}\n`;

  if (normalized === current) {
    return;
  }

  changedFiles.push(path);
  if (apply) {
    await writeFile(absolutePath, normalized, "utf8");
  }
}

function replaceRequired(source, search, replacement, label) {
  if (source.includes(replacement)) {
    return source;
  }
  if (!source.includes(search)) {
    throw new Error(`Required presentation-state pattern was not found: ${label}`);
  }
  return source.replace(search, replacement);
}

function insertBeforeRequired(source, marker, insertion, label) {
  if (source.includes(insertion)) {
    return source;
  }
  if (!source.includes(marker)) {
    throw new Error(`Required presentation-state insertion point was not found: ${label}`);
  }
  return source.replace(marker, `${insertion}\n\n${marker}`);
}

await updateFile("rooms/pattern-room/shared/types/pattern-room-snapshot.ts", (source) => {
  let next = insertBeforeRequired(
    source,
    "export interface PatternRoomSessionSnapshot {",
    [
      'export type PatternRoomCanvasMode = "board" | "graph";',
      "",
      "export type PatternRoomPresentationState = {",
      "  canvasMode: PatternRoomCanvasMode;",
      "  selectedBoardItemId: string | null;",
      "  selectedConnectionId: string | null;",
      "};",
    ].join("\n"),
    "presentation state type"
  );

  next = replaceRequired(
    next,
    "  activeView: PatternViewId;\n  guards: PatternRoomLocalGuards;",
    "  activeView: PatternViewId;\n  presentation?: PatternRoomPresentationState;\n  guards: PatternRoomLocalGuards;",
    "optional snapshot presentation"
  );
  return next;
});

await updateFile("rooms/pattern-room/shared/state/pattern-room-snapshot.ts", (source) => {
  let next = replaceRequired(
    source,
    ["  PATTERN_ROOM_SNAPSHOT_VERSION,", "  type PatternRoomSessionSnapshot,"].join("\n"),
    [
      "  PATTERN_ROOM_SNAPSHOT_VERSION,",
      "  type PatternRoomCanvasMode,",
      "  type PatternRoomPresentationState,",
      "  type PatternRoomSessionSnapshot,",
    ].join("\n"),
    "snapshot presentation imports"
  );

  next = replaceRequired(
    next,
    [
      "export type PatternRoomSnapshotRestoreResult = {",
      "  overlay: PatternRoomLocalOverlay;",
      "  activeView: PatternViewId;",
      "  guards: PatternRoomLocalGuards;",
      "};",
    ].join("\n"),
    [
      "export type PatternRoomSnapshotRestoreResult = {",
      "  overlay: PatternRoomLocalOverlay;",
      "  activeView: PatternViewId;",
      "  presentation?: PatternRoomPresentationState;",
      "  guards: PatternRoomLocalGuards;",
      "};",
    ].join("\n"),
    "restore presentation result"
  );

  next = replaceRequired(
    next,
    'const PATTERN_VIEW_IDS = ["overview", "board", "desk", "archive", "tenth-man", "report"] as const;',
    [
      'const PATTERN_VIEW_IDS = ["overview", "board", "desk", "archive", "tenth-man", "report"] as const;',
      'const PATTERN_CANVAS_MODES = ["board", "graph"] as const;',
    ].join("\n"),
    "canvas mode allowlist"
  );

  next = insertBeforeRequired(
    next,
    "function isDebateLocalPhase(value: unknown): value is DebateLocalPhase {",
    [
      "function isPatternCanvasMode(value: unknown): value is PatternRoomCanvasMode {",
      "  return (",
      '    typeof value === "string" &&',
      "    PATTERN_CANVAS_MODES.some((canvasMode) => canvasMode === value)",
      "  );",
      "}",
    ].join("\n"),
    "canvas mode parser"
  );

  next = insertBeforeRequired(
    next,
    "function parseGuards(value: unknown): PatternRoomLocalGuards | null {",
    [
      "function parsePresentation(",
      "  value: unknown",
      "): PatternRoomPresentationState | null | undefined {",
      "  if (value === undefined) {",
      "    return undefined;",
      "  }",
      '  if (!isRecord(value) || !isPatternCanvasMode(value["canvasMode"])) {',
      "    return null;",
      "  }",
      "",
      '  const selectedBoardItemId = value["selectedBoardItemId"];',
      '  const selectedConnectionId = value["selectedConnectionId"];',
      "  if (",
      '    (selectedBoardItemId !== null && typeof selectedBoardItemId !== "string") ||',
      '    (selectedConnectionId !== null && typeof selectedConnectionId !== "string")',
      "  ) {",
      "    return null;",
      "  }",
      "",
      "  return {",
      '    canvasMode: value["canvasMode"],',
      "    selectedBoardItemId:",
      '      selectedBoardItemId === null || selectedBoardItemId.trim() === ""',
      "        ? null",
      "        : selectedBoardItemId.trim(),",
      "    selectedConnectionId:",
      '      selectedConnectionId === null || selectedConnectionId.trim() === ""',
      "        ? null",
      "        : selectedConnectionId.trim(),",
      "  };",
      "}",
    ].join("\n"),
    "presentation parser"
  );

  next = replaceRequired(
    next,
    [
      '  const overlay = parseOverlay(value["overlay"]);',
      '  const guards = parseGuards(value["guards"]);',
      "  if (overlay === null || guards === null) {",
    ].join("\n"),
    [
      '  const overlay = parseOverlay(value["overlay"]);',
      '  const presentation = parsePresentation(value["presentation"]);',
      '  const guards = parseGuards(value["guards"]);',
      "  if (overlay === null || presentation === null || guards === null) {",
    ].join("\n"),
    "parsed presentation guard"
  );

  next = replaceRequired(
    next,
    ["    overlay,", '    activeView: value["activeView"],', "    guards,"].join("\n"),
    [
      "    overlay,",
      '    activeView: value["activeView"],',
      "    ...(presentation === undefined ? {} : { presentation }),",
      "    guards,",
    ].join("\n"),
    "parsed presentation return"
  );

  next = replaceRequired(
    next,
    [
      "export function createSnapshot(",
      "  localState: PatternRoomLocalState,",
      "  activeView: PatternViewId",
      "): PatternRoomSessionSnapshot {",
    ].join("\n"),
    [
      "export function createSnapshot(",
      "  localState: PatternRoomLocalState,",
      "  activeView: PatternViewId,",
      "  presentation?: PatternRoomPresentationState",
      "): PatternRoomSessionSnapshot {",
    ].join("\n"),
    "snapshot presentation input"
  );

  next = replaceRequired(
    next,
    [
      "    overlay: localState.getOverlay(),",
      "    activeView,",
      "    guards: localState.getGuards(),",
    ].join("\n"),
    [
      "    overlay: localState.getOverlay(),",
      "    activeView,",
      "    ...(presentation === undefined",
      "      ? {}",
      "      : { presentation: { ...presentation } }),",
      "    guards: localState.getGuards(),",
    ].join("\n"),
    "snapshot presentation output"
  );

  next = replaceRequired(
    next,
    [
      "    overlay,",
      "    activeView: parsedSnapshot.activeView,",
      "    guards: healGuards(parsedSnapshot.guards, overlay),",
    ].join("\n"),
    [
      "    overlay,",
      "    activeView: parsedSnapshot.activeView,",
      "    ...(parsedSnapshot.presentation === undefined",
      "      ? {}",
      "      : { presentation: { ...parsedSnapshot.presentation } }),",
      "    guards: healGuards(parsedSnapshot.guards, overlay),",
    ].join("\n"),
    "restored presentation output"
  );

  return next;
});

await updateFile("rooms/pattern-room/ui/pattern-room-ui-runtime.ts", (source) => {
  let next = replaceRequired(
    source,
    'import type { PatternRoomSessionSnapshot } from "../shared/types/pattern-room-snapshot.js";',
    [
      "import type {",
      "  PatternRoomPresentationState,",
      "  PatternRoomSessionSnapshot,",
      '} from "../shared/types/pattern-room-snapshot.js";',
    ].join("\n"),
    "runtime presentation import"
  );

  next = replaceRequired(
    next,
    [
      "    selectNode(nodeId: string | null): void {",
      "      selectedNodeId = nodeId;",
      '      if (workspaceShell !== null && (activeView === "board" || activeView === "desk")) {',
      "        renderWorkspaceInspector(workspaceShell);",
      "      }",
      "    },",
    ].join("\n"),
    [
      "    selectNode(nodeId: string | null): void {",
      "      selectedNodeId = nodeId;",
      '      if (workspaceShell !== null && (activeView === "board" || activeView === "desk")) {',
      "        renderWorkspaceInspector(workspaceShell);",
      "      }",
      "      scheduleAutosave();",
      "    },",
    ].join("\n"),
    "board selection autosave"
  );

  next = replaceRequired(
    next,
    [
      "    selectConnection(connectionId: string | null): void {",
      "      selectedConnectionId = connectionId;",
      '      if (workspaceShell !== null && (activeView === "board" || activeView === "desk")) {',
      "        renderWorkspaceInspector(workspaceShell);",
      "      }",
      "    },",
    ].join("\n"),
    [
      "    selectConnection(connectionId: string | null): void {",
      "      selectedConnectionId = connectionId;",
      '      if (workspaceShell !== null && (activeView === "board" || activeView === "desk")) {',
      "        renderWorkspaceInspector(workspaceShell);",
      "      }",
      "      scheduleAutosave();",
      "    },",
    ].join("\n"),
    "connection selection autosave"
  );

  next = insertBeforeRequired(
    next,
    [
      "    if (",
      "      selectedConnectionId !== null &&",
      "      !viewModels.connections.some((connection) => connection.id === selectedConnectionId)",
      "    ) {",
      "      selectedConnectionId = null;",
      "    }",
    ].join("\n"),
    [
      "    if (",
      "      selectedNodeId !== null &&",
      "      !viewModels.boardCategories.some((category) =>",
      "        category.pins.some((pin) => pin.id === selectedNodeId)",
      "      )",
      "    ) {",
      "      selectedNodeId = null;",
      "    }",
    ].join("\n"),
    "stale presentation selection cleanup"
  );

  next = replaceRequired(
    next,
    [
      "  function createCurrentSnapshot(): PatternRoomSessionSnapshot {",
      "    return createSnapshot(localState, activeView);",
      "  }",
    ].join("\n"),
    [
      "  function createCurrentSnapshot(): PatternRoomSessionSnapshot {",
      "    const presentation: PatternRoomPresentationState = {",
      "      canvasMode: investigationCanvasMode,",
      "      selectedBoardItemId: selectedNodeId,",
      "      selectedConnectionId,",
      "    };",
      "    return createSnapshot(localState, activeView, presentation);",
      "  }",
    ].join("\n"),
    "runtime presentation snapshot"
  );

  next = replaceRequired(
    next,
    [
      "    activeView = viewId;",
      "    activeWorkspaceSection = section;",
      "    render(true);",
      "  }",
    ].join("\n"),
    [
      "    activeView = viewId;",
      "    activeWorkspaceSection = section;",
      "    render(true);",
      "    scheduleAutosave();",
      "  }",
    ].join("\n"),
    "active view autosave"
  );

  next = replaceRequired(
    next,
    [
      "            shell.updateActiveView(activeView, activeWorkspaceSection);",
      "            renderWorkspaceInspector(shell);",
      "          },",
    ].join("\n"),
    [
      "            shell.updateActiveView(activeView, activeWorkspaceSection);",
      "            renderWorkspaceInspector(shell);",
      "            scheduleAutosave();",
      "          },",
    ].join("\n"),
    "canvas mode autosave"
  );

  next = replaceRequired(
    next,
    [
      "      activeView = restoredState.activeView;",
      '      investigationCanvasMode = activeView === "desk" ? "graph" : "board";',
      '      activeWorkspaceSection = "default";',
      "      selectedArchiveSourceId = null;",
    ].join("\n"),
    [
      "      activeView = restoredState.activeView;",
      "      investigationCanvasMode =",
      "        restoredState.presentation?.canvasMode ??",
      '        (activeView === "desk" ? "graph" : "board");',
      '      if (activeView === "board" || activeView === "desk") {',
      '        activeView = investigationCanvasMode === "graph" ? "desk" : "board";',
      "      }",
      '      activeWorkspaceSection = "default";',
      "      selectedNodeId = restoredState.presentation?.selectedBoardItemId ?? null;",
      "      selectedConnectionId = restoredState.presentation?.selectedConnectionId ?? null;",
      "      selectedArchiveSourceId = null;",
    ].join("\n"),
    "restore presentation state"
  );

  return next;
});

await updateFile("scripts/tests/pattern-room-session-snapshot-regressions.test.ts", (source) => {
  let next = replaceRequired(
    source,
    ["    overlay: unknown;", "    activeView: unknown;", "    guards: unknown;"].join("\n"),
    [
      "    overlay: unknown;",
      "    activeView: unknown;",
      "    presentation?: unknown;",
      "    guards: unknown;",
    ].join("\n"),
    "snapshot comparison presentation left"
  );

  next = replaceRequired(
    next,
    [
      "    overlay: unknown;",
      "    activeView: unknown;",
      "    guards: unknown;",
      "  }",
      "): void {",
      "  assert.deepEqual(left.overlay, right.overlay);",
      "  assert.equal(left.activeView, right.activeView);",
      "  assert.deepEqual(left.guards, right.guards);",
    ].join("\n"),
    [
      "    overlay: unknown;",
      "    activeView: unknown;",
      "    presentation?: unknown;",
      "    guards: unknown;",
      "  }",
      "): void {",
      "  assert.deepEqual(left.overlay, right.overlay);",
      "  assert.equal(left.activeView, right.activeView);",
      "  assert.deepEqual(left.presentation, right.presentation);",
      "  assert.deepEqual(left.guards, right.guards);",
    ].join("\n"),
    "snapshot comparison presentation right"
  );

  next = insertBeforeRequired(
    next,
    'void test("pattern-room phase 6B restores valid snapshot pieces and applies them to local state", () => {',
    [
      'void test("pattern-room presentation state round-trips separately from case truth", () => {',
      "  const localState = createSnapshotReadyLocalState();",
      "  const presentation = {",
      '    canvasMode: "graph" as const,',
      '    selectedBoardItemId: "node-shadow-analysis",',
      '    selectedConnectionId: "edge-navigation-supports-horizon",',
      "  };",
      '  const snapshot = createSnapshot(localState, "desk", presentation);',
      "  const restored = restoreFromSnapshot(snapshot, PATTERN_ROOM_DOMAIN_TEST_FIXTURE);",
      "",
      "  assert.equal(snapshot.schemaVersion, PATTERN_ROOM_SNAPSHOT_VERSION);",
      "  assert.deepEqual(snapshot.presentation, presentation);",
      "  assert.ok(restored);",
      "  assert.deepEqual(restored.presentation, presentation);",
      "  assert.deepEqual(restored.overlay, snapshot.overlay);",
      "",
      "  const legacySnapshot: PatternRoomSessionSnapshot = { ...snapshot };",
      "  delete legacySnapshot.presentation;",
      "  const restoredLegacy = restoreFromSnapshot(",
      "    legacySnapshot,",
      "    PATTERN_ROOM_DOMAIN_TEST_FIXTURE",
      "  );",
      "  assert.ok(restoredLegacy);",
      "  assert.equal(restoredLegacy.presentation, undefined);",
      "});",
    ].join("\n"),
    "presentation snapshot regression"
  );

  return next;
});

await updateFile(
  "scripts/tests/pattern-room-installed-ui-smoke-regressions-part1.test.ts",
  (source) => {
    let next = insertBeforeRequired(
      source,
      'void test("pattern-room installed UI restores a loaded host snapshot", async () => {',
      [
        'void test("pattern-room installed UI persists canvas mode and contextual selections", async () => {',
        "  const environment = createMinimalForgeUiEnvironment();",
        '  const installedCopy = await createRoomInstalledCopy("pattern-room");',
        "",
        "  try {",
        "    await startPatternRoomInstalledUi(installedCopy.rootDir);",
        "    environment.emitHostMessage({",
        "      payload: { snapshot: null },",
        "      type: PATTERN_ROOM_LOADED_EVENT,",
        "    });",
        "",
        '    openFocusedView(environment.app, "board");',
        "    const boardItem = environment.app.querySelector(",
        "      \"[data-pattern-board-pin='node-shadow-analysis']\"",
        "    );",
        "    assert.ok(boardItem);",
        '    fireEvent(boardItem, "click");',
        "",
        "    const graphMode = environment.app.querySelector(",
        "      \"[data-pattern-investigation-mode='graph']\"",
        "    );",
        "    assert.ok(graphMode);",
        '    fireEvent(graphMode, "click");',
        "    const connection = environment.app.querySelector(",
        "      \"[data-pattern-connection-edge='edge-navigation-supports-horizon']\"",
        "    );",
        "    assert.ok(connection);",
        '    fireEvent(connection, "click");',
        "",
        "    assert.equal(environment.pendingTimerCount(), 1);",
        "    environment.runPendingTimers(2000);",
        "    const savedSnapshot = readLatestSavePayload(environment)[",
        '      "snapshot"',
        "    ] as PatternRoomSessionSnapshot;",
        "    assert.deepEqual(savedSnapshot.presentation, {",
        '      canvasMode: "graph",',
        '      selectedBoardItemId: "node-shadow-analysis",',
        '      selectedConnectionId: "edge-navigation-supports-horizon",',
        "    });",
        "  } finally {",
        "    environment.restore();",
        "    await installedCopy.cleanup();",
        "  }",
        "});",
      ].join("\n"),
      "installed UI presentation save regression"
    );

    next = insertBeforeRequired(
      next,
      'void test("pattern-room installed UI restores a loaded host snapshot", async () => {',
      [
        'void test("pattern-room installed UI restores canvas mode and contextual selections", async () => {',
        "  const environment = createMinimalForgeUiEnvironment();",
        '  const installedCopy = await createRoomInstalledCopy("pattern-room");',
        "  const localState = createLocalState(PATTERN_ROOM_DOMAIN_TEST_FIXTURE);",
        '  const snapshot = createSnapshot(localState, "desk", {',
        '    canvasMode: "graph",',
        '    selectedBoardItemId: "node-shadow-analysis",',
        '    selectedConnectionId: "edge-navigation-supports-horizon",',
        "  });",
        "",
        "  try {",
        "    await startPatternRoomInstalledUi(installedCopy.rootDir);",
        "    environment.emitHostMessage({",
        "      payload: { snapshot },",
        "      type: PATTERN_ROOM_LOADED_EVENT,",
        "    });",
        "",
        "    assert.ok(environment.app.querySelector(\"[data-pattern-view='desk']\"));",
        "    const inspector = environment.app.querySelector(",
        "      \"[data-pattern-workspace-inspector='true']\"",
        "    );",
        "    assert.ok(inspector);",
        "    assertTextIncludes(readTreeText(inspector), [",
        '      "Bağlantı detayı",',
        '      "Seyir defteri kaynagi",',
        '      "Ufuk iddiasi",',
        '      "Regression fixture support relation only.",',
        "    ]);",
        "",
        "    const boardMode = environment.app.querySelector(",
        "      \"[data-pattern-investigation-mode='board']\"",
        "    );",
        "    assert.ok(boardMode);",
        '    fireEvent(boardMode, "click");',
        "    assertTextIncludes(readTreeText(inspector), [",
        '      "Tuval detayı",',
        '      "Golge acilari analizi",',
        "    ]);",
        "  } finally {",
        "    environment.restore();",
        "    await installedCopy.cleanup();",
        "  }",
        "});",
      ].join("\n"),
      "installed UI presentation restore regression"
    );

    return next;
  }
);

await updateFile(".rovo/pattern-room-v2-progress.md", (source) => {
  let next = source;
  if (!next.includes("Completed: separate Investigation Canvas presentation persistence")) {
    const section = [
      "## Completed: separate Investigation Canvas presentation persistence",
      "",
      "- Canvas mode and contextual board/connection selections persist in an optional snapshot presentation object.",
      "- Presentation state remains outside the local case overlay and does not become investigation truth.",
      "- Older version-1 snapshots without presentation state continue to restore safely.",
      "- Invalid or stale selections are cleared against the current projected workspace.",
      "- Installed UI and snapshot regressions cover save, restore and legacy compatibility.",
      "",
    ].join("\n");
    const marker = "## Next implementation steps";
    next = next.includes(marker)
      ? next.replace(marker, `${section}${marker}`)
      : `${next.trimEnd()}\n\n${section}`;
  }

  next = next.replace(
    [
      "## Next implementation steps",
      "",
      "1. Add explicit edge selection and edge-detail editing to the persistent inspector.",
      "2. Persist Investigation Canvas presentation state separately from case truth.",
    ].join("\n"),
    [
      "## Next implementation steps",
      "",
      "1. Complete functional closure validation and refresh the PR scope.",
      "2. Start the general UI revision in a separate session.",
    ].join("\n")
  );
  return next;
});

if (changedFiles.length === 0) {
  console.log("Pattern Room presentation state persistence is already current.");
} else {
  console.log(`${apply ? "Applied" : "Would apply"}:`);
  changedFiles.forEach((path) => console.log(`- ${path}`));
}
