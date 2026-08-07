import type {
  PatternClaim,
  PatternConnection,
  PatternConnectionOption,
  PatternPanelActions,
  PatternRoomWorkspaceModel,
} from "../../shared/types/pattern-room.js";
import {
  createPatternWorkspaceTranslator,
  type PatternWorkspaceTranslator,
} from "../pattern-room-workspace-i18n.js";
import { createElement, createEmptyState, createPanelShell } from "./pattern-panel-utils.js";

type PatternGraphNodeKind = PatternConnectionOption["kind"];

type PatternGraphNodeDraft = {
  readonly id: string;
  readonly label: string;
  readonly kind: PatternGraphNodeKind;
  readonly isLocal: boolean;
  readonly claim: PatternClaim | null;
};

type PatternGraphNode = PatternGraphNodeDraft & {
  readonly x: number;
  readonly y: number;
};

type PatternGraphLayout = {
  readonly width: number;
  readonly height: number;
  readonly nodes: readonly PatternGraphNode[];
  readonly nodesById: ReadonlyMap<string, PatternGraphNode>;
};

const GRAPH_LAYOUT_VERSION = "case-map-v3";
const GRAPH_SCENE_WIDTH = 1180;
const GRAPH_SCENE_HEIGHT = 760;
const GRAPH_NODE_WIDTH = 218;
const GRAPH_NODE_HEIGHT = 96;
const GRAPH_RING_CAPACITY = 8;
const GRAPH_ZOOM_MIN = 0.75;
const GRAPH_ZOOM_MAX = 1.5;
const GRAPH_ZOOM_STEP = 0.25;

const GRAPH_NODE_KIND_LABELS: Readonly<Record<PatternGraphNodeKind, string>> = {
  source: "Kaynak",
  evidence: "Kanıt",
  node: "Pano izi",
};

const GRAPH_NODE_KIND_ORDER: Readonly<Record<PatternGraphNodeKind, number>> = {
  source: 0,
  evidence: 1,
  node: 2,
};

function normalizeClaimNodeId(claimId: string): string {
  return claimId.startsWith("claim-") ? claimId.slice("claim-".length) : claimId;
}

function compareGraphNodes(left: PatternGraphNodeDraft, right: PatternGraphNodeDraft): number {
  const kindComparison = GRAPH_NODE_KIND_ORDER[left.kind] - GRAPH_NODE_KIND_ORDER[right.kind];
  if (kindComparison !== 0) {
    return kindComparison;
  }
  const labelComparison = left.label.localeCompare(right.label, "tr");
  return labelComparison === 0 ? left.id.localeCompare(right.id, "tr") : labelComparison;
}

function createGraphNodeDrafts(data: PatternRoomWorkspaceModel): readonly PatternGraphNodeDraft[] {
  const optionsById = new Map(
    data.connectionOptions.map((option) => {
      return [option.id, option] as const;
    })
  );
  const claimsByNodeId = new Map<string, PatternClaim>();
  data.claims.forEach((claim) => {
    claimsByNodeId.set(claim.id, claim);
    claimsByNodeId.set(normalizeClaimNodeId(claim.id), claim);
  });

  const nodesById = new Map<string, PatternGraphNodeDraft>();
  const ensureNode = (id: string, fallbackLabel: string): void => {
    const option = optionsById.get(id);
    const claim = claimsByNodeId.get(id) ?? claimsByNodeId.get(`claim-${id}`) ?? null;
    const existing = nodesById.get(id);
    const next: PatternGraphNodeDraft = {
      id,
      label: option?.label ?? claim?.label ?? fallbackLabel,
      kind: option?.kind ?? "node",
      isLocal: option?.isLocal ?? id.startsWith("local-"),
      claim,
    };
    if (existing === undefined || (existing.claim === null && next.claim !== null)) {
      nodesById.set(id, next);
    }
  };

  data.connections.forEach((connection) => {
    ensureNode(connection.sourceId, connection.sourceLabel);
    ensureNode(connection.targetId, connection.targetLabel);
  });
  data.claims.forEach((claim) => {
    ensureNode(normalizeClaimNodeId(claim.id), claim.label);
  });
  return [...nodesById.values()].sort(compareGraphNodes);
}

