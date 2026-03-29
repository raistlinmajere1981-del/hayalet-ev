(function(global) {
  const registry = global.GameRoomUiFactories || (global.GameRoomUiFactories = {});
  registry.createFateKnotsUiStateRuntime = function createFateKnotsUiStateRuntime(deps) {
    const createFateKnotsUiStateDefaultsRuntime = registry.createFateKnotsUiStateDefaultsRuntime;
    const createFateKnotsUiStateSanitizeRuntime = registry.createFateKnotsUiStateSanitizeRuntime;
    const createFateKnotsUiStateSupportRuntime = registry.createFateKnotsUiStateSupportRuntime;
    if (typeof createFateKnotsUiStateDefaultsRuntime !== "function") {
      throw new Error("Fate Knots state defaults runtime is required.");
    }
    if (typeof createFateKnotsUiStateSanitizeRuntime !== "function") {
      throw new Error("Fate Knots state sanitize runtime is required.");
    }
    if (typeof createFateKnotsUiStateSupportRuntime !== "function") {
      throw new Error("Fate Knots state support runtime is required.");
    }
    const defaultsRuntime = createFateKnotsUiStateDefaultsRuntime();
    const sanitizeRuntime = createFateKnotsUiStateSanitizeRuntime();
    const supportRuntime = createFateKnotsUiStateSupportRuntime(deps);
    return {
      createDefaultAsset: defaultsRuntime.createDefaultAsset,
      createDefaultSelection: defaultsRuntime.createDefaultSelection,
      createFateKnotsState: defaultsRuntime.createFateKnotsState,
      findParticipant: supportRuntime.findParticipant,
      formatDeck: supportRuntime.formatDeck,
      formatDeadline: supportRuntime.formatDeadline,
      formatHistoryTimestamp: supportRuntime.formatHistoryTimestamp,
      formatStats: supportRuntime.formatStats,
      getCurrentState: supportRuntime.getCurrentState,
      getCurrentStatus: supportRuntime.getCurrentStatus,
      getPhaseLabel: supportRuntime.getPhaseLabel,
      getSelectionBundle: supportRuntime.getSelectionBundle,
      getUserParticipant: supportRuntime.getUserParticipant,
      isSelectionComplete: supportRuntime.isSelectionComplete,
      sanitizeAssetLink: sanitizeRuntime.sanitizeAssetLink,
      sanitizeFateKnotsState: sanitizeRuntime.sanitizeFateKnotsState,
      sendChoice: supportRuntime.sendChoice,
      sendCombatAction: supportRuntime.sendCombatAction,
      sendReady: supportRuntime.sendReady,
      sendSelection: supportRuntime.sendSelection,
      sendSync: supportRuntime.sendSync,
      t: supportRuntime.t
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
