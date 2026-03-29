(function (global) {
  const registry = global.GameRoomUiFactories || (global.GameRoomUiFactories = {});

  registry.createTeamTetrisUiModuleCardRuntime =
    function createTeamTetrisUiModuleCardRuntime(deps) {
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

      function createTeamTetrisMiniPiece(pieceId, rotation) {
        const cells = getTeamTetrisRotationCells(pieceId, rotation);
        const bounds = getTeamTetrisPieceBounds(pieceId, rotation);
        const shell = createElement("div", "tt-piece-mini", "");
        shell.style.gridTemplateColumns =
          "repeat(" + Math.max(bounds.width, 1) + ", minmax(0, 1fr))";

        for (let y = 0; y < Math.max(bounds.height, 1); y += 1) {
          for (let x = 0; x < Math.max(bounds.width, 1); x += 1) {
            const filled = cells.some(function (cell) {
              return cell[0] === x && cell[1] === y;
            });
            const cell = createElement("div", "tt-piece-mini__cell", "");
            cell.dataset.filled = filled ? "true" : "false";
            cell.dataset.piece = pieceId;
            shell.append(cell);
          }
        }

        return shell;
      }

      function createTeamTetrisRequirementCard(slotId, ready) {
        const state = getState();
        const slot = state.context.slots[slotId] || createSlot(slotId);
        const card = createElement("div", "tt-requirement", "");
        card.dataset.ready = ready ? "true" : "false";
        card.append(
          createElement("span", "tt-requirement__slot", slotId.toUpperCase()),
          createElement("strong", "tt-requirement__name", slot.nickname),
          createElement(
            "span",
            "tt-requirement__status",
            ready
              ? text(["teamTetris", "controls", "requirementReady"])
              : text(["teamTetris", "controls", "requirementWaiting"])
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
        const config =
          options && typeof options === "object" && Array.isArray(options) === false ? options : {};
        const boardRows = sanitizeTeamTetrisRows(rows);
        const overlayLookup = {};
        (Array.isArray(config.overlayCells) ? config.overlayCells : []).forEach(function (cell) {
          overlayLookup[cell.x + ":" + cell.y] = true;
        });
        const board = createElement("div", "tt-board", "");
        board.style.gridTemplateColumns =
          "repeat(" + state.teamTetris.board.width + ", minmax(0, 1fr))";
        if (config.interactive === true) {
          board.dataset.interactive = "true";
        }

        boardRows.forEach(function (row, rowIndex) {
          row.split("").forEach(function (cellValue, columnIndex) {
            const cell = createElement(
              config.interactive === true ? "button" : "div",
              "tt-board__cell",
              ""
            );
            if (config.interactive === true) {
              cell.type = "button";
              cell.addEventListener("mousedown", function () {
                startTeamTetrisDrag(columnIndex, rowIndex);
              });
              cell.addEventListener("mouseenter", function () {
                const currentState = getState();
                if (currentState.teamTetrisDraft.dragActive === true) {
                  updateTeamTetrisDraftTarget(columnIndex, rowIndex);
                }
              });
              cell.addEventListener("mouseup", function () {
                finishTeamTetrisDrag();
              });
              cell.addEventListener("click", function () {
                startTeamTetrisDrag(columnIndex, rowIndex);
                finishTeamTetrisDrag();
              });
            }
            cell.dataset.filled = cellValue !== "." ? "true" : "false";
            cell.dataset.piece = cellValue !== "." ? cellValue : "";
            if (overlayLookup[columnIndex + ":" + rowIndex]) {
              cell.dataset.overlay = config.overlayTone || "draft";
              cell.dataset.overlayPiece = config.overlayPieceId || "";
            }
            board.append(cell);
          });
        });

        return board;
      }

      function createTeamTetrisPieceCard(title, pieceId, rotation, subtitle) {
        const card = createElement("section", "tt-context-card", "");
        card.append(createElement("span", "tt-context-card__label", title));
        if (pieceId && pieceId.trim() !== "") {
          card.append(createTeamTetrisMiniPiece(pieceId, rotation));
          card.append(
            createElement(
              "p",
              "tt-context-card__meta",
              pieceId +
                " / " +
                text(["teamTetris", "controls", "rotationShort"]) +
                " " +
                String(rotation)
            )
          );
        } else {
          card.append(
            createElement(
              "p",
              "tt-context-card__empty",
              text(["teamTetris", "boards", "emptyPiece"])
            )
          );
        }
        if (subtitle && subtitle.trim() !== "") {
          card.append(createElement("p", "tt-context-card__meta", subtitle));
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
        const config =
          options && typeof options === "object" && Array.isArray(options) === false ? options : {};
        const card = createElement("section", "tt-board-card", "");
        if (config.tone) {
          card.dataset.tone = config.tone;
        }
        const header = createElement("div", "tt-board-card__header", "");
        header.append(
          createElement("strong", "tt-board-card__title", boardState.label),
          createElement(
            "span",
            "tt-board-card__meta",
            config.meta && config.meta.trim() !== ""
              ? config.meta
              : boardState.visibility === "public"
                ? text(["teamTetris", "boards", "publicBoard"])
                : text(["teamTetris", "boards", "privateBoard"])
          )
        );

        const boardShell = createElement("div", "tt-board-card__board", "");
        boardShell.append(
          createTeamTetrisBoardElement(boardState.rows, {
            interactive: config.interactive === true,
            overlayCells: config.overlayCells || [],
            overlayTone: config.overlayTone || "draft",
            overlayPieceId: config.overlayPieceId || "",
          })
        );

        card.append(header, boardShell);

        if (config.context && config.context.length > 0) {
          const details = createElement("div", "tt-board-card__details", "");
          config.context.forEach(function (entry) {
            details.append(entry);
          });
          card.append(details);
        }

        return card;
      }

      return {
        createTeamTetrisMetric: createTeamTetrisMetric,
        createTeamTetrisPieceCard: createTeamTetrisPieceCard,
        createTeamTetrisRequirementCard: createTeamTetrisRequirementCard,
        createTeamTetrisSnapshotCard: createTeamTetrisSnapshotCard,
        renderTeamTetrisBoardCard: renderTeamTetrisBoardCard,
      };
    };
})(typeof window !== "undefined" ? window : globalThis);
