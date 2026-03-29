(function(global) {
  const registry = global.GameRoomUiFactories || (global.GameRoomUiFactories = {});
  registry.createFateKnotsUiModule = function createFateKnotsUiModule(deps) {
    const getState = deps.getState;
    const featureId = deps.featureId || "fate-knots";
    const createElement = deps.createElement;
    const sendRoomCommand = deps.sendRoomCommand;
    const text = deps.text;
    const createFateKnotsUiStateRuntime = registry.createFateKnotsUiStateRuntime;
    if (typeof createFateKnotsUiStateRuntime !== "function") {
      throw new Error("Fate Knots UI state runtime is not registered.");
    }
    const fateKnotsUiStateRuntime = createFateKnotsUiStateRuntime({
      featureId,
      getState,
      sendRoomCommand,
      text
    });
    const t = fateKnotsUiStateRuntime.t;
    const createDefaultAsset = fateKnotsUiStateRuntime.createDefaultAsset;
    const createDefaultSelection = fateKnotsUiStateRuntime.createDefaultSelection;
    const createFateKnotsState = fateKnotsUiStateRuntime.createFateKnotsState;
    const sanitizeAssetLink = fateKnotsUiStateRuntime.sanitizeAssetLink;
    const sanitizeFateKnotsState = fateKnotsUiStateRuntime.sanitizeFateKnotsState;
    const getCurrentState = fateKnotsUiStateRuntime.getCurrentState;
    const getCurrentStatus = fateKnotsUiStateRuntime.getCurrentStatus;
    const findParticipant = fateKnotsUiStateRuntime.findParticipant;
    const getUserParticipant = fateKnotsUiStateRuntime.getUserParticipant;
    const isSelectionComplete = fateKnotsUiStateRuntime.isSelectionComplete;
    const getSelectionBundle = fateKnotsUiStateRuntime.getSelectionBundle;
    const sendSelection = fateKnotsUiStateRuntime.sendSelection;
    const sendReady = fateKnotsUiStateRuntime.sendReady;
    const sendChoice = fateKnotsUiStateRuntime.sendChoice;
    const sendCombatAction = fateKnotsUiStateRuntime.sendCombatAction;
    const sendSync = fateKnotsUiStateRuntime.sendSync;
    const formatStats = fateKnotsUiStateRuntime.formatStats;
    const formatDeck = fateKnotsUiStateRuntime.formatDeck;
    const formatDeadline = fateKnotsUiStateRuntime.formatDeadline;
    const formatHistoryTimestamp = fateKnotsUiStateRuntime.formatHistoryTimestamp;
    const getPhaseLabel = fateKnotsUiStateRuntime.getPhaseLabel;
    const createFateKnotsUiSurfaceRuntime = registry.createFateKnotsUiSurfaceRuntime;
    if (typeof createFateKnotsUiSurfaceRuntime !== "function") {
      throw new Error("Fate Knots UI surface runtime is not registered.");
    }
    const fateKnotsUiSurfaceRuntime = createFateKnotsUiSurfaceRuntime({
      createElement,
      sanitizeAssetLink,
      createDefaultAsset
    });
    const appendImage = fateKnotsUiSurfaceRuntime.appendImage;
    const applyAssetLayers = fateKnotsUiSurfaceRuntime.applyAssetLayers;
    const applyFrameArtwork = fateKnotsUiSurfaceRuntime.applyFrameArtwork;
    const createActionButton = fateKnotsUiSurfaceRuntime.createActionButton;
    const createCatalogCard = fateKnotsUiSurfaceRuntime.createCatalogCard;
    const createFrame = fateKnotsUiSurfaceRuntime.createFrame;
    const createMapPathLayer = fateKnotsUiSurfaceRuntime.createMapPathLayer;
    const createRegion = fateKnotsUiSurfaceRuntime.createRegion;
    const createSigil = fateKnotsUiSurfaceRuntime.createSigil;
    const createStatBadge = fateKnotsUiSurfaceRuntime.createStatBadge;
    const createTextChip = fateKnotsUiSurfaceRuntime.createTextChip;
    const ensureUiAssetsPreloaded = fateKnotsUiSurfaceRuntime.ensureUiAssetsPreloaded;
    const getUiAsset = fateKnotsUiSurfaceRuntime.getUiAsset;
    const setSeatId = fateKnotsUiSurfaceRuntime.setSeatId;
    const KNOWN_SEAT_IDS = ["user", "ai1", "ai2", "us1"];
    const createFateKnotsUiChromeRuntime = registry.createFateKnotsUiChromeRuntime;
    if (typeof createFateKnotsUiChromeRuntime !== "function") {
      throw new Error("Fate Knots UI chrome runtime is not registered.");
    }
    const fateKnotsUiChromeRuntime = createFateKnotsUiChromeRuntime({
      KNOWN_SEAT_IDS,
      createDefaultAsset,
      createElement,
      appendImage,
      applyAssetLayers,
      applyFrameArtwork,
      createFrame,
      createRegion,
      createSigil,
      createTextChip,
      findParticipant,
      formatDeadline,
      getCurrentStatus,
      getPhaseLabel,
      getSelectionBundle,
      getUiAsset,
      setSeatId,
      t
    });
    const appendNpcBanter = fateKnotsUiChromeRuntime.appendNpcBanter;
    const applySurfaceBackdrop = fateKnotsUiChromeRuntime.applySurfaceBackdrop;
    const buildSeatDisplay = fateKnotsUiChromeRuntime.buildSeatDisplay;
    const createSeatLabel = fateKnotsUiChromeRuntime.createSeatLabel;
    const createSeatPlaque = fateKnotsUiChromeRuntime.createSeatPlaque;
    const createSeatRibbon = fateKnotsUiChromeRuntime.createSeatRibbon;
    const createSurfaceCorner = fateKnotsUiChromeRuntime.createSurfaceCorner;
    const createTopbar = fateKnotsUiChromeRuntime.createTopbar;
    const createFateKnotsUiJourneyStageRuntime = registry.createFateKnotsUiJourneyStageRuntime;
    if (typeof createFateKnotsUiJourneyStageRuntime !== "function") {
      throw new Error("Fate Knots UI journey stage runtime is not registered.");
    }
    const fateKnotsUiJourneyStageRuntime = createFateKnotsUiJourneyStageRuntime({
      KNOWN_SEAT_IDS,
      appendImage,
      applyFrameArtwork,
      buildSeatDisplay,
      createActionButton,
      createCatalogCard,
      createDefaultAsset,
      createDefaultSelection,
      createElement,
      createFrame,
      createMapPathLayer,
      createRegion,
      createSeatLabel,
      createSeatPlaque,
      formatDeck,
      formatHistoryTimestamp,
      formatStats,
      getCurrentStatus,
      getSelectionBundle,
      getUiAsset,
      getUserParticipant,
      isSelectionComplete,
      sendReady,
      sendRoomCommand,
      sendSelection,
      setSeatId,
      t
    });
    const renderOverviewStage = fateKnotsUiJourneyStageRuntime.renderOverviewStage;
    const renderCreationStage = fateKnotsUiJourneyStageRuntime.renderCreationStage;
    const createFateKnotsUiStageRuntime = registry.createFateKnotsUiStageRuntime;
    if (typeof createFateKnotsUiStageRuntime !== "function") {
      throw new Error("Fate Knots UI stage runtime is not registered.");
    }
    const fateKnotsUiStageRuntime = createFateKnotsUiStageRuntime({
      appendImage,
      appendNpcBanter,
      applyFrameArtwork,
      createActionButton,
      createDefaultSelection,
      createElement,
      createFrame,
      createRegion,
      createSeatRibbon,
      createStatBadge,
      getCurrentStatus,
      getUiAsset,
      sendChoice,
      sendCombatAction,
      sendRoomCommand,
      sendSync,
      setSeatId,
      t
    });
    const renderNarrativeStage = fateKnotsUiStageRuntime.renderNarrativeStage;
    const renderCombatStage = fateKnotsUiStageRuntime.renderCombatStage;
    const renderResultStage = fateKnotsUiStageRuntime.renderResultStage;
    function renderFateKnots(root) {
      ensureUiAssetsPreloaded();
      const state = getCurrentState();
      const phaseId = state.phase === "character-creation" ? "character-creation" : state.phase === "scenario" ? "scenario" : state.phase === "combat" ? "combat" : state.phase === "result" ? "result" : "overview";
      const shell = createRegion("div", "fk-shell", "shell");
      shell.dataset.fkPhase = phaseId;
      const surface = createRegion("section", "fk-surface", "surface-shell");
      applySurfaceBackdrop(surface, state);
      const inner = createRegion("div", "fk-surface__inner", null);
      inner.append(createTopbar(state, phaseId));
      if (phaseId === "character-creation") {
        renderCreationStage(inner, state);
      } else if (phaseId === "scenario") {
        renderNarrativeStage(inner, state);
      } else if (phaseId === "combat") {
        renderCombatStage(inner, state);
      } else if (phaseId === "result") {
        renderResultStage(inner, state);
      } else {
        renderOverviewStage(inner, state);
      }
      surface.append(createSurfaceCorner("nw", getUiAsset("cornerOrnament")));
      surface.append(createSurfaceCorner("se", getUiAsset("cornerOrnament")));
      surface.append(inner);
      shell.append(surface);
      root.replaceChildren(shell);
    }
    return {
      createFateKnotsState,
      sanitizeFateKnotsState,
      renderFateKnots
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
