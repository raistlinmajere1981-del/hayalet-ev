(function(global) {
  function getFactoryRegistry(host) {
    return host.GameRoomUiFactories || (host.GameRoomUiFactories = {});
  }
  function isRecord(value) {
    return typeof value === "object" && value !== null && Array.isArray(value) === false;
  }
  function readBoardOptions(options) {
    return options || {};
  }
  function readSlotNickname(slotValue, fallbackLabel) {
    if (isRecord(slotValue) && typeof slotValue["nickname"] === "string" && slotValue["nickname"].trim() !== "") {
      return slotValue["nickname"];
    }
    return fallbackLabel;
  }
  const registry = getFactoryRegistry(global);
  registry.createTeamTetrisUiModuleCardRuntime = function createTeamTetrisUiModuleCardRuntime(deps) {
    const getState = deps.getState;
    const createSlot = deps.createSlot;
    const createElement = deps.createElement;
    const text = deps.text;
    const getTeamTetrisRotationCells = deps.getTeamTetrisRotationCells;
    const getTeamTetrisPieceBounds = deps.getTeamTetrisPieceBounds;
    const sanitizeTeamTetrisRows = deps.sanitizeTeamTetrisRows;
    const startTeamTetrisDrag = deps.startTeamTetrisDrag;
    const updateTeamTetrisDraftTarget = deps.updateTeamTetrisDraftTarget;
    const finishTeamTetrisDrag = deps.finishTeamTetrisDrag;
    const onTeamTetrisBoardColumnSelect = deps.onTeamTetrisBoardColumnSelect;
    const onTeamTetrisBendRowSelect = deps.onTeamTetrisBendRowSelect;
    function createTeamTetrisMiniPiece(pieceId, rotation) {
      const cells = getTeamTetrisRotationCells(pieceId, rotation);
      const bounds = getTeamTetrisPieceBounds(pieceId, rotation);
      const shell = createElement("div", "tt-piece-mini", "");
      shell.style.gridTemplateColumns = "repeat(" + Math.max(bounds.width, 1) + ", var(--tt-mini-cell-size, 0.68rem))";
      shell.dataset["piece"] = pieceId;
      for (let y = 0; y < Math.max(bounds.height, 1); y += 1) {
        for (let x = 0; x < Math.max(bounds.width, 1); x += 1) {
          const filled = cells.some(function(cell2) {
            return cell2[0] === x && cell2[1] === y;
          });
          const cell = createElement("div", "tt-piece-mini__cell", "");
          cell.dataset["filled"] = filled ? "true" : "false";
          cell.dataset["piece"] = pieceId;
          shell.append(cell);
        }
      }
      return shell;
    }
    function createTeamTetrisRequirementCard(slotId, ready) {
      const state = getState();
      const slotValue = state.context.slots?.[slotId] ?? createSlot(slotId);
      const fallbackLabel = slotId.toUpperCase();
      const displayName = readSlotNickname(slotValue, fallbackLabel);
      const card = createElement("div", "tt-requirement", "");
      card.dataset["ready"] = ready ? "true" : "false";
      card.append(
        createElement("span", "tt-requirement__slot", fallbackLabel),
        createElement("strong", "tt-requirement__name", displayName),
        createElement(
          "span",
          "tt-requirement__status",
          ready ? text(["teamTetris", "controls", "requirementReady"]) : text(["teamTetris", "controls", "requirementWaiting"])
        )
      );
      return card;
    }
    function createTeamTetrisMetric(label, value) {
      const item = createElement("div", "tt-scorebar__item", "");
      item.append(
        createElement("span", "tt-scorebar__label", label),
        createElement("strong", "tt-scorebar__value", value)
      );
      return item;
    }
    function createTeamTetrisBoardElement(rows, options) {
      const state = getState();
      const config = readBoardOptions(options);
      const boardRows = sanitizeTeamTetrisRows(rows);
      const overlayLookup = {};
      const pathLookup = {};
      const pathTurnKey = config.pathTurnCell ? config.pathTurnCell.x + ":" + config.pathTurnCell.y : null;
      const overlayCells = config.overlayCells || [];
      const pathCells = config.pathCells || [];
      const board = createElement("div", "tt-board", "");
      overlayCells.forEach(function(cell) {
        overlayLookup[cell.x + ":" + cell.y] = true;
      });
      pathCells.forEach(function(cell) {
        pathLookup[cell.x + ":" + cell.y] = config.pathTone || "trace-valid";
      });
      board.style.gridTemplateColumns = "repeat(" + state.teamTetris.board.width + ", minmax(0, 1fr))";
      const boardMode = config.boardInteractionMode || "";
      const isBoardInteractive = config.interactive === true || boardMode === "positioning" || boardMode === "route-row-picker";
      if (isBoardInteractive) {
        board.dataset["interactive"] = "true";
        board.dataset["boardMode"] = boardMode;
      }
      boardRows.forEach(function(row, rowIndex) {
        row.split("").forEach(function(cellValue, columnIndex) {
          const cell = createElement(isBoardInteractive ? "button" : "div", "tt-board__cell", "");
          if (boardMode === "positioning") {
            const interactiveCell = cell;
            interactiveCell.type = "button";
            interactiveCell.addEventListener("click", function() {
              onTeamTetrisBoardColumnSelect(columnIndex);
            });
          } else if (boardMode === "route-row-picker") {
            const interactiveCell = cell;
            interactiveCell.type = "button";
            interactiveCell.addEventListener("click", function() {
              onTeamTetrisBendRowSelect(rowIndex);
            });
          } else if (config.interactive === true) {
            const interactiveCell = cell;
            interactiveCell.type = "button";
            interactiveCell.addEventListener("mousedown", function() {
              startTeamTetrisDrag(columnIndex, rowIndex);
            });
            interactiveCell.addEventListener("mouseenter", function() {
              if (getState().teamTetrisDraft.dragActive === true) {
                updateTeamTetrisDraftTarget(columnIndex, rowIndex);
              }
            });
            interactiveCell.addEventListener("mouseup", function() {
              finishTeamTetrisDrag();
            });
            interactiveCell.addEventListener("click", function() {
              startTeamTetrisDrag(columnIndex, rowIndex);
              finishTeamTetrisDrag();
            });
          }
          cell.dataset["filled"] = cellValue !== "." ? "true" : "false";
          cell.dataset["piece"] = cellValue !== "." ? cellValue : "";
          const pathTone = pathLookup[columnIndex + ":" + rowIndex];
          if (pathTone) {
            cell.dataset["path"] = pathTone;
          }
          if (pathTurnKey === columnIndex + ":" + rowIndex) {
            cell.dataset["pathTurn"] = config.pathTurnTone || "trace-valid-turn";
          }
          if (overlayLookup[columnIndex + ":" + rowIndex]) {
            cell.dataset["overlay"] = config.overlayTone || "draft";
            cell.dataset["overlayPiece"] = config.overlayPieceId || "";
          }
          board.append(cell);
        });
      });
      return board;
    }
    function createTeamTetrisPieceCard(title, pieceId, rotation, subtitle) {
      const card = createElement("section", "tt-context-card tt-context-card--piece", "");
      card.append(createElement("span", "tt-context-card__label", title));
      if (pieceId && pieceId.trim() !== "") {
        const showcase = createElement("div", "tt-piece-showcase", "");
        const metaRow = createElement("div", "tt-piece-meta-row", "");
        const pieceBadge = createElement("span", "tt-piece-badge", pieceId);
        const rotationBadge = createElement(
          "span",
          "tt-piece-badge",
          text(["teamTetris", "controls", "rotationShort"]) + " " + String(rotation)
        );
        pieceBadge.dataset["piece"] = pieceId;
        rotationBadge.dataset["tone"] = "rotation";
        showcase.dataset["piece"] = pieceId;
        metaRow.append(pieceBadge, rotationBadge);
        showcase.append(createTeamTetrisMiniPiece(pieceId, rotation), metaRow);
        card.append(showcase);
      } else {
        card.append(
          createElement("p", "tt-context-card__empty", text(["teamTetris", "boards", "emptyPiece"]))
        );
      }
      if (subtitle && subtitle.trim() !== "") {
        card.append(createElement("p", "tt-context-card__hint", subtitle));
      }
      return card;
    }
    function createTeamTetrisSnapshotCard(title, rows) {
      const card = createElement("section", "tt-context-card", "");
      card.append(
        createElement("span", "tt-context-card__label", title),
        createTeamTetrisBoardElement(rows, {})
      );
      return card;
    }
    function renderTeamTetrisBoardCard(boardState, options) {
      const config = readBoardOptions(options);
      const card = createElement("section", "tt-board-card", "");
      if (config.tone) {
        card.dataset["tone"] = config.tone;
      }
      const header = createElement("div", "tt-board-card__header", "");
      header.append(
        createElement("strong", "tt-board-card__title", boardState.label),
        createElement(
          "span",
          "tt-board-card__meta",
          config.meta && config.meta.trim() !== "" ? config.meta : boardState.visibility === "public" ? text(["teamTetris", "boards", "publicBoard"]) : text(["teamTetris", "boards", "privateBoard"])
        )
      );
      const boardShell = createElement("div", "tt-board-card__board", "");
      boardShell.append(
        createTeamTetrisBoardElement(boardState.rows, {
          interactive: config.interactive === true,
          overlayCells: config.overlayCells || [],
          overlayTone: config.overlayTone || "draft",
          overlayPieceId: config.overlayPieceId || "",
          pathCells: config.pathCells || [],
          pathTone: config.pathTone || "trace-valid",
          pathTurnCell: config.pathTurnCell || null,
          pathTurnTone: config.pathTurnTone || "trace-valid-turn"
        })
      );
      card.append(header, boardShell);
      if (config.context && config.context.length > 0) {
        const details = createElement("div", "tt-board-card__details", "");
        config.context.forEach(function(entry) {
          details.append(entry);
        });
        card.append(details);
      }
      return card;
    }
    return {
      createTeamTetrisMetric,
      createTeamTetrisPieceCard,
      createTeamTetrisRequirementCard,
      createTeamTetrisSnapshotCard,
      renderTeamTetrisBoardCard
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
