(function (global: any) {
  const registry = global.GameRoomUiFactories || (global.GameRoomUiFactories = {});

  registry.createFateKnotsUiJourneyStageRuntime = function createFateKnotsUiJourneyStageRuntime(deps: any) {
    const createFateKnotsUiJourneyOverviewRuntime =
      registry.createFateKnotsUiJourneyOverviewRuntime;
    if (typeof createFateKnotsUiJourneyOverviewRuntime !== "function") {
      throw new Error("Fate Knots UI journey overview runtime is not registered.");
    }
    const fateKnotsUiJourneyOverviewRuntime = createFateKnotsUiJourneyOverviewRuntime({
      KNOWN_SEAT_IDS: deps.KNOWN_SEAT_IDS,
      appendImage: deps.appendImage,
      applyFrameArtwork: deps.applyFrameArtwork,
      createActionButton: deps.createActionButton,
      createDefaultAsset: deps.createDefaultAsset,
      createElement: deps.createElement,
      createFrame: deps.createFrame,
      createMapPathLayer: deps.createMapPathLayer,
      createRegion: deps.createRegion,
      createSeatPlaque: deps.createSeatPlaque,
      formatHistoryTimestamp: deps.formatHistoryTimestamp,
      getUiAsset: deps.getUiAsset,
      sendRoomCommand: deps.sendRoomCommand,
      t: deps.t,
    });

    const createFateKnotsUiJourneyCreationRuntime =
      registry.createFateKnotsUiJourneyCreationRuntime;
    if (typeof createFateKnotsUiJourneyCreationRuntime !== "function") {
      throw new Error("Fate Knots UI journey creation runtime is not registered.");
    }
    const fateKnotsUiJourneyCreationRuntime = createFateKnotsUiJourneyCreationRuntime({
      KNOWN_SEAT_IDS: deps.KNOWN_SEAT_IDS,
      appendImage: deps.appendImage,
      buildSeatDisplay: deps.buildSeatDisplay,
      createActionButton: deps.createActionButton,
      createCatalogCard: deps.createCatalogCard,
      createDefaultAsset: deps.createDefaultAsset,
      createDefaultSelection: deps.createDefaultSelection,
      createElement: deps.createElement,
      createFrame: deps.createFrame,
      createRegion: deps.createRegion,
      createSeatLabel: deps.createSeatLabel,
      formatDeck: deps.formatDeck,
      formatStats: deps.formatStats,
      getSelectionBundle: deps.getSelectionBundle,
      getUiAsset: deps.getUiAsset,
      getUserParticipant: deps.getUserParticipant,
      isSelectionComplete: deps.isSelectionComplete,
      sendReady: deps.sendReady,
      sendRoomCommand: deps.sendRoomCommand,
      sendSelection: deps.sendSelection,
      setSeatId: deps.setSeatId,
      t: deps.t,
    });

    return {
      renderOverviewStage: fateKnotsUiJourneyOverviewRuntime.renderOverviewStage,
      renderCreationStage: fateKnotsUiJourneyCreationRuntime.renderCreationStage,
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
