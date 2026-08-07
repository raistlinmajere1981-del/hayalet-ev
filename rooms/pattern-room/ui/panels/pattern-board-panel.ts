import type {
  PatternBoardPin,
  PatternConnection,
  PatternPanelActions,
  PatternRoomWorkspaceModel,
} from "../../shared/types/pattern-room.js";
import {
  createPatternWorkspaceTranslator,
  type PatternWorkspaceTranslator,
} from "../pattern-room-workspace-i18n.js";
import {
  CONNECTION_EDGE_TYPE_OPTIONS,
  type AuthoredConnectionEdgeType,
} from "./pattern-connection-composer.js";
import { createElement, createEmptyState, createPanelShell } from "./pattern-panel-utils.js";

type BoardPosition = {
  readonly x: number;
  readonly y: number;
};

type StoredBoardLayout = Record<string, BoardPosition>;

const BOARD_WIDTH = 1040;
const BOARD_MIN_HEIGHT = 620;
const BOARD_CARD_WIDTH = 248;
const BOARD_CARD_HEIGHT = 118;
const BOARD_PADDING = 48;
const BOARD_COLUMN_STEP = 312;
const BOARD_ROW_STEP = 174;
const BOARD_JITTER_X = [0, 12, -8, 7, -13, 4] as const;
const BOARD_JITTER_Y = [0, 8, -5, 11, -9, 4] as const;
const BOARD_LAYOUT_STORAGE_PREFIX = "pattern-room:detective-board:v5:";

function normalizeBoardNodeId(nodeId: string): string {
  return nodeId.startsWith("claim-") ? nodeId.slice("claim-".length) : nodeId;
}

function createInitialPosition(index: number): BoardPosition {
  const column = index % 3;
  const row = Math.floor(index / 3);
  return {
    x:
      BOARD_PADDING +
      column * BOARD_COLUMN_STEP +
      (BOARD_JITTER_X[index % BOARD_JITTER_X.length] ?? 0),
    y: 74 + row * BOARD_ROW_STEP + (BOARD_JITTER_Y[index % BOARD_JITTER_Y.length] ?? 0),
  };
}

function createBoardHeight(pinCount: number): number {
  const rows = Math.max(1, Math.ceil(pinCount / 3));
  return Math.max(BOARD_MIN_HEIGHT, 128 + rows * BOARD_ROW_STEP);
}

function createPinAliases(pin: PatternBoardPin): readonly string[] {
  const normalizedId = normalizeBoardNodeId(pin.id);
  return normalizedId === pin.id ? [pin.id] : [pin.id, normalizedId];
}

function createBoardStorageKey(subject: string): string {
  return `${BOARD_LAYOUT_STORAGE_PREFIX}${subject.trim().toLocaleLowerCase("tr")}`;
}

function readStoredBoardLayout(subject: string): StoredBoardLayout {
  try {
    const raw = window.localStorage?.getItem(createBoardStorageKey(subject));
    if (raw === null || raw === undefined) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }

    const layout: StoredBoardLayout = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([id, value]) => {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return;
      }
      const x = (value as Record<string, unknown>)["x"];
      const y = (value as Record<string, unknown>)["y"];
      if (typeof x === "number" && Number.isFinite(x) && typeof y === "number" && Number.isFinite(y)) {
        layout[id] = { x, y };
      }
    });
    return layout;
  } catch {
    return {};
  }
}

function writeStoredBoardLayout(subject: string, positions: ReadonlyMap<string, BoardPosition>): void {
  try {
    const layout: StoredBoardLayout = {};
    positions.forEach((position, id) => {
      layout[id] = position;
    });
    window.localStorage?.setItem(createBoardStorageKey(subject), JSON.stringify(layout));
  } catch {
    // Board positioning is presentation-only. Storage failure must not block the room.
  }
}

