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

type BoardMaterial =
  "evidence-slip" | "source-file" | "analysis-card" | "postit" | "uncertainty-note" | "placeholder";

const BOARD_WIDTH = 1040;
const BOARD_MIN_HEIGHT = 620;
const BOARD_CARD_WIDTH = 248;
const BOARD_CARD_HEIGHT = 132;
const BOARD_PADDING = 48;
const BOARD_COLUMN_STEP = 312;
const BOARD_ROW_STEP = 186;
const BOARD_JITTER_X = [0, 12, -8, 7, -13, 4] as const;
const BOARD_JITTER_Y = [0, 8, -5, 11, -9, 4] as const;
const BOARD_LAYOUT_STORAGE_PREFIX = "pattern-room:detective-board:v5:";

function normalizeBoardNodeId(nodeId: string): string {
  return nodeId.startsWith("claim-") ? nodeId.slice("claim-".length) : nodeId;
}

function resolveBoardMaterial(pin: PatternBoardPin): BoardMaterial {
  if (pin.kind === "placeholder") {
    return "placeholder";
  }
  if (pin.kind === "source") {
    return "source-file";
  }
  if (pin.kind === "evidence" || pin.layer === "evidence") {
    return "evidence-slip";
  }
  if (pin.layer === "uncertainty" || pin.tone === "uncertainty") {
    return "uncertainty-note";
  }
  if (pin.layer === "analysis" || pin.tone === "analysis") {
    return "analysis-card";
  }
  return "postit";
}

function getBoardMaterialLabel(material: BoardMaterial): string {
  switch (material) {
    case "evidence-slip":
      return "KANIT FİŞİ";
    case "source-file":
      return "KAYNAK DOSYASI";
    case "analysis-card":
      return "ANALİZ KARTI";
    case "postit":
      return "SAHA NOTU";
    case "uncertainty-note":
      return "AÇIK SORU";
    case "placeholder":
      return "BOŞ İZ";
  }
  return material;
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
  return Math.max(BOARD_MIN_HEIGHT, 140 + rows * BOARD_ROW_STEP);
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
    const raw = window.localStorage.getItem(createBoardStorageKey(subject));
    if (raw === null) {
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
      if (
        typeof x === "number" &&
        Number.isFinite(x) &&
        typeof y === "number" &&
        Number.isFinite(y)
      ) {
        layout[id] = { x, y };
      }
    });
    return layout;
  } catch {
    return {};
  }
}

function writeStoredBoardLayout(
  subject: string,
  positions: ReadonlyMap<string, BoardPosition>
): void {
  try {
    const layout: StoredBoardLayout = {};
    positions.forEach((position, id) => {
      layout[id] = position;
    });
    window.localStorage.setItem(createBoardStorageKey(subject), JSON.stringify(layout));
  } catch {
    // Board positioning is presentation-only. Storage failure must not block the room.
  }
}

