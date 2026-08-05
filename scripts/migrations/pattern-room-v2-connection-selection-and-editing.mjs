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

  if (current === normalized) {
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
    throw new Error(`Required connection-editing pattern was not found: ${label}`);
  }
  return source.replace(search, replacement);
}

function insertBeforeRequired(source, marker, insertion, label) {
  if (source.includes(insertion)) {
    return source;
  }
  if (!source.includes(marker)) {
    throw new Error(`Required connection-editing insertion point was not found: ${label}`);
  }
  return source.replace(marker, `${insertion}\n\n${marker}`);
}

await updateFile("rooms/pattern-room/shared/types/pattern-room.ts", (source) => {
  let next = insertBeforeRequired(
    source,
    "export type PatternTenthManSession = {",
    [
      'export type PatternConnectionScope = "domain" | "local";',
      "",
      "export type PatternConnection = {",
      "  id: string;",
      "  edgeType: PatternEdgeType;",
      "  edgeTypeLabel: string;",
      "  sourceId: string;",
      "  sourceLabel: string;",
      "  targetId: string;",
      "  targetLabel: string;",
      "  note: string | null;",
      "  scope: PatternConnectionScope;",
      "  editable: boolean;",
      "};",
    ].join("\n"),
    "connection view type"
  );

  next = replaceRequired(
    next,
    "  connectionOptions: PatternConnectionOption[];\n  claims: PatternClaim[];",
    "  connectionOptions: PatternConnectionOption[];\n  connections: PatternConnection[];\n  claims: PatternClaim[];",
    "workspace connections"
  );

  next = replaceRequired(
    next,
    "  getSelectedNodeId: () => string | null;\n  selectNode: (nodeId: string | null) => void;",
    [
      "  getSelectedNodeId: () => string | null;",
      "  selectNode: (nodeId: string | null) => void;",
      "  getSelectedConnectionId: () => string | null;",
      "  selectConnection: (connectionId: string | null) => void;",
    ].join("\n"),
    "connection selection actions"
  );

  next = replaceRequired(
    next,
    [
      "  addAuthoredEdge: (",
      "    edgeType: PatternEdgeType,",
      "    sourceId: string,",
      "    targetId: string,",
      "    note?: string",
      "  ) => void;",
    ].join("\n"),
    [
      "  addAuthoredEdge: (",
      "    edgeType: PatternEdgeType,",
      "    sourceId: string,",
      "    targetId: string,",
      "    note?: string",
      "  ) => void;",
      "  updateLocalEdge: (edgeId: string, edgeType: PatternEdgeType, note?: string) => void;",
    ].join("\n"),
    "local edge update action"
  );
  return next;
});

await updateFile("rooms/pattern-room/shared/state/pattern-room-local-state.ts", (source) => {
  let next = replaceRequired(
    source,
    [
      "  addAuthoredEdge: (",
      "    edgeType: PatternEdgeType,",
      "    sourceId: string,",
      "    targetId: string,",
      "    note?: string",
      "  ) => void;",
    ].join("\n"),
    [
      "  addAuthoredEdge: (",
      "    edgeType: PatternEdgeType,",
      "    sourceId: string,",
      "    targetId: string,",
      "    note?: string",
      "  ) => void;",
      "  updateLocalEdge: (edgeId: string, edgeType: PatternEdgeType, note?: string) => boolean;",
    ].join("\n"),
    "local state edge update type"
  );

  next = replaceRequired(
    next,
    [
      "    addAuthoredEdge(",
      "      edgeType: PatternEdgeType,",
      "      sourceId: string,",
      "      targetId: string,",
      "      note?: string",
      "    ): void {",
      "      if (addAuthoredEdgeRecord(edgeType, sourceId, targetId, note)) {",
      "        notify();",
      "      }",
      "    },",
    ].join("\n"),
    [
      "    addAuthoredEdge(",
      "      edgeType: PatternEdgeType,",
      "      sourceId: string,",
      "      targetId: string,",
      "      note?: string",
      "    ): void {",
      "      if (addAuthoredEdgeRecord(edgeType, sourceId, targetId, note)) {",
      "        notify();",
      "      }",
      "    },",
      "    updateLocalEdge(edgeId: string, edgeType: PatternEdgeType, note?: string): boolean {",
      "      if (!PATTERN_EDGE_TYPES.includes(edgeType)) {",
      "        return false;",
      "      }",
      "      const edgeIndex = localAuthoredEdges.findIndex((edge) => edge.id === edgeId);",
      "      if (edgeIndex < 0) {",
      "        return false;",
      "      }",
      "      const edge = localAuthoredEdges[edgeIndex];",
      "      if (edge === undefined) {",
      "        return false;",
      "      }",
      "      const normalizedNote = note?.trim() || null;",
      "      if (edge.edgeType === edgeType && edge.note === normalizedNote) {",
      "        return false;",
      "      }",
      "      localAuthoredEdges[edgeIndex] = { ...edge, edgeType, note: normalizedNote };",
      "      notify();",
      "      return true;",
      "    },",
    ].join("\n"),
    "local state edge update implementation"
  );
  return next;
});