function createGraphLayout(data: PatternRoomWorkspaceModel): PatternGraphLayout {
  const drafts = createGraphNodeDrafts(data);
  const centerX = GRAPH_SCENE_WIDTH / 2;
  const centerY = GRAPH_SCENE_HEIGHT / 2 + 14;
  const nodes: PatternGraphNode[] = [];

  drafts.forEach((node, index) => {
    const ring = Math.floor(index / GRAPH_RING_CAPACITY);
    const slot = index % GRAPH_RING_CAPACITY;
    const ringStart = ring * GRAPH_RING_CAPACITY;
    const ringCount = Math.min(GRAPH_RING_CAPACITY, drafts.length - ringStart);
    const angleOffset = ring % 2 === 0 ? -90 : -67.5;
    const angleDegrees = angleOffset + (360 * slot) / Math.max(ringCount, 1);
    const angle = (angleDegrees * Math.PI) / 180;
    const radiusX = Math.max(270, 430 - ring * 118);
    const radiusY = Math.max(184, 270 - ring * 70);
    nodes.push({
      ...node,
      x: centerX + Math.cos(angle) * radiusX - GRAPH_NODE_WIDTH / 2,
      y: centerY + Math.sin(angle) * radiusY - GRAPH_NODE_HEIGHT / 2,
    });
  });

  return {
    width: GRAPH_SCENE_WIDTH,
    height: GRAPH_SCENE_HEIGHT,
    nodes,
    nodesById: new Map(
      nodes.map((node) => {
        return [node.id, node] as const;
      })
    ),
  };
}

function createCaseFocus(subject: string, connectionCount: number): HTMLElement {
  const focus = createElement("section", "pattern-room-case-map-focus");
  focus.ariaHidden = "true";
  focus.append(
    createElement("span", "pattern-room-kicker", "Vaka odağı"),
    createElement("strong", undefined, subject),
    createElement("small", undefined, `${String(connectionCount)} kayıtlı ilişki`)
  );
  return focus;
}

function createGraphNode(node: PatternGraphNode, index: number): HTMLElement {
  const card = createElement(
    "article",
    `pattern-room-graph-node pattern-room-case-map-node ${node.kind} ${
      node.isLocal ? "local" : "domain"
    }${node.claim === null ? "" : ` ${node.claim.stance}`}`
  );
  card.dataset["patternGraphNode"] = node.id;
  card.dataset["patternGraphNodeKind"] = node.kind;
  card.dataset["patternGraphNodeScope"] = node.isLocal ? "local" : "domain";
  card.setAttribute(
    "style",
    `left:${String(Math.round(node.x))}px;top:${String(Math.round(node.y))}px;`
  );
  if (node.claim !== null) {
    card.dataset["patternConnectionClaim"] = node.claim.id;
    card.dataset["patternClaimCard"] = node.claim.id;
  }

  const summary =
    node.claim?.summary ??
    `${GRAPH_NODE_KIND_LABELS[node.kind]} bağlantı ucu; ayrıntılar kaynak ve pano yüzeylerinde korunur.`;
  card.append(
    createElement("span", "pattern-room-list-eyebrow", GRAPH_NODE_KIND_LABELS[node.kind]),
    createElement("span", "pattern-room-connection-node-index", String(index + 1)),
    createElement("h3", undefined, node.label),
    createElement("p", undefined, summary),
    createElement("small", undefined, node.isLocal ? "Yerel vaka izi" : "Hazır vaka izi")
  );
  return card;
}

function createGraphEdge(
  connection: PatternConnection,
  source: PatternGraphNode,
  target: PatternGraphNode,
  index: number,
  onSelect: (connectionId: string) => void
): HTMLButtonElement {
  const sourceX = source.x + GRAPH_NODE_WIDTH / 2;
  const sourceY = source.y + GRAPH_NODE_HEIGHT / 2;
  const targetX = target.x + GRAPH_NODE_WIDTH / 2;
  const targetY = target.y + GRAPH_NODE_HEIGHT / 2;
  const deltaX = targetX - sourceX;
  const deltaY = targetY - sourceY;
  const length = Math.max(Math.hypot(deltaX, deltaY), 72);
  const angle = (Math.atan2(deltaY, deltaX) * 180) / Math.PI;
  const parallelOffset = ((index % 3) - 1) * 9;
  const radians = (angle * Math.PI) / 180;
  const offsetX = -Math.sin(radians) * parallelOffset;
  const offsetY = Math.cos(radians) * parallelOffset;

  const button = createElement(
    "button",
    `pattern-room-connection-card pattern-room-graph-edge pattern-room-case-map-edge ${connection.scope}`
  );
  button.type = "button";
  button.dataset["patternConnectionEdge"] = connection.id;
  button.dataset["patternGraphEdge"] = connection.id;
  button.dataset["patternGraphEdgeScope"] = connection.scope;
  button.ariaPressed = "false";
  button.ariaLabel = `${connection.sourceLabel} → ${connection.edgeTypeLabel} → ${connection.targetLabel}`;
  button.title = button.ariaLabel;
  button.setAttribute(
    "style",
    `left:${String(sourceX + offsetX)}px;top:${String(sourceY + offsetY)}px;width:${String(
      length
    )}px;transform:rotate(${String(angle)}deg);`
  );

  const label = createElement(
    "span",
    "pattern-room-connection-edge-label pattern-room-graph-edge-label",
    connection.edgeTypeLabel
  );
  label.setAttribute("style", `transform:translate(-50%,-50%) rotate(${String(-angle)}deg);`);
  button.append(
    createElement("span", "pattern-room-graph-edge-line"),
    label,
    createElement(
      "span",
      "pattern-room-visually-hidden",
      `${connection.sourceLabel} → ${connection.edgeTypeLabel} → ${connection.targetLabel}`
    )
  );
  button.addEventListener("click", () => {
    onSelect(connection.id);
  });
  return button;
}

