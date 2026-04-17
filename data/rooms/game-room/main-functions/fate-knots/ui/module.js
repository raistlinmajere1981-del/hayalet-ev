(function(global) {
  function getFactoryRegistry(host) {
    return host.GameRoomUiFactories || (host.GameRoomUiFactories = {});
  }
  const registry = getFactoryRegistry(global);
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
      getCurrentState,
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
    const createFateKnotsUiStageSupportRuntime = registry.createFateKnotsUiStageSupportRuntime;
    if (typeof createFateKnotsUiStageSupportRuntime !== "function") {
      throw new Error("Fate Knots UI stage support runtime is not registered.");
    }
    const fateKnotsUiStageSupportRuntime = createFateKnotsUiStageSupportRuntime({
      appendImage,
      createElement,
      createFrame,
      getCurrentStatus,
      getUiAsset,
      t
    });
    const fateKnotsUiStageRuntime = createFateKnotsUiStageRuntime({
      appendImage,
      appendNpcBanter,
      applyFrameArtwork,
      createActionButton,
      createDefaultSelection,
      createElement,
      createEvidenceCard: fateKnotsUiStageSupportRuntime.createEvidenceCard,
      createFrame,
      createLogFeed: fateKnotsUiStageSupportRuntime.createLogFeed,
      createNarrationPanel: fateKnotsUiStageSupportRuntime.createNarrationPanel,
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
    function resolvePhaseIdentity(state) {
      const phaseId = state && typeof state.phase === "string" && state.phase.trim() ? state.phase.trim() : "unknown";
      if (phaseId === "idle") {
        return {
          phaseId,
          screenId: "overview",
          known: true
        };
      }
      if (phaseId === "character-creation" || phaseId === "scenario" || phaseId === "combat" || phaseId === "result") {
        return {
          phaseId,
          screenId: phaseId,
          known: true
        };
      }
      return {
        phaseId,
        screenId: "unknown",
        known: false
      };
    }
    function renderUnknownPhaseStage(parent, state, phaseIdentity) {
      const layout = createRegion("section", "fk-result", "unknown-layout");
      const warning = createFrame(
        "section",
        "fk-stage-frame fk-stage-frame--scene fk-result-shell",
        ["main-scene", "summary-status", "phase-warning"],
        {
          overlay: getUiAsset("systemMessageBox"),
          frame: getUiAsset("mainSceneFrame"),
          texture: getUiAsset("darkPanel")
        }
      );
      warning.append(createElement("p", "fk-frame__eyebrow", "Unknown Phase"));
      warning.append(createElement("h2", "fk-frame__title", phaseIdentity.phaseId));
      warning.append(
        createElement(
          "p",
          "fk-scene-shell__body",
          state.status ? state.status : "The current renderer does not have an explicit stage for this phase."
        )
      );
      layout.append(warning);
      const support = createFrame(
        "aside",
        "fk-stage-frame fk-stage-frame--rail fk-overview__rail",
        ["support-rail", "narration", "log"],
        {
          frame: getUiAsset("sidePanelFrame"),
          texture: getUiAsset("darkPanel")
        }
      );
      support.append(
        createElement(
          "p",
          "fk-frame__hint",
          "This phase is rendered explicitly so reviews do not mistake it for overview."
        )
      );
      const actions = createRegion("div", "fk-action-cluster", "action-zone");
      actions.append(
        createActionButton(
          t(["fateKnots", "controls", "reset"], "Reset Run"),
          "secondary",
          false,
          function() {
            sendRoomCommand("GameRoomFateKnotsReset", {});
          }
        )
      );
      support.append(actions);
      layout.append(support);
      parent.append(layout);
    }
    function renderFateKnots(root) {
      ensureUiAssetsPreloaded();
      const state = getCurrentState() || createFateKnotsState();
      const phaseIdentity = resolvePhaseIdentity(state);
      const shell = createRegion("div", "fk-shell", "shell");
      shell.dataset["fkPhase"] = phaseIdentity.phaseId;
      shell.dataset["fkScreen"] = phaseIdentity.screenId;
      shell.dataset["fkPhaseKnown"] = phaseIdentity.known ? "true" : "false";
      const surface = createRegion("section", "fk-surface", "surface-shell");
      applySurfaceBackdrop(surface, state);
      const inner = createRegion("div", "fk-surface__inner", null);
      inner.append(createTopbar(state, phaseIdentity.phaseId));
      if (phaseIdentity.screenId === "character-creation") {
        renderCreationStage(inner, state);
      } else if (phaseIdentity.screenId === "scenario") {
        renderNarrativeStage(inner, state);
      } else if (phaseIdentity.screenId === "combat") {
        renderCombatStage(inner, state);
      } else if (phaseIdentity.screenId === "result") {
        renderResultStage(inner, state);
      } else if (phaseIdentity.screenId === "overview") {
        renderOverviewStage(inner, state);
      } else {
        renderUnknownPhaseStage(inner, state, phaseIdentity);
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
