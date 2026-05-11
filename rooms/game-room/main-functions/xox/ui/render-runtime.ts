(function (
  global: typeof globalThis & {
    GameRoomUiFactories?: GameRoomUiFactoriesRegistry;
  }
) {
  type XoxTarget = "ai1" | "ai2" | "us1";
  type BackgammonPoint = {
    point: number;
    owner: "user" | "ai" | "";
    count: number;
  };
  type BackgammonLocation =
    | { type: "bar"; seat: "user" | "ai" }
    | { type: "off" }
    | { type: "point"; point: number };
  type BackgammonSubMove = {
    from: BackgammonLocation;
    to: BackgammonLocation;
    die: number;
    hit: boolean;
  };
  type BackgammonLegalMove = {
    id: string;
    label: string;
    moves: BackgammonSubMove[];
    diceUsed: number[];
    pass?: boolean;
  };
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
    slotId: XoxTarget;
    dispatchable?: boolean;
    nickname: string;
    avatar?: string | null;
    assigned?: boolean;
    connected?: boolean;
    ready?: boolean;
  };
  type XoxMatchHistoryEntry = {
    id: string;
    finishedAt: number;
    target: string;
    opponentNickname: string;
    opponentAvatar: string | null;
    userNickname: string;
    result: "user-win" | "ai-win";
    starter: "ai" | "user";
    scorePoints: number;
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
      invitesTab?: "incoming" | "outgoing";
    };
    context: {
      room: {
        name: string;
      };
      user: {
        nickname: string;
        avatar?: string | null;
      };
      slots: Record<string, XoxSlotState>;
    };
    game: {
      pendingInvite: XoxPendingInvite | null;
      inviteInbox: XoxInviteEntry[];
      matchHistory?: XoxMatchHistoryEntry[];
      active: boolean;
      blockedReason: string;
      awaitingMoveFrom: "user" | "ai" | null;
      user: {
        nickname: string;
      };
      board: BackgammonPoint[];
      bar: Record<"user" | "ai", number>;
      off: Record<"user" | "ai", number>;
      dice: number[];
      legalMoves: BackgammonLegalMove[];
      result: string;
      winner?: string;
      opponent?: XoxSlotState;
      scorePoints: number;
    };
  };
  type XoxUiStateRuntime = {
    onAcceptInvite: (inviteId: string, remoteUserId: string) => void;
    onRejectInvite: (inviteId: string, remoteUserId: string) => void;
    formatInviteMeta: (invite: XoxInviteEntry) => string;
    getSelectedTarget: () => XoxTarget;
    getDisplayOpponent: () => XoxSlotState;
    getSlotOrder: () => XoxSlotState[];
    getSlotStatusLabel: (slot: XoxSlotState) => string;
    getStarterLabelForCurrentTarget: (value: "user" | "ai") => string;
    onStart: () => void;
    onReset: () => void;
    getCurrentStatus: () => string;
    getTurnLabel: () => string;
    getResultLabel: () => string;
    getDiceLabel: () => string;
    getBearOffLabel: () => string;
    getBarLabel: () => string;
    onLegalMove: (moveId: string) => void;
    onCancelOutgoingInvite: () => void;
    getMatchHistory: () => XoxMatchHistoryEntry[];
    getMatchHistoryResultLabel: (entry: XoxMatchHistoryEntry) => string;
    getMatchHistoryResultTone: (entry: XoxMatchHistoryEntry) => string;
    formatMatchHistoryDate: (entry: XoxMatchHistoryEntry) => string;
  };
  type XoxBackgammonStageRuntime = {
    destroy: () => void;
    renderBackgammonStage: (
      host: HTMLElement,
      options: {
        canUserMove: boolean;
        game: XoxUiState["game"];
      }
    ) => void;
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

  type XoxUiRenderRuntimeRegistry = GameRoomUiFactoriesRegistry & {
    createXoxBackgammonStageRuntime?: (
      deps: XoxUiRenderRuntimeDeps & {
        stateRuntime: XoxUiStateRuntime;
      }
    ) => XoxBackgammonStageRuntime;
    createXoxUiRenderRuntime?: (deps: XoxUiRenderRuntimeDeps) => {
      renderBootstrap(root: HTMLElement): void;
      renderXox(root: HTMLElement): void;
    };
  };

  const registry = (global.GameRoomUiFactories ||
    (global.GameRoomUiFactories = {} as GameRoomUiFactoriesRegistry)) as XoxUiRenderRuntimeRegistry;

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
    const createStageRuntime = registry.createXoxBackgammonStageRuntime;
    const backgammonStageRuntime =
      typeof createStageRuntime === "function"
        ? createStageRuntime({
            ...deps,
            stateRuntime,
          })
        : null;

    function getInitials(name: string): string {
      const trimmed = (name || "").trim();
      if (trimmed === "") {
        return "??";
      }
      const parts = trimmed.split(/\s+/);
      return parts.length === 1
        ? trimmed.slice(0, 2).toUpperCase()
        : ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
    }

    function createAvatar(
      name: string,
      avatar: string | null | undefined,
      size: "sm" | "md" | "lg"
    ) {
      const wrapper = createElement("span", "xox-avatar xox-avatar--" + size, "");
      if (avatar && avatar.trim() !== "") {
        const img = document.createElement("img");
        img.src = avatar;
        img.alt = name || "";
        img.loading = "lazy";
        wrapper.append(img);
      } else {
        wrapper.append(createElement("span", "xox-avatar__initials", getInitials(name)));
      }
      return wrapper;
    }

    function createSlotCard(slot: XoxSlotState, selected: boolean, disabled: boolean) {
      const status = stateRuntime.getSlotStatusLabel(slot);
      const tone =
        slot.ready === true
          ? "ready"
          : slot.assigned === true && slot.connected !== true
            ? "disconnected"
            : slot.assigned === true
              ? "assigned"
              : "empty";
      const button = createElement("button", "xox-slot-card", "");
      button.type = "button";
      button.disabled = disabled;
      button.dataset["selected"] = selected ? "true" : "false";
      button.dataset["tone"] = tone;
      button.append(
        createAvatar(slot.nickname, slot.avatar, "md"),
        createElement("span", "xox-slot-card__info", "")
      );
      const info = button.lastElementChild as HTMLElement;
      const header = createElement("span", "xox-slot-card__header", "");
      header.append(
        createElement("span", "xox-slot-card__badge", slot.slotId.toUpperCase()),
        createElement("strong", "xox-slot-card__name", slot.nickname)
      );
      const statusLine = createElement("span", "xox-slot-card__status", "");
      statusLine.append(
        createElement("span", "xox-slot-card__dot", ""),
        createElement("span", "xox-slot-card__status-text", status)
      );
      info.append(header, statusLine);
      return button;
    }

    function createChoiceButton(title: string, selected: boolean, disabled: boolean) {
      const button = createElement("button", "xox-choice-button", "");
      button.type = "button";
      button.disabled = disabled;
      button.dataset["selected"] = selected ? "true" : "false";
      button.append(createElement("span", "xox-choice-button__title", title));
      return button;
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

    function renderEmptyState(message: string) {
      const wrapper = createElement("div", "xox-empty-state", "");
      wrapper.append(createElement("p", "xox-empty-state__text", message));
      return wrapper;
    }

    function renderIncomingInviteCard(invite: XoxInviteEntry, canRespond: boolean) {
      const card = createElement("article", "xox-invite-card xox-invite-card--incoming", "");
      const header = createElement("div", "xox-invite-card__header", "");
      header.append(
        createAvatar(invite.nickname, null, "sm"),
        createElement("strong", "xox-invite-card__title", invite.nickname)
      );
      const actions = createElement("div", "xox-invite-card__actions", "");
      const acceptButton = createElement(
        "button",
        "xox-button xox-button--primary xox-button--compact",
        text(["xox", "invites", "accept"])
      );
      acceptButton.type = "button";
      acceptButton.disabled = !canRespond;
      acceptButton.addEventListener("click", function () {
        stateRuntime.onAcceptInvite(invite.inviteId, invite.remoteUserId);
      });
      const rejectButton = createElement(
        "button",
        "xox-button xox-button--ghost xox-button--compact",
        text(["xox", "invites", "reject"])
      );
      rejectButton.type = "button";
      rejectButton.disabled = !canRespond;
      rejectButton.addEventListener("click", function () {
        stateRuntime.onRejectInvite(invite.inviteId, invite.remoteUserId);
      });
      actions.append(acceptButton, rejectButton);
      card.append(
        header,
        createElement("p", "xox-invite-card__meta", stateRuntime.formatInviteMeta(invite)),
        createElement(
          "p",
          "xox-invite-card__message",
          invite.note || text(["xox", "invites", "messageFallback"])
        ),
        actions
      );
      return card;
    }

    function renderOutgoingInviteCard(invite: XoxPendingInvite, canCancel: boolean) {
      const card = createElement("article", "xox-invite-card xox-invite-card--outgoing", "");
      const actions = createElement("div", "xox-invite-card__actions", "");
      const cancelButton = createElement(
        "button",
        "xox-button xox-button--ghost xox-button--compact",
        text(["xox", "invites", "cancel"])
      );
      cancelButton.type = "button";
      cancelButton.disabled = !canCancel;
      cancelButton.addEventListener("click", stateRuntime.onCancelOutgoingInvite);
      actions.append(cancelButton);
      card.append(
        createElement("strong", "xox-invite-card__title", invite.nickname),
        createElement("p", "xox-invite-card__meta", text(["xox", "invites", "pendingOutgoing"])),
        createElement(
          "p",
          "xox-invite-card__message",
          invite.note || text(["xox", "invites", "messageFallback"])
        ),
        actions
      );
      return card;
    }

    function renderInvitesPanel(canRespond: boolean, canCancel: boolean) {
      const state = getState();
      const panel = createElement("section", "xox-panel xox-panel--invites", "");
      const activeTab = state.preferences.invitesTab === "outgoing" ? "outgoing" : "incoming";
      const header = createElement("div", "xox-panel__header", "");
      header.append(createElement("p", "xox-panel__label", text(["xox", "invites", "title"])));
      const tabs = createElement("div", "xox-tab-row", "");
      const outgoingCount =
        state.game.pendingInvite && state.game.pendingInvite.direction === "outgoing" ? 1 : 0;
      [
        {
          id: "incoming",
          label: text(["xox", "invites", "incomingTab"]),
          count: state.game.inviteInbox.length,
        },
        { id: "outgoing", label: text(["xox", "invites", "outgoingTab"]), count: outgoingCount },
      ].forEach(function (tabSpec) {
        const tabButton = createElement("button", "xox-tab", "");
        tabButton.type = "button";
        tabButton.dataset["active"] = tabSpec.id === activeTab ? "true" : "false";
        tabButton.append(createElement("span", "xox-tab__label", tabSpec.label));
        if (tabSpec.count > 0) {
          tabButton.append(createElement("span", "xox-tab__count", String(tabSpec.count)));
        }
        tabButton.addEventListener("click", function () {
          state.preferences.invitesTab = tabSpec.id as "incoming" | "outgoing";
          render();
        });
        tabs.append(tabButton);
      });
      header.append(tabs);
      panel.append(header);

      const body = createElement("div", "xox-panel__body xox-invite-list", "");
      if (activeTab === "incoming") {
        if (state.game.inviteInbox.length === 0) {
          body.append(renderEmptyState(text(["xox", "invites", "empty"])));
        } else {
          state.game.inviteInbox.forEach((invite) =>
            body.append(renderIncomingInviteCard(invite, canRespond))
          );
        }
      } else if (outgoingCount === 0) {
        body.append(renderEmptyState(text(["xox", "invites", "outgoingEmpty"])));
      } else if (state.game.pendingInvite && state.game.pendingInvite.direction === "outgoing") {
        body.append(renderOutgoingInviteCard(state.game.pendingInvite, canCancel));
      }
      panel.append(body);
      return panel;
    }

    function renderHistoryPanel() {
      const panel = createElement("section", "xox-panel xox-panel--history", "");
      panel.append(createElement("p", "xox-panel__label", text(["xox", "history", "title"])));
      const body = createElement("div", "xox-panel__body xox-history-list", "");
      const entries = stateRuntime.getMatchHistory();
      if (entries.length === 0) {
        body.append(renderEmptyState(text(["xox", "history", "empty"])));
      } else {
        entries.forEach(function (entry) {
          const card = createElement("article", "xox-history-card", "");
          card.dataset["tone"] = stateRuntime.getMatchHistoryResultTone(entry);
          const main = createElement("div", "xox-history-card__main", "");
          main.append(
            createElement("strong", "xox-history-card__name", entry.opponentNickname),
            createElement(
              "span",
              "xox-history-card__badge",
              stateRuntime.getMatchHistoryResultLabel(entry) + " x" + String(entry.scorePoints)
            ),
            createElement(
              "span",
              "xox-history-card__meta",
              stateRuntime.formatMatchHistoryDate(entry)
            )
          );
          card.append(createAvatar(entry.opponentNickname, entry.opponentAvatar, "sm"), main);
          body.append(card);
        });
      }
      panel.append(body);
      return panel;
    }

    function renderSlotsPanel(selectedTarget: XoxTarget, disabled: boolean) {
      const state = getState();
      const panel = createElement("section", "xox-panel xox-panel--slots", "");
      panel.append(
        createElement("p", "xox-panel__label", text(["xox", "topbar", "opponentLabel"]))
      );
      const list = createElement("div", "xox-slot-list", "");
      stateRuntime.getSlotOrder().forEach(function (slot: XoxSlotState) {
        const slotDisabled = disabled || slot.assigned !== true;
        const card = createSlotCard(slot, slot.slotId === selectedTarget, slotDisabled);
        card.addEventListener("click", function () {
          if (slotDisabled) {
            return;
          }
          state.preferences.target = slot.slotId;
          render();
        });
        list.append(card);
      });
      panel.append(list);
      return panel;
    }

    function renderSetupPanel(
      selectedTarget: XoxTarget,
      canStart: boolean,
      canReset: boolean,
      disabled: boolean
    ) {
      const state = getState();
      const panel = createElement("section", "xox-panel xox-panel--setup", "");
      panel.append(createElement("p", "xox-panel__label", text(["xox", "topbar", "starterLabel"])));
      const starterRow = createElement("div", "xox-toggle-row", "");
      (["user", "ai"] as const).forEach(function (starter) {
        const button = createChoiceButton(
          stateRuntime.getStarterLabelForCurrentTarget(starter),
          state.preferences.starter === starter,
          disabled
        );
        button.addEventListener("click", function () {
          state.preferences.starter = starter;
          render();
        });
        starterRow.append(button);
      });
      panel.append(starterRow);

      if (selectedTarget === "us1") {
        const inviteFieldLabel = createElement("label", "xox-field", "");
        inviteFieldLabel.append(
          createElement("span", "xox-field__label", text(["xox", "topbar", "inviteMessageLabel"]))
        );
        const inviteField = document.createElement("textarea");
        inviteField.className = "xox-textarea";
        inviteField.rows = 2;
        inviteField.placeholder = text(["xox", "topbar", "inviteMessagePlaceholder"]);
        inviteField.value = state.preferences.inviteMessage;
        inviteField.disabled = disabled;
        inviteField.addEventListener("input", function () {
          state.preferences.inviteMessage = inviteField.value;
        });
        inviteFieldLabel.append(inviteField);
        panel.append(inviteFieldLabel);
      }

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
      panel.append(actionGroup);
      return panel;
    }

    function createMatchupSeat(
      role: "user" | "opponent",
      name: string,
      avatar: string | null | undefined,
      active: boolean
    ) {
      const seat = createElement("div", "xox-matchup-seat", "");
      seat.dataset["role"] = role;
      seat.dataset["active"] = active ? "true" : "false";
      seat.append(
        createAvatar(name, avatar, "lg"),
        createElement("strong", "xox-matchup-seat__name", name)
      );
      return seat;
    }

    function renderMatchupHeader(
      userName: string,
      opponent: XoxSlotState,
      awaitingUser: boolean,
      awaitingAi: boolean
    ) {
      const userAvatar = getState().context.user.avatar ?? null;
      const header = createElement("header", "xox-matchup", "");
      header.append(
        createMatchupSeat("user", userName, userAvatar, awaitingUser),
        createElement("span", "xox-matchup__divider", text(["xox", "matchup", "vs"])),
        createMatchupSeat("opponent", opponent.nickname, opponent.avatar, awaitingAi)
      );
      return header;
    }

    function renderStatusStack(
      awaitingUser: boolean,
      awaitingAi: boolean,
      result: string,
      isActive: boolean
    ) {
      const stack = createElement("section", "xox-status-stack", "");
      const statusCard = createElement("section", "xox-context-card xox-context-card--status", "");
      statusCard.append(
        createElement("span", "xox-context-card__label", text(["xox", "board", "statusLabel"])),
        createElement("p", "xox-context-card__lead", stateRuntime.getCurrentStatus())
      );
      const turnCard = createElement("section", "xox-context-card xox-context-card--turn", "");
      turnCard.dataset["awaiting"] = awaitingUser ? "user" : awaitingAi ? "ai" : "none";
      turnCard.append(
        createElement("span", "xox-context-card__label", text(["xox", "board", "turnLabel"])),
        createElement("p", "xox-context-card__lead", stateRuntime.getTurnLabel())
      );
      const resultCard = createElement("section", "xox-context-card xox-context-card--result", "");
      resultCard.dataset["tone"] =
        result === "user-win" ? "win" : result === "ai-win" ? "loss" : isActive ? "active" : "idle";
      resultCard.append(
        createElement("span", "xox-context-card__label", text(["xox", "board", "resultLabel"])),
        createElement("p", "xox-context-card__lead", stateRuntime.getResultLabel())
      );
      const diceCard = createElement("section", "xox-context-card xox-context-card--dice", "");
      diceCard.append(
        createElement("span", "xox-context-card__label", text(["xox", "board", "diceLabel"])),
        createElement("p", "xox-context-card__lead", stateRuntime.getDiceLabel()),
        createElement(
          "p",
          "xox-context-card__meta",
          text(["xox", "board", "barLabel"]) + ": " + stateRuntime.getBarLabel()
        ),
        createElement(
          "p",
          "xox-context-card__meta",
          text(["xox", "board", "offLabel"]) + ": " + stateRuntime.getBearOffLabel()
        )
      );
      stack.append(statusCard, turnCard, resultCard, diceCard);
      return stack;
    }

    function createChecker(owner: "user" | "ai", index: number, total: number) {
      const checker = createElement(
        "span",
        "xox-checker",
        index === 0 && total > 5 ? String(total) : ""
      );
      checker.dataset["owner"] = owner;
      return checker;
    }

    function renderPoint(point: BackgammonPoint) {
      const pointEl = createElement("div", "xox-point", "");
      pointEl.dataset["owner"] = point.owner || "empty";
      pointEl.dataset["point"] = String(point.point);
      pointEl.append(createElement("span", "xox-point__number", String(point.point)));
      const stack = createElement("span", "xox-point__stack", "");
      const visible = Math.min(point.count, 5);
      for (let index = 0; index < visible; index += 1) {
        if (point.owner === "user" || point.owner === "ai") {
          stack.append(createChecker(point.owner, index, point.count));
        }
      }
      pointEl.append(stack);
      return pointEl;
    }

    function renderBoard(points: BackgammonPoint[]) {
      if (backgammonStageRuntime !== null) {
        const stageHost = createElement("div", "xox-backgammon-stage", "");
        stageHost.dataset["xoxBackgammonStage"] = "true";
        return stageHost;
      }
      const boardShell = createElement("div", "xox-board-shell xox-board-shell--tavla", "");
      const board = createElement("div", "xox-board xox-board--tavla", "");
      const top = createElement("div", "xox-board-row xox-board-row--top", "");
      const bottom = createElement("div", "xox-board-row xox-board-row--bottom", "");
      points
        .slice(12, 24)
        .reverse()
        .forEach((point) => top.append(renderPoint(point)));
      points.slice(0, 12).forEach((point) => bottom.append(renderPoint(point)));
      const bar = createElement("div", "xox-board-bar", "");
      bar.append(
        createElement("span", "xox-board-bar__label", text(["xox", "board", "barLabel"])),
        createElement("strong", "xox-board-bar__value", stateRuntime.getBarLabel())
      );
      board.append(top, bar, bottom);
      boardShell.append(board);
      return boardShell;
    }

    function renderLegalMoves(canUserMove: boolean, moves: BackgammonLegalMove[]) {
      const panel = createElement("section", "xox-context-card xox-context-card--moves", "");
      panel.append(
        createElement(
          "span",
          "xox-context-card__label",
          text(["xox", "board", "fallbackMovesLabel"])
        ),
        createElement("p", "xox-context-card__meta", text(["xox", "board", "fallbackMovesHint"]))
      );
      const list = createElement("div", "xox-move-list", "");
      if (moves.length === 0) {
        list.append(
          createElement("p", "xox-context-card__meta", text(["xox", "board", "noMoves"]))
        );
      } else {
        moves.slice(0, 4).forEach(function (move) {
          const button = createElement("button", "xox-move-button", "");
          button.type = "button";
          button.disabled = !canUserMove;
          button.append(
            createElement("span", "xox-move-button__label", move.label),
            createElement("span", "xox-move-button__dice", move.diceUsed.join(" - ") || "pass")
          );
          button.addEventListener("click", function () {
            stateRuntime.onLegalMove(move.id);
          });
          list.append(button);
        });
        if (moves.length > 4) {
          list.append(
            createElement(
              "p",
              "xox-context-card__meta",
              "+" + String(moves.length - 4) + " " + text(["xox", "board", "moreMoves"])
            )
          );
        }
      }
      panel.append(list);
      return panel;
    }

    function renderXox(root: HTMLElement) {
      const state = getState();
      document.title = state.context.room.name + " - " + getFeatureLabel(featureId);

      const selectedTarget = stateRuntime.getSelectedTarget();
      const selectedSlot = state.context.slots[selectedTarget] ?? state.context.slots["ai1"];
      if (!selectedSlot) {
        return;
      }
      const displayOpponent = stateRuntime.getDisplayOpponent();
      const hasPendingOutgoingInvite =
        !!state.game.pendingInvite && state.game.pendingInvite.direction === "outgoing";
      const controlsDisabled = state.game.active === true || hasPendingOutgoingInvite;
      const canStart =
        selectedSlot.dispatchable === true &&
        state.game.active !== true &&
        !hasPendingOutgoingInvite;
      const canReset = isRoomApiAvailable();
      const canUserMove =
        state.game.active === true &&
        state.game.awaitingMoveFrom === "user" &&
        !state.game.blockedReason;
      const canRespondToInvites = state.game.active !== true && !hasPendingOutgoingInvite;
      const canCancelOutgoing = hasPendingOutgoingInvite && canReset;
      const awaitingUser = state.game.active === true && state.game.awaitingMoveFrom === "user";
      const awaitingAi = state.game.active === true && state.game.awaitingMoveFrom === "ai";
      const resultKey = state.game.result || "idle";

      const app = createElement("main", "xox-shell", "");
      app.dataset["presentationMode"] = state.presentation.mode;
      const surface = createElement("section", "xox-surface", "");
      const arena = createElement("section", "xox-arena", "");
      const rail = createElement("aside", "xox-rail", "");
      rail.append(
        renderSlotsPanel(selectedTarget, controlsDisabled),
        renderSetupPanel(selectedTarget, canStart, canReset, controlsDisabled),
        renderInvitesPanel(canRespondToInvites, canCancelOutgoing),
        renderHistoryPanel()
      );

      const stage = createElement("section", "xox-stage", "");
      stage.dataset["awaiting"] = awaitingUser ? "user" : awaitingAi ? "ai" : "none";
      stage.dataset["result"] = resultKey;
      const userName = state.game.user.nickname || state.context.user.nickname;
      const matchupHeader = renderMatchupHeader(
        userName,
        displayOpponent,
        awaitingUser,
        awaitingAi
      );
      const boardArea = createElement("div", "xox-board-area", "");
      const boardStageHost = renderBoard(state.game.board);
      boardArea.append(boardStageHost);
      const sidecar = createElement("aside", "xox-sidecar", "");
      sidecar.append(
        renderStatusStack(awaitingUser, awaitingAi, resultKey, state.game.active === true),
        renderLegalMoves(canUserMove, state.game.legalMoves)
      );
      const stageBody = createElement("div", "xox-stage-body", "");
      stageBody.append(boardArea, sidecar);
      stage.append(matchupHeader, stageBody);
      arena.append(rail, stage);
      surface.append(arena);
      app.append(surface);
      root.replaceChildren(app);
      if (backgammonStageRuntime !== null) {
        backgammonStageRuntime.renderBackgammonStage(boardStageHost, {
          canUserMove,
          game: state.game,
        });
      }
    }

    return {
      renderBootstrap,
      renderXox,
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