await updateFile("rooms/pattern-room/shared/adapters/pattern-room-view-adapters.ts", (source) => {
  let next = replaceRequired(
    source,
    "  PatternConnectionOption,\n  PatternDebateReference,",
    "  PatternConnection,\n  PatternConnectionOption,\n  PatternDebateReference,",
    "connection view import"
  );

  next = replaceRequired(
    next,
    'export type PatternDeskViewModel = Pick<PatternRoomWorkspaceModel, "claims">;',
    'export type PatternDeskViewModel = Pick<PatternRoomWorkspaceModel, "claims" | "connections">;',
    "desk connection view model"
  );

  next = replaceRequired(
    next,
    "  return { claims: [...claims, ...localClaims, ...authoredClaims] };",
    [
      "  return {",
      "    claims: [...claims, ...localClaims, ...authoredClaims],",
      "    connections: adaptConnections(domain, overlay),",
      "  };",
    ].join("\n"),
    "desk connection projection"
  );

  next = replaceRequired(
    next,
    [
      "function resolveConnectionEntityLabel(",
      "  domain: PatternRoomDomainViewSource,",
      "  overlay: PatternRoomLocalOverlay,",
      "  entityId: string",
      "): string | null {",
    ].join("\n"),
    [
      "function resolveConnectionEntityLabel(",
      "  domain: PatternRoomDomainViewSource,",
      "  overlay: PatternRoomLocalOverlay | undefined,",
      "  entityId: string",
      "): string | null {",
    ].join("\n"),
    "optional overlay connection label"
  );

  next = replaceRequired(
    next,
    "  const localNode = overlay.localAuthoredNodes.find((node) => node.id === entityId);",
    "  const localNode = overlay?.localAuthoredNodes.find((node) => node.id === entityId);",
    "optional local node label"
  );
  next = replaceRequired(
    next,
    "  const localSource = overlay.localAuthoredSources.find((source) => source.id === entityId);",
    "  const localSource = overlay?.localAuthoredSources.find((source) => source.id === entityId);",
    "optional local source label"
  );
  next = replaceRequired(
    next,
    "  const localEvidence = overlay.localAuthoredEvidence.find((evidence) => evidence.id === entityId);",
    "  const localEvidence = overlay?.localAuthoredEvidence.find((evidence) => evidence.id === entityId);",
    "optional local evidence label"
  );

  next = insertBeforeRequired(
    next,
    "function adaptLocalConnectionBullet(",
    [
      "function adaptConnections(",
      "  domain: PatternRoomDomainViewSource,",
      "  overlay?: PatternRoomLocalOverlay",
      "): PatternConnection[] {",
      "  const domainConnections = domain.edges",
      "    .map((edge) => {",
      "      const sourceLabel = resolveConnectionEntityLabel(domain, overlay, edge.sourceNodeId);",
      "      const targetLabel = resolveConnectionEntityLabel(domain, overlay, edge.targetNodeId);",
      "      if (sourceLabel === null || targetLabel === null) {",
      "        return null;",
      "      }",
      "      return {",
      "        id: edge.id,",
      "        edgeType: edge.edgeType,",
      "        edgeTypeLabel: EDGE_TYPE_LABELS[edge.edgeType],",
      "        sourceId: edge.sourceNodeId,",
      "        sourceLabel,",
      "        targetId: edge.targetNodeId,",
      "        targetLabel,",
      "        note: edge.note,",
      '        scope: "domain" as const,',
      "        editable: false,",
      "      };",
      "    })",
      "    .filter((connection): connection is PatternConnection => connection !== null);",
      "  const localConnections =",
      "    overlay?.localAuthoredEdges",
      "      .map((edge) => {",
      "        const sourceLabel = resolveConnectionEntityLabel(domain, overlay, edge.sourceId);",
      "        const targetLabel = resolveConnectionEntityLabel(domain, overlay, edge.targetId);",
      "        if (sourceLabel === null || targetLabel === null) {",
      "          return null;",
      "        }",
      "        return {",
      "          id: edge.id,",
      "          edgeType: edge.edgeType,",
      "          edgeTypeLabel: EDGE_TYPE_LABELS[edge.edgeType],",
      "          sourceId: edge.sourceId,",
      "          sourceLabel,",
      "          targetId: edge.targetId,",
      "          targetLabel,",
      "          note: edge.note,",
      '          scope: "local" as const,',
      "          editable: true,",
      "        };",
      "      })",
      "      .filter((connection): connection is PatternConnection => connection !== null) ?? [];",
      "",
      "  return [...domainConnections, ...localConnections];",
      "}",
    ].join("\n"),
    "connection projection"
  );

  return next;
});

