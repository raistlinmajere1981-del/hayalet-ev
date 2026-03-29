(function(global) {
  const registry = global.GameRoomUiFactories || (global.GameRoomUiFactories = {});
  registry.createFateKnotsUiJourneyOverviewRuntime = function createFateKnotsUiJourneyOverviewRuntime(deps) {
    function createMemoryRail(state) {
      const panel = deps.createFrame(
        "section",
        "fk-stage-frame fk-stage-frame--rail fk-memory-rail",
        "history-rail"
      );
      panel.append(
        deps.createElement(
          "p",
          "fk-frame__eyebrow",
          deps.t(["fateKnots", "memory", "profileTitle"], "Remembered Build")
        )
      );
      const profileBlock = deps.createRegion("div", "fk-memory-rail__block", null);
      const profileValues = [
        state.profile?.avatarId || "-",
        state.profile?.classId || "-",
        state.profile?.backgroundId || "-"
      ];
      profileBlock.append(
        deps.createElement("strong", "fk-memory-rail__title", profileValues.join(" / "))
      );
      profileBlock.append(
        deps.createElement(
          "p",
          "fk-frame__hint",
          deps.t(
            ["fateKnots", "memory", "saveSlotIdle"],
            "Full resume stays deferred for now."
          )
        )
      );
      panel.append(profileBlock);
      const historyBlock = deps.createRegion("div", "fk-memory-rail__block", null);
      historyBlock.append(
        deps.createElement(
          "p",
          "fk-frame__eyebrow",
          deps.t(["fateKnots", "memory", "historyTitle"], "Recent Knots")
        )
      );
      const historyList = deps.createRegion("div", "fk-history-list", null);
      if (Array.isArray(state.history) && state.history.length > 0) {
        state.history.slice(0, 3).forEach(function(entry) {
          const item = deps.createRegion("div", "fk-history-list__item", null);
          const title = entry && entry.title ? entry.title : deps.t(["fateKnots", "result", "titleFallback"], "Run Complete");
          item.append(deps.createElement("strong", "fk-history-list__title", title));
          item.append(
            deps.createElement(
              "span",
              "fk-history-list__meta",
              deps.formatHistoryTimestamp(entry.timestamp)
            )
          );
          item.append(deps.createElement("p", "fk-frame__hint", entry.summary || ""));
          historyList.append(item);
        });
      } else {
        historyList.append(
          deps.createElement(
            "p",
            "fk-frame__hint",
            deps.t(["fateKnots", "memory", "emptyHistory"], "No completed runs yet.")
          )
        );
      }
      historyBlock.append(historyList);
      panel.append(historyBlock);
      return panel;
    }
    function createMapShell(state) {
      const shell = deps.createFrame(
        "section",
        "fk-stage-frame fk-stage-frame--scene fk-map-shell",
        "map-shell",
        {
          overlay: deps.getUiAsset("subtleRuneOverlay"),
          frame: deps.getUiAsset("mainSceneFrame"),
          texture: deps.getUiAsset("defaultPanel")
        }
      );
      const header = deps.createRegion("div", "fk-frame__header", null);
      header.append(
        deps.createElement("p", "fk-frame__eyebrow", deps.t(["fateKnots", "map", "title"], "Route Map"))
      );
      header.append(
        deps.createElement("h2", "fk-frame__title", deps.t(["fateKnots", "heroTitle"], "Fate Knots"))
      );
      header.append(
        deps.createElement(
          "p",
          "fk-frame__hint",
          deps.t(
            ["fateKnots", "heroSubtitle"],
            "A co-op story-combat slice with deterministic AI companions, unanimous votes, and one opening encounter."
          )
        )
      );
      shell.append(header);
      const figure = deps.createRegion("div", "fk-map-shell__figure", null);
      const mapAsset = state.map && state.map.mapAsset ? state.map.mapAsset : deps.createDefaultAsset(null);
      deps.appendImage(
        figure,
        "fk-map-shell__image",
        mapAsset,
        deps.t(["fateKnots", "map", "title"], "Route Map")
      );
      if (state.map && Array.isArray(state.map.nodes)) {
        figure.append(deps.createMapPathLayer(state.map.nodes, state.map.currentLocationId));
      }
      const crest = deps.createRegion("div", "fk-map-shell__crest", null);
      deps.applyFrameArtwork(crest, { texture: deps.getUiAsset("mapCrest") });
      figure.append(crest);
      if (state.map && Array.isArray(state.map.nodes)) {
        state.map.nodes.forEach(function(node) {
          if (!node || !node.marker) {
            return;
          }
          const marker = deps.createRegion(
            "div",
            "fk-map-shell__marker" + (state.map.currentLocationId === node.id ? " fk-map-shell__marker--active" : ""),
            null
          );
          marker.style.left = String(node.marker.xPct || 0) + "%";
          marker.style.top = String(node.marker.yPct || 0) + "%";
          deps.applyFrameArtwork(marker, {
            texture: state.map.currentLocationId === node.id ? deps.getUiAsset("activeMarker") : deps.getUiAsset("mapMarker"),
            overlay: state.map.currentLocationId === node.id ? deps.getUiAsset("selectionGlow") : deps.getUiAsset("hoverRing"),
            overlaySize: "100% 100%"
          });
          marker.append(
            deps.createElement("span", "fk-map-shell__marker-label", node.label || node.id || "Node")
          );
          figure.append(marker);
        });
      }
      shell.append(figure);
      return shell;
    }
    function renderOverviewStage(parent, state) {
      const layout = deps.createRegion("section", "fk-overview", "overview-layout");
      const main = deps.createRegion("div", "fk-overview__main", null);
      const mapShell = createMapShell(state);
      if (mapShell.classList && typeof mapShell.classList.add === "function") {
        mapShell.classList.add("fk-overview__map");
      } else {
        mapShell.className = (mapShell.className ? mapShell.className + " " : "") + "fk-overview__map";
      }
      main.append(mapShell);
      main.append(createMemoryRail(state));
      layout.append(main);
      const rail = deps.createFrame(
        "aside",
        "fk-stage-frame fk-stage-frame--rail fk-overview__rail",
        "right-rail",
        {
          frame: deps.getUiAsset("sidePanelFrame"),
          texture: deps.getUiAsset("darkPanel")
        }
      );
      rail.append(
        deps.createElement(
          "p",
          "fk-frame__eyebrow",
          deps.t(["fateKnots", "overview", "partyTitle"], "Gathered Seats")
        )
      );
      const seatGrid = deps.createRegion("div", "fk-seat-grid", null);
      deps.KNOWN_SEAT_IDS.forEach(function(seatId) {
        seatGrid.append(deps.createSeatPlaque(state, seatId, "roster-seat"));
      });
      rail.append(seatGrid);
      const actionZone = deps.createRegion("div", "fk-action-cluster", "start-zone");
      actionZone.append(
        deps.createActionButton(
          deps.t(["fateKnots", "controls", "start"], "Start Run"),
          "primary",
          state.phase !== "idle" && state.phase !== "result",
          function() {
            deps.sendRoomCommand("GameRoomFateKnotsStart", {});
          }
        )
      );
      actionZone.append(
        deps.createActionButton(
          deps.t(["fateKnots", "controls", "reset"], "Reset Run"),
          "secondary",
          false,
          function() {
            deps.sendRoomCommand("GameRoomFateKnotsReset", {});
          }
        )
      );
      rail.append(actionZone);
      if (state.excludedSeats && state.excludedSeats.length > 0) {
        rail.append(
          deps.createElement(
            "p",
            "fk-frame__hint",
            deps.t(
              ["fateKnots", "roster", "excluded"],
              "US1 stays outside the V1 playable roster and is tracked for later iterations."
            )
          )
        );
      }
      if (state.transport && state.transport.remoteUserId) {
        rail.append(
          deps.createElement(
            "p",
            "fk-frame__hint",
            deps.t(["fateKnots", "roster", "remoteUserLabel"], "US1: {id}").replace(
              "{id}",
              state.transport.remoteUserId
            )
          )
        );
      }
      layout.append(rail);
      parent.append(layout);
    }
    return {
      renderOverviewStage
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
