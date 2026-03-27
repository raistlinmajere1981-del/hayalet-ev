(function (global) {
  const registry = global.GameRoomUiFactories || (global.GameRoomUiFactories = {});

  registry.createTeamTetrisUiModule = function createTeamTetrisUiModule(deps) {
    const getState = deps.getState;
    const featureId = deps.featureId;
    const createSlot = deps.createSlot;
    const createElement = deps.createElement;
    const text = deps.text;
    const render = deps.render;
    const sendRoomCommand = deps.sendRoomCommand;
    const getFeatureLabel = deps.getFeatureLabel;

    const BOARD_WIDTH = 10;
    const BOARD_HEIGHT = 20;
    const PIECES = {
      I: [
        [
          [0, 0],
          [1, 0],
          [2, 0],
          [3, 0],
        ],
        [
          [0, 0],
          [0, 1],
          [0, 2],
          [0, 3],
        ],
      ],
      O: [
        [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ],
      ],
      T: [
        [
          [1, 0],
          [0, 1],
          [1, 1],
          [2, 1],
        ],
        [
          [0, 0],
          [0, 1],
          [1, 1],
          [0, 2],
        ],
        [
          [0, 0],
          [1, 0],
          [2, 0],
          [1, 1],
        ],
        [
          [1, 0],
          [0, 1],
          [1, 1],
          [1, 2],
        ],
      ],
      S: [
        [
          [1, 0],
          [2, 0],
          [0, 1],
          [1, 1],
        ],
        [
          [0, 0],
          [0, 1],
          [1, 1],
          [1, 2],
        ],
      ],
      Z: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [2, 1],
        ],
        [
          [1, 0],
          [0, 1],
          [1, 1],
          [0, 2],
        ],
      ],
      J: [
        [
          [0, 0],
          [0, 1],
          [1, 1],
          [2, 1],
        ],
        [
          [0, 0],
          [1, 0],
          [0, 1],
          [0, 2],
        ],
        [
          [0, 0],
          [1, 0],
          [2, 0],
          [2, 1],
        ],
        [
          [1, 0],
          [1, 1],
          [0, 2],
          [1, 2],
        ],
      ],
      L: [
        [
          [2, 0],
          [0, 1],
          [1, 1],
          [2, 1],
        ],
        [
          [0, 0],
          [0, 1],
          [0, 2],
          [1, 2],
        ],
        [
          [0, 0],
          [1, 0],
          [2, 0],
          [0, 1],
        ],
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [1, 2],
        ],
      ],
    };

    function createTeamTetrisBoard(teamId, visibility) {
      return {
        teamId: teamId,
        visibility: visibility,
        rows: Array.from({ length: BOARD_HEIGHT }, function () {
          return ".".repeat(BOARD_WIDTH);
        }),
        boardBeforePartnerPieceRows: Array.from({ length: BOARD_HEIGHT }, function () {
          return ".".repeat(BOARD_WIDTH);
        }),
        partnerLastPiece: null,
      };
    }

    function createTeamTetrisDraft() {
      return {
        matchId: "",
        turnIndex: null,
        turnToken: "",
        pieceId: "",
        rotation: 0,
        rowShifts: [],
        dragTargets: {},
        preview: null,
        errorKey: "",
        dragActive: false,
      };
    }

    function createTeamTetrisState() {
      return {
        active: false,
        result: "idle",
        hiddenPairs: true,
        revealPairsOnFinish: true,
        blockedReason: "",
        matchId: null,
        canStart: false,
        requiredSlots: {
          ai1: false,
          ai2: false,
          us1: false,
        },
        board: {
          width: BOARD_WIDTH,
          height: BOARD_HEIGHT,
          seedLabel: "contract-frozen",
        },
        boards: [
          createTeamTetrisBoard("team-a", "private"),
          createTeamTetrisBoard("team-b", "public"),
        ],
        turnLoop: ["team-a-opener", "team-b-opener", "team-a-followup", "team-b-followup"],
        currentTurn: null,
        teams: null,
        userView: null,
        status: "",
      };
    }

    function sanitizeTeamTetrisRows(rows) {
      if (!Array.isArray(rows)) {
        return Array.from({ length: BOARD_HEIGHT }, function () {
          return ".".repeat(BOARD_WIDTH);
        });
      }

      const normalized = rows
        .filter(function (row) {
          return typeof row === "string" && row.length > 0;
        })
        .map(function (row) {
          const nextRow = row.slice(0, BOARD_WIDTH);
          if (nextRow.length >= BOARD_WIDTH) {
            return nextRow;
          }
          return nextRow + ".".repeat(BOARD_WIDTH - nextRow.length);
        })
        .slice(0, BOARD_HEIGHT);

      while (normalized.length < BOARD_HEIGHT) {
        normalized.push(".".repeat(BOARD_WIDTH));
      }

      return normalized;
    }

    function sanitizeTeamTetrisCells(value) {
      if (!Array.isArray(value)) {
        return [];
      }
      return value
        .filter(function (cell) {
          return (
            cell &&
            typeof cell === "object" &&
            Array.isArray(cell) === false &&
            typeof cell.x === "number" &&
            Number.isInteger(cell.x) &&
            typeof cell.y === "number" &&
            Number.isInteger(cell.y)
          );
        })
        .map(function (cell) {
          return { x: cell.x, y: cell.y };
        });
    }

    function sanitizeTeamTetrisPieceSnapshot(candidate) {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
        return null;
      }

      return {
        pieceId:
          typeof candidate.pieceId === "string" && candidate.pieceId.trim() !== ""
            ? candidate.pieceId.trim()
            : "",
        rotation:
          typeof candidate.rotation === "number" && Number.isInteger(candidate.rotation)
            ? candidate.rotation
            : 0,
        cells: sanitizeTeamTetrisCells(candidate.cells),
        placedBySeatId:
          typeof candidate.placedBySeatId === "string" && candidate.placedBySeatId.trim() !== ""
            ? candidate.placedBySeatId.trim()
            : "",
        placedByRole:
          typeof candidate.placedByRole === "string" && candidate.placedByRole.trim() !== ""
            ? candidate.placedByRole.trim()
            : "",
        placedBy:
          typeof candidate.placedBy === "string" && candidate.placedBy.trim() !== ""
            ? candidate.placedBy.trim()
            : "",
      };
    }

    function sanitizeTeamTetrisBoardState(candidate, fallbackTeamId, fallbackVisibility) {
      const source =
        candidate && typeof candidate === "object" && Array.isArray(candidate) === false
          ? candidate
          : {};
      return {
        teamId:
          typeof source.teamId === "string" && source.teamId.trim() !== ""
            ? source.teamId.trim()
            : fallbackTeamId,
        visibility:
          source.visibility === "public" || source.visibility === "private"
            ? source.visibility
            : fallbackVisibility,
        rows: sanitizeTeamTetrisRows(source.rows),
        boardBeforePartnerPieceRows: sanitizeTeamTetrisRows(source.boardBeforePartnerPieceRows),
        partnerLastPiece: sanitizeTeamTetrisPieceSnapshot(source.partnerLastPiece),
      };
    }

    function sanitizeTeamTetrisSeatView(candidate) {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
        return null;
      }

      const seatSource =
        candidate.seat &&
        typeof candidate.seat === "object" &&
        Array.isArray(candidate.seat) === false
          ? candidate.seat
          : {};
      const ownTeamSource =
        candidate.ownTeam &&
        typeof candidate.ownTeam === "object" &&
        Array.isArray(candidate.ownTeam) === false
          ? candidate.ownTeam
          : {};
      const opponentTeamSource =
        candidate.opponentTeam &&
        typeof candidate.opponentTeam === "object" &&
        Array.isArray(candidate.opponentTeam) === false
          ? candidate.opponentTeam
          : {};
      const pendingTurnSource =
        candidate.pendingTurn &&
        typeof candidate.pendingTurn === "object" &&
        Array.isArray(candidate.pendingTurn) === false
          ? candidate.pendingTurn
          : null;

      return {
        schemaVersion:
          typeof candidate.schemaVersion === "number" && Number.isInteger(candidate.schemaVersion)
            ? candidate.schemaVersion
            : 1,
        matchId:
          typeof candidate.matchId === "string" && candidate.matchId.trim() !== ""
            ? candidate.matchId.trim()
            : "",
        seat: {
          seatId:
            typeof seatSource.seatId === "string" && seatSource.seatId.trim() !== ""
              ? seatSource.seatId.trim()
              : "user",
          teamId:
            typeof seatSource.teamId === "string" && seatSource.teamId.trim() !== ""
              ? seatSource.teamId.trim()
              : "team-a",
          role:
            typeof seatSource.role === "string" && seatSource.role.trim() !== ""
              ? seatSource.role.trim()
              : "opener",
        },
        hiddenPairs: candidate.hiddenPairs !== false,
        revealedPairs: candidate.revealedPairs === true,
        result:
          typeof candidate.result === "string" && candidate.result.trim() !== ""
            ? candidate.result.trim()
            : "idle",
        winnerTeamId:
          typeof candidate.winnerTeamId === "string" && candidate.winnerTeamId.trim() !== ""
            ? candidate.winnerTeamId.trim()
            : null,
        teams: Array.isArray(candidate.teams)
          ? candidate.teams
              .map(function (entry) {
                const teamSource =
                  entry && typeof entry === "object" && Array.isArray(entry) === false ? entry : {};
                return {
                  teamId:
                    typeof teamSource.teamId === "string" && teamSource.teamId.trim() !== ""
                      ? teamSource.teamId.trim()
                      : "team-a",
                  seatIds: Array.isArray(teamSource.seatIds)
                    ? teamSource.seatIds.filter(function (seatId) {
                        return typeof seatId === "string" && seatId.trim() !== "";
                      })
                    : [],
                };
              })
              .slice(0, 2)
          : null,
        ownTeam: {
          teamId:
            typeof ownTeamSource.teamId === "string" && ownTeamSource.teamId.trim() !== ""
              ? ownTeamSource.teamId.trim()
              : "team-a",
          boardRows: sanitizeTeamTetrisRows(ownTeamSource.boardRows),
          boardBeforePartnerPieceRows: sanitizeTeamTetrisRows(
            ownTeamSource.boardBeforePartnerPieceRows
          ),
          partnerLastPiece: sanitizeTeamTetrisPieceSnapshot(ownTeamSource.partnerLastPiece),
        },
        opponentTeam: {
          teamId:
            typeof opponentTeamSource.teamId === "string" && opponentTeamSource.teamId.trim() !== ""
              ? opponentTeamSource.teamId.trim()
              : "team-b",
          boardRows: sanitizeTeamTetrisRows(opponentTeamSource.boardRows),
        },
        pendingTurn:
          pendingTurnSource !== null
            ? {
                turnIndex:
                  typeof pendingTurnSource.turnIndex === "number" &&
                  Number.isInteger(pendingTurnSource.turnIndex)
                    ? pendingTurnSource.turnIndex
                    : 0,
                turnToken:
                  typeof pendingTurnSource.turnToken === "string" &&
                  pendingTurnSource.turnToken.trim() !== ""
                    ? pendingTurnSource.turnToken.trim()
                    : "",
                pieceId:
                  typeof pendingTurnSource.pieceId === "string" &&
                  pendingTurnSource.pieceId.trim() !== ""
                    ? pendingTurnSource.pieceId.trim()
                    : "",
                legalRotations: Array.isArray(pendingTurnSource.legalRotations)
                  ? pendingTurnSource.legalRotations.filter(function (value) {
                      return typeof value === "number" && Number.isInteger(value);
                    })
                  : [0],
                actingRole:
                  typeof pendingTurnSource.actingRole === "string" &&
                  pendingTurnSource.actingRole.trim() !== ""
                    ? pendingTurnSource.actingRole.trim()
                    : "opener",
              }
            : null,
      };
    }

    function sanitizeTeamTetrisState(candidate) {
      const source =
        candidate && typeof candidate === "object" && Array.isArray(candidate) === false
          ? candidate
          : {};
      const next = createTeamTetrisState();
      next.active = source.active === true;
      next.result =
        typeof source.result === "string" && source.result.trim() !== ""
          ? source.result.trim()
          : "idle";
      next.hiddenPairs = source.hiddenPairs !== false;
      next.revealPairsOnFinish = source.revealPairsOnFinish !== false;
      next.blockedReason =
        typeof source.blockedReason === "string" && source.blockedReason.trim() !== ""
          ? source.blockedReason.trim()
          : "";
      next.matchId =
        typeof source.matchId === "string" && source.matchId.trim() !== ""
          ? source.matchId.trim()
          : null;
      next.canStart = source.canStart === true;
      if (
        source.requiredSlots &&
        typeof source.requiredSlots === "object" &&
        Array.isArray(source.requiredSlots) === false
      ) {
        next.requiredSlots = {
          ai1: source.requiredSlots.ai1 === true,
          ai2: source.requiredSlots.ai2 === true,
          us1: source.requiredSlots.us1 === true,
        };
      }
      if (source.board && typeof source.board === "object" && Array.isArray(source.board) === false) {
        next.board = {
          width:
            typeof source.board.width === "number" &&
            Number.isInteger(source.board.width) &&
            source.board.width > 0
              ? source.board.width
              : BOARD_WIDTH,
          height:
            typeof source.board.height === "number" &&
            Number.isInteger(source.board.height) &&
            source.board.height > 0
              ? source.board.height
              : BOARD_HEIGHT,
          seedLabel:
            typeof source.board.seedLabel === "string" && source.board.seedLabel.trim() !== ""
              ? source.board.seedLabel.trim()
              : "contract-frozen",
        };
      }
      if (Array.isArray(source.boards)) {
        next.boards = source.boards
          .map(function (entry, index) {
            return sanitizeTeamTetrisBoardState(
              entry,
              index === 0 ? "team-a" : "team-b",
              index === 0 ? "private" : "public"
            );
          })
          .slice(0, 2);
      }
      if (Array.isArray(source.turnLoop)) {
        next.turnLoop = source.turnLoop.filter(function (entry) {
          return typeof entry === "string" && entry.trim() !== "";
        });
      }
      next.currentTurn =
        source.currentTurn &&
        typeof source.currentTurn === "object" &&
        Array.isArray(source.currentTurn) === false
          ? {
              turnIndex:
                typeof source.currentTurn.turnIndex === "number" &&
                Number.isInteger(source.currentTurn.turnIndex)
                  ? source.currentTurn.turnIndex
                  : 0,
              seatId:
                typeof source.currentTurn.seatId === "string" &&
                source.currentTurn.seatId.trim() !== ""
                  ? source.currentTurn.seatId.trim()
                  : "",
              teamId:
                typeof source.currentTurn.teamId === "string" &&
                source.currentTurn.teamId.trim() !== ""
                  ? source.currentTurn.teamId.trim()
                  : "",
              role:
                typeof source.currentTurn.role === "string" && source.currentTurn.role.trim() !== ""
                  ? source.currentTurn.role.trim()
                  : "",
              pieceId:
                typeof source.currentTurn.pieceId === "string" &&
                source.currentTurn.pieceId.trim() !== ""
                  ? source.currentTurn.pieceId.trim()
                  : "",
              legalRotations: Array.isArray(source.currentTurn.legalRotations)
                ? source.currentTurn.legalRotations.filter(function (value) {
                    return typeof value === "number" && Number.isInteger(value);
                  })
                : [0],
              turnToken:
                typeof source.currentTurn.turnToken === "string" &&
                source.currentTurn.turnToken.trim() !== ""
                  ? source.currentTurn.turnToken.trim()
                  : "",
            }
          : null;
      next.teams = Array.isArray(source.teams)
        ? source.teams
            .map(function (entry) {
              const teamSource =
                entry && typeof entry === "object" && Array.isArray(entry) === false ? entry : {};
              return {
                teamId:
                  typeof teamSource.teamId === "string" && teamSource.teamId.trim() !== ""
                    ? teamSource.teamId.trim()
                    : "team-a",
                seatIds: Array.isArray(teamSource.seatIds)
                  ? teamSource.seatIds.filter(function (seatId) {
                      return typeof seatId === "string" && seatId.trim() !== "";
                    })
                  : [],
              };
            })
            .slice(0, 2)
        : null;
      next.userView = sanitizeTeamTetrisSeatView(source.userView);
      next.status =
        typeof source.status === "string" && source.status.trim() !== "" ? source.status.trim() : "";
      return next;
    }

    function syncTeamTetrisPreferencesFromState() {
      const state = getState();
      state.preferences.teamTetrisHiddenPairs = state.teamTetris.hiddenPairs !== false;
    }

    function getTeamTetrisView() {
      const state = getState();
      return state.teamTetris.userView && typeof state.teamTetris.userView === "object"
        ? state.teamTetris.userView
        : null;
    }

    function getTeamTetrisBoardLabel(teamId) {
      return teamId === "team-b"
        ? text(["teamTetris", "boards", "teamB"])
        : text(["teamTetris", "boards", "teamA"]);
    }

    function getTeamTetrisSeatDisplayLabel(seatId) {
      const state = getState();
      if (seatId === "user") {
        return text(["teamTetris", "turns", "you"]);
      }
      const slot = state.context.slots[seatId];
      if (slot && typeof slot.nickname === "string" && slot.nickname.trim() !== "") {
        return slot.nickname;
      }
      return typeof seatId === "string" && seatId.trim() !== "" ? seatId.toUpperCase() : "???";
    }

    function getTeamTetrisAnonymousSeatLabel(role) {
      return role === "followup"
        ? text(["teamTetris", "roster", "partnerFollowup"])
        : text(["teamTetris", "roster", "partnerOpener"]);
    }

    function getTeamTetrisPlacedByLabel(pieceSnapshot) {
      if (!pieceSnapshot) {
        return text(["teamTetris", "boards", "noPartnerPiece"]);
      }
      if (pieceSnapshot.placedBySeatId) {
        return getTeamTetrisSeatDisplayLabel(pieceSnapshot.placedBySeatId);
      }
      if (pieceSnapshot.placedByRole) {
        return getTeamTetrisAnonymousSeatLabel(pieceSnapshot.placedByRole);
      }
      if (pieceSnapshot.placedBy) {
        return pieceSnapshot.placedBy;
      }
      return text(["teamTetris", "roster", "partnerUnknown"]);
    }

    function getTeamTetrisPendingTurn() {
      const view = getTeamTetrisView();
      return view && view.pendingTurn ? view.pendingTurn : null;
    }

    function getTeamTetrisOwnBoardState() {
      const state = getState();
      const view = getTeamTetrisView();
      const board = state.teamTetris.boards[0] || createTeamTetrisBoard("team-a", "private");
      if (!view) {
        return {
          teamId: board.teamId,
          label: getTeamTetrisBoardLabel(board.teamId),
          visibility: board.visibility,
          rows: board.rows.slice(),
          boardBeforePartnerPieceRows: board.boardBeforePartnerPieceRows.slice(),
          partnerLastPiece: board.partnerLastPiece,
        };
      }
      return {
        teamId: view.ownTeam.teamId,
        label: getTeamTetrisBoardLabel(view.ownTeam.teamId),
        visibility: "private",
        rows: view.ownTeam.boardRows.slice(),
        boardBeforePartnerPieceRows: view.ownTeam.boardBeforePartnerPieceRows.slice(),
        partnerLastPiece: view.ownTeam.partnerLastPiece,
      };
    }

    function getTeamTetrisOpponentBoardState() {
      const state = getState();
      const view = getTeamTetrisView();
      const board = state.teamTetris.boards[1] || createTeamTetrisBoard("team-b", "public");
      if (!view) {
        return {
          teamId: board.teamId,
          label: getTeamTetrisBoardLabel(board.teamId),
          visibility: board.visibility,
          rows: board.rows.slice(),
          boardBeforePartnerPieceRows: board.boardBeforePartnerPieceRows.slice(),
          partnerLastPiece: board.partnerLastPiece,
        };
      }
      return {
        teamId: view.opponentTeam.teamId,
        label: getTeamTetrisBoardLabel(view.opponentTeam.teamId),
        visibility: "public",
        rows: view.opponentTeam.boardRows.slice(),
        boardBeforePartnerPieceRows: board.boardBeforePartnerPieceRows.slice(),
        partnerLastPiece: null,
      };
    }

    function getTeamTetrisRotationCells(pieceId, rotation) {
      const rotations = PIECES[pieceId];
      if (!Array.isArray(rotations) || rotations.length === 0) {
        return [];
      }
      return Array.isArray(rotations[rotation]) ? rotations[rotation] : rotations[0];
    }

    function getTeamTetrisLegalRotations(pieceId) {
      return getTeamTetrisRotationCells(pieceId, 0).length === 0
        ? [0]
        : PIECES[pieceId].map(function (_entry, index) {
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
      cells.forEach(function (cell) {
        maxX = Math.max(maxX, cell[0]);
        maxY = Math.max(maxY, cell[1]);
      });
      return {
        width: maxX + 1,
        height: maxY + 1,
      };
    }

    function clampNumber(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function getTeamTetrisSpawnPosition(pieceId, rotation) {
      const bounds = getTeamTetrisPieceBounds(pieceId, rotation);
      return {
        x: Math.max(0, Math.floor((BOARD_WIDTH - bounds.width) / 2)),
        y: 0,
      };
    }

    function buildTeamTetrisMatrix(rows) {
      return sanitizeTeamTetrisRows(rows).map(function (row) {
        return row.split("").map(function (value) {
          return value === "." ? "" : value;
        });
      });
    }

    function getTeamTetrisPlacedCells(pieceId, rotation, originX, originY) {
      return getTeamTetrisRotationCells(pieceId, rotation).map(function (cell) {
        return {
          x: originX + cell[0],
          y: originY + cell[1],
        };
      });
    }

    function doesTeamTetrisPieceCollide(rows, pieceId, rotation, originX, originY) {
      const matrix = buildTeamTetrisMatrix(rows);
      const cells = getTeamTetrisPlacedCells(pieceId, rotation, originX, originY);
      if (cells.length === 0) {
        return true;
      }

      return cells.some(function (cell) {
        if (cell.x < 0 || cell.x >= BOARD_WIDTH || cell.y < 0 || cell.y >= BOARD_HEIGHT) {
          return true;
        }
        return matrix[cell.y][cell.x] !== "";
      });
    }

    function replayTeamTetrisDraft(rows, pieceId, rotation, rowShifts) {
      const legalRotations = getTeamTetrisLegalRotations(pieceId);
      if (legalRotations.indexOf(rotation) === -1) {
        return { success: false, reason: "invalidRotation" };
      }

      if (
        !Array.isArray(rowShifts) ||
        rowShifts.some(function (value) {
          return value !== -1 && value !== 0 && value !== 1;
        })
      ) {
        return { success: false, reason: "invalidRowShifts" };
      }

      const spawn = getTeamTetrisSpawnPosition(pieceId, rotation);
      if (doesTeamTetrisPieceCollide(rows, pieceId, rotation, spawn.x, spawn.y)) {
        return { success: false, reason: "spawnCollision" };
      }

      let x = spawn.x;
      let y = spawn.y;

      for (let index = 0; index < rowShifts.length; index += 1) {
        const shift = rowShifts[index];
        if (shift !== 0) {
          if (doesTeamTetrisPieceCollide(rows, pieceId, rotation, x + shift, y)) {
            return { success: false, reason: "horizontalCollision", stepIndex: index };
          }
          x += shift;
        }

        if (doesTeamTetrisPieceCollide(rows, pieceId, rotation, x, y + 1)) {
          return { success: false, reason: "downwardCollision", stepIndex: index };
        }

        y += 1;
      }

      if (!doesTeamTetrisPieceCollide(rows, pieceId, rotation, x, y + 1)) {
        return { success: false, reason: "incompletePath" };
      }

      return {
        success: true,
        x: x,
        y: y,
        cells: getTeamTetrisPlacedCells(pieceId, rotation, x, y),
      };
    }

    function getTeamTetrisOriginFromCell(pieceId, rotation, cellX) {
      const bounds = getTeamTetrisPieceBounds(pieceId, rotation);
      const maxOrigin = Math.max(0, BOARD_WIDTH - bounds.width);
      return clampNumber(cellX - Math.floor(bounds.width / 2), 0, maxOrigin);
    }

    function buildTeamTetrisRowShiftsFromTargets(pieceId, rotation, dragTargets) {
      const targetRows = Object.keys(dragTargets)
        .map(function (key) {
          return Number.parseInt(key, 10);
        })
        .filter(function (value) {
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
          desiredX = dragTargets[rowIndex];
        }
        const shift = clampNumber(desiredX - currentX, -1, 1);
        rowShifts.push(shift);
        currentX += shift;
      }

      return rowShifts;
    }

    function normalizeTeamTetrisPreview(pieceId, rotation, rowShifts) {
      const ownBoard = getTeamTetrisOwnBoardState();
      let nextRowShifts = rowShifts.slice();
      let preview = replayTeamTetrisDraft(ownBoard.rows, pieceId, rotation, nextRowShifts);

      while (
        nextRowShifts.length > 0 &&
        preview.success !== true &&
        preview.reason === "downwardCollision"
      ) {
        nextRowShifts = nextRowShifts.slice(0, -1);
        preview = replayTeamTetrisDraft(ownBoard.rows, pieceId, rotation, nextRowShifts);
      }

      return {
        rowShifts: nextRowShifts,
        preview: preview,
      };
    }

    function refreshTeamTetrisDraftPreview() {
      const state = getState();
      const pendingTurn = getTeamTetrisPendingTurn();
      if (!pendingTurn) {
        state.teamTetrisDraft = createTeamTetrisDraft();
        return;
      }

      const normalized = normalizeTeamTetrisPreview(
        pendingTurn.pieceId,
        state.teamTetrisDraft.rotation,
        state.teamTetrisDraft.rowShifts
      );
      state.teamTetrisDraft.rowShifts = normalized.rowShifts;
      state.teamTetrisDraft.preview = normalized.preview.success === true ? normalized.preview : null;
      state.teamTetrisDraft.errorKey =
        normalized.preview.success === true ? "" : normalized.preview.reason || "";
    }

    function syncTeamTetrisDraftFromState() {
      const state = getState();
      const pendingTurn = getTeamTetrisPendingTurn();
      if (!pendingTurn) {
        state.teamTetrisDraft = createTeamTetrisDraft();
        return;
      }

      const legalRotations =
        Array.isArray(pendingTurn.legalRotations) && pendingTurn.legalRotations.length > 0
          ? pendingTurn.legalRotations
          : [0];

      if (state.teamTetrisDraft.turnToken !== pendingTurn.turnToken) {
        state.teamTetrisDraft = {
          matchId: state.teamTetris.matchId || "",
          turnIndex: pendingTurn.turnIndex,
          turnToken: pendingTurn.turnToken,
          pieceId: pendingTurn.pieceId,
          rotation: legalRotations[0],
          rowShifts: [],
          dragTargets: {},
          preview: null,
          errorKey: "",
          dragActive: false,
        };
        refreshTeamTetrisDraftPreview();
        return;
      }

      if (legalRotations.indexOf(state.teamTetrisDraft.rotation) === -1) {
        state.teamTetrisDraft.rotation = legalRotations[0];
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

      const legalRotations =
        Array.isArray(pendingTurn.legalRotations) && pendingTurn.legalRotations.length > 0
          ? pendingTurn.legalRotations
          : [0];
      const currentIndex = legalRotations.indexOf(state.teamTetrisDraft.rotation);
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % legalRotations.length;
      state.teamTetrisDraft.rotation = legalRotations[nextIndex];
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

      const nextTargets = Object.assign({}, state.teamTetrisDraft.dragTargets);
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

      state.lastCommandMessage = "";
      sendRoomCommand("GameRoomTeamTetrisUserMove", {
        schemaVersion: 1,
        matchId: state.teamTetris.matchId,
        turnIndex: pendingTurn.turnIndex,
        turnToken: pendingTurn.turnToken,
        pieceId: pendingTurn.pieceId,
        rotation: state.teamTetrisDraft.rotation,
        rowShifts: state.teamTetrisDraft.rowShifts.slice(),
      });
    }

    function onTeamTetrisStart() {
      const state = getState();
      state.lastCommandMessage = "";
      sendRoomCommand("GameRoomTeamTetrisStart", {
        hiddenPairs: state.preferences.teamTetrisHiddenPairs !== false,
      });
    }

    function onTeamTetrisReset() {
      const state = getState();
      state.lastCommandMessage = "";
      sendRoomCommand("GameRoomTeamTetrisReset", {});
    }

    function getTeamTetrisPartnerRoleLabel() {
      const view = getTeamTetrisView();
      if (!view) {
        return text(["teamTetris", "roster", "partnerUnknown"]);
      }

      if (view.teams) {
        const team = view.teams.find(function (entry) {
          return entry.teamId === view.seat.teamId;
        });
        if (team) {
          const partnerSeatId = team.seatIds.find(function (entry) {
            return entry !== view.seat.seatId;
          });
          if (partnerSeatId) {
            return getTeamTetrisSeatDisplayLabel(partnerSeatId);
          }
        }
      }

      return getTeamTetrisAnonymousSeatLabel(view.seat.role === "opener" ? "followup" : "opener");
    }

    function getTeamTetrisTurnLabel() {
      const state = getState();
      const currentTurn = state.teamTetris.currentTurn;
      const view = getTeamTetrisView();

      if (!currentTurn) {
        return text(["teamTetris", "turns", "idle"]);
      }
      if (view && currentTurn.seatId === view.seat.seatId) {
        return text(["teamTetris", "turns", "you"]);
      }
      if (view && currentTurn.teamId === view.seat.teamId) {
        return getTeamTetrisPartnerRoleLabel();
      }
      return text(["teamTetris", "turns", "opponent"]);
    }

    function getTeamTetrisResultLabel() {
      const state = getState();
      return text(["teamTetris", "results", state.teamTetris.result]);
    }

    function getTeamTetrisDraftStatusText() {
      const state = getState();
      const pendingTurn = getTeamTetrisPendingTurn();
      if (!pendingTurn) {
        return text(["teamTetris", "controls", "awaitingTurn"]);
      }
      if (state.teamTetrisDraft.preview) {
        return text(["teamTetris", "controls", "pathReady"]);
      }
      if (state.teamTetrisDraft.errorKey) {
        return text(["teamTetris", "validation", state.teamTetrisDraft.errorKey]);
      }
      return text(["teamTetris", "controls", "pathHint"]);
    }

    function getTeamTetrisStatusText() {
      const state = getState();
      const currentTurn = state.teamTetris.currentTurn;
      const view = getTeamTetrisView();

      if (state.teamTetris.result === "blocked") {
        return (
          state.lastCommandMessage ||
          state.teamTetris.status ||
          text(["teamTetris", "status", "blocked"])
        );
      }
      if (
        state.teamTetris.result === "team-a-win" ||
        state.teamTetris.result === "team-b-win" ||
        state.teamTetris.result === "draw"
      ) {
        return text(["teamTetris", "status", state.teamTetris.result]);
      }
      if (currentTurn && view) {
        if (currentTurn.seatId === view.seat.seatId) {
          return text(["teamTetris", "status", "yourTurn"]);
        }
        if (currentTurn.teamId === view.seat.teamId) {
          return text([
            "teamTetris",
            "status",
            state.teamTetris.hiddenPairs === true && view.revealedPairs !== true
              ? "partnerTurnHidden"
              : "partnerTurn",
          ]);
        }
        return text(["teamTetris", "status", "opponentTurn"]);
      }
      if (state.lastCommandMessage && state.lastCommandMessage.trim() !== "") {
        return state.lastCommandMessage.trim();
      }
      if (state.teamTetris.status && state.teamTetris.status.trim() !== "") {
        return state.teamTetris.status.trim();
      }
      return text(["teamTetris", "status", "idle"]);
    }

    function createTeamTetrisMiniPiece(pieceId, rotation) {
      const cells = getTeamTetrisRotationCells(pieceId, rotation);
      const bounds = getTeamTetrisPieceBounds(pieceId, rotation);
      const shell = createElement("div", "tt-piece-mini", "");
      shell.style.gridTemplateColumns = "repeat(" + Math.max(bounds.width, 1) + ", minmax(0, 1fr))";

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
          createElement("p", "tt-context-card__empty", text(["teamTetris", "boards", "emptyPiece"]))
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

    function renderTeamTetris(root) {
      const state = getState();
      document.title = state.context.room.name + " - " + getFeatureLabel(featureId);

      const view = getTeamTetrisView();
      const pendingTurn = getTeamTetrisPendingTurn();
      const ownBoard = getTeamTetrisOwnBoardState();
      const opponentBoard = getTeamTetrisOpponentBoardState();
      const canConfigureMatch =
        state.teamTetris.active !== true && state.teamTetris.result !== "pending";
      const canStart = state.teamTetris.canStart === true && canConfigureMatch;
      const canSubmitMove = !!pendingTurn && !!state.teamTetrisDraft.preview;

      const app = createElement("main", "tt-shell", "");
      app.dataset.presentationMode = state.presentation.mode;
      const surface = createElement("section", "tt-surface", "");
      const arena = createElement("section", "tt-arena", "");
      const rail = createElement("aside", "tt-rail", "");
      const stage = createElement("section", "tt-stage", "");

      const intro = createElement("section", "tt-panel tt-panel--intro", "");
      intro.append(
        createElement("div", "tt-panel__eyebrow", text(["teamTetris", "heroBadge"])),
        createElement("h1", "tt-panel__title", text(["teamTetris", "heroTitle"])),
        createElement(
          "p",
          "tt-panel__body",
          getTeamTetrisStatusText() || text(["teamTetris", "heroSubtitle"])
        )
      );

      const roster = createElement("section", "tt-panel", "");
      roster.append(
        createElement("p", "tt-panel__label", text(["teamTetris", "roster", "title"])),
        createElement(
          "p",
          "tt-panel__body",
          text(["teamTetris", "roster", "youLabel"]) +
            ": " +
            (view
              ? getTeamTetrisSeatDisplayLabel(view.seat.seatId)
              : text(["teamTetris", "turns", "idle"]))
        ),
        createElement(
          "p",
          "tt-panel__body",
          text(["teamTetris", "roster", "partnerLabel"]) + ": " + getTeamTetrisPartnerRoleLabel()
        )
      );

      const requirements = createElement("section", "tt-panel", "");
      requirements.append(
        createElement("p", "tt-panel__label", text(["teamTetris", "controls", "requirementsLabel"])),
        createTeamTetrisRequirementCard("ai1", state.teamTetris.requiredSlots.ai1 === true),
        createTeamTetrisRequirementCard("ai2", state.teamTetris.requiredSlots.ai2 === true),
        createTeamTetrisRequirementCard("us1", state.teamTetris.requiredSlots.us1 === true)
      );

      const controls = createElement("section", "tt-panel", "");
      controls.append(
        createElement("p", "tt-panel__label", text(["teamTetris", "controls", "featureLabel"]))
      );
      const hiddenChoices = createElement("div", "tt-toggle-row", "");
      [
        { value: true, label: text(["teamTetris", "controls", "hiddenPairsOn"]) },
        { value: false, label: text(["teamTetris", "controls", "hiddenPairsOff"]) },
      ].forEach(function (entry) {
        const button = createElement("button", "tt-toggle", entry.label);
        button.type = "button";
        button.disabled = !canConfigureMatch;
        button.dataset.selected =
          state.preferences.teamTetrisHiddenPairs === entry.value ? "true" : "false";
        button.addEventListener("click", function () {
          state.preferences.teamTetrisHiddenPairs = entry.value;
          render();
        });
        hiddenChoices.append(button);
      });
      const actions = createElement("div", "tt-actions", "");
      const startButton = createElement(
        "button",
        "xox-button xox-button--primary",
        text(["teamTetris", "controls", "start"])
      );
      startButton.type = "button";
      startButton.disabled = !canStart;
      startButton.addEventListener("click", onTeamTetrisStart);
      const resetButton = createElement(
        "button",
        "xox-button xox-button--ghost",
        text(["teamTetris", "controls", "reset"])
      );
      resetButton.type = "button";
      resetButton.addEventListener("click", onTeamTetrisReset);
      actions.append(startButton, resetButton);
      controls.append(
        hiddenChoices,
        createElement("p", "tt-panel__hint", text(["teamTetris", "controls", "startHint"])),
        actions
      );

      if (Array.isArray(state.teamTetris.teams) && state.teamTetris.teams.length > 0) {
        const reveal = createElement("section", "tt-panel", "");
        reveal.append(
          createElement("p", "tt-panel__label", text(["teamTetris", "roster", "revealTitle"]))
        );
        state.teamTetris.teams.forEach(function (team) {
          const revealedSeatLabels = Array.isArray(team.seatIds)
            ? team.seatIds.map(function (seatId) {
                return getTeamTetrisSeatDisplayLabel(seatId);
              })
            : [];
          reveal.append(
            createElement(
              "p",
              "tt-panel__body",
              getTeamTetrisBoardLabel(team.teamId) +
                ": " +
                (revealedSeatLabels.length > 0
                  ? revealedSeatLabels.join(" + ")
                  : text(["teamTetris", "turns", "idle"]))
            )
          );
        });
        rail.append(intro, roster, requirements, controls, reveal);
      } else {
        rail.append(intro, roster, requirements, controls);
      }

      const scorebar = createElement("div", "tt-scorebar", "");
      scorebar.append(
        createTeamTetrisMetric(text(["teamTetris", "metrics", "turnLabel"]), getTeamTetrisTurnLabel()),
        createTeamTetrisMetric(text(["teamTetris", "metrics", "resultLabel"]), getTeamTetrisResultLabel()),
        createTeamTetrisMetric(
          text(["teamTetris", "controls", "hiddenPairsLabel"]),
          state.teamTetris.hiddenPairs
            ? text(["teamTetris", "controls", "hiddenPairsOn"])
            : text(["teamTetris", "controls", "hiddenPairsOff"])
        ),
        createTeamTetrisMetric(text(["teamTetris", "boards", "seedLabel"]), state.teamTetris.board.seedLabel),
        createTeamTetrisMetric(
          text(["teamTetris", "metrics", "roleLabel"]),
          view ? text(["teamTetris", "roles", view.seat.role]) : text(["teamTetris", "turns", "idle"])
        ),
        createTeamTetrisMetric(
          text(["teamTetris", "metrics", "draftLabel"]),
          state.teamTetrisDraft.rowShifts.length > 0
            ? state.teamTetrisDraft.rowShifts.join(",")
            : text(["teamTetris", "controls", "pathEmpty"])
        )
      );

      const rotationPanel = createElement("section", "tt-context-card", "");
      rotationPanel.append(
        createElement(
          "span",
          "tt-context-card__label",
          text(["teamTetris", "controls", "rotationLabel"])
        ),
        createTeamTetrisPieceCard(
          text(["teamTetris", "boards", "currentPiece"]),
          pendingTurn ? pendingTurn.pieceId : "",
          state.teamTetrisDraft.rotation,
          getTeamTetrisDraftStatusText()
        )
      );
      const rotationChoices = createElement("div", "tt-rotation-row", "");
      (pendingTurn ? pendingTurn.legalRotations : [0]).forEach(function (rotation) {
        const button = createElement("button", "tt-rotation", String(rotation));
        button.type = "button";
        button.disabled = !pendingTurn;
        button.dataset.selected = state.teamTetrisDraft.rotation === rotation ? "true" : "false";
        button.addEventListener("click", function () {
          onTeamTetrisRotationSelect(rotation);
        });
        rotationChoices.append(button);
      });
      const rotateButton = createElement(
        "button",
        "xox-button xox-button--ghost",
        text(["teamTetris", "controls", "rotate"])
      );
      rotateButton.type = "button";
      rotateButton.disabled = !pendingTurn;
      rotateButton.addEventListener("click", onTeamTetrisRotate);
      const draftActions = createElement("div", "tt-actions tt-actions--compact", "");
      const clearButton = createElement(
        "button",
        "xox-button xox-button--ghost",
        text(["teamTetris", "controls", "clearPath"])
      );
      clearButton.type = "button";
      clearButton.disabled = !pendingTurn;
      clearButton.addEventListener("click", onTeamTetrisClearDraft);
      const submitButton = createElement(
        "button",
        "xox-button xox-button--primary",
        text(["teamTetris", "controls", "submitMove"])
      );
      submitButton.type = "button";
      submitButton.disabled = !canSubmitMove;
      submitButton.addEventListener("click", onTeamTetrisSubmit);
      draftActions.append(clearButton, rotateButton, submitButton);
      rotationPanel.append(rotationChoices, draftActions);

      const ownContext = [
        createTeamTetrisSnapshotCard(
          text(["teamTetris", "boards", "beforePartner"]),
          ownBoard.boardBeforePartnerPieceRows
        ),
        createTeamTetrisPieceCard(
          text(["teamTetris", "boards", "partnerPiece"]),
          ownBoard.partnerLastPiece ? ownBoard.partnerLastPiece.pieceId : "",
          ownBoard.partnerLastPiece ? ownBoard.partnerLastPiece.rotation : 0,
          getTeamTetrisPlacedByLabel(ownBoard.partnerLastPiece)
        ),
        rotationPanel,
      ];

      const boardGrid = createElement("div", "tt-board-grid", "");
      boardGrid.append(
        renderTeamTetrisBoardCard(ownBoard, {
          tone: "private",
          meta: text(["teamTetris", "boards", "privateBoard"]),
          interactive: !!pendingTurn,
          overlayCells: state.teamTetrisDraft.preview ? state.teamTetrisDraft.preview.cells : [],
          overlayTone: "draft",
          overlayPieceId: pendingTurn ? pendingTurn.pieceId : "",
          context: ownContext,
        }),
        renderTeamTetrisBoardCard(opponentBoard, {
          tone: "public",
          meta: text(["teamTetris", "boards", "publicBoard"]),
          interactive: false,
          context: [
            createTeamTetrisPieceCard(
              text(["teamTetris", "boards", "publicSummary"]),
              "",
              0,
              text(["teamTetris", "boards", "publicHint"])
            ),
          ],
        })
      );

      const footer = createElement("div", "tt-stage-footer", "");
      footer.append(
        createElement("p", "tt-stage-footer__message", getTeamTetrisStatusText()),
        createElement(
          "p",
          "tt-stage-footer__meta",
          text(["teamTetris", "controls", "pathLegend"]) +
            ": " +
            text(["teamTetris", "controls", "pathRule"])
        )
      );

      if (view && view.hiddenPairs === true && view.revealedPairs !== true) {
        footer.append(
          createElement("p", "tt-stage-footer__meta", text(["teamTetris", "roster", "hiddenHint"]))
        );
      } else {
        footer.append(
          createElement("p", "tt-stage-footer__meta", text(["teamTetris", "roster", "revealedHint"]))
        );
      }

      stage.append(scorebar, boardGrid, footer);
      arena.append(rail, stage);
      surface.append(arena);
      app.append(surface);
      root.replaceChildren(app);
    }

    function getTestBridge() {
      return {
        replayDraft: replayTeamTetrisDraft,
        buildRowShiftsFromTargets: buildTeamTetrisRowShiftsFromTargets,
        getOriginFromCell: getTeamTetrisOriginFromCell,
        getSpawnPosition: getTeamTetrisSpawnPosition,
      };
    }

    return {
      createTeamTetrisDraft: createTeamTetrisDraft,
      createTeamTetrisState: createTeamTetrisState,
      sanitizeTeamTetrisState: sanitizeTeamTetrisState,
      syncTeamTetrisPreferencesFromState: syncTeamTetrisPreferencesFromState,
      syncTeamTetrisDraftFromState: syncTeamTetrisDraftFromState,
      renderTeamTetris: renderTeamTetris,
      getTestBridge: getTestBridge,
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
