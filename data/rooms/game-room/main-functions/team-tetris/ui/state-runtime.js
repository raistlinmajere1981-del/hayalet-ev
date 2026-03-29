(function(global) {
  const registry = global.GameRoomUiFactories || (global.GameRoomUiFactories = {});
  registry.createTeamTetrisUiStateRuntime = function createTeamTetrisUiStateRuntime(deps) {
    const getState = deps.getState;
    const sendRoomCommand = deps.sendRoomCommand;
    const text = deps.text;
    const createTeamTetrisUiStateShapeRuntime = registry.createTeamTetrisUiStateShapeRuntime;
    if (typeof createTeamTetrisUiStateShapeRuntime !== "function") {
      throw new Error("Team Tetris UI state shape runtime is not registered.");
    }
    const teamTetrisUiStateShapeRuntime = createTeamTetrisUiStateShapeRuntime();
    const createTeamTetrisBoard = teamTetrisUiStateShapeRuntime.createTeamTetrisBoard;
    const createTeamTetrisDraft = teamTetrisUiStateShapeRuntime.createTeamTetrisDraft;
    const createTeamTetrisState = teamTetrisUiStateShapeRuntime.createTeamTetrisState;
    const sanitizeTeamTetrisRows = teamTetrisUiStateShapeRuntime.sanitizeTeamTetrisRows;
    const sanitizeTeamTetrisState = teamTetrisUiStateShapeRuntime.sanitizeTeamTetrisState;
    const createTeamTetrisUiStateViewRuntime = registry.createTeamTetrisUiStateViewRuntime;
    if (typeof createTeamTetrisUiStateViewRuntime !== "function") {
      throw new Error("Team Tetris UI state view runtime is not registered.");
    }
    const teamTetrisUiStateViewRuntime = createTeamTetrisUiStateViewRuntime({
      getState,
      text,
      createTeamTetrisBoard
    });
    const syncTeamTetrisPreferencesFromState = teamTetrisUiStateViewRuntime.syncTeamTetrisPreferencesFromState;
    const getTeamTetrisView = teamTetrisUiStateViewRuntime.getTeamTetrisView;
    const getTeamTetrisBoardLabel = teamTetrisUiStateViewRuntime.getTeamTetrisBoardLabel;
    const getTeamTetrisSeatDisplayLabel = teamTetrisUiStateViewRuntime.getTeamTetrisSeatDisplayLabel;
    const getTeamTetrisPendingTurn = teamTetrisUiStateViewRuntime.getTeamTetrisPendingTurn;
    const getTeamTetrisOwnBoardState = teamTetrisUiStateViewRuntime.getTeamTetrisOwnBoardState;
    const getTeamTetrisOpponentBoardState = teamTetrisUiStateViewRuntime.getTeamTetrisOpponentBoardState;
    const getTeamTetrisPlacedByLabel = teamTetrisUiStateViewRuntime.getTeamTetrisPlacedByLabel;
    const getTeamTetrisPartnerRoleLabel = teamTetrisUiStateViewRuntime.getTeamTetrisPartnerRoleLabel;
    const getTeamTetrisTurnLabel = teamTetrisUiStateViewRuntime.getTeamTetrisTurnLabel;
    const getTeamTetrisResultLabel = teamTetrisUiStateViewRuntime.getTeamTetrisResultLabel;
    const getTeamTetrisDraftStatusText = teamTetrisUiStateViewRuntime.getTeamTetrisDraftStatusText;
    const getTeamTetrisStatusText = teamTetrisUiStateViewRuntime.getTeamTetrisStatusText;
    const createTeamTetrisUiDraftRuntime = registry.createTeamTetrisUiDraftRuntime;
    if (typeof createTeamTetrisUiDraftRuntime !== "function") {
      throw new Error("Team Tetris UI draft runtime is not registered.");
    }
    const teamTetrisUiDraftRuntime = createTeamTetrisUiDraftRuntime({
      createTeamTetrisDraft,
      getState,
      render: deps.render,
      sendRoomCommand,
      sanitizeTeamTetrisRows,
      getTeamTetrisOwnBoardState,
      getTeamTetrisPendingTurn
    });
    const getTeamTetrisRotationCells = teamTetrisUiDraftRuntime.getTeamTetrisRotationCells;
    const getTeamTetrisPieceBounds = teamTetrisUiDraftRuntime.getTeamTetrisPieceBounds;
    const getTeamTetrisSpawnPosition = teamTetrisUiDraftRuntime.getTeamTetrisSpawnPosition;
    const replayTeamTetrisDraft = teamTetrisUiDraftRuntime.replayTeamTetrisDraft;
    const buildTeamTetrisRowShiftsFromTargets = teamTetrisUiDraftRuntime.buildTeamTetrisRowShiftsFromTargets;
    const getTeamTetrisOriginFromCell = teamTetrisUiDraftRuntime.getTeamTetrisOriginFromCell;
    const syncTeamTetrisDraftFromState = teamTetrisUiDraftRuntime.syncTeamTetrisDraftFromState;
    const startTeamTetrisDrag = teamTetrisUiDraftRuntime.startTeamTetrisDrag;
    const updateTeamTetrisDraftTarget = teamTetrisUiDraftRuntime.updateTeamTetrisDraftTarget;
    const finishTeamTetrisDrag = teamTetrisUiDraftRuntime.finishTeamTetrisDrag;
    const onTeamTetrisRotationSelect = teamTetrisUiDraftRuntime.onTeamTetrisRotationSelect;
    const onTeamTetrisRotate = teamTetrisUiDraftRuntime.onTeamTetrisRotate;
    const onTeamTetrisClearDraft = teamTetrisUiDraftRuntime.onTeamTetrisClearDraft;
    const onTeamTetrisSubmit = teamTetrisUiDraftRuntime.onTeamTetrisSubmit;
    function onTeamTetrisStart() {
      const state = getState();
      state.lastCommandMessage = "";
      sendRoomCommand("GameRoomTeamTetrisStart", {
        hiddenPairs: state.preferences.teamTetrisHiddenPairs !== false
      });
    }
    function onTeamTetrisReset() {
      const state = getState();
      state.lastCommandMessage = "";
      sendRoomCommand("GameRoomTeamTetrisReset", {});
    }
    return {
      createTeamTetrisDraft,
      createTeamTetrisState,
      sanitizeTeamTetrisRows,
      sanitizeTeamTetrisState,
      syncTeamTetrisPreferencesFromState,
      getTeamTetrisView,
      getTeamTetrisBoardLabel,
      getTeamTetrisSeatDisplayLabel,
      getTeamTetrisPendingTurn,
      getTeamTetrisOwnBoardState,
      getTeamTetrisOpponentBoardState,
      getTeamTetrisRotationCells,
      getTeamTetrisPieceBounds,
      getTeamTetrisPlacedByLabel,
      getTeamTetrisPartnerRoleLabel,
      getTeamTetrisTurnLabel,
      getTeamTetrisResultLabel,
      getTeamTetrisDraftStatusText,
      getTeamTetrisStatusText,
      replayTeamTetrisDraft,
      buildTeamTetrisRowShiftsFromTargets,
      getTeamTetrisOriginFromCell,
      getTeamTetrisSpawnPosition,
      syncTeamTetrisDraftFromState,
      startTeamTetrisDrag,
      updateTeamTetrisDraftTarget,
      finishTeamTetrisDrag,
      onTeamTetrisRotationSelect,
      onTeamTetrisRotate,
      onTeamTetrisClearDraft,
      onTeamTetrisSubmit,
      onTeamTetrisStart,
      onTeamTetrisReset
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
