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
import { createElement, createEmptyState, createPanelShell } from "./pattern-panel-utils.js";

type BoardPosition = {
  readonly x: number;
  readonly y: number;
};

const BOARD_WIDTH = 1040;
const BOARD_MIN_HEIGHT = 620;
const BOARD_CARD_WIDTH = 248;
const BOARD_CARD_HEIGHT = 118;
const BOARD_PADDING = 48;
const BOARD_COLUMN_STEP = 312;
const BOARD_ROW_STEP = 174;
const BOARD_POSITION_STORAGE_PREFIX = "pattern-room:detective-board:v3:";
const BOARD_JITTER_X = [0, 12, -8, 7, -13, 4] as const;
const BOARD_JITTER_Y = [0, 8, -5, 11, -9, 4] as const;
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

function normalizeBoardNodeId(nodeId: string): string {
  return nodeId.startsWith("claim-") ? nodeId.slice("claim-".length) : nodeId;
}

function createPositionStorageKey(subject: string): string {
  return `${BOARD_POSITION_STORAGE_PREFIX}${subject.trim().toLocaleLowerCase("tr")}`;
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

function isBoardPosition(value: unknown): value is BoardPosition {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as { readonly x?: unknown; readonly y?: unknown };
  return typeof candidate.x === "number" && typeof candidate.y === "number";
}

function loadStoredPositions(subject: string): Readonly<Record<string, BoardPosition>> {
  try {
    const stored = window.localStorage.getItem(createPositionStorageKey(subject));
    if (stored === null) {
      return {};
    }
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }

    const result: Record<string, BoardPosition> = {};
    const record = parsed as Record<string, unknown>;
    Object.keys(record).forEach((id) => {
      const value = record[id];
      if (isBoardPosition(value)) {
        result[id] = value;
      }
    });
    return result;
  } catch {
    return {};
  }
}

function saveStoredPositions(subject: string, positions: ReadonlyMap<string, BoardPosition>): void {
  try {
    const serialized = Object.fromEntries(positions.entries());
    window.localStorage.setItem(createPositionStorageKey(subject), JSON.stringify(serialized));
  } catch {
    // The board remains fully usable when storage is unavailable.
  }
}

function createBoardHeight(pinCount: number): number {
  const rows = Math.max(1, Math.ceil(pinCount / 3));
  return Math.max(BOARD_MIN_HEIGHT, 128 + rows * BOARD_ROW_STEP);
}

function createPinAliases(pin: PatternBoardPin): readonly string[] {
  const normalizedId = normalizeBoardNodeId(pin.id);
  return normalizedId === pin.id ? [pin.id] : [pin.id, normalizedId];
}

function createBoardString(
  connection: PatternConnection,
  onSelect: (connectionId: string) => void
): SVGPathElement {
  const path = document.createElementNS(SVG_NAMESPACE, "path");
  path.classList.add("pattern-room-board-string", connection.scope);
  path.dataset["patternBoardConnection"] = connection.id;
  path.dataset["patternBoardConnectionScope"] = connection.scope;
  path.dataset["patternBoardConnectionType"] = connection.edgeType;
  path.setAttribute("fill", "none");
  path.setAttribute("tabindex", "0");
  path.setAttribute("role", "button");
  path.setAttribute(
    "aria-label",
    `${connection.sourceLabel} → ${connection.edgeTypeLabel} → ${connection.targetLabel}`
  );

  const title = document.createElementNS(SVG_NAMESPACE, "title");
  title.textContent = `${connection.sourceLabel} → ${connection.edgeTypeLabel} → ${connection.targetLabel}`;
  path.append(title);

  const select = (): void => {
    onSelect(connection.id);
  };
  path.addEventListener("click", (event) => {
    event.stopPropagation();
    select();
  });
  path.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      select();
    }
  });
  return path;
}

