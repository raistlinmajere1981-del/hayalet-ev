(function (global: GameRoomUiGlobal) {
  function getFactoryRegistry(host: GameRoomUiGlobal): GameRoomUiFactoriesRegistry {
    return host.GameRoomUiFactories || (host.GameRoomUiFactories = {});
  }

  const registry = getFactoryRegistry(global);

  registry.createFateKnotsUiStageRuntime = function createFateKnotsUiStageRuntime(
    deps: GameRoomFateKnotsUiStageRuntimeDeps
  ): GameRoomFateKnotsUiStageRuntime {
    const createFateKnotsUiStageSupportRuntime = registry.createFateKnotsUiStageSupportRuntime;
    if (typeof createFateKnotsUiStageSupportRuntime !== "function") {
      throw new Error("Fate Knots UI stage support runtime is not registered.");
    }
    const fateKnotsUiStageSupportRuntime = createFateKnotsUiStageSupportRuntime({
      appendImage: deps.appendImage,
      createElement: deps.createElement,
      createFrame: deps.createFrame,
      getCurrentStatus: deps.getCurrentStatus,
      getUiAsset: deps.getUiAsset,
      t: deps.t,
    });

    const createFateKnotsUiNarrativeStageRuntime = registry.createFateKnotsUiNarrativeStageRuntime;
    if (typeof createFateKnotsUiNarrativeStageRuntime !== "function") {
      throw new Error("Fate Knots UI narrative stage runtime is not registered.");
    }
    const fateKnotsUiNarrativeStageRuntime = createFateKnotsUiNarrativeStageRuntime({
      appendImage: deps.appendImage,
      applyFrameArtwork: deps.applyFrameArtwork,
      createActionButton: deps.createActionButton,
      createElement: deps.createElement,
      createEvidenceCard: fateKnotsUiStageSupportRuntime.createEvidenceCard,
      createFrame: deps.createFrame,
      createLogFeed: fateKnotsUiStageSupportRuntime.createLogFeed,
      createNarrationPanel: fateKnotsUiStageSupportRuntime.createNarrationPanel,
      createRegion: deps.createRegion,
      createSeatRibbon: deps.createSeatRibbon,
      getUiAsset: deps.getUiAsset,
      sendChoice: deps.sendChoice,
      sendRoomCommand: deps.sendRoomCommand,
      sendSync: deps.sendSync,
      t: deps.t,
    });

    const createFateKnotsUiCombatStageRuntime = registry.createFateKnotsUiCombatStageRuntime;
    if (typeof createFateKnotsUiCombatStageRuntime !== "function") {
      throw new Error("Fate Knots UI combat stage runtime is not registered.");
    }
    const fateKnotsUiCombatStageRuntime = createFateKnotsUiCombatStageRuntime({
      appendImage: deps.appendImage,
      appendNpcBanter: deps.appendNpcBanter,
      applyFrameArtwork: deps.applyFrameArtwork,
      createActionButton: deps.createActionButton,
      createDefaultSelection: deps.createDefaultSelection,
      createElement: deps.createElement,
      createFrame: deps.createFrame,
      createNarrationPanel: fateKnotsUiStageSupportRuntime.createNarrationPanel,
      createRegion: deps.createRegion,
      createSeatRibbon: deps.createSeatRibbon,
      createStatBadge: deps.createStatBadge,
      getUiAsset: deps.getUiAsset,
      sendCombatAction: deps.sendCombatAction,
      sendRoomCommand: deps.sendRoomCommand,
      sendSync: deps.sendSync,
      setSeatId: deps.setSeatId,
      t: deps.t,
    });
    const renderNarrativeStage = fateKnotsUiNarrativeStageRuntime.renderNarrativeStage;
    const renderCombatStage = fateKnotsUiCombatStageRuntime.renderCombatStage;

    function renderResultStage(parent: HTMLElement, state: GameRoomFateKnotsState): void {
      const layout = deps.createRegion("section", "fk-result", "result-layout");
      const resultShell = deps.createFrame(
        "section",
        "fk-stage-frame fk-stage-frame--scene fk-result-shell",
        ["main-scene", "summary-status", "result-shell"],
        {
          overlay: deps.getUiAsset("notificationBanner"),
          frame: deps.getUiAsset("mainSceneFrame"),
          texture: deps.getUiAsset("defaultPanel"),
        }
      );
      resultShell.append(
        deps.createElement(
          "p",
          "fk-frame__eyebrow",
          deps.t(["fateKnots", "result", "label"], "Result")
        )
      );
      resultShell.append(
        deps.createElement(
          "h2",
          "fk-frame__title",
          state.result.title || deps.t(["fateKnots", "result", "titleFallback"], "Run Complete")
        )
      );
      resultShell.append(
        deps.createElement(
          "p",
          "fk-scene-shell__body",
          state.result.summary || deps.getCurrentStatus(state)
        )
      );
      if (state.result.continueHint) {
        resultShell.append(deps.createElement("p", "fk-frame__hint", state.result.continueHint));
      }
      resultShell.append(deps.createSeatRibbon(state, "result-ribbon", null));
      resultShell.append(
        fateKnotsUiStageSupportRuntime.createNarrationPanel(state, ["narration-panel", "narration"])
      );
      const actions = deps.createRegion("div", "fk-action-cluster", "action-zone");
      actions.append(
        deps.createActionButton(
          deps.t(["fateKnots", "controls", "reset"], "Reset Run"),
          "primary",
          false,
          function () {
            deps.sendRoomCommand("GameRoomFateKnotsReset", {});
          }
        )
      );
      actions.append(
        deps.createActionButton(
          deps.t(["fateKnots", "controls", "end"], "End Run"),
          "secondary",
          false,
          function () {
            deps.sendRoomCommand("GameRoomFateKnotsEnd", { sessionId: state.sessionId });
          }
        )
      );
      resultShell.append(actions);
      layout.append(resultShell);
      const supportRail = deps.createRegion("aside", "fk-overview__rail", ["support-rail", "log"]);
      supportRail.append(fateKnotsUiStageSupportRuntime.createLogFeed(state));
      layout.append(supportRail);
      parent.append(layout);
    }

    return {
      renderNarrativeStage: renderNarrativeStage,
      renderCombatStage: renderCombatStage,
      renderResultStage: renderResultStage,
    };
  };
})(window as unknown as GameRoomUiGlobal);
