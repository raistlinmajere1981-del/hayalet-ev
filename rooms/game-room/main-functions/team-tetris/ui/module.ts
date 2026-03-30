(function (global: any) {
  type UnknownRecord = Record<string, unknown>;
  type TeamTetrisStateRuntime = {
    createTeamTetrisDraft: () => unknown;
    createTeamTetrisState: () => unknown;
    sanitizeTeamTetrisRows: (rows: unknown) => string[];
    sanitizeTeamTetrisState: (candidate: unknown) => unknown;
    syncTeamTetrisPreferencesFromState: () => void;
    getTeamTetrisView: () => unknown;
    getTeamTetrisBoardLabel: (teamId: string) => string;
    getTeamTetrisSeatDisplayLabel: (seatId: string) => string;
    getTeamTetrisPendingTurn: () => unknown;
    getTeamTetrisOwnBoardState: () => unknown;
    getTeamTetrisOpponentBoardState: () => unknown;
    getTeamTetrisRotationCells: (pieceId: string, rotation: number) => Array<[number, number]>;
    getTeamTetrisPieceBounds: (
      pieceId: string,
      rotation: number
    ) => { width: number; height: number };
    getTeamTetrisPlacedByLabel: (placement: unknown) => string;
    getTeamTetrisPartnerRoleLabel: () => string;
    getTeamTetrisTurnLabel: () => string;
    getTeamTetrisResultLabel: () => string;
    getTeamTetrisDraftStatusText: () => string;
    getTeamTetrisStatusText: () => string;
    replayTeamTetrisDraft: (...args: unknown[]) => unknown;
    buildTeamTetrisRowShiftsFromTargets: (...args: unknown[]) => unknown;
    getTeamTetrisOriginFromCell: (...args: unknown[]) => unknown;
    getTeamTetrisSpawnPosition: (...args: unknown[]) => unknown;
    syncTeamTetrisDraftFromState: () => void;
    startTeamTetrisDrag: (columnIndex: number, rowIndex: number) => void;
    updateTeamTetrisDraftTarget: (columnIndex: number, rowIndex: number) => void;
    finishTeamTetrisDrag: () => void;
    onTeamTetrisRotationSelect: (rotation: number) => void;
    onTeamTetrisRotate: () => void;
    onTeamTetrisClearDraft: () => void;
    onTeamTetrisSubmit: () => void;
    onTeamTetrisStart: () => void;
    onTeamTetrisReset: () => void;
  };
  type TeamTetrisModuleCardRuntime = {
    createTeamTetrisMetric: (label: string, value: string) => HTMLElement;
    createTeamTetrisPieceCard: (
      title: string,
      pieceId: string,
      rotation: number,
      subtitle: string
    ) => HTMLElement;
    createTeamTetrisRequirementCard: (slotId: string, ready: boolean) => HTMLElement;
    createTeamTetrisSnapshotCard: (title: string, rows: unknown) => HTMLElement;
    renderTeamTetrisBoardCard: (boardState: unknown, options: UnknownRecord) => HTMLElement;
  };
  type TeamTetrisModuleShellRuntime = {
    renderTeamTetris: (root: HTMLElement) => void;
  };
  type TeamTetrisModuleDeps = {
    getState: () => unknown;
    featureId?: string;
    createSlot: (slotId: string) => unknown;
    createElement: (tagName: string, className?: string, textContent?: string) => HTMLElement;
    text: (path: string[]) => string;
    render: () => void;
    getFeatureLabel: (featureId: string) => string;
    sendRoomCommand: (command: string, payload: UnknownRecord) => void;
  };

  const registry = (global.GameRoomUiFactories || (global.GameRoomUiFactories = {})) as {
    createTeamTetrisUiStateRuntime?: (deps: {
      getState: () => unknown;
      render: () => void;
      sendRoomCommand: (command: string, payload: UnknownRecord) => void;
      text: (path: string[]) => string;
    }) => TeamTetrisStateRuntime;
    createTeamTetrisUiModuleCardRuntime?: (deps: UnknownRecord) => TeamTetrisModuleCardRuntime;
    createTeamTetrisUiModuleShellRuntime?: (deps: UnknownRecord) => TeamTetrisModuleShellRuntime;
    createTeamTetrisUiModule?: (deps: TeamTetrisModuleDeps) => unknown;
  };

  registry.createTeamTetrisUiModule = function createTeamTetrisUiModule(
    deps: TeamTetrisModuleDeps
  ) {
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
    const getTeamTetrisPartnerRoleLabel = teamTetrisUiStateRuntime.getTeamTetrisPartnerRoleLabel;
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
