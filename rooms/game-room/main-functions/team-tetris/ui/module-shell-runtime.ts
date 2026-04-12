(function (global: GameRoomUiGlobal) {
  function getFactoryRegistry(host: GameRoomUiGlobal): GameRoomUiFactoriesRegistry {
    return host.GameRoomUiFactories || (host.GameRoomUiFactories = {});
  }

  const registry = getFactoryRegistry(global);

  registry.createTeamTetrisUiModuleShellRuntime = function createTeamTetrisUiModuleShellRuntime(
    deps: GameRoomTeamTetrisUiModuleShellRuntimeDeps
  ): GameRoomTeamTetrisUiModuleShellRuntime {
    const getState = deps.getState;
    const featureId = deps.featureId || "team-tetris";
    const createElement = deps.createElement;
    const text = deps.text;
    const render = deps.render;
    const getFeatureLabel = deps.getFeatureLabel;
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

    function createButton(className: string, label: string): HTMLButtonElement {
      const button = createElement("button", className, label) as HTMLButtonElement;
      button.type = "button";
      return button;
    }

    function readSelectedPartnerSeatId(state: GameRoomUiState): string | null {
      const selectedPartnerSeatId = state.preferences.teamTetrisSelectedPartnerSeatId;
      return selectedPartnerSeatId === "ai1" ||
        selectedPartnerSeatId === "ai2" ||
        selectedPartnerSeatId === "us1"
        ? selectedPartnerSeatId
        : null;
    }

    function getTeamTetrisNeutralSeatLabel(seatId: string): string {
      return seatId.trim() !== "" ? seatId.trim().toUpperCase() : "???";
    }

    function buildTeamTetrisSelectionPreview(selectedPartnerSeatId: string): string[] {
      const remainingPair = ["ai1", "ai2", "us1"].filter(function (seatId) {
        return seatId !== selectedPartnerSeatId;
      });
      return [
        "USER + " + getTeamTetrisNeutralSeatLabel(selectedPartnerSeatId),
        remainingPair.map(getTeamTetrisNeutralSeatLabel).join(" + "),
      ];
    }

    function buildTeamTetrisPairStatusLines(state: GameRoomUiState): string[] {
      if (Array.isArray(state.teamTetris.teams) && state.teamTetris.teams.length > 0) {
        return state.teamTetris.teams.map(function (team: GameRoomTeamTetrisTeamRecord) {
          return (
            getTeamTetrisBoardLabel(team.teamId) +
            ": " +
            team.seatIds.map(getTeamTetrisNeutralSeatLabel).join(" + ")
          );
        });
      }

      if (state.teamTetris.hiddenPairs === true) {
        return [text(["teamTetris", "roster", "hiddenHint"])];
      }

      return [text(["teamTetris", "roster", "revealedHint"])];
    }

    function renderTeamTetris(root: HTMLElement): void {
      const state = getState();
      document.title = state.context.room.name + " - " + getFeatureLabel(featureId);

      const view = getTeamTetrisView();
      const pendingTurn = getTeamTetrisPendingTurn();
      const ownBoard = getTeamTetrisOwnBoardState();
      const opponentBoard = getTeamTetrisOpponentBoardState();
      const hiddenPairs = state.preferences.teamTetrisHiddenPairs !== false;
      const selectedPartnerSeatId = readSelectedPartnerSeatId(state);
      const draftPreview = state.teamTetrisDraft.preview;
      const draftCanSubmit =
        draftPreview !== null &&
        draftPreview.success === true &&
        draftPreview.pathComplete === true;
      const draftOverlayCells =
        draftPreview && Array.isArray(draftPreview.cells) ? draftPreview.cells : [];
      const draftPathCells =
        draftPreview && Array.isArray(draftPreview.pathCells) ? draftPreview.pathCells : [];
      const draftPathTail: GameRoomTeamTetrisCell | null =
        draftPathCells.length > 1 ? draftPathCells[draftPathCells.length - 1] || null : null;
      const draftPathBeforeTail: GameRoomTeamTetrisCell | null =
        draftPathCells.length > 1 ? draftPathCells[draftPathCells.length - 2] || null : null;
      const hasHorizontalTail =
        draftPathTail !== null &&
        draftPathBeforeTail !== null &&
        draftPathTail.y === draftPathBeforeTail.y &&
        draftPathTail.x !== draftPathBeforeTail.x;
      const draftPathTurnCell: GameRoomTeamTetrisCell | null = hasHorizontalTail
        ? draftPathTail
        : null;
      const draftPathLineCells = hasHorizontalTail ? draftPathCells.slice(0, -1) : draftPathCells;
      const draftOverlayTone = draftCanSubmit ? "draft-valid" : "draft-blocked";
      const draftPathTone = draftCanSubmit ? "trace-valid" : "trace-blocked";
      const draftPathTurnTone = draftCanSubmit ? "trace-valid-turn" : "trace-blocked-turn";
      const canConfigureMatch =
        state.teamTetris.active !== true && state.teamTetris.result !== "pending";
      const canStart =
        state.teamTetris.canStart === true &&
        canConfigureMatch &&
        (hiddenPairs === true || selectedPartnerSeatId !== null);
      const canSubmitMove = pendingTurn !== null && draftCanSubmit;

      const app = createElement("main", "tt-shell", "");
      app.dataset["presentationMode"] = state.presentation.mode;
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

      const roster = createElement("section", "tt-panel tt-panel--overview", "");
      const overviewGrid = createElement("div", "tt-overview-grid", "");
      const overviewCopy = createElement("div", "tt-overview-copy", "");
      const readinessGrid = createElement("div", "tt-requirement-grid", "");

      overviewCopy.append(
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
          text(["teamTetris", "roster", "partnerLabel"]) + ": " + getTeamTetrisPartnerRoleLabel()
        )
      );
      readinessGrid.append(
        createTeamTetrisRequirementCard("ai1", state.teamTetris.requiredSlots.ai1 === true),
        createTeamTetrisRequirementCard("ai2", state.teamTetris.requiredSlots.ai2 === true),
        createTeamTetrisRequirementCard("us1", state.teamTetris.requiredSlots.us1 === true)
      );
      overviewGrid.append(overviewCopy, readinessGrid);
      roster.append(overviewGrid);

      if (state.teamTetris.matchId || state.teamTetris.active === true) {
        roster.append(
          createElement("p", "tt-panel__label", text(["teamTetris", "roster", "pairStatusTitle"]))
        );
        buildTeamTetrisPairStatusLines(state).forEach(function (line: string) {
          roster.append(createElement("p", "tt-panel__body", line));
        });
      }

      const controls = createElement("section", "tt-panel", "");
      controls.append(
        createElement("p", "tt-panel__label", text(["teamTetris", "controls", "featureLabel"]))
      );

      const hiddenChoices = createElement("div", "tt-toggle-row", "");
      const hiddenToggleOptions = [
        { value: true, label: text(["teamTetris", "controls", "hiddenPairsOn"]) },
        { value: false, label: text(["teamTetris", "controls", "hiddenPairsOff"]) },
      ];

      hiddenToggleOptions.forEach(function (entry: { value: boolean; label: string }) {
        const button = createButton("tt-toggle", entry.label);
        button.disabled = !canConfigureMatch;
        button.dataset["selected"] = hiddenPairs === entry.value ? "true" : "false";
        button.addEventListener("click", function () {
          state.preferences.teamTetrisHiddenPairs = entry.value;
          render();
        });
        hiddenChoices.append(button);
      });

      controls.append(hiddenChoices);

      if (hiddenPairs !== true) {
        const partnerChoices = createElement("div", "tt-partner-row", "");
        (["ai1", "ai2", "us1"] as const).forEach(function (seatId) {
          const button = createButton("tt-toggle", getTeamTetrisSeatDisplayLabel(seatId));
          button.disabled = !canConfigureMatch;
          button.dataset["selected"] = selectedPartnerSeatId === seatId ? "true" : "false";
          button.addEventListener("click", function () {
            state.preferences.teamTetrisSelectedPartnerSeatId = seatId;
            render();
          });
          partnerChoices.append(button);
        });

        const previewCard = createElement("div", "tt-pairing-preview", "");
        previewCard.append(
          createElement(
            "p",
            "tt-panel__label",
            text(["teamTetris", "controls", "partnerPreviewTitle"])
          )
        );
        if (selectedPartnerSeatId) {
          buildTeamTetrisSelectionPreview(selectedPartnerSeatId).forEach(function (line: string) {
            previewCard.append(createElement("p", "tt-panel__body", line));
          });
        } else {
          previewCard.append(
            createElement("p", "tt-panel__body", text(["teamTetris", "controls", "partnerPending"]))
          );
        }
        previewCard.append(
          createElement("p", "tt-panel__hint", text(["teamTetris", "controls", "partnerHint"]))
        );

        controls.append(
          createElement("p", "tt-panel__label", text(["teamTetris", "controls", "partnerLabel"])),
          partnerChoices,
          previewCard
        );
      }

      const actions = createElement("div", "tt-actions", "");
      const startButton = createButton(
        "xox-button xox-button--primary",
        text(["teamTetris", "controls", "start"])
      );
      startButton.disabled = !canStart;
      startButton.addEventListener("click", onTeamTetrisStart);

      const resetButton = createButton(
        "xox-button xox-button--ghost",
        text(["teamTetris", "controls", "reset"])
      );
      resetButton.addEventListener("click", onTeamTetrisReset);

      actions.append(startButton, resetButton);
      controls.append(
        createElement("p", "tt-panel__hint", text(["teamTetris", "controls", "startHint"])),
        actions
      );
      rail.append(intro, roster, controls);

      const stageMain = createElement("div", "tt-stage-main", "");
      const supportStack = createElement("div", "tt-support-stack", "");
      const supportPair = createElement("div", "tt-support-pair", "");
      const statusPanel = createElement("section", "tt-context-card tt-context-card--status", "");
      const rotationPanel = createTeamTetrisPieceCard(
        text(["teamTetris", "boards", "currentPiece"]),
        pendingTurn ? pendingTurn.pieceId : "",
        state.teamTetrisDraft.rotation,
        ""
      );
      const snapshotCard = createTeamTetrisSnapshotCard(
        text(["teamTetris", "boards", "beforePartner"]),
        ownBoard.boardBeforePartnerPieceRows
      );
      const partnerPieceCard = createTeamTetrisPieceCard(
        text(["teamTetris", "boards", "partnerPiece"]),
        ownBoard.partnerLastPiece ? ownBoard.partnerLastPiece.pieceId : "",
        ownBoard.partnerLastPiece ? ownBoard.partnerLastPiece.rotation : 0,
        getTeamTetrisPlacedByLabel(ownBoard.partnerLastPiece)
      );

      rotationPanel.className = `${rotationPanel.className} tt-context-card--controls`.trim();
      rotationPanel.dataset["variant"] = "current-piece";
      snapshotCard.dataset["variant"] = "snapshot";
      partnerPieceCard.dataset["variant"] = "partner";
      statusPanel.append(
        createElement("span", "tt-context-card__label", text(["teamTetris", "heroBadge"])),
        createElement("p", "tt-context-card__lead", getTeamTetrisStatusText()),
        createElement(
          "p",
          "tt-context-card__meta",
          text(["teamTetris", "metrics", "turnLabel"]) +
            ": " +
            getTeamTetrisTurnLabel() +
            " • " +
            text(["teamTetris", "metrics", "resultLabel"]) +
            ": " +
            getTeamTetrisResultLabel()
        ),
        createElement(
          "p",
          "tt-context-card__meta",
          text(["teamTetris", "controls", "pathLegend"]) +
            ": " +
            text(["teamTetris", "controls", "pathRule"])
        ),
        createElement(
          "p",
          "tt-context-card__meta",
          view && view.hiddenPairs === true && view.revealedPairs !== true
            ? text(["teamTetris", "roster", "hiddenHint"])
            : text(["teamTetris", "roster", "revealedHint"])
        ),
        createElement("p", "tt-context-card__meta", text(["teamTetris", "boards", "publicHint"]))
      );

      const rotationChoices = createElement("div", "tt-rotation-row", "");
      const legalRotations = pendingTurn ? pendingTurn.legalRotations : [0];
      legalRotations.forEach(function (rotation: number) {
        const button = createButton("tt-rotation", String(rotation));
        button.disabled = pendingTurn === null;
        button.dataset["selected"] = state.teamTetrisDraft.rotation === rotation ? "true" : "false";
        button.addEventListener("click", function () {
          onTeamTetrisRotationSelect(rotation);
        });
        rotationChoices.append(button);
      });

      const rotateButton = createButton(
        "xox-button xox-button--ghost",
        text(["teamTetris", "controls", "rotate"])
      );
      rotateButton.disabled = pendingTurn === null;
      rotateButton.addEventListener("click", onTeamTetrisRotate);

      const draftActions = createElement("div", "tt-actions tt-actions--compact", "");
      const clearButton = createButton(
        "xox-button xox-button--ghost",
        text(["teamTetris", "controls", "clearPath"])
      );
      clearButton.disabled = pendingTurn === null;
      clearButton.addEventListener("click", onTeamTetrisClearDraft);

      const submitButton = createButton(
        "xox-button xox-button--primary",
        text(["teamTetris", "controls", "submitMove"])
      );
      submitButton.disabled = !canSubmitMove;
      submitButton.addEventListener("click", onTeamTetrisSubmit);

      draftActions.append(clearButton, rotateButton, submitButton);
      rotationPanel.append(
        rotationChoices,
        draftActions,
        createElement("p", "tt-context-card__hint", getTeamTetrisDraftStatusText())
      );
      supportPair.append(snapshotCard, partnerPieceCard);
      supportStack.append(statusPanel, rotationPanel, supportPair);

      const boardGrid = createElement("div", "tt-board-grid", "");
      boardGrid.append(
        renderTeamTetrisBoardCard(ownBoard, {
          tone: "private",
          meta: text(["teamTetris", "boards", "privateBoard"]),
          interactive: pendingTurn !== null,
          overlayCells: draftOverlayCells,
          overlayTone: draftOverlayTone,
          overlayPieceId: pendingTurn ? pendingTurn.pieceId : "",
          pathCells: draftPathLineCells,
          pathTone: draftPathTone,
          pathTurnCell: draftPathTurnCell,
          pathTurnTone: draftPathTurnTone,
        }),
        renderTeamTetrisBoardCard(opponentBoard, {
          tone: "public",
          meta: text(["teamTetris", "boards", "publicBoard"]),
          interactive: false,
        })
      );

      stageMain.append(boardGrid, supportStack);
      stage.append(stageMain);
      arena.append(rail, stage);
      surface.append(arena);
      app.append(surface);
      root.replaceChildren(app);
    }

    return {
      renderTeamTetris: renderTeamTetris,
    };
  };
})((typeof window !== "undefined" ? window : globalThis) as unknown as GameRoomUiGlobal);
