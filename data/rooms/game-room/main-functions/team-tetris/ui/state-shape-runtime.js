(function(global) {
  const registry = global.GameRoomUiFactories || (global.GameRoomUiFactories = {});
  registry.createTeamTetrisUiStateShapeRuntime = function createTeamTetrisUiStateShapeRuntime() {
    const BOARD_WIDTH = 10;
    const BOARD_HEIGHT = 20;
    function createTeamTetrisBoard(teamId, visibility) {
      return {
        teamId,
        visibility,
        rows: Array.from({ length: BOARD_HEIGHT }, function() {
          return ".".repeat(BOARD_WIDTH);
        }),
        boardBeforePartnerPieceRows: Array.from({ length: BOARD_HEIGHT }, function() {
          return ".".repeat(BOARD_WIDTH);
        }),
        partnerLastPiece: null
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
        dragActive: false
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
          us1: false
        },
        board: {
          width: BOARD_WIDTH,
          height: BOARD_HEIGHT,
          seedLabel: "contract-frozen"
        },
        boards: [
          createTeamTetrisBoard("team-a", "private"),
          createTeamTetrisBoard("team-b", "public")
        ],
        turnLoop: ["team-a-opener", "team-b-opener", "team-a-followup", "team-b-followup"],
        currentTurn: null,
        teams: null,
        userView: null,
        status: ""
      };
    }
    function sanitizeTeamTetrisRows(rows) {
      if (!Array.isArray(rows)) {
        return Array.from({ length: BOARD_HEIGHT }, function() {
          return ".".repeat(BOARD_WIDTH);
        });
      }
      const normalized = rows.filter(function(row) {
        return typeof row === "string" && row.length > 0;
      }).map(function(row) {
        const nextRow = row.slice(0, BOARD_WIDTH);
        if (nextRow.length >= BOARD_WIDTH) {
          return nextRow;
        }
        return nextRow + ".".repeat(BOARD_WIDTH - nextRow.length);
      }).slice(0, BOARD_HEIGHT);
      while (normalized.length < BOARD_HEIGHT) {
        normalized.push(".".repeat(BOARD_WIDTH));
      }
      return normalized;
    }
    function sanitizeTeamTetrisCells(value) {
      if (!Array.isArray(value)) {
        return [];
      }
      return value.filter(function(cell) {
        return cell && typeof cell === "object" && Array.isArray(cell) === false && typeof cell.x === "number" && Number.isInteger(cell.x) && typeof cell.y === "number" && Number.isInteger(cell.y);
      }).map(function(cell) {
        return { x: cell.x, y: cell.y };
      });
    }
    function sanitizeTeamTetrisPieceSnapshot(candidate) {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
        return null;
      }
      return {
        pieceId: typeof candidate.pieceId === "string" && candidate.pieceId.trim() !== "" ? candidate.pieceId.trim() : "",
        rotation: typeof candidate.rotation === "number" && Number.isInteger(candidate.rotation) ? candidate.rotation : 0,
        cells: sanitizeTeamTetrisCells(candidate.cells),
        placedBySeatId: typeof candidate.placedBySeatId === "string" && candidate.placedBySeatId.trim() !== "" ? candidate.placedBySeatId.trim() : "",
        placedByRole: typeof candidate.placedByRole === "string" && candidate.placedByRole.trim() !== "" ? candidate.placedByRole.trim() : "",
        placedBy: typeof candidate.placedBy === "string" && candidate.placedBy.trim() !== "" ? candidate.placedBy.trim() : ""
      };
    }
    function sanitizeTeamTetrisBoardState(candidate, fallbackTeamId, fallbackVisibility) {
      const source = candidate && typeof candidate === "object" && Array.isArray(candidate) === false ? candidate : {};
      return {
        teamId: typeof source.teamId === "string" && source.teamId.trim() !== "" ? source.teamId.trim() : fallbackTeamId,
        visibility: source.visibility === "public" || source.visibility === "private" ? source.visibility : fallbackVisibility,
        rows: sanitizeTeamTetrisRows(source.rows),
        boardBeforePartnerPieceRows: sanitizeTeamTetrisRows(source.boardBeforePartnerPieceRows),
        partnerLastPiece: sanitizeTeamTetrisPieceSnapshot(source.partnerLastPiece)
      };
    }
    function sanitizeTeamTetrisSeatView(candidate) {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
        return null;
      }
      const seatSource = candidate.seat && typeof candidate.seat === "object" && Array.isArray(candidate.seat) === false ? candidate.seat : {};
      const ownTeamSource = candidate.ownTeam && typeof candidate.ownTeam === "object" && Array.isArray(candidate.ownTeam) === false ? candidate.ownTeam : {};
      const opponentTeamSource = candidate.opponentTeam && typeof candidate.opponentTeam === "object" && Array.isArray(candidate.opponentTeam) === false ? candidate.opponentTeam : {};
      const pendingTurnSource = candidate.pendingTurn && typeof candidate.pendingTurn === "object" && Array.isArray(candidate.pendingTurn) === false ? candidate.pendingTurn : null;
      return {
        schemaVersion: typeof candidate.schemaVersion === "number" && Number.isInteger(candidate.schemaVersion) ? candidate.schemaVersion : 1,
        matchId: typeof candidate.matchId === "string" && candidate.matchId.trim() !== "" ? candidate.matchId.trim() : "",
        seat: {
          seatId: typeof seatSource.seatId === "string" && seatSource.seatId.trim() !== "" ? seatSource.seatId.trim() : "user",
          teamId: typeof seatSource.teamId === "string" && seatSource.teamId.trim() !== "" ? seatSource.teamId.trim() : "team-a",
          role: typeof seatSource.role === "string" && seatSource.role.trim() !== "" ? seatSource.role.trim() : "opener"
        },
        hiddenPairs: candidate.hiddenPairs !== false,
        revealedPairs: candidate.revealedPairs === true,
        result: typeof candidate.result === "string" && candidate.result.trim() !== "" ? candidate.result.trim() : "idle",
        winnerTeamId: typeof candidate.winnerTeamId === "string" && candidate.winnerTeamId.trim() !== "" ? candidate.winnerTeamId.trim() : null,
        teams: Array.isArray(candidate.teams) ? candidate.teams.map(function(entry) {
          const teamSource = entry && typeof entry === "object" && Array.isArray(entry) === false ? entry : {};
          return {
            teamId: typeof teamSource.teamId === "string" && teamSource.teamId.trim() !== "" ? teamSource.teamId.trim() : "team-a",
            seatIds: Array.isArray(teamSource.seatIds) ? teamSource.seatIds.filter(function(seatId) {
              return typeof seatId === "string" && seatId.trim() !== "";
            }) : []
          };
        }).slice(0, 2) : null,
        ownTeam: {
          teamId: typeof ownTeamSource.teamId === "string" && ownTeamSource.teamId.trim() !== "" ? ownTeamSource.teamId.trim() : "team-a",
          boardRows: sanitizeTeamTetrisRows(ownTeamSource.boardRows),
          boardBeforePartnerPieceRows: sanitizeTeamTetrisRows(
            ownTeamSource.boardBeforePartnerPieceRows
          ),
          partnerLastPiece: sanitizeTeamTetrisPieceSnapshot(ownTeamSource.partnerLastPiece)
        },
        opponentTeam: {
          teamId: typeof opponentTeamSource.teamId === "string" && opponentTeamSource.teamId.trim() !== "" ? opponentTeamSource.teamId.trim() : "team-b",
          boardRows: sanitizeTeamTetrisRows(opponentTeamSource.boardRows)
        },
        pendingTurn: pendingTurnSource !== null ? {
          turnIndex: typeof pendingTurnSource.turnIndex === "number" && Number.isInteger(pendingTurnSource.turnIndex) ? pendingTurnSource.turnIndex : 0,
          turnToken: typeof pendingTurnSource.turnToken === "string" && pendingTurnSource.turnToken.trim() !== "" ? pendingTurnSource.turnToken.trim() : "",
          pieceId: typeof pendingTurnSource.pieceId === "string" && pendingTurnSource.pieceId.trim() !== "" ? pendingTurnSource.pieceId.trim() : "",
          legalRotations: Array.isArray(pendingTurnSource.legalRotations) ? pendingTurnSource.legalRotations.filter(function(value) {
            return typeof value === "number" && Number.isInteger(value);
          }) : [0],
          actingRole: typeof pendingTurnSource.actingRole === "string" && pendingTurnSource.actingRole.trim() !== "" ? pendingTurnSource.actingRole.trim() : "opener"
        } : null
      };
    }
    function sanitizeTeamTetrisState(candidate) {
      const source = candidate && typeof candidate === "object" && Array.isArray(candidate) === false ? candidate : {};
      const next = createTeamTetrisState();
      next.active = source.active === true;
      next.result = typeof source.result === "string" && source.result.trim() !== "" ? source.result.trim() : "idle";
      next.hiddenPairs = source.hiddenPairs !== false;
      next.revealPairsOnFinish = source.revealPairsOnFinish !== false;
      next.blockedReason = typeof source.blockedReason === "string" && source.blockedReason.trim() !== "" ? source.blockedReason.trim() : "";
      next.matchId = typeof source.matchId === "string" && source.matchId.trim() !== "" ? source.matchId.trim() : null;
      next.canStart = source.canStart === true;
      if (source.requiredSlots && typeof source.requiredSlots === "object" && Array.isArray(source.requiredSlots) === false) {
        next.requiredSlots = {
          ai1: source.requiredSlots.ai1 === true,
          ai2: source.requiredSlots.ai2 === true,
          us1: source.requiredSlots.us1 === true
        };
      }
      if (source.board && typeof source.board === "object" && Array.isArray(source.board) === false) {
        next.board = {
          width: typeof source.board.width === "number" && Number.isInteger(source.board.width) && source.board.width > 0 ? source.board.width : BOARD_WIDTH,
          height: typeof source.board.height === "number" && Number.isInteger(source.board.height) && source.board.height > 0 ? source.board.height : BOARD_HEIGHT,
          seedLabel: typeof source.board.seedLabel === "string" && source.board.seedLabel.trim() !== "" ? source.board.seedLabel.trim() : "contract-frozen"
        };
      }
      if (Array.isArray(source.boards)) {
        next.boards = source.boards.map(function(entry, index) {
          return sanitizeTeamTetrisBoardState(
            entry,
            index === 0 ? "team-a" : "team-b",
            index === 0 ? "private" : "public"
          );
        }).slice(0, 2);
      }
      if (Array.isArray(source.turnLoop)) {
        next.turnLoop = source.turnLoop.filter(function(entry) {
          return typeof entry === "string" && entry.trim() !== "";
        });
      }
      next.currentTurn = source.currentTurn && typeof source.currentTurn === "object" && Array.isArray(source.currentTurn) === false ? {
        turnIndex: typeof source.currentTurn.turnIndex === "number" && Number.isInteger(source.currentTurn.turnIndex) ? source.currentTurn.turnIndex : 0,
        seatId: typeof source.currentTurn.seatId === "string" && source.currentTurn.seatId.trim() !== "" ? source.currentTurn.seatId.trim() : "",
        teamId: typeof source.currentTurn.teamId === "string" && source.currentTurn.teamId.trim() !== "" ? source.currentTurn.teamId.trim() : "",
        role: typeof source.currentTurn.role === "string" && source.currentTurn.role.trim() !== "" ? source.currentTurn.role.trim() : "",
        pieceId: typeof source.currentTurn.pieceId === "string" && source.currentTurn.pieceId.trim() !== "" ? source.currentTurn.pieceId.trim() : "",
        legalRotations: Array.isArray(source.currentTurn.legalRotations) ? source.currentTurn.legalRotations.filter(function(value) {
          return typeof value === "number" && Number.isInteger(value);
        }) : [0],
        turnToken: typeof source.currentTurn.turnToken === "string" && source.currentTurn.turnToken.trim() !== "" ? source.currentTurn.turnToken.trim() : ""
      } : null;
      next.teams = Array.isArray(source.teams) ? source.teams.map(function(entry) {
        const teamSource = entry && typeof entry === "object" && Array.isArray(entry) === false ? entry : {};
        return {
          teamId: typeof teamSource.teamId === "string" && teamSource.teamId.trim() !== "" ? teamSource.teamId.trim() : "team-a",
          seatIds: Array.isArray(teamSource.seatIds) ? teamSource.seatIds.filter(function(seatId) {
            return typeof seatId === "string" && seatId.trim() !== "";
          }) : []
        };
      }).slice(0, 2) : null;
      next.userView = sanitizeTeamTetrisSeatView(source.userView);
      next.status = typeof source.status === "string" && source.status.trim() !== "" ? source.status.trim() : "";
      return next;
    }
    return {
      createTeamTetrisBoard,
      createTeamTetrisDraft,
      createTeamTetrisState,
      sanitizeTeamTetrisRows,
      sanitizeTeamTetrisState
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
