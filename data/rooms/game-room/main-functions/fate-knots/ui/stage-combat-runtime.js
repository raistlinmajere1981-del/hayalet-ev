(function(global) {
  const registry = global.GameRoomUiFactories || (global.GameRoomUiFactories = {});
  registry.createFateKnotsUiCombatStageRuntime = function createFateKnotsUiCombatStageRuntime(deps) {
    function createPartyGrid(state, combat) {
      const grid = deps.createRegion("div", "fk-party-grid", "combat-status");
      combat.party.forEach(function(member) {
        const card = deps.createFrame("article", "fk-party-card", null, {
          overlay: deps.getUiAsset("parchmentStain"),
          frame: deps.getUiAsset("sidePanelFrame"),
          texture: deps.getUiAsset("defaultPanel")
        });
        deps.setSeatId(card, member.seatId);
        card.append(
          deps.createElement(
            "strong",
            "fk-party-card__title",
            member.nickname || member.seatId || "Seat"
          )
        );
        const selection = member.selection || deps.createDefaultSelection();
        if (selection.avatar && selection.avatar.uiSrc) {
          deps.appendImage(
            card,
            "fk-party-card__portrait",
            selection.avatar,
            member.nickname || member.seatId || "Seat"
          );
        }
        card.append(
          deps.createElement(
            "p",
            "fk-party-card__meta",
            String(member.hp) + "/" + String(member.maxHp) + " HP"
          )
        );
        card.append(
          deps.createElement(
            "p",
            "fk-party-card__meta",
            String(member.energy) + "/" + String(member.maxEnergy) + " EN"
          )
        );
        deps.appendNpcBanter(card, state, member.seatId);
        grid.append(card);
      });
      return grid;
    }
    function createCombatHand(state, combat) {
      const hand = deps.createFrame(
        "section",
        "fk-stage-frame fk-stage-frame--decision fk-combat-hand",
        "combat-hand",
        {
          overlay: deps.getUiAsset("notificationBanner"),
          frame: deps.getUiAsset("logPanelFrame"),
          texture: deps.getUiAsset("darkPanel")
        }
      );
      hand.append(
        deps.createElement(
          "p",
          "fk-frame__eyebrow",
          deps.t(["fateKnots", "combat", "actionsLabel"], "Combat Actions")
        )
      );
      const cards = deps.createRegion("div", "fk-combat-hand__cards", null);
      if (combat.availableActions.length > 0) {
        combat.availableActions.forEach(function(action) {
          const button = deps.createRegion("button", "fk-card-choice fk-card-choice--combat", null);
          button.type = "button";
          button.disabled = action.available !== true;
          button.dataset.selected = combat.turn && combat.turn.seatId === "user" ? "true" : "false";
          deps.applyFrameArtwork(button, {
            overlay: button.disabled ? deps.getUiAsset("cardDisabled") : deps.getUiAsset("cardFocusBorder"),
            frame: deps.getUiAsset("cardSlotFrame"),
            texture: deps.getUiAsset("creatureCardTemplate")
          });
          button.append(deps.createElement("strong", "fk-card-choice__title", action.label));
          button.append(
            deps.createElement(
              "span",
              "fk-card-choice__meta",
              action.type + " • cost " + String(action.cost)
            )
          );
          button.append(
            deps.createElement("span", "fk-card-choice__meta", action.description || "")
          );
          button.addEventListener("click", function() {
            deps.sendCombatAction(state, action.id);
          });
          cards.append(button);
        });
      } else {
        cards.append(
          deps.createElement(
            "p",
            "fk-frame__hint",
            deps.t(["fateKnots", "combat", "waitingHint"], "Waiting for the next seat to act.")
          )
        );
      }
      hand.append(cards);
      const actions = deps.createRegion("div", "fk-action-cluster", null);
      actions.append(
        deps.createActionButton(
          deps.t(["fateKnots", "controls", "sync"], "Sync"),
          "secondary",
          false,
          function() {
            deps.sendSync(state);
          }
        )
      );
      actions.append(
        deps.createActionButton(
          deps.t(["fateKnots", "controls", "reset"], "Reset Run"),
          "secondary",
          false,
          function() {
            deps.sendRoomCommand("GameRoomFateKnotsReset", {});
          }
        )
      );
      hand.append(actions);
      return hand;
    }
    function renderCombatStage(parent, state) {
      const combat = state.combat;
      if (!combat) {
        parent.append(
          deps.createFrame("section", "fk-stage-frame fk-stage-frame--scene", "combat-arena", {
            overlay: deps.getUiAsset("systemMessageBox"),
            frame: deps.getUiAsset("mainSceneFrame"),
            texture: deps.getUiAsset("darkPanel")
          })
        );
        return;
      }
      const layout = deps.createRegion("section", "fk-combat", "combat-layout");
      const arena = deps.createFrame(
        "section",
        "fk-stage-frame fk-stage-frame--scene fk-combat-arena",
        "combat-arena",
        {
          overlay: deps.getUiAsset("targetRing"),
          frame: deps.getUiAsset("mainSceneFrame"),
          texture: deps.getUiAsset("defaultPanel")
        }
      );
      arena.append(
        deps.createElement(
          "p",
          "fk-frame__eyebrow",
          deps.t(["fateKnots", "combat", "enemyLabel"], "Encounter")
        )
      );
      arena.append(deps.createElement("h2", "fk-frame__title", combat.enemy.label || "Enemy"));
      deps.appendImage(
        arena,
        "fk-combat-arena__image",
        combat.enemy.asset,
        combat.enemy.label || "Enemy"
      );
      const arenaStats = deps.createRegion("div", "fk-combat-arena__stats", null);
      arenaStats.append(
        deps.createStatBadge(
          "HP",
          String(combat.enemy.hp) + "/" + String(combat.enemy.maxHp),
          "alert"
        )
      );
      arenaStats.append(
        deps.createStatBadge(
          deps.t(["fateKnots", "combat", "roundLabel"], "Round"),
          String(combat.round),
          "warm"
        )
      );
      arenaStats.append(
        deps.createStatBadge(
          deps.t(["fateKnots", "combat", "turnLabel"], "Turn"),
          combat.turn && combat.turn.seatId ? combat.turn.seatId : deps.t(["fateKnots", "turns", "idle"], "Idle"),
          "soft"
        )
      );
      arena.append(arenaStats);
      arena.append(
        deps.createSeatRibbon(
          state,
          "turn-order",
          combat.turn && combat.turn.seatId ? combat.turn.seatId : null
        )
      );
      layout.append(arena);
      const lower = deps.createRegion("div", "fk-combat__lower", null);
      const status = deps.createFrame(
        "section",
        "fk-stage-frame fk-stage-frame--rail fk-combat-status-panel",
        "combat-status",
        {
          overlay: deps.getUiAsset("logPanel"),
          frame: deps.getUiAsset("sidePanelFrame"),
          texture: deps.getUiAsset("darkPanel")
        }
      );
      status.append(deps.createNarrationPanel(state, "narration-panel"));
      status.append(
        deps.createElement(
          "p",
          "fk-frame__eyebrow",
          deps.t(["fateKnots", "combat", "partyTitle"], "Field Party")
        )
      );
      status.append(createPartyGrid(state, combat));
      if (combat.recentLog.length > 0) {
        const combatLog = deps.createRegion("div", "fk-combat-log", null);
        combat.recentLog.forEach(function(entry) {
          combatLog.append(deps.createElement("p", "fk-log-feed__text", entry));
        });
        status.append(combatLog);
      }
      lower.append(status);
      lower.append(createCombatHand(state, combat));
      layout.append(lower);
      parent.append(layout);
    }
    return {
      renderCombatStage
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