await updateFile("rooms/pattern-room/ui/panels/pattern-connection-composer.ts", (source) => {
  let next = replaceRequired(
    source,
    'type AuthoredConnectionEdgeType = Parameters<PatternPanelActions["addAuthoredEdge"]>[0];',
    'export type AuthoredConnectionEdgeType = Parameters<PatternPanelActions["addAuthoredEdge"]>[0];',
    "export edge type"
  );
  next = replaceRequired(
    next,
    "const CONNECTION_EDGE_TYPE_OPTIONS: ReadonlyArray<{",
    "export const CONNECTION_EDGE_TYPE_OPTIONS: ReadonlyArray<{",
    "export edge options"
  );
  return next;
});

await updateFile("rooms/pattern-room/ui/panels/pattern-desk-panel.ts", (source) => {
  let next = replaceRequired(
    source,
    "  _actions: PatternPanelActions,",
    "  actions: PatternPanelActions,",
    "desk actions"
  );

  next = replaceRequired(
    next,
    [
      '  const relationship = createElement("div", "pattern-room-connection-axis");',
      '  relationship.ariaHidden = "true";',
      "  connectionMap.append(claimObjects, relationship);",
    ].join("\n"),
    [
      '  const relationship = createElement("section", "pattern-room-connection-list");',
      '  relationship.dataset["patternConnectionList"] = "true";',
      "  const connectionButtons: HTMLButtonElement[] = [];",
      "  const updateSelectedConnection = (connectionId: string | null): void => {",
      "    connectionButtons.forEach((button) => {",
      '      const isSelected = button.dataset["patternConnectionEdge"] === connectionId;',
      '      button.ariaPressed = isSelected ? "true" : "false";',
      "      if (isSelected) {",
      '        button.classList.add("active");',
      "      } else {",
      '        button.classList.remove("active");',
      "      }",
      "    });",
      "  };",
      "",
      "  if (data.connections.length === 0) {",
      "    relationship.append(",
      "      createElement(",
      '        "p",',
      '        "pattern-room-connection-empty",',
      '        "Henüz seçilebilir bir bağlantı yok. Sağ panelden yeni bağlantı kurabilirsiniz."',
      "      )",
      "    );",
      "  } else {",
      "    data.connections.forEach((connection, index) => {",
      "      const button = createElement(",
      '        "button",',
      '        "pattern-room-connection-card " + connection.scope',
      "      );",
      '      button.type = "button";',
      '      button.dataset["patternConnectionEdge"] = connection.id;',
      '      button.ariaPressed = "false";',
      "      button.append(",
      '        createElement("span", "pattern-room-connection-node-index", String(index + 1)),',
      '        createElement("strong", undefined, connection.sourceLabel),',
      '        createElement("span", "pattern-room-connection-edge-label", connection.edgeTypeLabel),',
      '        createElement("strong", undefined, connection.targetLabel),',
      "        createElement(",
      '          "small",',
      "          undefined,",
      '          connection.scope === "local" ? "Yerel bağlantı" : "Domain bağlantısı"',
      "        )",
      "      );",
      '      button.addEventListener("click", () => {',
      "        actions.selectConnection(connection.id);",
      "        updateSelectedConnection(connection.id);",
      "      });",
      "      connectionButtons.push(button);",
      "      relationship.append(button);",
      "    });",
      "  }",
      "  updateSelectedConnection(actions.getSelectedConnectionId());",
      "  connectionMap.append(claimObjects, relationship);",
    ].join("\n"),
    "selectable graph connections"
  );
  return next;
});

