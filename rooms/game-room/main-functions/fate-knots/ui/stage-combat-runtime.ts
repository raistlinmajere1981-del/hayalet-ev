(function (global: GameRoomUiGlobal) {
  interface FateKnotsUiCombatStageRuntimeDeps {
    appendImage: GameRoomAppendImage;
    appendNpcBanter(parent: HTMLElement, state: GameRoomFateKnotsState, seatId: string): void;
    applyFrameArtwork: GameRoomApplyFrameArtwork;
    createActionButton: GameRoomCreateActionButton;
    createDefaultSelection(): GameRoomFateKnotsSelection;
    createElement: GameRoomCreateElement;
    createFrame: GameRoomCreateFrame;
    createNarrationPanel(state: GameRoomFateKnotsState, role: GameRoomRoleToken): HTMLElement;
    createRegion: GameRoomCreateRegion;
    createSeatRibbon(
      state: GameRoomFateKnotsState,
      role: string,
      activeSeatId: string | null
    ): HTMLElement;
    createStatBadge: GameRoomCreateStatBadge;
    getUiAsset: GameRoomGetUiAsset;
    sendCombatAction(state: GameRoomFateKnotsState, actionId: string): unknown;
    sendRoomCommand: GameRoomSendRoomCommand;
    sendSync(state: GameRoomFateKnotsState): unknown;
    setSeatId: GameRoomSetSeatId;
    t(path: string[], fallback: string): string;
  }

  function getFactoryRegistry(host: GameRoomUiGlobal): GameRoomUiFactoriesRegistry {
    return host.GameRoomUiFactories || (host.GameRoomUiFactories = {});
  }

  const registry = getFactoryRegistry(global);

  registry.createFateKnotsUiCombatStageRuntime = function createFateKnotsUiCombatStageRuntime(
    deps: FateKnotsUiCombatStageRuntimeDeps
  ): { renderCombatStage(parent: HTMLElement, state: GameRoomFateKnotsState): void } {
    function createPartyGrid(
      state: GameRoomFateKnotsState,
      combat: GameRoomFateKnotsCombatState
    ): HTMLElement {
      const grid = deps.createRegion("div", "fk-party-grid", "summary-status");
      combat.party.forEach(function (member: GameRoomFateKnotsCombatPartyMember) {
        const card = deps.createFrame("article", "fk-party-card", null, {
          overlay: deps.getUiAsset("parchmentStain"),
          frame: deps.getUiAsset("sidePanelFrame"),
          texture: deps.getUiAsset("defaultPanel"),
        });
        deps.setSeatId(card, member.seatId || "");
        card.append(
          deps.createElement(
            "strong",
            "fk-party-card__title",
            member.nickname || member.seatId || "Seat"
          )
        );
        const selection = member.selection;
        deps.appendImage(
          card,
          "fk-party-card__portrait",
          selection.avatar,
          member.nickname || member.seatId || "Seat"
        );
        card.append(
          deps.createElement(
            "p",
            "fk-party-card__meta",
            String(member.hp || 0) + "/" + String(member.maxHp || 0) + " HP"
          )
        );
        card.append(
          deps.createElement(
            "p",
            "fk-party-card__meta",
            String(member.energy || 0) + "/" + String(member.maxEnergy || 0) + " EN"
          )
        );
        if (member.seatId) {
          deps.appendNpcBanter(card, state, member.seatId);
        }
        grid.append(card);
      });
      return grid;
    }

    function createCombatHand(
      state: GameRoomFateKnotsState,
      combat: GameRoomFateKnotsCombatState
    ): HTMLElement {
      const hand = deps.createFrame(
        "section",
        "fk-stage-frame fk-stage-frame--decision fk-combat-hand",
        ["action-zone", "selection-zone", "combat-hand"],
        {
          overlay: deps.getUiAsset("notificationBanner"),
          frame: deps.getUiAsset("logPanelFrame"),
          texture: deps.getUiAsset("darkPanel"),
        }
      );
      hand.dataset["activeTurn"] = combat.turn?.seatId === "user" ? "true" : "false";
      hand.dataset["turnSeatId"] = combat.turn?.seatId ? String(combat.turn.seatId) : "";
      hand.append(
        deps.createElement(
          "p",
          "fk-frame__eyebrow",
          deps.t(["fateKnots", "combat", "actionsLabel"], "Combat Actions")
        )
      );
      const cards = deps.createRegion("div", "fk-combat-hand__cards", null);
      if (combat.availableActions.length > 0) {
        combat.availableActions.forEach(function (action: GameRoomFateKnotsCombatAction) {
          const button = deps.createRegion(
            "button",
            "fk-card-choice fk-card-choice--combat",
            null
          ) as HTMLButtonElement;
          button.type = "button";
          button.disabled = action.available !== true;
          button.dataset["selected"] = "false";
          button.dataset["available"] = action.available === true ? "true" : "false";
          deps.applyFrameArtwork(button, {
            overlay: button.disabled
              ? deps.getUiAsset("cardDisabled")
              : deps.getUiAsset("cardFocusBorder"),
            frame: deps.getUiAsset("cardSlotFrame"),
            texture: deps.getUiAsset("creatureCardTemplate"),
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
          button.addEventListener("click", function () {
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
      hand.append(actions);
      return hand;
    }

    function renderCombatStage(parent: HTMLElement, state: GameRoomFateKnotsState): void {
      const combat = state.combat;
      if (!combat) {
        parent.append(
          deps.createFrame(
            "section",
            "fk-stage-frame fk-stage-frame--scene",
            ["main-scene", "combat-arena"],
            {
              overlay: deps.getUiAsset("systemMessageBox"),
              frame: deps.getUiAsset("mainSceneFrame"),
              texture: deps.getUiAsset("darkPanel"),
            }
          )
        );
        return;
      }
      const layout = deps.createRegion("section", "fk-combat", "combat-layout");
      const arena = deps.createFrame(
        "section",
        "fk-stage-frame fk-stage-frame--scene fk-combat-arena",
        ["main-scene", "summary-status", "combat-arena"],
        {
          overlay: deps.getUiAsset("targetRing"),
          frame: deps.getUiAsset("mainSceneFrame"),
          texture: deps.getUiAsset("defaultPanel"),
        }
      );
      arena.dataset["turnSeatId"] = combat.turn?.seatId ? String(combat.turn.seatId) : "";
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
          combat.turn?.seatId ? combat.turn.seatId : deps.t(["fateKnots", "turns", "idle"], "Idle"),
          "soft"
        )
      );
      arena.append(arenaStats);
      arena.append(
        deps.createSeatRibbon(state, "turn-order", combat.turn?.seatId ? combat.turn.seatId : null)
      );
      layout.append(arena);

      const lower = deps.createRegion("div", "fk-combat__lower", null);
      const status = deps.createFrame(
        "section",
        "fk-stage-frame fk-stage-frame--rail fk-combat-status-panel",
        ["support-rail", "summary-status", "narration", "log", "combat-status"],
        {
          overlay: deps.getUiAsset("logPanel"),
          frame: deps.getUiAsset("sidePanelFrame"),
          texture: deps.getUiAsset("darkPanel"),
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
        const combatLog = deps.createRegion("div", "fk-combat-log", "log");
        combat.recentLog.forEach(function (entry: string) {
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
      renderCombatStage: renderCombatStage,
    };
  };
})((typeof window !== "undefined" ? window : globalThis) as unknown as GameRoomUiGlobal);