function updateGraphScale(
  stage: HTMLElement,
  scene: HTMLElement,
  zoomValue: HTMLElement,
  zoomOut: HTMLButtonElement,
  zoomIn: HTMLButtonElement,
  layout: PatternGraphLayout,
  zoom: number
): void {
  stage.setAttribute(
    "style",
    `width:${String(Math.round(layout.width * zoom))}px;height:${String(
      Math.round(layout.height * zoom)
    )}px;`
  );
  scene.setAttribute(
    "style",
    `width:${String(layout.width)}px;height:${String(layout.height)}px;transform:scale(${String(
      zoom
    )});`
  );
  zoomValue.textContent = `${String(Math.round(zoom * 100))}%`;
  zoomOut.disabled = zoom <= GRAPH_ZOOM_MIN;
  zoomIn.disabled = zoom >= GRAPH_ZOOM_MAX;
}

function createGraphToolbar(
  nodeCount: number,
  connectionCount: number,
  onZoomChange: (direction: "in" | "out" | "reset") => void
): {
  readonly toolbar: HTMLElement;
  readonly zoomValue: HTMLElement;
  readonly zoomOut: HTMLButtonElement;
  readonly zoomIn: HTMLButtonElement;
} {
  const toolbar = createElement("div", "pattern-room-graph-toolbar pattern-room-case-map-toolbar");
  toolbar.dataset["patternGraphToolbar"] = "true";
  const metrics = createElement("div", "pattern-room-graph-metrics");
  metrics.append(
    createElement("span", undefined, `${String(nodeCount)} iz`),
    createElement("span", undefined, `${String(connectionCount)} ilişki`),
    createElement("span", undefined, "Vaka haritası")
  );

  const legend = createElement("div", "pattern-room-case-map-legend");
  (["source", "evidence", "node"] as const).forEach((kind) => {
    const item = createElement("span", kind);
    item.append(createElement("i"), createElement("small", undefined, GRAPH_NODE_KIND_LABELS[kind]));
    legend.append(item);
  });

  const controls = createElement("div", "pattern-room-graph-zoom-controls");
  controls.ariaLabel = "Harita yakınlaştırma";
  const zoomOut = createElement("button", "pattern-room-graph-zoom-button", "−");
  zoomOut.type = "button";
  zoomOut.ariaLabel = "Uzaklaştır";
  const zoomValue = createElement("span", "pattern-room-graph-zoom-value", "100%");
  zoomValue.dataset["patternGraphZoomValue"] = "true";
  const reset = createElement("button", "pattern-room-graph-zoom-button reset", "Ortala");
  reset.type = "button";
  reset.ariaLabel = "Haritayı ortala";
  const zoomIn = createElement("button", "pattern-room-graph-zoom-button", "+");
  zoomIn.type = "button";
  zoomIn.ariaLabel = "Yakınlaştır";
  zoomOut.addEventListener("click", () => onZoomChange("out"));
  reset.addEventListener("click", () => onZoomChange("reset"));
  zoomIn.addEventListener("click", () => onZoomChange("in"));
  controls.append(zoomOut, zoomValue, reset, zoomIn);
  toolbar.append(metrics, legend, controls);
  return { toolbar, zoomValue, zoomOut, zoomIn };
}