await updateFile("rooms/pattern-room/ui/panels/pattern-investigation-inspector.ts", (source) => {
  let next = replaceRequired(
    source,
    "  PatternBoardPin,\n  PatternConnectionOption,",
    "  PatternBoardPin,\n  PatternConnection,\n  PatternConnectionOption,",
    "inspector connection type"
  );
  next = replaceRequired(
    next,
    'import { createConnectionAuthoringForm } from "./pattern-connection-composer.js";',
    [
      'import {',
      '  CONNECTION_EDGE_TYPE_OPTIONS,',
      '  createConnectionAuthoringForm,',
      '  type AuthoredConnectionEdgeType,',
      '} from "./pattern-connection-composer.js";',
    ].join("\n"),
    "connection editor imports"
  );

  next = insertBeforeRequired(
    next,
    "function createConnectionEntity(option: PatternConnectionOption): HTMLElement {",
    [
      "function findConnection(",
      "  data: PatternRoomWorkspaceModel,",
      "  connectionId: string | null",
      "): PatternConnection | null {",
      "  if (connectionId === null) {",
      "    return null;",
      "  }",
      "  return data.connections.find((connection) => connection.id === connectionId) ?? null;",
      "}",
      "",
      "function createConnectionEditorOption(",
      "  value: AuthoredConnectionEdgeType,",
      "  label: string",
      "): HTMLOptionElement {",
      '  const option = createElement("option", undefined, label);',
      "  option.value = value;",
      "  return option;",
      "}",
      "",
      "function createSelectedConnectionDetail(",
      "  data: PatternRoomWorkspaceModel,",
      "  actions: PatternPanelActions,",
      "  connectionId: string | null",
      "): HTMLElement {",
      '  const detail = createElement("section", "pattern-room-connection-detail");',
      '  detail.dataset["patternConnectionDetail"] = "true";',
      '  detail.ariaLive = "polite";',
      "  const connection = findConnection(data, connectionId);",
      "  if (connection === null) {",
      "    detail.append(",
      '      createElement("span", "pattern-room-kicker", "Bağlantı detayı"),',
      '      createElement("h2", undefined, "Bir bağlantı seç"),',
      "      createElement(",
      '        "p",',
      "        undefined,",
      '        "İlişki yüzeyindeki bir bağlantıyı seçtiğinizde kaynak, hedef, tür ve not burada görünür."',
      "      )",
      "    );",
      "    return detail;",
      "  }",
      "",
      '  const metrics = createElement("div", "pattern-room-detail-metrics");',
      "  metrics.append(",
      '    createDetailMetric("Kapsam", connection.scope === "local" ? "Yerel" : "Domain"),',
      '    createDetailMetric("Kaynak", connection.sourceLabel),',
      '    createDetailMetric("Hedef", connection.targetLabel)',
      "  );",
      "  detail.append(",
      '    createElement("span", "pattern-room-kicker", "Bağlantı detayı"),',
      '    createElement("h2", undefined, connection.edgeTypeLabel),',
      "    metrics,",
      "    createElement(",
      '      "p",',
      "      undefined,",
      '      `${connection.sourceLabel} → ${connection.edgeTypeLabel} → ${connection.targetLabel}`',
      "    )",
      "  );",
      "",
      "  if (!connection.editable) {",
      "    detail.append(",
      "      createElement(",
      '        "small",',
      "        undefined,",
      '        connection.note === null',
      '          ? "Domain bağlantıları salt okunur; bağlantı notu yok."',
      '          : `Domain bağlantısı salt okunur. Not: ${connection.note}`',
      "      )",
      "    );",
      "    return detail;",
      "  }",
      "",
      '  const form = createElement("form", "pattern-room-inline-form pattern-room-connection-edit-form");',
      '  form.dataset["patternEditEdgeForm"] = connection.id;',
      '  const edgeType = createElement("select", "pattern-room-inline-input");',
      '  edgeType.dataset["patternEditEdgeType"] = connection.id;',
      "  edgeType.name = \"edgeType\";",
      "  edgeType.append(",
      "    ...CONNECTION_EDGE_TYPE_OPTIONS.map((option) =>",
      "      createConnectionEditorOption(option.value, option.label)",
      "    )",
      "  );",
      "  edgeType.value = connection.edgeType;",
      '  const note = createElement("textarea", "pattern-room-inline-input");',
      '  note.dataset["patternEditEdgeNote"] = connection.id;',
      '  note.name = "note";',
      '  note.placeholder = "Bağlantı notu (opsiyonel)";',
      '  note.value = connection.note ?? "";',
      '  const submit = createSubmitButton("Bağlantıyı Güncelle");',
      '  submit.dataset["patternEditEdgeSubmit"] = connection.id;',
      '  form.addEventListener("submit", (event) => {',
      "    event.preventDefault();",
      "    actions.updateLocalEdge(",
      "      connection.id,",
      "      edgeType.value as AuthoredConnectionEdgeType,",
      "      note.value",
      "    );",
      "  });",
      "  form.append(edgeType, note, submit);",
      "  detail.append(form);",
      "  return detail;",
      "}",
    ].join("\n"),
    "connection inspector detail"
  );

  next = replaceRequired(
    next,
    [
      "function createGraphInspectorContent(",
      "  data: PatternRoomWorkspaceModel,",
      "  actions: PatternPanelActions,",
      "  text: PatternWorkspaceTranslator",
      "): HTMLElement {",
    ].join("\n"),
    [
      "function createGraphInspectorContent(",
      "  data: PatternRoomWorkspaceModel,",
      "  actions: PatternPanelActions,",
      "  selectedConnectionId: string | null,",
      "  text: PatternWorkspaceTranslator",
      "): HTMLElement {",
    ].join("\n"),
    "graph inspector selection parameter"
  );
  next = replaceRequired(
    next,
    '  content.dataset["patternInvestigationInspectorMode"] = "graph";\n\n  const entitySection',
    '  content.dataset["patternInvestigationInspectorMode"] = "graph";\n  content.append(createSelectedConnectionDetail(data, actions, selectedConnectionId));\n\n  const entitySection',
    "graph connection detail render"
  );
  next = replaceRequired(
    next,
    [
      "  selectedPinId: string | null,",
      "  text: PatternWorkspaceTranslator = createPatternWorkspaceTranslator(\"tr\", null)",
      "): HTMLElement {",
      "  return mode === \"graph\"",
      "    ? createGraphInspectorContent(data, actions, text)",
      "    : createBoardInspectorContent(data, actions, selectedPinId, text);",
    ].join("\n"),
    [
      "  selectedPinId: string | null,",
      "  selectedConnectionId: string | null,",
      "  text: PatternWorkspaceTranslator = createPatternWorkspaceTranslator(\"tr\", null)",
      "): HTMLElement {",
      "  return mode === \"graph\"",
      "    ? createGraphInspectorContent(data, actions, selectedConnectionId, text)",
      "    : createBoardInspectorContent(data, actions, selectedPinId, text);",
    ].join("\n"),
    "inspector selected connection wiring"
  );
  return next;
});