function clearStoredBoardLayout(subject: string): void {
  try {
    window.localStorage.removeItem(createBoardStorageKey(subject));
  } catch {
    // Presentation-only state.
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
  button.dataset["patternBoardConnectionRelated"] = "false";
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
  sourceCard: HTMLElement,
  target: BoardPosition,
  targetCard: HTMLElement,
  index: number
): void {
  const sourceX = source.x + sourceCard.offsetWidth / 2;
  const sourceY = source.y + sourceCard.offsetHeight / 2;
  const targetX = target.x + targetCard.offsetWidth / 2;
  const targetY = target.y + targetCard.offsetHeight / 2;
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
      "Kartları sürükle. Bir kart seçince bağlı izler öne çıkar; C ile hızlı ip moduna geç."
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

  const tidyButton = createElement("button", "pattern-room-board-tidy-button", "Toparla");
  tidyButton.type = "button";
  tidyButton.title = "Kartları başlangıç düzenine getir";
  tidyButton.ariaLabel = tidyButton.title;

  const connectionStatus = createElement("span", "pattern-room-board-connect-status", "");
  connectionStatus.ariaLive = "polite";
  connectionTools.append(edgeType, connectButton, tidyButton, connectionStatus);
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

  const redrawConnections = (changedPinId?: string): void => {
    data.connections.forEach((connection, index) => {
      const button = connectionButtons.get(connection.id);
      const sourcePin = resolvePin(connection.sourceId);
      const targetPin = resolvePin(connection.targetId);
      if (button === undefined || sourcePin === undefined || targetPin === undefined) {
        return;
      }
      if (
        changedPinId !== undefined &&
        sourcePin.id !== changedPinId &&
        targetPin.id !== changedPinId
      ) {
        return;
      }
      const sourcePosition = positions.get(sourcePin.id);
      const targetPosition = positions.get(targetPin.id);
      const sourceCard = cardsById.get(sourcePin.id);
      const targetCard = cardsById.get(targetPin.id);
      if (
        sourcePosition === undefined ||
        targetPosition === undefined ||
        sourceCard === undefined ||
        targetCard === undefined
      ) {
        return;
      }
      updateStringGeometry(button, sourcePosition, sourceCard, targetPosition, targetCard, index);
    });
  };

  const updateSelectedCard = (pinId: string | null): void => {
    const relatedPinIds = new Set<string>();
    const relatedConnectionIds = new Set<string>();
    if (pinId !== null) {
      relatedPinIds.add(pinId);
      data.connections.forEach((connection) => {
        const sourcePin = resolvePin(connection.sourceId);
        const targetPin = resolvePin(connection.targetId);
        if (sourcePin?.id === pinId || targetPin?.id === pinId) {
          relatedConnectionIds.add(connection.id);
          if (sourcePin !== undefined) {
            relatedPinIds.add(sourcePin.id);
          }
          if (targetPin !== undefined) {
            relatedPinIds.add(targetPin.id);
          }
        }
      });
    }

    canvas.dataset["patternBoardHasFocus"] = pinId === null ? "false" : "true";
    cardsById.forEach((card, id) => {
      const isSelected = id === pinId;
      const isRelated = pinId !== null && relatedPinIds.has(id);
      card.dataset["patternBoardPinSelected"] = isSelected ? "true" : "false";
      card.dataset["patternBoardPinRelated"] = isRelated ? "true" : "false";
      card.ariaPressed = isSelected ? "true" : "false";
      card.classList.toggle("selected", isSelected);
    });
    connectionButtons.forEach((button, id) => {
      button.dataset["patternBoardConnectionRelated"] =
        pinId !== null && relatedConnectionIds.has(id) ? "true" : "false";
    });
  };

  const updateSelectedConnection = (connectionId: string | null): void => {
    let sourcePinId: string | null = null;
    let targetPinId: string | null = null;
    if (connectionId !== null) {
      const selectedConnection = data.connections.find(
        (connection) => connection.id === connectionId
      );
      if (selectedConnection !== undefined) {
        sourcePinId = resolvePin(selectedConnection.sourceId)?.id ?? null;
        targetPinId = resolvePin(selectedConnection.targetId)?.id ?? null;
      }
    }

    connectionButtons.forEach((button, id) => {
      const isSelected = id === connectionId;
      button.dataset["patternBoardConnectionSelected"] = isSelected ? "true" : "false";
      button.ariaPressed = isSelected ? "true" : "false";
      button.classList.toggle("selected", isSelected);
    });
    cardsById.forEach((card, id) => {
      card.dataset["patternBoardConnectionEndpoint"] =
        id === sourcePinId || id === targetPinId ? "true" : "false";
    });
  };

  data.connections.forEach((connection) => {
    const sourcePin = resolvePin(connection.sourceId);
    const targetPin = resolvePin(connection.targetId);
    if (sourcePin === undefined || targetPin === undefined || sourcePin.id === targetPin.id) {
      return;
    }
    const button = createBoardString(connection, (connectionId) => {
      actions.selectNode(null);
      updateSelectedCard(null);
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

    actions.addAuthoredEdge(edgeType.value as AuthoredConnectionEdgeType, sourceEntityId, entityId);
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

  tidyButton.addEventListener("click", () => {
    cancelConnectionMode();
    clearStoredBoardLayout(data.subject);
    allPins.forEach(({ pin }, index) => {
      const card = cardsById.get(pin.id);
      if (card === undefined) {
        return;
      }
      const position = createInitialPosition(index);
      const width = card.offsetWidth || BOARD_CARD_WIDTH;
      const height = card.offsetHeight || BOARD_CARD_HEIGHT;
      const clamped: BoardPosition = {
        x: Math.min(Math.max(0, position.x), BOARD_WIDTH - width),
        y: Math.min(Math.max(0, position.y), boardHeight - height),
      };
      positions.set(pin.id, clamped);
      const tilt = ((index % 5) - 2) * 0.45;
      setCardGeometry(card, clamped, tilt);
    });
    redrawConnections();
    connectionStatus.textContent = "Pano toplandı";
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
    const material = resolveBoardMaterial(pin);
    const card = createElement(
      "button",
      `pattern-room-board-node pattern-room-detective-note ${category.tone} material-${material}`
    );
    card.type = "button";
    card.dataset["patternBoardPin"] = pin.id;
    card.dataset["patternBoardPinKind"] = pin.kind;
    card.dataset["patternBoardTone"] = category.tone;
    card.dataset["patternBoardLayer"] = pin.layer;
    card.dataset["patternBoardMaterial"] = material;
    card.dataset["patternBoardLocal"] = pin.isLocal ? "true" : "false";
    card.dataset["patternBoardPinSelected"] = "false";
    card.dataset["patternBoardPinRelated"] = "false";
    card.dataset["patternBoardConnectionEndpoint"] = "false";
    card.dataset["patternBoardConnectionMode"] = "false";
    card.dataset["patternBoardConnectionSource"] = "false";
    card.ariaPressed = "false";
    setCardGeometry(card, position, tilt);

    const pinHead = createElement("span", "pattern-room-detective-note-head");
    pinHead.append(
      createElement("span", "pattern-room-detective-note-pin"),
      createElement("span", "pattern-room-detective-note-category", category.label),
      createElement(
        "span",
        "pattern-room-detective-note-material-label",
        getBoardMaterialLabel(material)
      )
    );

    const content = createElement("span", "pattern-room-detective-note-content");
    content.append(
      createElement("strong", "pattern-room-board-node-copy", pin.label),
      createElement("span", "pattern-room-detective-note-preview", pin.content)
    );

    const meta = createElement("small", "pattern-room-board-node-meta");
    meta.append(
      createElement("span", undefined, pin.layerLabel),
      createElement("span", undefined, pin.confidenceLabel),
      createElement("span", undefined, pin.isLocal ? "Yerel" : "Hazır")
    );

    card.append(pinHead, content, meta);

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
      actions.selectConnection(null);
      updateSelectedConnection(null);
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
        const width = card.offsetWidth || BOARD_CARD_WIDTH;
        const height = card.offsetHeight || BOARD_CARD_HEIGHT;
        const nextPosition: BoardPosition = {
          x: Math.min(Math.max(0, start.x + deltaX), BOARD_WIDTH - width),
          y: Math.min(Math.max(0, start.y + deltaY), boardHeight - height),
        };
        positions.set(pin.id, nextPosition);
        setCardGeometry(card, nextPosition, tilt);
        redrawConnections(pin.id);
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

  scene.addEventListener("click", (event) => {
    if (event.target !== scene && event.target !== cardsLayer && event.target !== stringLayer) {
      return;
    }
    actions.selectNode(null);
    actions.selectConnection(null);
    updateSelectedCard(null);
    updateSelectedConnection(null);
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