function createBoardString(
  connection: PatternConnection,
  onSelect: (connectionId: string) => void
): HTMLButtonElement {
  const button = createElement("button", `pattern-room-board-string ${connection.scope}`);
  button.type = "button";
  button.dataset["patternBoardConnection"] = connection.id;
  button.dataset["patternBoardConnectionScope"] = connection.scope;
  button.dataset["patternBoardConnectionType"] = connection.edgeType;
  button.dataset["patternBoardConnectionSelected"] = "false";
  button.ariaPressed = "false";
  button.ariaLabel = `${connection.sourceLabel} → ${connection.edgeTypeLabel} → ${connection.targetLabel}`;
  button.title = button.ariaLabel;
  button.append(createElement("span", "pattern-room-board-string-line"));
  button.addEventListener("click", () => {
    onSelect(connection.id);
  });
  return button;
}

function updateStringGeometry(
  button: HTMLButtonElement,
  source: BoardPosition,
  target: BoardPosition,
  index: number
): void {
  const sourceX = source.x + BOARD_CARD_WIDTH / 2;
  const sourceY = source.y + BOARD_CARD_HEIGHT / 2;
  const targetX = target.x + BOARD_CARD_WIDTH / 2;
  const targetY = target.y + BOARD_CARD_HEIGHT / 2;
  const deltaX = targetX - sourceX;
  const deltaY = targetY - sourceY;
  const length = Math.max(Math.hypot(deltaX, deltaY), 24);
  const angle = (Math.atan2(deltaY, deltaX) * 180) / Math.PI;
  const parallelOffset = ((index % 3) - 1) * 8;
  const radians = (angle * Math.PI) / 180;
  const offsetX = -Math.sin(radians) * parallelOffset;
  const offsetY = Math.cos(radians) * parallelOffset;

  button.setAttribute(
    "style",
    `left:${String(sourceX + offsetX)}px;top:${String(sourceY + offsetY)}px;width:${String(
      length
    )}px;transform:rotate(${String(angle)}deg);`
  );
}

function setCardGeometry(card: HTMLButtonElement, position: BoardPosition, tilt: number): void {
  card.setAttribute(
    "style",
    `left:${String(position.x)}px;top:${String(position.y)}px;--pattern-note-tilt:${String(
      tilt
    )}deg;`
  );
}