await updateFile("rooms/pattern-room/ui/pattern-room-ui-runtime.ts", (source) => {
  let next = replaceRequired(
    source,
    "  let selectedNodeId: string | null = null;\n  let selectedArchiveSourceId: string | null = null;",
    "  let selectedNodeId: string | null = null;\n  let selectedConnectionId: string | null = null;\n  let selectedArchiveSourceId: string | null = null;",
    "runtime selected connection"
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
      "    },",
      "    getSelectedConnectionId(): string | null {",
      "      return selectedConnectionId;",
      "    },",
      "    selectConnection(connectionId: string | null): void {",
      "      selectedConnectionId = connectionId;",
      '      if (workspaceShell !== null && (activeView === "board" || activeView === "desk")) {',
      "        renderWorkspaceInspector(workspaceShell);",
      "      }",
      "    },",
    ].join("\n"),
    "runtime connection selection actions"
  );

  next = replaceRequired(
    next,
    [
      "    addAuthoredEdge(edgeType, sourceId: string, targetId: string, note?: string): void {",
      "      const beforeCount = localState.getOverlay().localAuthoredEdges.length;",
      "      localState.addAuthoredEdge(edgeType, sourceId, targetId, note);",
      "      const added = localState.getOverlay().localAuthoredEdges.length > beforeCount;",
      "      showWorkspaceActionFeedback(",
      '        added ? "feedback.connectionAdded" : "feedback.importFailed",',
      '        added ? "success" : "error"',
      "      );",
      "    },",
    ].join("\n"),
    [
      "    addAuthoredEdge(edgeType, sourceId: string, targetId: string, note?: string): void {",
      "      const beforeCount = localState.getOverlay().localAuthoredEdges.length;",
      "      localState.addAuthoredEdge(edgeType, sourceId, targetId, note);",
      "      const added = localState.getOverlay().localAuthoredEdges.length > beforeCount;",
      "      showWorkspaceActionFeedback(",
      '        added ? "feedback.connectionAdded" : "feedback.importFailed",',
      '        added ? "success" : "error"',
      "      );",
      "    },",
      "    updateLocalEdge(edgeId, edgeType, note?: string): void {",
      "      const updated = localState.updateLocalEdge(edgeId, edgeType, note);",
      "      showWorkspaceActionFeedback(",
      '        updated ? "feedback.connectionUpdated" : "feedback.connectionUnchanged",',
      '        updated ? "success" : "info"',
      "      );",
      "    },",
    ].join("\n"),
    "runtime local edge update"
  );

  next = replaceRequired(
    next,
    [
      "    if (selectedArchiveSourceId !== null && !archiveSourceExists(selectedArchiveSourceId)) {",
      "      selectedArchiveSourceId = null;",
      "      archiveEvidenceCaptureStatus = null;",
      "    }",
      "    render();",
    ].join("\n"),
    [
      "    if (selectedArchiveSourceId !== null && !archiveSourceExists(selectedArchiveSourceId)) {",
      "      selectedArchiveSourceId = null;",
      "      archiveEvidenceCaptureStatus = null;",
      "    }",
      "    if (",
      "      selectedConnectionId !== null &&",
      "      !viewModels.connections.some((connection) => connection.id === selectedConnectionId)",
      "    ) {",
      "      selectedConnectionId = null;",
      "    }",
      "    render();",
    ].join("\n"),
    "stale connection selection cleanup"
  );

  next = replaceRequired(
    next,
    [
      "        actions,",
      "        selectedNodeId,",
      "        getWorkspaceText()",
    ].join("\n"),
    [
      "        actions,",
      "        selectedNodeId,",
      "        selectedConnectionId,",
      "        getWorkspaceText()",
    ].join("\n"),
    "inspector selected connection argument"
  );

  next = replaceRequired(
    next,
    "      selectedArchiveSourceId = null;\n      archiveEvidenceCaptureStatus = null;",
    "      selectedConnectionId = null;\n      selectedArchiveSourceId = null;\n      archiveEvidenceCaptureStatus = null;",
    "restore connection selection reset"
  );
  return next;
});

