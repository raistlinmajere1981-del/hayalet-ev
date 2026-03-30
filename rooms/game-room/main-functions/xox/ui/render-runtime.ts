(function (global: any) {
  type XoxInviteEntry = {
    inviteId: string;
    remoteUserId: string;
    nickname: string;
    note: string;
    starter: "user" | "opponent";
    sentAt: number | null;
  };
  type XoxPendingInvite = {
    direction: "incoming" | "outgoing";
    nickname: string;
    note: string;
  };
  type XoxSlotState = {
    slotId: string;
    nickname: string;
    ready?: boolean;
  };
  type XoxUiState = {
    presentation: {
      mode: string;
    };
    lastCommandMessage: string;
    preferences: {
      target: string;
      starter: string;
      inviteMessage: string;
    };
    context: {
      room: {
        name: string;
      };
      user: {
        nickname: string;
      };
      slots: Record<string, XoxSlotState>;
    };
    game: {
      pendingInvite: XoxPendingInvite | null;
      inviteInbox: XoxInviteEntry[];
      active: boolean;
      blockedReason: string;
      awaitingMoveFrom: "user" | "ai" | null;
      user: {
        nickname: string;
      };
      userSymbol: string;
      aiSymbol: string;
      board: string[];
      result: string;
    };
  };
  type XoxUiStateRuntime = {
    onAcceptInvite: (inviteId: string, remoteUserId: string) => void;
    onRejectInvite: (inviteId: string, remoteUserId: string) => void;
    formatInviteMeta: (invite: XoxInviteEntry) => string;
    getSelectedTarget: () => string;
    getDisplayOpponent: () => XoxSlotState;
    getSlotOrder: () => XoxSlotState[];
    getSlotStatusLabel: (slot: XoxSlotState) => string;
    getStarterLabelForCurrentTarget: (value: "user" | "ai") => string;
    onStart: () => void;
    onReset: () => void;
    getCurrentStatus: () => string;
    getTurnLabel: () => string;
    getResultLabel: () => string;
    getSymbolsLabel: () => string;
    onCellClick: (index: number) => void;
    getBoardCaption: () => string;
    getOpenCellsLabel: () => string;
  };
  type InteractiveElement = HTMLElement & {
    type?: string;
    disabled?: boolean;
  };
  type XoxUiRenderRuntimeDeps = {
    getState: () => XoxUiState;
    featureId: string;
    bootstrapText: (key: string) => string;
    text: (path: string[]) => string;
    createElement: (
      tagName: string,
      className?: string,
      textContent?: string
    ) => InteractiveElement;
    render: () => void;
    isRoomApiAvailable: () => boolean;
    getFeatureLabel: (featureId: string) => string;
    stateRuntime: XoxUiStateRuntime;
  };

  const registry = global.GameRoomUiFactories || (global.GameRoomUiFactories = {});

  registry.createXoxUiRenderRuntime = function createXoxUiRenderRuntime(
    deps: XoxUiRenderRuntimeDeps
  ) {
    const getState = deps.getState;
    const featureId = deps.featureId;
    const bootstrapText = deps.bootstrapText;
    const text = deps.text;
    const createElement = deps.createElement;
    const render = deps.render;
    const isRoomApiAvailable = deps.isRoomApiAvailable;
    const getFeatureLabel = deps.getFeatureLabel;
    const stateRuntime = deps.stateRuntime;

    function createStatCard(label: string, value: string) {
      const card = createElement("div", "xox-stat", "");
      card.append(
        createElement("span", "xox-stat__label", label),
        createElement("strong", "xox-stat__value", value)
      );
      return card;
    }

    function createChoiceButton(title: string, meta: string, selected: boolean, disabled: boolean) {
      const button = createElement("button", "xox-choice-button", "");
      button.type = "button";
      button.disabled = disabled;
      button.dataset["selected"] = selected ? "true" : "false";
      button.append(createElement("span", "xox-choice-button__title", title));
      if (meta && meta.trim() !== "") {
        button.append(createElement("span", "xox-choice-button__meta", meta));
      }
      return button;
    }

    function createSeatCard(label: string, name: string, symbol: string, current: boolean) {
      const card = createElement("div", "xox-seat", "");
      card.dataset["current"] = current ? "true" : "false";
      card.dataset["tone"] = symbol === "O" ? "o" : "x";
      card.append(
        createElement("span", "xox-seat__label", label),
        createElement("strong", "xox-seat__name", name),
        createElement("span", "xox-seat__symbol", symbol)
      );
      return card;
    }

    function renderBootstrap(root: HTMLElement) {
      const state = getState();
      const app = createElement("main", "xox-shell xox-shell--bootstrap", "");
      app.dataset["presentationMode"] = state.presentation.mode;
      const surface = createElement("section", "xox-surface xox-surface--bootstrap", "");
      const brand = createElement("div", "xox-brand", "");
      brand.append(
        createElement("div", "xox-brand__eyebrow", bootstrapText("roomTitle")),
        createElement("h1", "xox-brand__title", bootstrapText("loadingTitle")),
        createElement(
          "p",
          "xox-brand__subtitle",
          state.lastCommandMessage && state.lastCommandMessage.trim() !== ""
            ? state.lastCommandMessage.trim()
            : bootstrapText("loadingBody")
        )
      );
      surface.append(brand);
      app.append(surface);
      document.title = bootstrapText("roomTitle");
      root.replaceChildren(app);
    }

    function renderInviteInbox(canRespond: boolean) {
      const state = getState();
      const panel = createElement("section", "xox-panel xox-panel--invites", "");
      panel.append(createElement("p", "xox-panel__label", text(["xox", "invites", "title"])));

      if (state.game.pendingInvite && state.game.pendingInvite.direction === "outgoing") {
        const pending = createElement("div", "xox-invite-card xox-invite-card--pending", "");
        pending.append(
          createElement("strong", "xox-invite-card__title", state.game.pendingInvite.nickname),
          createElement("p", "xox-invite-card__meta", text(["xox", "invites", "pendingOutgoing"])),
          createElement(
            "p",
            "xox-invite-card__message",
            state.game.pendingInvite.note || text(["xox", "invites", "messageFallback"])
          )
        );
        panel.append(pending);
      }

      if (state.game.inviteInbox.length === 0) {
        panel.append(createElement("p", "xox-panel__empty", text(["xox", "invites", "empty"])));
        return panel;
      }

      const list = createElement("div", "xox-invite-list", "");
      state.game.inviteInbox.forEach(function (invite: any) {
        const card = createElement("article", "xox-invite-card", "");
        const actions = createElement("div", "xox-invite-card__actions", "");
        const acceptButton = createElement(
          "button",
          "xox-button xox-button--primary",
          text(["xox", "invites", "accept"])
        );
        acceptButton.type = "button";
        acceptButton.disabled = !canRespond;
        acceptButton.addEventListener("click", function () {
          stateRuntime.onAcceptInvite(invite.inviteId, invite.remoteUserId);
        });
        const rejectButton = createElement(
          "button",
          "xox-button xox-button--ghost",
          text(["xox", "invites", "reject"])
        );
        rejectButton.type = "button";
        rejectButton.disabled = !canRespond;
        rejectButton.addEventListener("click", function () {
          stateRuntime.onRejectInvite(invite.inviteId, invite.remoteUserId);
        });
        actions.append(acceptButton, rejectButton);
        card.append(
          createElement("strong", "xox-invite-card__title", invite.nickname),
          createElement("p", "xox-invite-card__meta", stateRuntime.formatInviteMeta(invite)),
          createElement(
            "p",
            "xox-invite-card__message",
            invite.note || text(["xox", "invites", "messageFallback"])
          ),
          actions
        );
        list.append(card);
      });
      panel.append(list);
      return panel;
    }

    function renderXox(root: HTMLElement) {
      const state = getState();
      document.title = state.context.room.name + " - " + getFeatureLabel(featureId);

      const selectedTarget = stateRuntime.getSelectedTarget() || "ai1";
      const selectedSlot =
        state.context.slots[selectedTarget] || state.context.slots["ai1"] || { ready: false };
      const displayOpponent = stateRuntime.getDisplayOpponent();
      const hasPendingOutgoingInvite =
        !!state.game.pendingInvite && state.game.pendingInvite.direction === "outgoing";
      const canStart =
        selectedSlot["ready"] === true && state.game.active !== true && !hasPendingOutgoingInvite;
      const canReset = isRoomApiAvailable();
      const canUserMove =
        state.game.active === true &&
        state.game.awaitingMoveFrom === "user" &&
        !state.game.blockedReason;
      const canRespondToInvites = state.game.active !== true && !hasPendingOutgoingInvite;

      const app = createElement("main", "xox-shell", "");
      app.dataset["presentationMode"] = state.presentation.mode;
      const surface = createElement("section", "xox-surface", "");

      const arena = createElement("section", "xox-arena", "");
      const rail = createElement("aside", "xox-rail", "");

      const opponentPanel = createElement("section", "xox-panel", "");
      opponentPanel.append(
        createElement("p", "xox-panel__label", text(["xox", "topbar", "opponentLabel"]))
      );
      const opponentChoices = createElement("div", "xox-choice-grid", "");
      stateRuntime.getSlotOrder().forEach(function (slot: any) {
        const button = createChoiceButton(
          slot.nickname,
          slot.slotId.toUpperCase() + " / " + stateRuntime.getSlotStatusLabel(slot),
          slot.slotId === selectedTarget,
          state.game.active === true || hasPendingOutgoingInvite
        );
        button.addEventListener("click", function () {
          state.preferences.target = slot.slotId;
          render();
        });
        opponentChoices.append(button);
      });
      opponentPanel.append(opponentChoices);

      const starterPanel = createElement("section", "xox-panel", "");
      starterPanel.append(
        createElement("p", "xox-panel__label", text(["xox", "topbar", "starterLabel"]))
      );
      const starterChoices = createElement("div", "xox-toggle-row", "");
      [
        { value: "user", label: stateRuntime.getStarterLabelForCurrentTarget("user") },
        { value: "ai", label: stateRuntime.getStarterLabelForCurrentTarget("ai") },
      ].forEach(function (entry: any) {
        const button = createChoiceButton(
          entry.label,
          "",
          state.preferences.starter === entry.value,
          state.game.active === true || hasPendingOutgoingInvite
        );
        button.addEventListener("click", function () {
          state.preferences.starter = entry.value === "ai" ? "ai" : "user";
          render();
        });
        starterChoices.append(button);
      });
      starterPanel.append(starterChoices);

      const actionPanel = createElement("section", "xox-panel xox-panel--actions", "");
      actionPanel.append(
        createElement("p", "xox-panel__label", text(["xox", "topbar", "featureLabel"]))
      );
      const featurePill = createElement("div", "xox-feature-pill", getFeatureLabel(featureId));
      const inviteFieldLabel = createElement("label", "xox-field", "");
      inviteFieldLabel.append(
        createElement("span", "xox-field__label", text(["xox", "topbar", "inviteMessageLabel"]))
      );
      const inviteField = document.createElement("textarea");
      inviteField.className = "xox-textarea";
      inviteField.rows = 4;
      inviteField.placeholder = text(["xox", "topbar", "inviteMessagePlaceholder"]);
      inviteField.value = state.preferences.inviteMessage;
      inviteField.disabled = state.game.active === true || hasPendingOutgoingInvite;
      inviteField.addEventListener("input", function () {
        state.preferences.inviteMessage = inviteField.value;
      });
      inviteFieldLabel.append(inviteField);
      const actionHint = createElement(
        "p",
        "xox-panel__hint",
        selectedTarget === "us1"
          ? text(["xox", "topbar", "inviteMessageHintUs1"])
          : text(["xox", "topbar", "inviteMessageHintAi"])
      );
      const actionGroup = createElement("div", "xox-actions", "");
      const startButton = createElement(
        "button",
        "xox-button xox-button--primary",
        selectedTarget === "us1"
          ? text(["xox", "topbar", "sendInvite"])
          : text(["xox", "topbar", "start"])
      );
      startButton.type = "button";
      startButton.disabled = !canStart;
      startButton.addEventListener("click", stateRuntime.onStart);
      const resetButton = createElement(
        "button",
        "xox-button xox-button--ghost",
        text(["xox", "topbar", "reset"])
      );
      resetButton.type = "button";
      resetButton.disabled = !canReset;
      resetButton.addEventListener("click", stateRuntime.onReset);
      actionGroup.append(startButton, resetButton);
      actionPanel.append(featurePill, inviteFieldLabel, actionHint, actionGroup);

      rail.append(opponentPanel, starterPanel, actionPanel, renderInviteInbox(canRespondToInvites));

      const stage = createElement("section", "xox-stage", "");
      const scorebar = createElement("div", "xox-scorebar", "");
      scorebar.append(
        createStatCard(text(["xox", "board", "statusLabel"]), stateRuntime.getCurrentStatus()),
        createStatCard(text(["xox", "board", "turnLabel"]), stateRuntime.getTurnLabel()),
        createStatCard(text(["xox", "board", "resultLabel"]), stateRuntime.getResultLabel()),
        createStatCard(text(["xox", "board", "symbolsLabel"]), stateRuntime.getSymbolsLabel())
      );

      const boardWrap = createElement("div", "xox-board-wrap", "");
      boardWrap.append(
        createSeatCard(
          text(["xox", "turns", "user"]),
          state.game.user.nickname || state.context.user.nickname,
          state.game.userSymbol,
          state.game.awaitingMoveFrom === "user"
        )
      );

      const boardShell = createElement("div", "xox-board-shell", "");
      const board = createElement("div", "xox-board", "");
      state.game.board.forEach(function (symbol: any, index: any) {
        const cell = createElement("button", "xox-cell", symbol);
        cell.type = "button";
        cell.dataset["index"] = String(index);
        cell.dataset["symbol"] = symbol;
        cell.dataset["empty"] = symbol === "" ? "true" : "false";
        cell.disabled = !canUserMove || symbol !== "";
        cell.addEventListener("click", function () {
          stateRuntime.onCellClick(index);
        });
        board.append(cell);
      });
      boardShell.append(board);
      boardWrap.append(boardShell);

      boardWrap.append(
        createSeatCard(
          text(["xox", "turns", "ai"]),
          displayOpponent.nickname,
          state.game.aiSymbol,
          state.game.awaitingMoveFrom === "ai"
        )
      );

      const footer = createElement("div", "xox-stage-footer", "");
      footer.append(
        createElement("p", "xox-stage-footer__message", stateRuntime.getBoardCaption()),
        createElement(
          "p",
          "xox-stage-footer__meta",
          text(["xox", "board", "cellsLabel"]) + ": " + stateRuntime.getOpenCellsLabel()
        )
      );

      stage.append(scorebar, boardWrap, footer);
      arena.append(rail, stage);
      surface.append(arena);
      app.append(surface);
      root.replaceChildren(app);
    }

    return {
      renderBootstrap: renderBootstrap,
      renderXox: renderXox,
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
