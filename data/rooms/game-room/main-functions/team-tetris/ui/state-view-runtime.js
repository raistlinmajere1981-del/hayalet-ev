(function(global) {
  function getFactoryRegistry(host) {
    return host.GameRoomUiFactories || (host.GameRoomUiFactories = {});
  }
  function readSlotRecord(value) {
    return value && typeof value === "object" && Array.isArray(value) === false ? value : null;
  }
  function readNicknameRecord(value) {
    return value && typeof value === "object" && Array.isArray(value) === false ? value : null;
  }
  const registry = getFactoryRegistry(global);
  registry.createTeamTetrisUiStateViewRuntime = function createTeamTetrisUiStateViewRuntime(deps) {
    const getState = deps.getState;
    const text = deps.text;
    const createTeamTetrisBoard = deps.createTeamTetrisBoard;
    function getTeamTetrisLocalSeatId() {
      const localSeatId = getState().teamTetris.userView?.seat.seatId;
      return typeof localSeatId === "string" && localSeatId.trim() !== "" ? localSeatId : "user";
    }
    function readCreatorPartnerSeatId() {
      const teams = getState().teamTetris.teams;
      if (!Array.isArray(teams)) {
        return null;
      }
      const creatorTeam = teams.find(function(team) {
        return Array.isArray(team.seatIds) && team.seatIds.includes("user");
      }) || null;
      if (!creatorTeam || !Array.isArray(creatorTeam.seatIds)) {
        return null;
      }
      return creatorTeam.seatIds.find(function(seatId) {
        return seatId !== "user";
      }) || null;
    }
    function syncTeamTetrisPreferencesFromState() {
      const state = getState();
      state.preferences.teamTetrisHiddenPairs = state.teamTetris.hiddenPairs !== false;
      state.preferences.teamTetrisSelectedPartnerSeatId = state.teamTetris.hiddenPairs === false ? readCreatorPartnerSeatId() : null;
    }
    function getTeamTetrisView() {
      return getState().teamTetris.userView;
    }
    function getTeamTetrisBoardLabel(teamId) {
      return teamId === "team-b" ? text(["teamTetris", "boards", "teamB"]) : text(["teamTetris", "boards", "teamA"]);
    }
    function getTeamTetrisSeatDisplayLabel(seatId) {
      const state = getState();
      const localSeatId = getTeamTetrisLocalSeatId();
      if (seatId === localSeatId) {
        return text(["teamTetris", "turns", "you"]);
      }
      if (seatId === "user") {
        if (localSeatId === "us1") {
          const mirroredUser = readSlotRecord(state.context.slots?.["us1"] ?? null);
          if (mirroredUser?.nickname && mirroredUser.nickname.trim() !== "") {
            return mirroredUser.nickname;
          }
        }
        const localUser = readNicknameRecord(state.context["user"]);
        return localUser?.nickname && localUser.nickname.trim() !== "" ? localUser.nickname.trim() : "USER";
      }
      const slot = readSlotRecord(state.context.slots?.[seatId] ?? null);
      if (slot?.nickname && slot.nickname.trim() !== "") {
        return slot.nickname;
      }
      return seatId.trim() !== "" ? seatId.toUpperCase() : "???";
    }
    function getTeamTetrisPlayerDisplay(seatId) {
      const state = getState();
      const label = getTeamTetrisSeatDisplayLabel(seatId);
      const localSeatId = getTeamTetrisLocalSeatId();
      if (state.teamTetris.hiddenPairs === true) {
        const view = getTeamTetrisView();
        if (view && view.revealedPairs !== true && seatId !== localSeatId) {
          return {
            avatarUrl: null,
            label: text(["teamTetris", "roster", "partnerUnknown"]),
            isAnonymous: true
          };
        }
      }
      let avatarUrl = null;
      if (seatId === "user" || seatId === localSeatId) {
        const userCtx = state.context["user"];
        if (userCtx && typeof userCtx.avatar === "string" && userCtx.avatar.trim() !== "") {
          avatarUrl = userCtx.avatar;
        }
      } else {
        const slot = readSlotRecord(state.context.slots?.[seatId] ?? null);
        if (slot && typeof slot.avatar === "string") {
          avatarUrl = slot.avatar || null;
        }
      }
      return { avatarUrl, label, isAnonymous: false };
    }
    function getTeamTetrisAnonymousSeatLabel(role) {
      return role === "followup" ? text(["teamTetris", "roster", "partnerFollowup"]) : text(["teamTetris", "roster", "partnerOpener"]);
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
      return view ? view.pendingTurn : null;
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
          partnerLastPiece: board.partnerLastPiece
        };
      }
      return {
        teamId: view.ownTeam.teamId,
        label: getTeamTetrisBoardLabel(view.ownTeam.teamId),
        visibility: "private",
        rows: view.ownTeam.boardRows.slice(),
        boardBeforePartnerPieceRows: view.ownTeam.boardBeforePartnerPieceRows.slice(),
        partnerLastPiece: view.ownTeam.partnerLastPiece
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
          partnerLastPiece: board.partnerLastPiece
        };
      }
      return {
        teamId: view.opponentTeam.teamId,
        label: getTeamTetrisBoardLabel(view.opponentTeam.teamId),
        visibility: "public",
        rows: view.opponentTeam.boardRows.slice(),
        boardBeforePartnerPieceRows: board.boardBeforePartnerPieceRows.slice(),
        partnerLastPiece: null
      };
    }
    function getTeamTetrisPartnerRoleLabel() {
      const view = getTeamTetrisView();
      if (!view) {
        return text(["teamTetris", "roster", "partnerUnknown"]);
      }
      if (view.teams) {
        const team = view.teams.find(function(entry) {
          return entry.teamId === view.seat.teamId;
        }) || null;
        if (team) {
          const partnerSeatId = team.seatIds.find(function(entry) {
            return entry !== view.seat.seatId;
          }) || null;
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
      if (state.teamTetrisDraft.preview && state.teamTetrisDraft.preview.success === true && state.teamTetrisDraft.preview.pathComplete === true) {
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
        return state.lastCommandMessage || state.teamTetris.status || text(["teamTetris", "status", "blocked"]);
      }
      if (state.teamTetris.result === "team-a-win" || state.teamTetris.result === "team-b-win" || state.teamTetris.result === "draw") {
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
            state.teamTetris.hiddenPairs === true && view.revealedPairs !== true ? "partnerTurnHidden" : "partnerTurn"
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
    return {
      syncTeamTetrisPreferencesFromState,
      getTeamTetrisView,
      getTeamTetrisBoardLabel,
      getTeamTetrisSeatDisplayLabel,
      getTeamTetrisPlayerDisplay,
      getTeamTetrisPendingTurn,
      getTeamTetrisOwnBoardState,
      getTeamTetrisOpponentBoardState,
      getTeamTetrisPlacedByLabel,
      getTeamTetrisPartnerRoleLabel,
      getTeamTetrisTurnLabel,
      getTeamTetrisResultLabel,
      getTeamTetrisDraftStatusText,
      getTeamTetrisStatusText
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