await updateFile("rooms/pattern-room/ui/pattern-room-workspace-i18n.ts", (source) => {
  let next = replaceRequired(
    source,
    '  | "feedback.connectionAdded"\n  | "feedback.debateUpdated"',
    '  | "feedback.connectionAdded"\n  | "feedback.connectionUpdated"\n  | "feedback.connectionUnchanged"\n  | "feedback.debateUpdated"',
    "connection feedback keys"
  );
  next = replaceRequired(
    next,
    '  "feedback.connectionAdded": "Bağlantı oluşturuldu.",\n  "feedback.debateUpdated":',
    '  "feedback.connectionAdded": "Bağlantı oluşturuldu.",\n  "feedback.connectionUpdated": "Yerel bağlantı güncellendi.",\n  "feedback.connectionUnchanged": "Bağlantıda kaydedilecek bir değişiklik yok.",\n  "feedback.debateUpdated":',
    "Turkish connection feedback"
  );
  next = replaceRequired(
    next,
    '  "feedback.connectionAdded": "Connection created.",\n  "feedback.debateUpdated":',
    '  "feedback.connectionAdded": "Connection created.",\n  "feedback.connectionUpdated": "Local connection updated.",\n  "feedback.connectionUnchanged": "There are no connection changes to save.",\n  "feedback.debateUpdated":',
    "English connection feedback"
  );
  return next;
});

async function updateCatalog(path, locale) {
  await updateFile(path, (source) => {
    const catalog = JSON.parse(source);
    catalog.workspace.feedback.connectionUpdated =
      locale === "tr" ? "Yerel bağlantı güncellendi." : "Local connection updated.";
    catalog.workspace.feedback.connectionUnchanged =
      locale === "tr"
        ? "Bağlantıda kaydedilecek bir değişiklik yok."
        : "There are no connection changes to save.";
    return JSON.stringify(catalog, null, 2);
  });
}

await updateCatalog("rooms/pattern-room/i18n/tr.json", "tr");
await updateCatalog("rooms/pattern-room/i18n/en.json", "en");