export function createDeskPanel(
  data: PatternRoomWorkspaceModel,
  actions: PatternPanelActions,
  onBack: () => void,
  text: PatternWorkspaceTranslator = createPatternWorkspaceTranslator("tr", null)
): HTMLElement {
  const shell = createPanelShell("desk", text("connections.title"), onBack);
  shell.classList.add("pattern-room-case-map-panel");
  const layout = createElement(
    "div",
    "pattern-room-desk-layout pattern-room-connections-workspace pattern-room-connections-canvas-only"
  );

  const workSurface = createElement("section", "pattern-room-desk-surface");
  workSurface.ariaLabel = text("connections.title");
  const surfaceHeader = createElement("header", "pattern-room-desk-header pattern-room-case-map-header");
  surfaceHeader.append(
    createElement("span", "pattern-room-kicker", "Bağlantı masası"),
    createElement("h2", undefined, data.subject),
    createElement("p", undefined, "Kaynak, kanıt ve pano izlerini vaka odağının çevresinde karşılaştır.")
  );

  const connectionMap = createElement("div", "pattern-room-connection-map pattern-room-graph-map");
  connectionMap.dataset["patternConnectionMap"] = "true";
  const graphLayout = createGraphLayout(data);
  const stage = createElement("div", "pattern-room-graph-stage");
  stage.dataset["patternGraphStage"] = "true";
  const scene = createElement("div", "pattern-room-graph-scene pattern-room-case-map-scene");
  scene.dataset["patternGraphScene"] = "true";
  scene.dataset["patternGraphLayout"] = GRAPH_LAYOUT_VERSION;

  const relationship = createElement("div", "pattern-room-connection-list pattern-room-graph-edges");
  relationship.dataset["patternConnectionList"] = "true";
  const graphNodes = createElement("div", "pattern-room-claim-objects pattern-room-graph-nodes");
  const connectionButtons: HTMLButtonElement[] = [];
  const updateSelectedConnection = (connectionId: string | null): void => {
    connectionButtons.forEach((button) => {
      const selected = button.dataset["patternConnectionEdge"] === connectionId;
      button.ariaPressed = selected ? "true" : "false";
      button.classList.toggle("active", selected);
    });
  };

  [...data.connections]
    .sort((left, right) => left.id.localeCompare(right.id, "tr"))
    .forEach((connection, index) => {
      const source = graphLayout.nodesById.get(connection.sourceId);
      const target = graphLayout.nodesById.get(connection.targetId);
      if (source === undefined || target === undefined) {
        return;
      }
      const button = createGraphEdge(connection, source, target, index, (connectionId) => {
        actions.selectConnection(connectionId);
        updateSelectedConnection(connectionId);
      });
      connectionButtons.push(button);
      relationship.append(button);
    });

  graphLayout.nodes.forEach((node, index) => {
    graphNodes.append(createGraphNode(node, index));
  });
  updateSelectedConnection(actions.getSelectedConnectionId());
  scene.append(createCaseFocus(data.subject, data.connections.length), relationship, graphNodes);
  stage.append(scene);

  const viewport = createElement("div", "pattern-room-graph-viewport");
  viewport.dataset["patternGraphViewport"] = "true";
  viewport.tabIndex = 0;
  viewport.ariaLabel = "Kaydırılabilir vaka ilişki haritası";
  viewport.append(stage);

  let zoom = 1;
  const toolbarElements = createGraphToolbar(
    graphLayout.nodes.length,
    data.connections.length,
    (direction) => {
      zoom =
        direction === "reset"
          ? 1
          : direction === "in"
            ? Math.min(GRAPH_ZOOM_MAX, zoom + GRAPH_ZOOM_STEP)
            : Math.max(GRAPH_ZOOM_MIN, zoom - GRAPH_ZOOM_STEP);
      updateGraphScale(
        stage,
        scene,
        toolbarElements.zoomValue,
        toolbarElements.zoomOut,
        toolbarElements.zoomIn,
        graphLayout,
        zoom
      );
    }
  );
  updateGraphScale(
    stage,
    scene,
    toolbarElements.zoomValue,
    toolbarElements.zoomOut,
    toolbarElements.zoomIn,
    graphLayout,
    zoom
  );

  connectionMap.append(toolbarElements.toolbar, viewport);
  if (graphLayout.nodes.length === 0) {
    connectionMap.append(createEmptyState("Haritaya yerleştirilecek vaka izi yok.", "data-empty"));
  } else if (data.connections.length === 0) {
    connectionMap.append(
      createEmptyState("Henüz ilişki kurulmadı. Sağdaki İZ çekmecesinden iki öğeyi bağla.", "data-empty", {
        compact: true,
        className: "pattern-room-connection-empty",
      })
    );
  }

  const hint = createElement(
    "p",
    "pattern-room-graph-hint",
    "Bir ilişkiye tıklayarak ayrıntısını aç. Harita yakınlaştırması yalnız görünümü değiştirir."
  );
  workSurface.append(surfaceHeader, connectionMap, hint);
  layout.append(workSurface);
  shell.append(layout);
  return shell;
}
