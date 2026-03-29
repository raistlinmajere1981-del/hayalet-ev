(function (global) {
  const registry = global.GameRoomUiFactories || (global.GameRoomUiFactories = {});

  registry.createTeamTetrisUiModule = function createTeamTetrisUiModule(deps) {
    const getState = deps.getState;
    const featureId = deps.featureId || "team-tetris";
    const createSlot = deps.createSlot;
    const createElement = deps.createElement;
    const text = deps.text;
    const render = deps.render;
    const getFeatureLabel = deps.getFeatureLabel;
    const createTeamTetrisUiStateRuntime = registry.createTeamTetrisUiStateRuntime;
    const createTeamTetrisUiModuleCardRuntime = registry.createTeamTetrisUiModuleCardRuntime;
    const createTeamTetrisUiModuleShellRuntime = registry.createTeamTetrisUiModuleShellRuntime;

    if (typeof createTeamTetrisUiStateRuntime !== "function") {
      throw new Error("Team Tetris UI state runtime is not registered.");
    }
    if (typeof createTeamTetrisUiModuleCardRuntime !== "function") {
      throw new Error("Team Tetris UI module card runtime is not registered.");
    }
    if (typeof createTeamTetrisUiModuleShellRuntime !== "function") {
      throw new Error("Team Tetris UI module shell runtime is not registered.");
    }

    const teamTetrisUiStateRuntime = createTeamTetrisUiStateRuntime({
      getState: getState,
      render: render,
      sendRoomCommand: deps.sendRoomCommand,
      text: text,
    });

    const createTeamTetrisDraft = teamTetrisUiStateRuntime.createTeamTetrisDraft;
    const createTeamTetrisState = teamTetrisUiStateRuntime.createTeamTetrisState;
    const sanitizeTeamTetrisRows = teamTetrisUiStateRuntime.sanitizeTeamTetrisRows;
    const sanitizeTeamTetrisState = teamTetrisUiStateRuntime.sanitizeTeamTetrisState;
    const syncTeamTetrisPreferencesFromState =
      teamTetrisUiStateRuntime.syncTeamTetrisPreferencesFromState;
    const getTeamTetrisView = teamTetrisUiStateRuntime.getTeamTetrisView;
    const getTeamTetrisBoardLabel = teamTetrisUiStateRuntime.getTeamTetrisBoardLabel;
    const getTeamTetrisSeatDisplayLabel = teamTetrisUiStateRuntime.getTeamTetrisSeatDisplayLabel;
    const getTeamTetrisPendingTurn = teamTetrisUiStateRuntime.getTeamTetrisPendingTurn;
    const getTeamTetrisOwnBoardState = teamTetrisUiStateRuntime.getTeamTetrisOwnBoardState;
    const getTeamTetrisOpponentBoardState =
      teamTetrisUiStateRuntime.getTeamTetrisOpponentBoardState;
    const getTeamTetrisRotationCells = teamTetrisUiStateRuntime.getTeamTetrisRotationCells;
    const getTeamTetrisPieceBounds = teamTetrisUiStateRuntime.getTeamTetrisPieceBounds;
    const getTeamTetrisPlacedByLabel = teamTetrisUiStateRuntime.getTeamTetrisPlacedByLabel;
    const getTeamTetrisPartnerRoleLabel =
      teamTetrisUiStateRuntime.getTeamTetrisPartnerRoleLabel;
    const getTeamTetrisTurnLabel = teamTetrisUiStateRuntime.getTeamTetrisTurnLabel;
    const getTeamTetrisResultLabel = teamTetrisUiStateRuntime.getTeamTetrisResultLabel;
    const getTeamTetrisDraftStatusText = teamTetrisUiStateRuntime.getTeamTetrisDraftStatusText;
    const getTeamTetrisStatusText = teamTetrisUiStateRuntime.getTeamTetrisStatusText;
    const replayTeamTetrisDraft = teamTetrisUiStateRuntime.replayTeamTetrisDraft;
    const buildTeamTetrisRowShiftsFromTargets =
      teamTetrisUiStateRuntime.buildTeamTetrisRowShiftsFromTargets;
    const getTeamTetrisOriginFromCell = teamTetrisUiStateRuntime.getTeamTetrisOriginFromCell;
    const getTeamTetrisSpawnPosition = teamTetrisUiStateRuntime.getTeamTetrisSpawnPosition;
    const syncTeamTetrisDraftFromState = teamTetrisUiStateRuntime.syncTeamTetrisDraftFromState;
    const startTeamTetrisDrag = teamTetrisUiStateRuntime.startTeamTetrisDrag;
    const updateTeamTetrisDraftTarget = teamTetrisUiStateRuntime.updateTeamTetrisDraftTarget;
    const finishTeamTetrisDrag = teamTetrisUiStateRuntime.finishTeamTetrisDrag;
    const onTeamTetrisRotationSelect = teamTetrisUiStateRuntime.onTeamTetrisRotationSelect;
    const onTeamTetrisRotate = teamTetrisUiStateRuntime.onTeamTetrisRotate;
    const onTeamTetrisClearDraft = teamTetrisUiStateRuntime.onTeamTetrisClearDraft;
    const onTeamTetrisSubmit = teamTetrisUiStateRuntime.onTeamTetrisSubmit;
    const onTeamTetrisStart = teamTetrisUiStateRuntime.onTeamTetrisStart;
    const onTeamTetrisReset = teamTetrisUiStateRuntime.onTeamTetrisReset;
    const moduleCardRuntime = createTeamTetrisUiModuleCardRuntime({
      getState: getState,
      createSlot: createSlot,
      createElement: createElement,
      text: text,
      getTeamTetrisRotationCells: getTeamTetrisRotationCells,
      getTeamTetrisPieceBounds: getTeamTetrisPieceBounds,
      sanitizeTeamTetrisRows: sanitizeTeamTetrisRows,
      startTeamTetrisDrag: startTeamTetrisDrag,
      updateTeamTetrisDraftTarget: updateTeamTetrisDraftTarget,
      finishTeamTetrisDrag: finishTeamTetrisDrag,
    });
    const moduleShellRuntime = createTeamTetrisUiModuleShellRuntime({
      getState: getState,
      featureId: featureId,
      createElement: createElement,
      text: text,
      render: render,
      getFeatureLabel: getFeatureLabel,
      createTeamTetrisMetric: moduleCardRuntime.createTeamTetrisMetric,
      createTeamTetrisPieceCard: moduleCardRuntime.createTeamTetrisPieceCard,
      createTeamTetrisRequirementCard: moduleCardRuntime.createTeamTetrisRequirementCard,
      createTeamTetrisSnapshotCard: moduleCardRuntime.createTeamTetrisSnapshotCard,
      renderTeamTetrisBoardCard: moduleCardRuntime.renderTeamTetrisBoardCard,
      getTeamTetrisView: getTeamTetrisView,
      getTeamTetrisBoardLabel: getTeamTetrisBoardLabel,
      getTeamTetrisSeatDisplayLabel: getTeamTetrisSeatDisplayLabel,
      getTeamTetrisPendingTurn: getTeamTetrisPendingTurn,
      getTeamTetrisOwnBoardState: getTeamTetrisOwnBoardState,
      getTeamTetrisOpponentBoardState: getTeamTetrisOpponentBoardState,
      getTeamTetrisPlacedByLabel: getTeamTetrisPlacedByLabel,
      getTeamTetrisPartnerRoleLabel: getTeamTetrisPartnerRoleLabel,
      getTeamTetrisTurnLabel: getTeamTetrisTurnLabel,
      getTeamTetrisResultLabel: getTeamTetrisResultLabel,
      getTeamTetrisDraftStatusText: getTeamTetrisDraftStatusText,
      getTeamTetrisStatusText: getTeamTetrisStatusText,
      onTeamTetrisRotationSelect: onTeamTetrisRotationSelect,
      onTeamTetrisRotate: onTeamTetrisRotate,
      onTeamTetrisClearDraft: onTeamTetrisClearDraft,
      onTeamTetrisSubmit: onTeamTetrisSubmit,
      onTeamTetrisStart: onTeamTetrisStart,
      onTeamTetrisReset: onTeamTetrisReset,
    });

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
        renderTeamTetris: moduleShellRuntime.renderTeamTetris,
        getTestBridge: getTestBridge,
      };
    };
})(typeof window !== "undefined" ? window : globalThis);