await updateFile("rooms/pattern-room/ui/workspace.css", (source) => {
  if (source.includes("SELECTABLE CONNECTIONS AND EDGE EDITOR")) {
    return source;
  }
  return `${source.trimEnd()}\n\n/* ─────────────────────────────────────────\n   SELECTABLE CONNECTIONS AND EDGE EDITOR\n───────────────────────────────────────── */\n.pattern-room-connection-list {\n  display: grid;\n  gap: var(--pattern-px-8);\n  align-content: start;\n}\n\n.pattern-room-connection-card {\n  display: grid;\n  grid-template-columns: auto minmax(0, 1fr);\n  gap: var(--pattern-px-6) var(--pattern-px-10);\n  width: 100%;\n  padding: var(--pattern-px-12);\n  border: var(--pattern-px-1) solid var(--pattern-text-alpha-14);\n  border-radius: var(--pattern-px-6);\n  background: var(--pattern-surface-panel-alpha-82);\n  color: var(--pattern-text-subtle);\n  text-align: left;\n  cursor: pointer;\n}\n\n.pattern-room-connection-card > :not(.pattern-room-connection-node-index) {\n  grid-column: 2;\n}\n\n.pattern-room-connection-card strong {\n  color: var(--pattern-text-warm);\n}\n\n.pattern-room-connection-card:hover,\n.pattern-room-connection-card:focus-visible,\n.pattern-room-connection-card.active {\n  border-color: var(--pattern-accent-amber-alpha-38);\n  outline: none;\n}\n\n.pattern-room-connection-card.active {\n  box-shadow: var(--pattern-glow-amber-action);\n}\n\n.pattern-room-connection-edge-label,\n.pattern-room-connection-card small {\n  font-family: \"IBM Plex Mono\", monospace;\n  font-size: var(--pattern-rem-0-72);\n}\n\n.pattern-room-connection-edge-label {\n  color: var(--pattern-accent-amber);\n  font-weight: 800;\n}\n\n.pattern-room-connection-empty {\n  margin: 0;\n  color: var(--pattern-text-subtle);\n  font-size: var(--pattern-rem-0-82);\n  line-height: 1.5;\n}\n\n.pattern-room-connection-detail {\n  display: grid;\n  gap: var(--pattern-px-10);\n}\n\n.pattern-room-connection-detail h2,\n.pattern-room-connection-detail p,\n.pattern-room-connection-detail small {\n  margin: 0;\n}\n\n.pattern-room-connection-detail p,\n.pattern-room-connection-detail small {\n  color: var(--pattern-text-subtle);\n  line-height: 1.5;\n}\n\n.pattern-room-connection-edit-form {\n  grid-template-columns: minmax(0, 1fr);\n  margin-top: var(--pattern-px-4);\n  padding: 0;\n}\n\n.pattern-room-connection-edit-form textarea {\n  min-height: var(--pattern-px-88);\n  resize: vertical;\n}\n`;
});

await updateFile("scripts/tests/pattern-room-view-adapters-regressions.test.ts", (source) => {
  if (source.includes("local connection editing projects selectable graph details")) {
    return source;
  }
  return `${source.trimEnd()}\n\nvoid test(\"pattern-room local connection editing projects selectable graph details\", () => {\n  const localState = createLocalState(PATTERN_ROOM_DOMAIN_TEST_FIXTURE);\n  localState.addAuthoredEdge(\n    \"supports\",\n    \"node-navigation-source\",\n    \"source-shadow-comparison\",\n    \"İlk bağlantı notu.\"\n  );\n\n  assert.equal(\n    localState.updateLocalEdge(\"local-edge-001\", \"contradicts\", \"Güncel bağlantı notu.\"),\n    true\n  );\n  assert.equal(\n    localState.updateLocalEdge(\"local-edge-001\", \"contradicts\", \"Güncel bağlantı notu.\"),\n    false\n  );\n\n  const viewModels = adaptDomainToViewModels(\n    PATTERN_ROOM_DOMAIN_TEST_FIXTURE,\n    localState.getOverlay()\n  );\n  const localConnection = viewModels.connections.find((connection) => {\n    return connection.id === \"local-edge-001\";\n  });\n  const domainConnection = viewModels.connections.find((connection) => {\n    return connection.scope === \"domain\";\n  });\n\n  assert.ok(localConnection);\n  assert.equal(localConnection.edgeType, \"contradicts\");\n  assert.equal(localConnection.edgeTypeLabel, \"çelişiyor\");\n  assert.equal(localConnection.note, \"Güncel bağlantı notu.\");\n  assert.equal(localConnection.scope, \"local\");\n  assert.equal(localConnection.editable, true);\n  assert.ok(domainConnection);\n  assert.equal(domainConnection.editable, false);\n});\n`;
});

