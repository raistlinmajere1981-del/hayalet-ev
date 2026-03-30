(function (global: any) {
  const registry = global.GameRoomUiFactories || (global.GameRoomUiFactories = {});

  registry.createTeamTetrisUiStateRuntime = function createTeamTetrisUiStateRuntime(deps: any) {
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
      getState: getState,
      text: text,
      createTeamTetrisBoard: createTeamTetrisBoard,
    });
    const syncTeamTetrisPreferencesFromState =
      teamTetrisUiStateViewRuntime.syncTeamTetrisPreferencesFromState;
    const getTeamTetrisView = teamTetrisUiStateViewRuntime.getTeamTetrisView;
    const getTeamTetrisBoardLabel = teamTetrisUiStateViewRuntime.getTeamTetrisBoardLabel;
    const getTeamTetrisSeatDisplayLabel =
      teamTetrisUiStateViewRuntime.getTeamTetrisSeatDisplayLabel;
    const getTeamTetrisPendingTurn = teamTetrisUiStateViewRuntime.getTeamTetrisPendingTurn;
    const getTeamTetrisOwnBoardState = teamTetrisUiStateViewRuntime.getTeamTetrisOwnBoardState;
    const getTeamTetrisOpponentBoardState =
      teamTetrisUiStateViewRuntime.getTeamTetrisOpponentBoardState;
    const getTeamTetrisPlacedByLabel = teamTetrisUiStateViewRuntime.getTeamTetrisPlacedByLabel;
    const getTeamTetrisPartnerRoleLabel =
      teamTetrisUiStateViewRuntime.getTeamTetrisPartnerRoleLabel;
    const getTeamTetrisTurnLabel = teamTetrisUiStateViewRuntime.getTeamTetrisTurnLabel;
    const getTeamTetrisResultLabel = teamTetrisUiStateViewRuntime.getTeamTetrisResultLabel;
    const getTeamTetrisDraftStatusText = teamTetrisUiStateViewRuntime.getTeamTetrisDraftStatusText;
    const getTeamTetrisStatusText = teamTetrisUiStateViewRuntime.getTeamTetrisStatusText;

    const createTeamTetrisUiDraftRuntime = registry.createTeamTetrisUiDraftRuntime;
    if (typeof createTeamTetrisUiDraftRuntime !== "function") {
      throw new Error("Team Tetris UI draft runtime is not registered.");
    }
    const teamTetrisUiDraftRuntime = createTeamTetrisUiDraftRuntime({
      createTeamTetrisDraft: createTeamTetrisDraft,
      getState: getState,
      render: deps.render,
      sendRoomCommand: sendRoomCommand,
      sanitizeTeamTetrisRows: sanitizeTeamTetrisRows,
      getTeamTetrisOwnBoardState: getTeamTetrisOwnBoardState,
      getTeamTetrisPendingTurn: getTeamTetrisPendingTurn,
    });
    const getTeamTetrisRotationCells = teamTetrisUiDraftRuntime.getTeamTetrisRotationCells;
    const getTeamTetrisPieceBounds = teamTetrisUiDraftRuntime.getTeamTetrisPieceBounds;
    const getTeamTetrisSpawnPosition = teamTetrisUiDraftRuntime.getTeamTetrisSpawnPosition;
    const replayTeamTetrisDraft = teamTetrisUiDraftRuntime.replayTeamTetrisDraft;
    const buildTeamTetrisRowShiftsFromTargets =
      teamTetrisUiDraftRuntime.buildTeamTetrisRowShiftsFromTargets;
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
        hiddenPairs: state.preferences.teamTetrisHiddenPairs !== false,
      });
    }

    function onTeamTetrisReset() {
      const state = getState();
      state.lastCommandMessage = "";
      sendRoomCommand("GameRoomTeamTetrisReset", {});
    }

    return {
      createTeamTetrisDraft: createTeamTetrisDraft,
      createTeamTetrisState: createTeamTetrisState,
      sanitizeTeamTetrisRows: sanitizeTeamTetrisRows,
      sanitizeTeamTetrisState: sanitizeTeamTetrisState,
      syncTeamTetrisPreferencesFromState: syncTeamTetrisPreferencesFromState,
      getTeamTetrisView: getTeamTetrisView,
      getTeamTetrisBoardLabel: getTeamTetrisBoardLabel,
      getTeamTetrisSeatDisplayLabel: getTeamTetrisSeatDisplayLabel,
      getTeamTetrisPendingTurn: getTeamTetrisPendingTurn,
      getTeamTetrisOwnBoardState: getTeamTetrisOwnBoardState,
      getTeamTetrisOpponentBoardState: getTeamTetrisOpponentBoardState,
      getTeamTetrisRotationCells: getTeamTetrisRotationCells,
      getTeamTetrisPieceBounds: getTeamTetrisPieceBounds,
      getTeamTetrisPlacedByLabel: getTeamTetrisPlacedByLabel,
      getTeamTetrisPartnerRoleLabel: getTeamTetrisPartnerRoleLabel,
      getTeamTetrisTurnLabel: getTeamTetrisTurnLabel,
      getTeamTetrisResultLabel: getTeamTetrisResultLabel,
      getTeamTetrisDraftStatusText: getTeamTetrisDraftStatusText,
      getTeamTetrisStatusText: getTeamTetrisStatusText,
      replayTeamTetrisDraft: replayTeamTetrisDraft,
      buildTeamTetrisRowShiftsFromTargets: buildTeamTetrisRowShiftsFromTargets,
      getTeamTetrisOriginFromCell: getTeamTetrisOriginFromCell,
      getTeamTetrisSpawnPosition: getTeamTetrisSpawnPosition,
      syncTeamTetrisDraftFromState: syncTeamTetrisDraftFromState,
      startTeamTetrisDrag: startTeamTetrisDrag,
      updateTeamTetrisDraftTarget: updateTeamTetrisDraftTarget,
      finishTeamTetrisDrag: finishTeamTetrisDrag,
      onTeamTetrisRotationSelect: onTeamTetrisRotationSelect,
      onTeamTetrisRotate: onTeamTetrisRotate,
      onTeamTetrisClearDraft: onTeamTetrisClearDraft,
      onTeamTetrisSubmit: onTeamTetrisSubmit,
      onTeamTetrisStart: onTeamTetrisStart,
      onTeamTetrisReset: onTeamTetrisReset,
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
