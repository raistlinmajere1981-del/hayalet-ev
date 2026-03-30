(function (global: GameRoomUiGlobal) {
  function getFactoryRegistry(host: GameRoomUiGlobal): GameRoomUiFactoriesRegistry {
    return host.GameRoomUiFactories || (host.GameRoomUiFactories = {});
  }

  const registry = getFactoryRegistry(global);

  registry.createFateKnotsUiNarrativeStageRuntime =
    function createFateKnotsUiNarrativeStageRuntime(
      deps: GameRoomFateKnotsUiNarrativeStageRuntimeDeps
    ): GameRoomFateKnotsUiNarrativeStageRuntime {
      function createDecisionSurface(
        state: GameRoomFateKnotsState,
        step: GameRoomFateKnotsCurrentStep
      ): HTMLElement {
        const decision = state.decision;
        const denominator =
          decision?.participantIds.length && decision.participantIds.length > 0
            ? decision.participantIds.length
            : state.participants.length;
        const surface = deps.createFrame(
          "section",
          "fk-stage-frame fk-stage-frame--decision fk-decision-surface",
          ["action-zone", "selection-zone", "summary-status", "decision-surface"],
          {
            overlay: deps.getUiAsset("notificationBanner"),
            frame: deps.getUiAsset("sidePanelFrame"),
            texture: deps.getUiAsset("darkPanel"),
          }
        );
        surface.append(
          deps.createElement(
            "p",
            "fk-frame__eyebrow",
            deps.t(["fateKnots", "scenario", "choicesLabel"], "Common Decision")
          )
        );
        surface.append(
          deps.createSeatRibbon(
            state,
            "scenario-presence",
            decision?.pendingSeatIds[0] || null
          )
        );
        const stack = deps.createRegion("div", "fk-decision-stack", null);
        step.choices.forEach(function (choice: GameRoomFateKnotsChoice) {
          const voteCount = Object.values(decision ? decision.votes : {}).filter(function (
            value: string | null | undefined
          ) {
            return value === choice.id;
          }).length;
          const button = deps.createRegion("button", "fk-decision-card", null) as HTMLButtonElement;
          button.type = "button";
          button.dataset["selected"] = decision?.votes["user"] === choice.id ? "true" : "false";
          deps.applyFrameArtwork(button, {
            overlay:
              button.dataset["selected"] === "true"
                ? deps.getUiAsset("cardSelected")
                : deps.getUiAsset("cardHoverGlow"),
            frame: deps.getUiAsset("buttonPlate"),
            texture: deps.getUiAsset("choiceButton"),
          });
          button.append(deps.createElement("strong", "fk-decision-card__title", choice.label));
          button.append(
            deps.createElement("span", "fk-decision-card__summary", choice.summary || "")
          );
          button.append(
            deps.createElement(
              "span",
              "fk-decision-card__vote",
              String(voteCount) + "/" + String(denominator)
            )
          );
          button.addEventListener("click", function () {
            deps.sendChoice(state, choice.id);
          });
          stack.append(button);
        });
        surface.append(stack);
        if (decision?.conflict === true) {
          surface.append(
            deps.createElement(
              "p",
              "fk-frame__hint",
              deps.t(
                ["fateKnots", "scenario", "conflict"],
                "Votes conflicted. Sync to re-request the AI seats."
              )
            )
          );
        }
        if (decision?.pendingSeatIds.length) {
          surface.append(
            deps.createElement(
              "p",
              "fk-frame__hint",
              deps.t(["fateKnots", "scenario", "pending"], "Awaiting") +
                ": " +
                decision.pendingSeatIds.join(", ")
            )
          );
        }
        const actions = deps.createRegion("div", "fk-action-cluster", "action-zone");
        actions.append(
          deps.createActionButton(
            deps.t(["fateKnots", "controls", "sync"], "Sync"),
            "secondary",
            false,
            function () {
              deps.sendSync(state);
            }
          )
        );
        actions.append(
          deps.createActionButton(
            deps.t(["fateKnots", "controls", "reset"], "Reset Run"),
            "secondary",
            false,
            function () {
              deps.sendRoomCommand("GameRoomFateKnotsReset", {});
            }
          )
        );
        surface.append(actions);
        return surface;
      }

      function renderNarrativeStage(
        parent: HTMLElement,
        state: GameRoomFateKnotsState
      ): void {
        const step = state.currentStep;
        if (!step) {
          parent.append(
            deps.createFrame(
              "section",
              "fk-stage-frame fk-stage-frame--scene",
              ["main-scene", "scene-shell"],
              {
                overlay: deps.getUiAsset("systemMessageBox"),
                frame: deps.getUiAsset("mainSceneFrame"),
                texture: deps.getUiAsset("darkPanel"),
              }
            )
          );
          return;
        }

        const layout = deps.createRegion("section", "fk-scenario", "scenario-layout");
        const sceneShell = deps.createFrame(
          "section",
          "fk-stage-frame fk-stage-frame--scene fk-scene-shell",
          ["main-scene", "summary-status", "scene-shell"],
          {
            overlay: deps.getUiAsset("subtleRuneOverlay"),
            frame: deps.getUiAsset("mainSceneFrame"),
            texture: deps.getUiAsset("defaultPanel"),
          }
        );
        const copy = deps.createRegion("div", "fk-scene-shell__copy", null);
        copy.append(
          deps.createElement(
            "p",
            "fk-frame__eyebrow",
            step.location?.label || deps.t(["fateKnots", "scenario", "mapLabel"], "Map")
          )
        );
        copy.append(deps.createElement("h2", "fk-frame__title", step.title));
        copy.append(deps.createElement("p", "fk-scene-shell__body", step.body));
        if (step.speaker) {
          copy.append(
            deps.createElement(
              "p",
              "fk-frame__hint",
              deps.t(["fateKnots", "scenario", "speaker"], "Speaker") + ": " + step.speaker
            )
          );
        }
        sceneShell.append(copy);
        const visual = deps.createRegion("div", "fk-scene-shell__visual", null);
        deps.appendImage(visual, "fk-scene-shell__image", step.sceneAsset, step.title);
        visual.append(deps.createSeatRibbon(state, "scene-presence", null));
        sceneShell.append(visual);
        if (step.npcs.length || step.items.length || step.creatures.length) {
          const strip = deps.createRegion("div", "fk-evidence-strip", null);
          step.npcs.forEach(function (assetLink: GameRoomFateKnotsAssetLink) {
            strip.append(
              deps.createEvidenceCard(assetLink, assetLink.assetId || "NPC", "location")
            );
          });
          step.items.forEach(function (assetLink: GameRoomFateKnotsAssetLink) {
            strip.append(deps.createEvidenceCard(assetLink, assetLink.assetId || "Item", "item"));
          });
          step.creatures.forEach(function (assetLink: GameRoomFateKnotsAssetLink) {
            strip.append(
              deps.createEvidenceCard(assetLink, assetLink.assetId || "Creature", "creature")
            );
          });
          sceneShell.append(strip);
        }
        layout.append(sceneShell);

        const lower = deps.createRegion("div", "fk-scenario__lower", null);
        const narrativeRail = deps.createRegion("div", "fk-scenario__rail", "support-rail");
        narrativeRail.append(deps.createNarrationPanel(state, "narration-panel"));
        narrativeRail.append(deps.createLogFeed(state));
        lower.append(narrativeRail);
        lower.append(createDecisionSurface(state, step));
        layout.append(lower);
        parent.append(layout);
      }

      return {
        renderNarrativeStage: renderNarrativeStage,
      };
    };
})(window as unknown as GameRoomUiGlobal);
