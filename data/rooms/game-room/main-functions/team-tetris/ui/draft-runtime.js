(function(global) {
  function getFactoryRegistry(host) {
    return host.GameRoomUiFactories || (host.GameRoomUiFactories = {});
  }
  const registry = getFactoryRegistry(global);
  registry.createTeamTetrisUiDraftRuntime = function createTeamTetrisUiDraftRuntime(deps) {
    const createTeamTetrisDraft = deps.createTeamTetrisDraft;
    const getState = deps.getState;
    const render = deps.render;
    const sendRoomCommand = deps.sendRoomCommand;
    const sanitizeTeamTetrisRows = deps.sanitizeTeamTetrisRows;
    const getTeamTetrisOwnBoardState = deps.getTeamTetrisOwnBoardState;
    const getTeamTetrisPendingTurn = deps.getTeamTetrisPendingTurn;
    const BOARD_WIDTH = 10;
    const BOARD_HEIGHT = 20;
    const PIECES = {
      I: [
        [
          [0, 0],
          [1, 0],
          [2, 0],
          [3, 0]
        ],
        [
          [0, 0],
          [0, 1],
          [0, 2],
          [0, 3]
        ]
      ],
      O: [
        [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1]
        ]
      ],
      T: [
        [
          [1, 0],
          [0, 1],
          [1, 1],
          [2, 1]
        ],
        [
          [0, 0],
          [0, 1],
          [1, 1],
          [0, 2]
        ],
        [
          [0, 0],
          [1, 0],
          [2, 0],
          [1, 1]
        ],
        [
          [1, 0],
          [0, 1],
          [1, 1],
          [1, 2]
        ]
      ],
      S: [
        [
          [1, 0],
          [2, 0],
          [0, 1],
          [1, 1]
        ],
        [
          [0, 0],
          [0, 1],
          [1, 1],
          [1, 2]
        ]
      ],
      Z: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [2, 1]
        ],
        [
          [1, 0],
          [0, 1],
          [1, 1],
          [0, 2]
        ]
      ],
      J: [
        [
          [0, 0],
          [0, 1],
          [1, 1],
          [2, 1]
        ],
        [
          [0, 0],
          [1, 0],
          [0, 1],
          [0, 2]
        ],
        [
          [0, 0],
          [1, 0],
          [2, 0],
          [2, 1]
        ],
        [
          [1, 0],
          [1, 1],
          [0, 2],
          [1, 2]
        ]
      ],
      L: [
        [
          [2, 0],
          [0, 1],
          [1, 1],
          [2, 1]
        ],
        [
          [0, 0],
          [0, 1],
          [0, 2],
          [1, 2]
        ],
        [
          [0, 0],
          [1, 0],
          [2, 0],
          [0, 1]
        ],
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [1, 2]
        ]
      ]
    };
    function getTeamTetrisRotationCells(pieceId, rotation) {
      const rotations = PIECES[pieceId];
      if (!Array.isArray(rotations) || rotations.length === 0) {
        return [];
      }
      const rotationCells = rotations[rotation];
      return Array.isArray(rotationCells) ? rotationCells : rotations[0] || [];
    }
    function getTeamTetrisLegalRotations(pieceId) {
      const rotations = PIECES[pieceId];
      return !Array.isArray(rotations) || rotations.length === 0 ? [0] : rotations.map(function(_entry, index) {
        return index;
      });
    }
    function getTeamTetrisPieceBounds(pieceId, rotation) {
      const cells = getTeamTetrisRotationCells(pieceId, rotation);
      if (cells.length === 0) {
        return { width: 0, height: 0 };
      }
      let maxX = 0;
      let maxY = 0;
      cells.forEach(function(cell) {
        maxX = Math.max(maxX, cell[0]);
        maxY = Math.max(maxY, cell[1]);
      });
      return { width: maxX + 1, height: maxY + 1 };
    }
    function clampNumber(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }
    function getTeamTetrisSpawnPosition(pieceId, rotation) {
      const bounds = getTeamTetrisPieceBounds(pieceId, rotation);
      return {
        x: Math.max(0, Math.floor((BOARD_WIDTH - bounds.width) / 2)),
        y: 0
      };
    }
    function buildTeamTetrisMatrix(rows) {
      return sanitizeTeamTetrisRows(rows).map(function(row) {
        return row.split("").map(function(value) {
          return value === "." ? "" : value;
        });
      });
    }
    function getTeamTetrisPlacedCells(pieceId, rotation, originX, originY) {
      return getTeamTetrisRotationCells(pieceId, rotation).map(function(cell) {
        return {
          x: originX + cell[0],
          y: originY + cell[1]
        };
      });
    }
    function doesTeamTetrisPieceCollide(rows, pieceId, rotation, originX, originY) {
      const matrix = buildTeamTetrisMatrix(rows);
      const cells = getTeamTetrisPlacedCells(pieceId, rotation, originX, originY);
      if (cells.length === 0) {
        return true;
      }
      return cells.some(function(cell) {
        if (cell.x < 0 || cell.x >= BOARD_WIDTH || cell.y < 0 || cell.y >= BOARD_HEIGHT) {
          return true;
        }
        const row = matrix[cell.y];
        return !row || row[cell.x] !== "";
      });
    }
    function pushUniqueTeamTetrisPathCell(pathCells, pieceId, rotation, originX, originY) {
      const bounds = getTeamTetrisPieceBounds(pieceId, rotation);
      const traceCell = {
        x: clampNumber(
          originX + Math.floor((Math.max(bounds.width, 1) - 1) / 2),
          0,
          BOARD_WIDTH - 1
        ),
        y: clampNumber(
          originY + Math.floor((Math.max(bounds.height, 1) - 1) / 2),
          0,
          BOARD_HEIGHT - 1
        )
      };
      const lastCell = pathCells[pathCells.length - 1];
      if (lastCell && lastCell.x === traceCell.x && lastCell.y === traceCell.y) {
        return;
      }
      pathCells.push(traceCell);
    }
    function buildSimplifiedTeamTetrisPathCells(pieceId, rotation, rowShifts, preview) {
      if (preview.success !== true) {
        return [];
      }
      const bounds = getTeamTetrisPieceBounds(pieceId, rotation);
      const spawn = getTeamTetrisSpawnPosition(pieceId, rotation);
      const centerOffsetX = Math.floor((Math.max(bounds.width, 1) - 1) / 2);
      const centerOffsetY = Math.floor((Math.max(bounds.height, 1) - 1) / 2);
      const finalCenterX = clampNumber(preview.x + centerOffsetX, 0, BOARD_WIDTH - 1);
      const finalCenterY = clampNumber(preview.y + centerOffsetY, 0, BOARD_HEIGHT - 1);
      const pathCells = [];
      const totalHorizontalIntent = rowShifts.reduce(function(sum, shift) {
        return sum + shift;
      }, 0);
      const spawnCenterX = clampNumber(spawn.x + centerOffsetX, 0, BOARD_WIDTH - 1);
      const horizontalDirection = totalHorizontalIntent !== 0 ? totalHorizontalIntent > 0 ? 1 : -1 : finalCenterX === spawnCenterX ? 0 : finalCenterX > spawnCenterX ? 1 : -1;
      for (let rowIndex = centerOffsetY; rowIndex <= finalCenterY; rowIndex += 1) {
        pathCells.push({
          x: finalCenterX,
          y: rowIndex
        });
      }
      if (horizontalDirection !== 0) {
        const branchX = clampNumber(finalCenterX - horizontalDirection, 0, BOARD_WIDTH - 1);
        const lastCell = pathCells[pathCells.length - 1] || null;
        if (!lastCell || lastCell.x !== branchX || lastCell.y !== finalCenterY) {
          pathCells.push({
            x: branchX,
            y: finalCenterY
          });
        }
      }
      return pathCells;
    }
    function replayTeamTetrisDraft(rows, pieceId, rotation, rowShifts) {
      const legalRotations = getTeamTetrisLegalRotations(pieceId);
      if (legalRotations.indexOf(rotation) === -1) {
        return { success: false, reason: "invalidRotation" };
      }
      if (!Array.isArray(rowShifts) || rowShifts.some(function(value) {
        return value !== -1 && value !== 0 && value !== 1;
      })) {
        return { success: false, reason: "invalidRowShifts" };
      }
      const spawn = getTeamTetrisSpawnPosition(pieceId, rotation);
      if (doesTeamTetrisPieceCollide(rows, pieceId, rotation, spawn.x, spawn.y)) {
        return { success: false, reason: "spawnCollision" };
      }
      let x = spawn.x;
      let y = spawn.y;
      const pathCells = [];
      pushUniqueTeamTetrisPathCell(pathCells, pieceId, rotation, x, y);
      for (let index = 0; index < rowShifts.length; index += 1) {
        const shift = rowShifts[index] ?? 0;
        if (shift !== 0) {
          if (doesTeamTetrisPieceCollide(rows, pieceId, rotation, x + shift, y)) {
            return {
              success: true,
              x,
              y,
              rotation,
              cells: getTeamTetrisPlacedCells(pieceId, rotation, x, y),
              pathCells,
              pathComplete: false,
              autoDropDistance: 0,
              blockedReason: "horizontalCollision",
              stepIndex: index
            };
          }
          x += shift;
        }
        if (doesTeamTetrisPieceCollide(rows, pieceId, rotation, x, y + 1)) {
          return {
            success: true,
            x,
            y,
            rotation,
            cells: getTeamTetrisPlacedCells(pieceId, rotation, x, y),
            pathCells,
            pathComplete: false,
            autoDropDistance: 0,
            blockedReason: "downwardCollision",
            stepIndex: index
          };
        }
        y += 1;
        pushUniqueTeamTetrisPathCell(pathCells, pieceId, rotation, x, y);
      }
      let autoDropDistance = 0;
      while (!doesTeamTetrisPieceCollide(rows, pieceId, rotation, x, y + 1)) {
        y += 1;
        autoDropDistance += 1;
        pushUniqueTeamTetrisPathCell(pathCells, pieceId, rotation, x, y);
      }
      return {
        success: true,
        x,
        y,
        rotation,
        cells: getTeamTetrisPlacedCells(pieceId, rotation, x, y),
        pathCells,
        pathComplete: true,
        autoDropDistance
      };
    }
    function getTeamTetrisOriginFromCell(pieceId, rotation, cellX) {
      const bounds = getTeamTetrisPieceBounds(pieceId, rotation);
      const maxOrigin = Math.max(0, BOARD_WIDTH - bounds.width);
      return clampNumber(cellX - Math.floor(bounds.width / 2), 0, maxOrigin);
    }
    function buildTeamTetrisRowShiftsFromTargets(pieceId, rotation, dragTargets) {
      const targetRows = Object.keys(dragTargets).map(function(key) {
        return Number.parseInt(key, 10);
      }).filter(function(value) {
        return Number.isInteger(value) && value >= 0;
      });
      if (targetRows.length === 0) {
        return [];
      }
      const maxTargetRow = Math.max.apply(null, targetRows);
      const spawn = getTeamTetrisSpawnPosition(pieceId, rotation);
      const rowShifts = [];
      let desiredX = spawn.x;
      let currentX = spawn.x;
      for (let rowIndex = 1; rowIndex <= maxTargetRow; rowIndex += 1) {
        if (Object.prototype.hasOwnProperty.call(dragTargets, String(rowIndex))) {
          const nextDesiredX = dragTargets[rowIndex];
          if (typeof nextDesiredX === "number") {
            desiredX = nextDesiredX;
          }
        }
        const shift = clampNumber(desiredX - currentX, -1, 1);
        rowShifts.push(shift);
        currentX += shift;
      }
      return rowShifts;
    }
    function refreshTeamTetrisDraftPreview() {
      const state = getState();
      const pendingTurn = getTeamTetrisPendingTurn();
      if (!pendingTurn) {
        state.teamTetrisDraft = createTeamTetrisDraft();
        return;
      }
      if (Object.keys(state.teamTetrisDraft.dragTargets).length === 0) {
        state.teamTetrisDraft.preview = null;
        state.teamTetrisDraft.errorKey = "";
        return;
      }
      const ownBoard = getTeamTetrisOwnBoardState();
      const preview = replayTeamTetrisDraft(
        ownBoard.rows,
        pendingTurn.pieceId,
        state.teamTetrisDraft.rotation,
        state.teamTetrisDraft.rowShifts
      );
      state.teamTetrisDraft.preview = preview.success === true ? Object.assign({}, preview, {
        pathCells: buildSimplifiedTeamTetrisPathCells(
          pendingTurn.pieceId,
          state.teamTetrisDraft.rotation,
          state.teamTetrisDraft.rowShifts,
          preview
        )
      }) : preview;
      state.teamTetrisDraft.errorKey = preview.success === true ? preview.pathComplete === true ? "" : preview.blockedReason || "" : preview.reason;
    }
    function getInitialRotation(pendingTurn) {
      const legalRotations = pendingTurn.legalRotations.length > 0 ? pendingTurn.legalRotations : [0];
      return legalRotations[0] ?? 0;
    }
    function syncTeamTetrisDraftFromState() {
      const state = getState();
      const pendingTurn = getTeamTetrisPendingTurn();
      if (!pendingTurn) {
        state.teamTetrisDraft = createTeamTetrisDraft();
        return;
      }
      const legalRotations = pendingTurn.legalRotations.length > 0 ? pendingTurn.legalRotations : [0];
      const initialRotation = getInitialRotation(pendingTurn);
      if (state.teamTetrisDraft.turnToken !== pendingTurn.turnToken) {
        const nextDraft = createTeamTetrisDraft();
        nextDraft.matchId = state.teamTetris.matchId || "";
        nextDraft.turnIndex = pendingTurn.turnIndex;
        nextDraft.turnToken = pendingTurn.turnToken;
        nextDraft.pieceId = pendingTurn.pieceId;
        nextDraft.rotation = initialRotation;
        state.teamTetrisDraft = nextDraft;
        refreshTeamTetrisDraftPreview();
        return;
      }
      if (legalRotations.indexOf(state.teamTetrisDraft.rotation) === -1) {
        state.teamTetrisDraft.rotation = initialRotation;
        state.teamTetrisDraft.dragTargets = {};
        state.teamTetrisDraft.rowShifts = [];
      }
      refreshTeamTetrisDraftPreview();
    }
    function clearTeamTetrisDraft() {
      const state = getState();
      const pendingTurn = getTeamTetrisPendingTurn();
      if (!pendingTurn) {
        state.teamTetrisDraft = createTeamTetrisDraft();
        return;
      }
      state.teamTetrisDraft.dragTargets = {};
      state.teamTetrisDraft.rowShifts = [];
      state.teamTetrisDraft.preview = null;
      state.teamTetrisDraft.errorKey = "";
      state.teamTetrisDraft.dragActive = false;
    }
    function onTeamTetrisRotate() {
      const state = getState();
      const pendingTurn = getTeamTetrisPendingTurn();
      if (!pendingTurn) {
        return;
      }
      const legalRotations = pendingTurn.legalRotations.length > 0 ? pendingTurn.legalRotations : [0];
      const currentIndex = legalRotations.indexOf(state.teamTetrisDraft.rotation);
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % legalRotations.length;
      state.teamTetrisDraft.rotation = legalRotations[nextIndex] ?? 0;
      clearTeamTetrisDraft();
      refreshTeamTetrisDraftPreview();
      render();
    }
    function onTeamTetrisRotationSelect(rotation) {
      const state = getState();
      const pendingTurn = getTeamTetrisPendingTurn();
      if (!pendingTurn || pendingTurn.legalRotations.indexOf(rotation) === -1) {
        return;
      }
      state.teamTetrisDraft.rotation = rotation;
      clearTeamTetrisDraft();
      refreshTeamTetrisDraftPreview();
      render();
    }
    function updateTeamTetrisDraftTarget(cellX, cellY) {
      const state = getState();
      const pendingTurn = getTeamTetrisPendingTurn();
      if (!pendingTurn) {
        return;
      }
      const nextTargets = Object.assign(
        {},
        state.teamTetrisDraft.dragTargets
      );
      const targetRow = clampNumber(cellY, 0, BOARD_HEIGHT - 1);
      nextTargets[targetRow] = getTeamTetrisOriginFromCell(
        pendingTurn.pieceId,
        state.teamTetrisDraft.rotation,
        cellX
      );
      state.teamTetrisDraft.dragTargets = nextTargets;
      state.teamTetrisDraft.rowShifts = buildTeamTetrisRowShiftsFromTargets(
        pendingTurn.pieceId,
        state.teamTetrisDraft.rotation,
        nextTargets
      );
      refreshTeamTetrisDraftPreview();
      render();
    }
    function startTeamTetrisDrag(cellX, cellY) {
      const state = getState();
      const pendingTurn = getTeamTetrisPendingTurn();
      if (!pendingTurn) {
        return;
      }
      state.teamTetrisDraft.dragActive = true;
      updateTeamTetrisDraftTarget(cellX, cellY);
    }
    function finishTeamTetrisDrag() {
      const state = getState();
      state.teamTetrisDraft.dragActive = false;
    }
    function onTeamTetrisClearDraft() {
      clearTeamTetrisDraft();
      render();
    }
    function onTeamTetrisSubmit() {
      const state = getState();
      const pendingTurn = getTeamTetrisPendingTurn();
      if (!pendingTurn || !state.teamTetrisDraft.preview) {
        return;
      }
      if (state.teamTetrisDraft.preview.success !== true || state.teamTetrisDraft.preview.pathComplete !== true) {
        return;
      }
      state.lastCommandMessage = "";
      sendRoomCommand("GameRoomTeamTetrisUserMove", {
        schemaVersion: 1,
        matchId: state.teamTetris.matchId,
        turnIndex: pendingTurn.turnIndex,
        turnToken: pendingTurn.turnToken,
        pieceId: pendingTurn.pieceId,
        rotation: state.teamTetrisDraft.rotation,
        rowShifts: state.teamTetrisDraft.rowShifts.slice()
      });
    }
    return {
      getTeamTetrisRotationCells,
      getTeamTetrisPieceBounds,
      getTeamTetrisSpawnPosition,
      replayTeamTetrisDraft,
      buildTeamTetrisRowShiftsFromTargets,
      getTeamTetrisOriginFromCell,
      syncTeamTetrisDraftFromState,
      startTeamTetrisDrag,
      updateTeamTetrisDraftTarget,
      finishTeamTetrisDrag,
      onTeamTetrisRotationSelect,
      onTeamTetrisRotate,
      onTeamTetrisClearDraft,
      onTeamTetrisSubmit
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
