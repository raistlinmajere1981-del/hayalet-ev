(function (global) {
  const registry = global.GameRoomUiFactories || (global.GameRoomUiFactories = {});

  registry.createFateKnotsUiStageSupportRuntime = function createFateKnotsUiStageSupportRuntime(
    deps
  ) {
    function createNarrationPanel(state, role) {
      const panel = deps.createFrame(
        "section",
        "fk-stage-frame fk-stage-frame--log fk-narration-panel",
        role || "narration-panel",
        {
          overlay: deps.getUiAsset("notificationBanner"),
          frame: deps.getUiAsset("logPanelFrame"),
          texture: deps.getUiAsset("darkPanel"),
        }
      );
      panel.append(
        deps.createElement(
          "p",
          "fk-frame__eyebrow",
          deps.t(["fateKnots", "narration", "title"], "DM Thread")
        )
      );
      if (state.dmNarration && state.dmNarration.text) {
        panel.append(deps.createElement("p", "fk-narration-panel__text", state.dmNarration.text));
      } else {
        panel.append(
          deps.createElement(
            "p",
            "fk-frame__hint",
            deps.t(
              ["fateKnots", "narration", "empty"],
              "Ambient narration will appear here when a packet arrives."
            )
          )
        );
      }
      return panel;
    }

    function createEvidenceCard(assetLink, label, family) {
      const card = deps.createFrame("div", "fk-evidence-card", null, {
        overlay: deps.getUiAsset("parchmentStain"),
        frame: deps.getUiAsset("cardSlotFrame"),
        texture:
          family === "creature"
            ? deps.getUiAsset("creatureCardTemplate")
            : family === "location"
              ? deps.getUiAsset("locationCardTemplate")
              : deps.getUiAsset("itemCardTemplate"),
      });
      deps.appendImage(card, "fk-evidence-card__image", assetLink, label);
      card.append(deps.createElement("span", "fk-evidence-card__label", label));
      return card;
    }

    function createLogFeed(state) {
      const feed = deps.createFrame(
        "section",
        "fk-stage-frame fk-stage-frame--log fk-log-feed",
        "story-feed",
        {
          overlay: deps.getUiAsset("logPanel"),
          frame: deps.getUiAsset("logPanelFrame"),
          texture: deps.getUiAsset("darkPanel"),
        }
      );
      feed.append(
        deps.createElement(
          "p",
          "fk-frame__eyebrow",
          deps.t(["fateKnots", "scenario", "logLabel"], "Story Log")
        )
      );
      if (state.scenarioLog.length === 0) {
        feed.append(deps.createElement("p", "fk-frame__hint", deps.getCurrentStatus(state)));
        return feed;
      }
      state.scenarioLog
        .slice()
        .reverse()
        .forEach(function (entry) {
          const item = deps.createFrame("div", "fk-log-feed__entry", null, {
            overlay: deps.getUiAsset("systemMessageBox"),
            frame: deps.getUiAsset("buttonPlate"),
            texture: deps.getUiAsset("darkPanel"),
          });
          item.append(deps.createElement("p", "fk-log-feed__text", entry));
          feed.append(item);
        });
      return feed;
    }

    return {
      createNarrationPanel: createNarrationPanel,
      createEvidenceCard: createEvidenceCard,
      createLogFeed: createLogFeed,
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
