(function(global) {
  function getFactoryRegistry(host) {
    return host.GameRoomUiFactories || (host.GameRoomUiFactories = {});
  }
  const registry = getFactoryRegistry(global);
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
      sanitizeCatalogEntry: sanitizeRuntime.sanitizeCatalogEntry,
      sanitizeSelection: sanitizeRuntime.sanitizeSelection,
      sanitizeParticipant: sanitizeRuntime.sanitizeParticipant,
      sanitizeCurrentStep: sanitizeRuntime.sanitizeCurrentStep,
      sanitizeDecision: sanitizeRuntime.sanitizeDecision,
      sanitizeCombat: sanitizeRuntime.sanitizeCombat,
      sanitizeUiAssets: sanitizeRuntime.sanitizeUiAssets,
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