function updateStringPath(
  path: SVGPathElement,
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
  const length = Math.max(Math.hypot(deltaX, deltaY), 1);
  const normalX = -deltaY / length;
  const normalY = deltaX / length;
  const bend = ((index % 3) - 1) * 18 + Math.min(38, length * 0.045);
  const controlX = (sourceX + targetX) / 2 + normalX * bend;
  const controlY = (sourceY + targetY) / 2 + normalY * bend;
  path.setAttribute(
    "d",
    `M ${String(sourceX)} ${String(sourceY)} Q ${String(controlX)} ${String(controlY)} ${String(
      targetX
    )} ${String(targetY)}`
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
      "Kartları sürükle. İplere tıklayarak bağlantıyı incele."
    )
  );
  const headerMetrics = createElement("div", "pattern-room-detective-board-metrics");
  headerMetrics.append(
    createElement("span", undefined, `${String(allPins.length)} kart`),
    createElement("span", undefined, `${String(data.connections.length)} bağlantı`)
  );
  canvasHeader.append(headerCopy, headerMetrics);

  const viewport = createElement("div", "pattern-room-detective-board-viewport");
  viewport.tabIndex = 0;
  viewport.ariaLabel = "Kaydırılabilir soruşturma panosu";
  const scene = createElement("div", "pattern-room-board-scene pattern-room-detective-board-scene");
  scene.setAttribute("style", `width:${String(BOARD_WIDTH)}px;height:${String(boardHeight)}px;`);

  const stringLayer = document.createElementNS(SVG_NAMESPACE, "svg");
  stringLayer.classList.add("pattern-room-board-string-layer");
  stringLayer.setAttribute("viewBox", `0 0 ${String(BOARD_WIDTH)} ${String(boardHeight)}`);
  stringLayer.setAttribute("aria-label", "Pano bağlantıları");

  const cardsLayer = createElement("div", "pattern-room-board-card-layer");
  const storedPositions = loadStoredPositions(data.subject);
  const positions = new Map<string, BoardPosition>();
  const cardsById = new Map<string, HTMLButtonElement>();
  const pinByAlias = new Map<string, PatternBoardPin>();
  const connectionPaths = new Map<string, SVGPathElement>();

  allPins.forEach(({ pin }, index) => {
    const initial = storedPositions[pin.id] ?? createInitialPosition(index);
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

  const updateSelectedCard = (pinId: string | null): void => {
    cardsById.forEach((card, id) => {
      const isSelected = id === pinId;
      card.dataset["patternBoardPinSelected"] = isSelected ? "true" : "false";
      card.ariaPressed = isSelected ? "true" : "false";
      card.classList.toggle("selected", isSelected);
    });
  };

  const updateSelectedConnection = (connectionId: string | null): void => {
    connectionPaths.forEach((path, id) => {
      const isSelected = id === connectionId;
      path.dataset["patternBoardConnectionSelected"] = isSelected ? "true" : "false";
      path.classList.toggle("selected", isSelected);
    });
  };

  const redrawConnections = (): void => {
    data.connections.forEach((connection, index) => {
      const path = connectionPaths.get(connection.id);
      const sourcePin = resolvePin(connection.sourceId);
      const targetPin = resolvePin(connection.targetId);
      if (path === undefined || sourcePin === undefined || targetPin === undefined) {
        return;
      }
      const sourcePosition = positions.get(sourcePin.id);
      const targetPosition = positions.get(targetPin.id);
      if (sourcePosition === undefined || targetPosition === undefined) {
        return;
      }
      updateStringPath(path, sourcePosition, targetPosition, index);
    });
  };

  data.connections.forEach((connection) => {
    const sourcePin = resolvePin(connection.sourceId);
    const targetPin = resolvePin(connection.targetId);
    if (sourcePin === undefined || targetPin === undefined || sourcePin.id === targetPin.id) {
      return;
    }
    const path = createBoardString(connection, (connectionId) => {
      actions.selectConnection(connectionId);
      updateSelectedConnection(connectionId);
    });
    connectionPaths.set(connection.id, path);
    stringLayer.append(path);
  });

  let redrawFrame: number | null = null;
  const scheduleRedraw = (): void => {
    if (redrawFrame !== null) {
      return;
    }
    redrawFrame = window.requestAnimationFrame(() => {
      redrawFrame = null;
      redrawConnections();
    });
  };

  allPins.forEach(({ category, pin }, index) => {
    const position = positions.get(pin.id) ?? createInitialPosition(index);
    const card = createElement(
      "button",
      `pattern-room-board-node pattern-room-detective-note ${category.tone}`
    );
    card.type = "button";
    card.dataset["patternBoardPin"] = pin.id;
    card.dataset["patternBoardPinKind"] = pin.kind;
    card.dataset["patternBoardTone"] = category.tone;
    card.dataset["patternBoardPinSelected"] = "false";
    card.ariaPressed = "false";
    card.style.left = `${String(position.x)}px`;
    card.style.top = `${String(position.y)}px`;
    card.style.setProperty("--pattern-note-tilt", `${String(((index % 5) - 2) * 0.45)}deg`);

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
      actions.selectNode(pin.id);
      updateSelectedCard(pin.id);
    });

    card.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) {
        return;
      }
      const start = positions.get(pin.id) ?? position;
      const startClientX = event.clientX;
      const startClientY = event.clientY;
      moved = false;
      card.classList.add("dragging");
      card.setPointerCapture(event.pointerId);

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
        card.style.left = `${String(nextPosition.x)}px`;
        card.style.top = `${String(nextPosition.y)}px`;
        scheduleRedraw();
      };

      const finishDrag = (): void => {
        card.classList.remove("dragging");
        card.removeEventListener("pointermove", onPointerMove);
        card.removeEventListener("pointerup", finishDrag);
        card.removeEventListener("pointercancel", finishDrag);
        saveStoredPositions(data.subject, positions);
      };

      card.addEventListener("pointermove", onPointerMove);
      card.addEventListener("pointerup", finishDrag);
      card.addEventListener("pointercancel", finishDrag);
    });

    cardsById.set(pin.id, card);
    cardsLayer.append(card);
  });

  if (allPins.length === 0) {
    scene.append(
      createEmptyState(
        "Panoya iliştirilmiş kayıt yok. Arşivden bir kaynak veya kanıt ekle.",
        "data-empty"
      )
    );
  }

  redrawConnections();
  updateSelectedCard(actions.getSelectedNodeId());
  updateSelectedConnection(actions.getSelectedConnectionId());
  scene.append(stringLayer, cardsLayer);
  viewport.append(scene);
  canvas.append(canvasHeader, viewport);
  workspace.append(canvas);
  shell.append(workspace);
  return shell;
}
