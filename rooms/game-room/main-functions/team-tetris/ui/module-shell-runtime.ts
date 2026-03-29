(function (global) {
  const registry = global.GameRoomUiFactories || (global.GameRoomUiFactories = {});

  registry.createTeamTetrisUiModuleShellRuntime =
    function createTeamTetrisUiModuleShellRuntime(deps) {
      const getState = deps.getState;
      const featureId = deps.featureId || "team-tetris";
      const createElement = deps.createElement;
      const text = deps.text;
      const getFeatureLabel = deps.getFeatureLabel;
      const createTeamTetrisMetric = deps.createTeamTetrisMetric;
      const createTeamTetrisPieceCard = deps.createTeamTetrisPieceCard;
      const createTeamTetrisRequirementCard = deps.createTeamTetrisRequirementCard;
      const createTeamTetrisSnapshotCard = deps.createTeamTetrisSnapshotCard;
      const renderTeamTetrisBoardCard = deps.renderTeamTetrisBoardCard;
      const getTeamTetrisView = deps.getTeamTetrisView;
      const getTeamTetrisBoardLabel = deps.getTeamTetrisBoardLabel;
      const getTeamTetrisSeatDisplayLabel = deps.getTeamTetrisSeatDisplayLabel;
      const getTeamTetrisPendingTurn = deps.getTeamTetrisPendingTurn;
      const getTeamTetrisOwnBoardState = deps.getTeamTetrisOwnBoardState;
      const getTeamTetrisOpponentBoardState = deps.getTeamTetrisOpponentBoardState;
      const getTeamTetrisPlacedByLabel = deps.getTeamTetrisPlacedByLabel;
      const getTeamTetrisPartnerRoleLabel = deps.getTeamTetrisPartnerRoleLabel;
      const getTeamTetrisTurnLabel = deps.getTeamTetrisTurnLabel;
      const getTeamTetrisResultLabel = deps.getTeamTetrisResultLabel;
      const getTeamTetrisDraftStatusText = deps.getTeamTetrisDraftStatusText;
      const getTeamTetrisStatusText = deps.getTeamTetrisStatusText;
      const onTeamTetrisRotationSelect = deps.onTeamTetrisRotationSelect;
      const onTeamTetrisRotate = deps.onTeamTetrisRotate;
      const onTeamTetrisClearDraft = deps.onTeamTetrisClearDraft;
      const onTeamTetrisSubmit = deps.onTeamTetrisSubmit;
      const onTeamTetrisStart = deps.onTeamTetrisStart;
      const onTeamTetrisReset = deps.onTeamTetrisReset;

      function renderTeamTetris(root) {
        const state = getState();
        document.title = state.context.room.name + " - " + getFeatureLabel(featureId);

        const view = getTeamTetrisView();
        const pendingTurn = getTeamTetrisPendingTurn();
        const ownBoard = getTeamTetrisOwnBoardState();
        const opponentBoard = getTeamTetrisOpponentBoardState();
        const canConfigureMatch =
          state.teamTetris.active !== true && state.teamTetris.result !== "pending";
        const canStart = state.teamTetris.canStart === true && canConfigureMatch;
        const canSubmitMove = !!pendingTurn && !!state.teamTetrisDraft.preview;

        const app = createElement("main", "tt-shell", "");
        app.dataset.presentationMode = state.presentation.mode;
        const surface = createElement("section", "tt-surface", "");
        const arena = createElement("section", "tt-arena", "");
        const rail = createElement("aside", "tt-rail", "");
        const stage = createElement("section", "tt-stage", "");

        const intro = createElement("section", "tt-panel tt-panel--intro", "");
        intro.append(
          createElement("div", "tt-panel__eyebrow", text(["teamTetris", "heroBadge"])),
          createElement("h1", "tt-panel__title", text(["teamTetris", "heroTitle"])),
          createElement(
            "p",
            "tt-panel__body",
            getTeamTetrisStatusText() || text(["teamTetris", "heroSubtitle"])
          )
        );

        const roster = createElement("section", "tt-panel", "");
        roster.append(
          createElement("p", "tt-panel__label", text(["teamTetris", "roster", "title"])),
          createElement(
            "p",
            "tt-panel__body",
            text(["teamTetris", "roster", "youLabel"]) +
              ": " +
              (view
                ? getTeamTetrisSeatDisplayLabel(view.seat.seatId)
                : text(["teamTetris", "turns", "idle"]))
          ),
          createElement(
            "p",
            "tt-panel__body",
            text(["teamTetris", "roster", "partnerLabel"]) +
              ": " +
              getTeamTetrisPartnerRoleLabel()
          )
        );

        const requirements = createElement("section", "tt-panel", "");
        requirements.append(
          createElement(
            "p",
            "tt-panel__label",
            text(["teamTetris", "controls", "requirementsLabel"])
          ),
          createTeamTetrisRequirementCard("ai1", state.teamTetris.requiredSlots.ai1 === true),
          createTeamTetrisRequirementCard("ai2", state.teamTetris.requiredSlots.ai2 === true),
          createTeamTetrisRequirementCard("us1", state.teamTetris.requiredSlots.us1 === true)
        );

        const controls = createElement("section", "tt-panel", "");
        controls.append(
          createElement("p", "tt-panel__label", text(["teamTetris", "controls", "featureLabel"]))
        );
        const hiddenChoices = createElement("div", "tt-toggle-row", "");
        [
          { value: true, label: text(["teamTetris", "controls", "hiddenPairsOn"]) },
          { value: false, label: text(["teamTetris", "controls", "hiddenPairsOff"]) },
        ].forEach(function (entry) {
          const button = createElement("button", "tt-toggle", entry.label);
          button.type = "button";
          button.disabled = !canConfigureMatch;
          button.dataset.selected =
            state.preferences.teamTetrisHiddenPairs === entry.value ? "true" : "false";
          button.addEventListener("click", function () {
            state.preferences.teamTetrisHiddenPairs = entry.value;
            deps.render();
          });
          hiddenChoices.append(button);
        });
        const actions = createElement("div", "tt-actions", "");
        const startButton = createElement(
          "button",
          "xox-button xox-button--primary",
          text(["teamTetris", "controls", "start"])
        );
        startButton.type = "button";
        startButton.disabled = !canStart;
        startButton.addEventListener("click", onTeamTetrisStart);
        const resetButton = createElement(
          "button",
          "xox-button xox-button--ghost",
          text(["teamTetris", "controls", "reset"])
        );
        resetButton.type = "button";
        resetButton.addEventListener("click", onTeamTetrisReset);
        actions.append(startButton, resetButton);
        controls.append(
          hiddenChoices,
          createElement("p", "tt-panel__hint", text(["teamTetris", "controls", "startHint"])),
          actions
        );

        if (Array.isArray(state.teamTetris.teams) && state.teamTetris.teams.length > 0) {
          const reveal = createElement("section", "tt-panel", "");
          reveal.append(
            createElement("p", "tt-panel__label", text(["teamTetris", "roster", "revealTitle"]))
          );
          state.teamTetris.teams.forEach(function (team) {
            const revealedSeatLabels = Array.isArray(team.seatIds)
              ? team.seatIds.map(function (seatId) {
                  return getTeamTetrisSeatDisplayLabel(seatId);
                })
              : [];
            reveal.append(
              createElement(
                "p",
                "tt-panel__body",
                getTeamTetrisBoardLabel(team.teamId) +
                  ": " +
                  (revealedSeatLabels.length > 0
                    ? revealedSeatLabels.join(" + ")
                    : text(["teamTetris", "turns", "idle"]))
              )
            );
          });
          rail.append(intro, roster, requirements, controls, reveal);
        } else {
          rail.append(intro, roster, requirements, controls);
        }

        const scorebar = createElement("div", "tt-scorebar", "");
        scorebar.append(
          createTeamTetrisMetric(
            text(["teamTetris", "metrics", "turnLabel"]),
            getTeamTetrisTurnLabel()
          ),
          createTeamTetrisMetric(
            text(["teamTetris", "metrics", "resultLabel"]),
            getTeamTetrisResultLabel()
          ),
          createTeamTetrisMetric(
            text(["teamTetris", "controls", "hiddenPairsLabel"]),
            state.teamTetris.hiddenPairs
              ? text(["teamTetris", "controls", "hiddenPairsOn"])
              : text(["teamTetris", "controls", "hiddenPairsOff"])
          ),
          createTeamTetrisMetric(
            text(["teamTetris", "boards", "seedLabel"]),
            state.teamTetris.board.seedLabel
          ),
          createTeamTetrisMetric(
            text(["teamTetris", "metrics", "roleLabel"]),
            view ? text(["teamTetris", "roles", view.seat.role]) : text(["teamTetris", "turns", "idle"])
          ),
          createTeamTetrisMetric(
            text(["teamTetris", "metrics", "draftLabel"]),
            state.teamTetrisDraft.rowShifts.length > 0
              ? state.teamTetrisDraft.rowShifts.join(",")
              : text(["teamTetris", "controls", "pathEmpty"])
          )
        );

        const rotationPanel = createElement("section", "tt-context-card", "");
        rotationPanel.append(
          createElement(
            "span",
            "tt-context-card__label",
            text(["teamTetris", "controls", "rotationLabel"])
          ),
          createTeamTetrisPieceCard(
            text(["teamTetris", "boards", "currentPiece"]),
            pendingTurn ? pendingTurn.pieceId : "",
            state.teamTetrisDraft.rotation,
            getTeamTetrisDraftStatusText()
          )
        );
        const rotationChoices = createElement("div", "tt-rotation-row", "");
        (pendingTurn ? pendingTurn.legalRotations : [0]).forEach(function (rotation) {
          const button = createElement("button", "tt-rotation", String(rotation));
          button.type = "button";
          button.disabled = !pendingTurn;
          button.dataset.selected = state.teamTetrisDraft.rotation === rotation ? "true" : "false";
          button.addEventListener("click", function () {
            onTeamTetrisRotationSelect(rotation);
          });
          rotationChoices.append(button);
        });
        const rotateButton = createElement(
          "button",
          "xox-button xox-button--ghost",
          text(["teamTetris", "controls", "rotate"])
        );
        rotateButton.type = "button";
        rotateButton.disabled = !pendingTurn;
        rotateButton.addEventListener("click", onTeamTetrisRotate);
        const draftActions = createElement("div", "tt-actions tt-actions--compact", "");
        const clearButton = createElement(
          "button",
          "xox-button xox-button--ghost",
          text(["teamTetris", "controls", "clearPath"])
        );
        clearButton.type = "button";
        clearButton.disabled = !pendingTurn;
        clearButton.addEventListener("click", onTeamTetrisClearDraft);
        const submitButton = createElement(
          "button",
          "xox-button xox-button--primary",
          text(["teamTetris", "controls", "submitMove"])
        );
        submitButton.type = "button";
        submitButton.disabled = !canSubmitMove;
        submitButton.addEventListener("click", onTeamTetrisSubmit);
        draftActions.append(clearButton, rotateButton, submitButton);
        rotationPanel.append(rotationChoices, draftActions);

        const ownContext = [
          createTeamTetrisSnapshotCard(
            text(["teamTetris", "boards", "beforePartner"]),
            ownBoard.boardBeforePartnerPieceRows
          ),
          createTeamTetrisPieceCard(
            text(["teamTetris", "boards", "partnerPiece"]),
            ownBoard.partnerLastPiece ? ownBoard.partnerLastPiece.pieceId : "",
            ownBoard.partnerLastPiece ? ownBoard.partnerLastPiece.rotation : 0,
            getTeamTetrisPlacedByLabel(ownBoard.partnerLastPiece)
          ),
          rotationPanel,
        ];

        const boardGrid = createElement("div", "tt-board-grid", "");
        boardGrid.append(
          renderTeamTetrisBoardCard(ownBoard, {
            tone: "private",
            meta: text(["teamTetris", "boards", "privateBoard"]),
            interactive: !!pendingTurn,
            overlayCells: state.teamTetrisDraft.preview ? state.teamTetrisDraft.preview.cells : [],
            overlayTone: "draft",
            overlayPieceId: pendingTurn ? pendingTurn.pieceId : "",
            context: ownContext,
          }),
          renderTeamTetrisBoardCard(opponentBoard, {
            tone: "public",
            meta: text(["teamTetris", "boards", "publicBoard"]),
            interactive: false,
            context: [
              createTeamTetrisPieceCard(
                text(["teamTetris", "boards", "publicSummary"]),
                "",
                0,
                text(["teamTetris", "boards", "publicHint"])
              ),
            ],
          })
        );

        const footer = createElement("div", "tt-stage-footer", "");
        footer.append(
          createElement("p", "tt-stage-footer__message", getTeamTetrisStatusText()),
          createElement(
            "p",
            "tt-stage-footer__meta",
            text(["teamTetris", "controls", "pathLegend"]) +
              ": " +
              text(["teamTetris", "controls", "pathRule"])
          )
        );

        if (view && view.hiddenPairs === true && view.revealedPairs !== true) {
          footer.append(
            createElement("p", "tt-stage-footer__meta", text(["teamTetris", "roster", "hiddenHint"]))
          );
        } else {
          footer.append(
            createElement(
              "p",
              "tt-stage-footer__meta",
              text(["teamTetris", "roster", "revealedHint"])
            )
          );
        }

        stage.append(scorebar, boardGrid, footer);
        arena.append(rail, stage);
        surface.append(arena);
        app.append(surface);
        root.replaceChildren(app);
      }

      return {
        renderTeamTetris: renderTeamTetris,
      };
    };
})(typeof window !== "undefined" ? window : globalThis);
