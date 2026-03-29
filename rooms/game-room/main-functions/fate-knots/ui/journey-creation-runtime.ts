(function (global) {
  const registry = global.GameRoomUiFactories || (global.GameRoomUiFactories = {});

  registry.createFateKnotsUiJourneyCreationRuntime =
    function createFateKnotsUiJourneyCreationRuntime(deps) {
      function hasRenderableAssetSource(assetLink) {
        const source = assetLink && typeof assetLink === "object" ? assetLink : null;
        if (!source) {
          return false;
        }
        return Boolean(
          (typeof source.uiSrc === "string" && source.uiSrc.trim()) ||
            (typeof source.src === "string" && source.src.trim()) ||
            (source.asset &&
              typeof source.asset === "object" &&
              ((typeof source.asset.uiSrc === "string" && source.asset.uiSrc.trim()) ||
                (typeof source.asset.src === "string" && source.asset.src.trim())))
        );
      }

      function renderSelectionFamily(
        parent,
        state,
        title,
        entries,
        selectedId,
        disabled,
        onSelect,
        metaResolver,
        family
      ) {
        const familySection = deps.createFrame(
          "section",
          "fk-stage-frame fk-stage-frame--selection fk-selection-family",
          family + "-family",
          {
            overlay: deps.getUiAsset("parchmentStain"),
            frame: deps.getUiAsset("sidePanelFrame"),
            texture: deps.getUiAsset("darkPanel"),
          }
        );
        familySection.append(deps.createElement("p", "fk-frame__eyebrow", title));
        const grid = deps.createRegion("div", "fk-selection-family__grid", null);
        entries.forEach(function (entry) {
          const template =
            family === "avatar"
              ? deps.getUiAsset("avatarCardTemplate")
              : family === "class"
                ? deps.getUiAsset("classCardTemplate")
                : deps.getUiAsset("itemCardTemplate");
          const card = deps.createCatalogCard(entry, {
            family,
            template,
            selected: entry.id === selectedId,
            disabled,
            onClick: onSelect,
            metaLines: metaResolver(entry),
          });
          grid.append(card);
        });
        familySection.append(grid);
        parent.append(familySection);
      }

      function createSelectionSummary(state, selection) {
        const user = deps.getUserParticipant(state);
        const bundle = deps.getSelectionBundle(state, user);
        const summaryMount = deps.createRegion("div", "fk-summary-rail__mount", "summary-rail");
        const summary = deps.createFrame(
          "aside",
          "fk-stage-frame fk-stage-frame--rail fk-summary-rail",
          ["support-rail", "summary-status", "dossier-rail"],
          {
            overlay: deps.getUiAsset("notificationBanner"),
            frame: deps.getUiAsset("sidePanelFrame"),
            texture: deps.getUiAsset("defaultPanel"),
          }
        );
        summary.append(
          deps.createElement(
            "p",
            "fk-frame__eyebrow",
            deps.t(["fateKnots", "creation", "summaryTitle"], "Build Summary")
          )
        );
        summaryMount.dataset.fkRole = "support-rail summary-status summary-rail";
        const seatTabs = deps.createRegion("div", "fk-seat-tabs", ["log", "selection-log"]);
        summary.append(seatTabs);
        deps.KNOWN_SEAT_IDS.forEach(function (seatId) {
          const seat = deps.buildSeatDisplay(state, seatId);
          const tab = deps.createRegion(
            "div",
            "fk-seat-tabs__item" +
              (seatId === "user"
                ? " fk-seat-tabs__item--active"
                : " fk-seat-tabs__item--dummy"),
            null
          );
          deps.setSeatId(tab, seatId);
          tab.append(deps.createElement("span", "fk-seat-tabs__label", seat.eyebrow));
          tab.append(
            deps.createElement(
              "span",
              "fk-seat-tabs__meta",
              seatId === "user"
                ? deps.t(["fateKnots", "seatState", "active"], "Active")
                : seat.stateText
            )
          );
          seatTabs.append(tab);
        });
        const hero = deps.createRegion("div", "fk-summary-hero", null);
        if (bundle.avatar && hasRenderableAssetSource(bundle.avatar)) {
          deps.appendImage(hero, "fk-summary-hero__portrait", bundle.avatar, bundle.avatar.label);
        } else if (bundle.avatar) {
          deps.appendImage(hero, "fk-summary-hero__portrait", bundle.avatar, bundle.avatar.label);
        } else {
          const placeholder = deps.createRegion(
            "div",
            "fk-summary-hero__portrait fk-summary-hero__portrait--placeholder",
            null
          );
          placeholder.append(
            deps.createElement(
              "span",
              "fk-summary-hero__placeholder-label",
              "Choose an avatar"
            )
          );
          hero.append(placeholder);
        }
        const heroBody = deps.createRegion("div", "fk-summary-hero__body", null);
        heroBody.append(
          deps.createElement(
            "strong",
            "fk-summary-hero__title",
            user.nickname || deps.createSeatLabel(state, "user")
          )
        );
        heroBody.append(
          deps.createElement(
            "p",
            "fk-summary-hero__meta",
            [bundle.avatar ? bundle.avatar.label : null, bundle.classDef ? bundle.classDef.label : null, bundle.background ? bundle.background.label : null]
              .filter(Boolean)
              .join(" / ") ||
              deps.t(
                ["fateKnots", "creation", "incomplete"],
                "Pick an avatar, class, and background."
              )
          )
        );
        if (bundle.classDef) {
          heroBody.append(
            deps.createElement("p", "fk-summary-hero__meta", deps.formatStats(bundle.classDef))
          );
          heroBody.append(
            deps.createElement("p", "fk-summary-hero__meta", deps.formatDeck(bundle.classDef))
          );
        }
        if (bundle.background && bundle.background.perk) {
          heroBody.append(
            deps.createElement("p", "fk-summary-hero__meta", bundle.background.perk)
          );
        }
        hero.append(heroBody);
        summary.append(hero);
        const selectionActions = deps.createRegion(
          "div",
          "fk-selection-actions",
          ["action-zone", "selection-actions"]
        );
        const actions = deps.createRegion("div", "fk-action-cluster", ["action-zone", "lock-zone"]);
        const readyLabel = selection.locked
          ? deps.t(["fateKnots", "creation", "locked"], "Build locked")
          : deps.isSelectionComplete(selection)
            ? deps.t(["fateKnots", "controls", "ready"], "Lock Build")
            : deps.t(
                ["fateKnots", "creation", "incomplete"],
                "Pick an avatar, class, and background."
              );
        actions.append(
          deps.createActionButton(
            readyLabel,
            "primary",
            selection.locked || !deps.isSelectionComplete(selection),
            function () {
              deps.sendReady(state);
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
        selectionActions.append(actions);
        summary.append(selectionActions);
        summaryMount.append(summary);
        return summaryMount;
      }

      function renderCreationStage(parent, state) {
        const user = deps.getUserParticipant(state);
        const selection = user.selection || deps.createDefaultSelection();
        const layout = deps.createRegion("section", "fk-creation", "creation-layout");
        const table = deps.createRegion(
          "div",
          "fk-selection-table",
          ["main-scene", "selection-zone", "selection-table"]
        );
        const intro = deps.createFrame(
          "section",
          "fk-stage-frame fk-stage-frame--scene fk-creation__intro",
          "narration",
          {
            overlay: deps.getUiAsset("parchmentStain"),
            frame: deps.getUiAsset("mainSceneFrame"),
            texture: deps.getUiAsset("darkPanel"),
          }
        );
        intro.append(
          deps.createElement(
            "p",
            "fk-frame__eyebrow",
            deps.t(["fateKnots", "creation", "title"], "Character Creation")
          )
        );
        intro.append(
          deps.createElement(
            "p",
            "fk-frame__hint",
            deps.t(
              ["fateKnots", "creation", "subtitle"],
              "Pick the local build, then lock it so the shared slice can begin."
            )
          )
        );
        table.append(intro);
        renderSelectionFamily(
          table,
          state,
          deps.t(["fateKnots", "creation", "avatarLabel"], "Avatar"),
          state.catalogs.avatars,
          selection.avatarId,
          selection.locked,
          function (value) {
            deps.sendSelection("avatarId", value);
          },
          function (entry) {
            return [entry.summary];
          },
          "avatar"
        );
        renderSelectionFamily(
          table,
          state,
          deps.t(["fateKnots", "creation", "classLabel"], "Class"),
          state.catalogs.classes,
          selection.classId,
          selection.locked,
          function (value) {
            deps.sendSelection("classId", value);
          },
          function (entry) {
            return [deps.formatStats(entry), deps.formatDeck(entry)];
          },
          "class"
        );
        renderSelectionFamily(
          table,
          state,
          deps.t(["fateKnots", "creation", "backgroundLabel"], "Background"),
          state.catalogs.backgrounds,
          selection.backgroundId,
          selection.locked,
          function (value) {
            deps.sendSelection("backgroundId", value);
          },
          function (entry) {
            return [entry.perk || entry.summary];
          },
          "background"
        );
        layout.append(table);
        layout.append(createSelectionSummary(state, selection));
        parent.append(layout);
      }

      return {
        renderCreationStage: renderCreationStage,
      };
    };
})(typeof window !== "undefined" ? window : globalThis);