export function createBoardPanel(
  data: PatternRoomWorkspaceModel,
  actions: PatternPanelActions,
  onBack: () => void,
  text: PatternWorkspaceTranslator = createPatternWorkspaceTranslator("tr", null)
): HTMLElement {
  const shell = createPanelShell("board", text("nav.board.label"), onBack);
  const workspace = createElement(
    "div",
    "pattern-room-board-workspace pattern-room-board-workspace-canvas-only pattern-room-detective-board-workspace"
  );
  const canvas = createElement("section", "pattern-room-board-canvas pattern-room-detective-board");
  canvas.ariaLabel = text("board.canvasLabel");

  const allPins = data.boardCategories.flatMap((category) => {
    return category.pins.map((pin) => {
      return { category, pin } as const;
    });
  });
  const boardHeight = createBoardHeight(allPins.length);

  const canvasHeader = createElement(
    "header",
    "pattern-room-workspace-section-header pattern-room-detective-board-header"
  );
  const headerCopy = createElement("div", "pattern-room-detective-board-heading");
  headerCopy.append(
    createElement("span", "pattern-room-kicker", "Soruşturma panosu"),
    createElement("strong", undefined, data.subject),
    createElement(
      "small",
      "pattern-room-detective-board-hint",
      "Kartları sürükle. İp bağla modunda iki kart seçerek doğrudan ilişki kur."
    )
  );

  const headerActions = createElement("div", "pattern-room-detective-board-header-actions");
  const headerMetrics = createElement("div", "pattern-room-detective-board-metrics");
  headerMetrics.append(
    createElement("span", undefined, `${String(allPins.length)} kart`),
    createElement("span", undefined, `${String(data.connections.length)} bağlantı`)
  );

  const connectionTools = createElement("div", "pattern-room-board-connection-tools");
  connectionTools.dataset["patternBoardConnectionTools"] = "true";
  const edgeType = createElement("select", "pattern-room-board-connection-type");
  edgeType.ariaLabel = "İp bağlantı türü";
  CONNECTION_EDGE_TYPE_OPTIONS.forEach((optionValue) => {
    const option = createElement("option", undefined, optionValue.label);
    option.value = optionValue.value;
    edgeType.append(option);
  });
  edgeType.value = "supports";
  const connectButton = createElement("button", "pattern-room-board-connect-button", "İp bağla");
  connectButton.type = "button";
  connectButton.dataset["patternBoardConnectMode"] = "false";
  const connectionStatus = createElement("span", "pattern-room-board-connect-status", "");
  connectionStatus.ariaLive = "polite";
  connectionTools.append(edgeType, connectButton, connectionStatus);
  headerActions.append(headerMetrics, connectionTools);
  canvasHeader.append(headerCopy, headerActions);

  const viewport = createElement("div", "pattern-room-detective-board-viewport");
  viewport.tabIndex = 0;
  viewport.ariaLabel = "Kaydırılabilir soruşturma panosu";
  const scene = createElement("div", "pattern-room-board-scene pattern-room-detective-board-scene");
  scene.setAttribute("style", `width:${String(BOARD_WIDTH)}px;height:${String(boardHeight)}px;`);

  const stringLayer = createElement("div", "pattern-room-board-string-layer");
  stringLayer.ariaLabel = "Pano bağlantıları";
  const cardsLayer = createElement("div", "pattern-room-board-card-layer");
  const positions = new Map<string, BoardPosition>();
  const cardsById = new Map<string, HTMLButtonElement>();
  const pinByAlias = new Map<string, PatternBoardPin>();
  const connectionButtons = new Map<string, HTMLButtonElement>();
  const connectionOptionIds = new Set(data.connectionOptions.map((optionValue) => optionValue.id));
  const storedLayout = readStoredBoardLayout(data.subject);

  allPins.forEach(({ pin }, index) => {
    const initial = storedLayout[pin.id] ?? createInitialPosition(index);
    const clamped: BoardPosition = {
      x: Math.min(Math.max(0, initial.x), BOARD_WIDTH - BOARD_CARD_WIDTH),
      y: Math.min(Math.max(0, initial.y), boardHeight - BOARD_CARD_HEIGHT),
    };
    positions.set(pin.id, clamped);
    createPinAliases(pin).forEach((alias) => {
      pinByAlias.set(alias, pin);
    });
  });

  const resolvePin = (nodeId: string): PatternBoardPin | undefined => {
    return pinByAlias.get(nodeId) ?? pinByAlias.get(normalizeBoardNodeId(nodeId));
  };

  const resolveConnectionEntityId = (pin: PatternBoardPin): string | null => {
    const alias = createPinAliases(pin).find((candidate) => connectionOptionIds.has(candidate));
    if (alias !== undefined) {
      return alias;
    }
    if (pin.sourceId !== null && connectionOptionIds.has(pin.sourceId)) {
      return pin.sourceId;
    }
    return null;
  };

  const updateSelectedCard = (pinId: string | null): void => {
    cardsById.forEach((card, id) => {
      const isSelected = id === pinId;
      card.dataset["patternBoardPinSelected"] = isSelected ? "true" : "false";
      card.ariaPressed = isSelected ? "true" : "false";
      card.classList.toggle("selected", isSelected);
    });
  };

  const updateSelectedConnection = (connectionId: string | null): void => {
    connectionButtons.forEach((button, id) => {
      const isSelected = id === connectionId;
      button.dataset["patternBoardConnectionSelected"] = isSelected ? "true" : "false";
      button.ariaPressed = isSelected ? "true" : "false";
      button.classList.toggle("selected", isSelected);
    });
  };

  const redrawConnections = (): void => {
    data.connections.forEach((connection, index) => {
      const button = connectionButtons.get(connection.id);
      const sourcePin = resolvePin(connection.sourceId);
      const targetPin = resolvePin(connection.targetId);
      if (button === undefined || sourcePin === undefined || targetPin === undefined) {
        return;
      }
      const sourcePosition = positions.get(sourcePin.id);
      const targetPosition = positions.get(targetPin.id);
      if (sourcePosition === undefined || targetPosition === undefined) {
        return;
      }
      updateStringGeometry(button, sourcePosition, targetPosition, index);
    });
  };

  data.connections.forEach((connection) => {
    const sourcePin = resolvePin(connection.sourceId);
    const targetPin = resolvePin(connection.targetId);
    if (sourcePin === undefined || targetPin === undefined || sourcePin.id === targetPin.id) {
      return;
    }
    const button = createBoardString(connection, (connectionId) => {
      actions.selectConnection(connectionId);
      updateSelectedConnection(connectionId);
    });
    connectionButtons.set(connection.id, button);
    stringLayer.append(button);
  });

  let connectionMode = false;
  let connectionSourcePin: PatternBoardPin | null = null;

  const updateConnectionModeVisuals = (): void => {
    connectButton.dataset["patternBoardConnectMode"] = connectionMode ? "true" : "false";
    connectButton.textContent = connectionMode ? "İptal" : "İp bağla";
    edgeType.disabled = !connectionMode;
    cardsById.forEach((card, id) => {
      const isSource = connectionSourcePin?.id === id;
      card.dataset["patternBoardConnectionSource"] = isSource ? "true" : "false";
      card.classList.toggle("connection-source", isSource);
      card.dataset["patternBoardConnectionMode"] = connectionMode ? "true" : "false";
    });
    if (!connectionMode) {
      connectionStatus.textContent = "";
    } else if (connectionSourcePin === null) {
      connectionStatus.textContent = "Başlangıç kartını seç";
    } else {
      connectionStatus.textContent = "Hedef kartı seç";
    }
  };

  const cancelConnectionMode = (): void => {
    connectionMode = false;
    connectionSourcePin = null;
    updateConnectionModeVisuals();
  };

  const handleConnectionPin = (pin: PatternBoardPin): void => {
    const entityId = resolveConnectionEntityId(pin);
    if (entityId === null) {
      connectionStatus.textContent = "Bu kart bağlantıya uygun değil";
      return;
    }

    if (connectionSourcePin === null) {
      connectionSourcePin = pin;
      updateConnectionModeVisuals();
      return;
    }

    if (connectionSourcePin.id === pin.id) {
      connectionSourcePin = null;
      updateConnectionModeVisuals();
      return;
    }

    const sourceEntityId = resolveConnectionEntityId(connectionSourcePin);
    if (sourceEntityId === null || sourceEntityId === entityId) {
      connectionStatus.textContent = "Farklı bir hedef seç";
      return;
    }

    actions.addAuthoredEdge(
      edgeType.value as AuthoredConnectionEdgeType,
      sourceEntityId,
      entityId
    );
    connectionStatus.textContent = "İp bağlantısı eklendi";
    connectionSourcePin = null;
    connectionMode = false;
    updateConnectionModeVisuals();
  };

  connectButton.addEventListener("click", () => {
    connectionMode = !connectionMode;
    connectionSourcePin = null;
    updateConnectionModeVisuals();
  });

  viewport.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && connectionMode) {
      event.preventDefault();
      cancelConnectionMode();
    }
  });

  allPins.forEach(({ category, pin }, index) => {
    const position = positions.get(pin.id) ?? createInitialPosition(index);
    const tilt = ((index % 5) - 2) * 0.45;
    const card = createElement(
      "button",
      `pattern-room-board-node pattern-room-detective-note ${category.tone}`
    );
    card.type = "button";
    card.dataset["patternBoardPin"] = pin.id;
    card.dataset["patternBoardPinKind"] = pin.kind;
    card.dataset["patternBoardTone"] = category.tone;
    card.dataset["patternBoardPinSelected"] = "false";
    card.dataset["patternBoardConnectionMode"] = "false";
    card.dataset["patternBoardConnectionSource"] = "false";
    card.ariaPressed = "false";
    setCardGeometry(card, position, tilt);

    const pinHead = createElement("span", "pattern-room-detective-note-head");
    pinHead.append(
      createElement("span", "pattern-room-detective-note-pin"),
      createElement("span", "pattern-room-detective-note-category", category.label)
    );
    card.append(
      pinHead,
      createElement("strong", "pattern-room-board-node-copy", pin.label),
      createElement("span", "pattern-room-detective-note-preview", pin.content),
      createElement(
        "small",
        "pattern-room-board-node-meta",
        `${pin.layerLabel} · ${pin.confidenceLabel}`
      )
    );

    let moved = false;
    card.addEventListener("click", (event) => {
      if (moved) {
        moved = false;
        event.preventDefault();
        return;
      }
      if (connectionMode) {
        handleConnectionPin(pin);
        return;
      }
      actions.selectNode(pin.id);
      updateSelectedCard(pin.id);
    });

    card.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || connectionMode) {
        return;
      }
      const start = positions.get(pin.id) ?? position;
      const startClientX = event.clientX;
      const startClientY = event.clientY;
      moved = false;
      card.classList.add("dragging");
      if (typeof card.setPointerCapture === "function") {
        card.setPointerCapture(event.pointerId);
      }

      const onPointerMove = (moveEvent: PointerEvent): void => {
        const deltaX = moveEvent.clientX - startClientX;
        const deltaY = moveEvent.clientY - startClientY;
        if (Math.abs(deltaX) + Math.abs(deltaY) > 4) {
          moved = true;
        }
        if (!moved) {
          return;
        }
        const nextPosition: BoardPosition = {
          x: Math.min(Math.max(0, start.x + deltaX), BOARD_WIDTH - BOARD_CARD_WIDTH),
          y: Math.min(Math.max(0, start.y + deltaY), boardHeight - BOARD_CARD_HEIGHT),
        };
        positions.set(pin.id, nextPosition);
        setCardGeometry(card, nextPosition, tilt);
        redrawConnections();
      };

      const finishDrag = (): void => {
        card.classList.remove("dragging");
        card.removeEventListener("pointermove", onPointerMove);
        card.removeEventListener("pointerup", finishDrag);
        card.removeEventListener("pointercancel", finishDrag);
        if (moved) {
          writeStoredBoardLayout(data.subject, positions);
        }
      };

      card.addEventListener("pointermove", onPointerMove);
      card.addEventListener("pointerup", finishDrag);
      card.addEventListener("pointercancel", finishDrag);
    });

    cardsById.set(pin.id, card);
    cardsLayer.append(card);
  });

  updateConnectionModeVisuals();

  if (allPins.length === 0) {
    scene.append(
      createEmptyState(
        "Panoya iliştirilmiş kayıt yok. Arşivden bir kaynak veya kanıt ekle.",
        "data-empty"
      )
    );
  }

  const connectionReportHint = createElement(
    "span",
    "pattern-room-visually-hidden",
    "Bağlantılar Rapor panelinde Yerel Bağlantılar bölümünde listelenir."
  );

  redrawConnections();
  updateSelectedCard(actions.getSelectedNodeId());
  updateSelectedConnection(actions.getSelectedConnectionId());
  scene.append(stringLayer, cardsLayer);
  viewport.append(scene);
  canvas.append(canvasHeader, viewport, connectionReportHint);
  workspace.append(canvas);
  shell.append(workspace);
  return shell;
}
