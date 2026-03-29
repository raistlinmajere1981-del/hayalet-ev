(function (global) {
  const registry = global.GameRoomUiFactories || (global.GameRoomUiFactories = {});

  registry.createFateKnotsUiNarrativeStageRuntime =
    function createFateKnotsUiNarrativeStageRuntime(deps) {
      function createDecisionSurface(state, step) {
        const denominator =
          state.decision &&
          Array.isArray(state.decision.participantIds) &&
          state.decision.participantIds.length > 0
            ? state.decision.participantIds.length
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
            state.decision && state.decision.pendingSeatIds && state.decision.pendingSeatIds[0]
              ? state.decision.pendingSeatIds[0]
              : null
          )
        );
        const stack = deps.createRegion("div", "fk-decision-stack", null);
        step.choices.forEach(function (choice) {
          const voteCount = Object.values(state.decision ? state.decision.votes : {}).filter(
            function (value) {
              return value === choice.id;
            }
          ).length;
          const button = deps.createRegion("button", "fk-decision-card", null);
          button.type = "button";
          button.dataset.selected =
            state.decision && state.decision.votes && state.decision.votes.user === choice.id
              ? "true"
              : "false";
          deps.applyFrameArtwork(button, {
            overlay:
              button.dataset.selected === "true"
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
        if (state.decision && state.decision.conflict === true) {
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
        if (
          state.decision &&
          state.decision.pendingSeatIds &&
          state.decision.pendingSeatIds.length > 0
        ) {
          surface.append(
            deps.createElement(
              "p",
              "fk-frame__hint",
              deps.t(["fateKnots", "scenario", "pending"], "Awaiting") +
                ": " +
                state.decision.pendingSeatIds.join(", ")
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

      function renderNarrativeStage(parent, state) {
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
            step.location && step.location.label
              ? step.location.label
              : deps.t(["fateKnots", "scenario", "mapLabel"], "Map")
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
          step.npcs.forEach(function (assetLink) {
            strip.append(
              deps.createEvidenceCard(assetLink, assetLink.assetId || "NPC", "location")
            );
          });
          step.items.forEach(function (assetLink) {
            strip.append(deps.createEvidenceCard(assetLink, assetLink.assetId || "Item", "item"));
          });
          step.creatures.forEach(function (assetLink) {
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
})(typeof window !== "undefined" ? window : globalThis);