await updateFile("scripts/tests/pattern-room-installed-ui-smoke-regressions-part3.test.ts", (source) => {
  if (source.includes("graph connection selection edits local edge details")) {
    return source;
  }
  return `${source.trimEnd()}\n\nvoid test(\"pattern-room graph connection selection edits local edge details\", async () => {\n  const environment = createMinimalForgeUiEnvironment();\n  const installedCopy = await createRoomInstalledCopy(\"pattern-room\");\n\n  try {\n    await startPatternRoomInstalledUi(installedCopy.rootDir);\n    openFocusedView(environment.app, \"board\");\n\n    const edgeForm = environment.app.querySelector(\"[data-pattern-author-edge-form='true']\");\n    const sourceSelect = environment.app.querySelector(\"[data-pattern-author-edge-source='true']\");\n    const edgeTypeSelect = environment.app.querySelector(\"[data-pattern-author-edge-type='true']\");\n    const targetSelect = environment.app.querySelector(\"[data-pattern-author-edge-target='true']\");\n    const noteInput = environment.app.querySelector(\"[data-pattern-author-edge-note='true']\");\n    assert.ok(edgeForm);\n    assert.ok(sourceSelect);\n    assert.ok(edgeTypeSelect);\n    assert.ok(targetSelect);\n    assert.ok(noteInput);\n    installFormReset(edgeForm);\n    sourceSelect.value = \"node-navigation-source\";\n    edgeTypeSelect.value = \"supports\";\n    targetSelect.value = \"source-shadow-comparison\";\n    noteInput.value = \"İlk ilişki notu.\";\n    submitForm(edgeForm);\n\n    returnToOverview(environment.app);\n    openFocusedView(environment.app, \"desk\");\n    const connectionButton = environment.app.querySelector(\n      \"[data-pattern-connection-edge='local-edge-001']\"\n    );\n    assert.ok(connectionButton);\n    fireEvent(connectionButton, \"click\");\n    assert.equal(connectionButton.ariaPressed, \"true\");\n    assertTextIncludes(readTreeText(environment.app), [\n      \"Bağlantı detayı\",\n      \"Seyir defteri kaynagi\",\n      \"destekliyor\",\n      \"Golge karsilastirma gorseli\",\n    ]);\n\n    const editForm = environment.app.querySelector(\n      \"[data-pattern-edit-edge-form='local-edge-001']\"\n    );\n    const editType = environment.app.querySelector(\n      \"[data-pattern-edit-edge-type='local-edge-001']\"\n    );\n    const editNote = environment.app.querySelector(\n      \"[data-pattern-edit-edge-note='local-edge-001']\"\n    );\n    assert.ok(editForm);\n    assert.ok(editType);\n    assert.ok(editNote);\n    editType.value = \"contradicts\";\n    editNote.value = \"Güncellenmiş ilişki notu.\";\n    submitForm(editForm);\n\n    assertTextIncludes(readTreeText(environment.app), [\n      \"Yerel bağlantı güncellendi.\",\n      \"çelişiyor\",\n      \"Güncellenmiş ilişki notu.\",\n    ]);\n\n    returnToOverview(environment.app);\n    openFocusedView(environment.app, \"report\");\n    assertTextIncludes(readTreeText(environment.app), [\n      \"Yerel Bağlantılar\",\n      \"çelişiyor\",\n      \"Güncellenmiş ilişki notu.\",\n    ]);\n  } finally {\n    environment.restore();\n    await installedCopy.cleanup();\n  }\n});\n`;
});

await updateFile(".rovo/pattern-room-v2-progress.md", (source) => {
  if (source.includes("Completed: connection selection and local edge editing")) {
    return source;
  }
  const section = [
    "## Completed: connection selection and local edge editing",
    "",
    "- Domain and local connections are projected as explicit selectable graph records.",
    "- Selecting a connection opens its source, target, type, scope and note in the persistent inspector.",
    "- Domain connections remain read-only.",
    "- Local connection type and note can be edited without changing endpoints or enabling deletion.",
    "- Stale connection selections are cleared after linked local entities are removed.",
    "- View-model and installed-UI regressions cover projection, selection, editing and report propagation.",
  ].join("\n");
  const marker = "## Next implementation steps";
  return source.includes(marker)
    ? source.replace(marker, `${section}\n\n${marker}`)
    : `${source.trimEnd()}\n\n${section}\n`;
});

if (changedFiles.length === 0) {
  console.log("Pattern Room connection selection and editing are already current.");
} else {
  console.log(`${apply ? "Applied" : "Would apply"}:`);
  changedFiles.forEach((path) => console.log(`- ${path}`));
}
