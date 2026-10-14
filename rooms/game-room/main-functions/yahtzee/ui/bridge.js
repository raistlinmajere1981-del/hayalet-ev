/* global window, document */

(function (global) {
  const runtimeRegistry = global.GameRoomUiRuntime;
  if (!runtimeRegistry || typeof runtimeRegistry.createGameRoomUiRuntime !== "function") return;

  const createBaseRuntime = runtimeRegistry.createGameRoomUiRuntime;

  function withYahtzeeMultiplayerTranslations(source) {
    if (!source || typeof source !== "object") return source;
    const yahtzee = source.yahtzee;
    if (!yahtzee || typeof yahtzee !== "object") return source;
    const isTurkish =
      yahtzee.title === "Korsan Güvertesi Yahtzee" || yahtzee.start === "Oyunu Başlat";
    if (!isTurkish) return source;

    return {
      ...source,
      yahtzee: {
        ...yahtzee,
        mode: yahtzee.mode || "Oyun Modu",
        turn: yahtzee.turn || "Sıra",
        winner: yahtzee.winner || "Kazanan",
        draw: yahtzee.draw || "Berabere",
        modes: {
          ...(yahtzee.modes && typeof yahtzee.modes === "object" ? yahtzee.modes : {}),
          solo: yahtzee.modes?.solo || "Tek Kişi",
          local2: yahtzee.modes?.local2 || "Yerel 2 Kişi",
          ai1: yahtzee.modes?.ai1 || "AI1'e Karşı",
          ai2: yahtzee.modes?.ai2 || "AI2'ye Karşı",
          us1: yahtzee.modes?.us1 || "US1 ile Çevrimiçi",
        },
        status: {
          ...(yahtzee.status && typeof yahtzee.status === "object" ? yahtzee.status : {}),
          waitOpponent: yahtzee.status?.waitOpponent || "Diğer oyuncunun sırası bekleniyor.",
          aiThinking: yahtzee.status?.aiThinking || "AI hamlesini seçiyor.",
          blockedOpponent:
            yahtzee.status?.blockedOpponent || "Seçilen rakip şu anda kullanılamıyor.",
          syncFailed: yahtzee.status?.syncFailed || "Uzak oyun eşitlemesi başarısız oldu.",
        },
      },
    };
  }

  function readAvatarSource(value) {
    return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
  }

  function resolveSeatAvatar(context, seatId) {
    if (!context || typeof context !== "object") return undefined;
    if (seatId === "user") {
      const user = context.user;
      return user && typeof user === "object" ? readAvatarSource(user.avatar) : null;
    }
    if (seatId === "ai1" || seatId === "ai2" || seatId === "us1") {
      const slots = context.slots;
      const slot = slots && typeof slots === "object" ? slots[seatId] : null;
      return slot && typeof slot === "object" ? readAvatarSource(slot.avatar) : null;
    }
    return undefined;
  }

  runtimeRegistry.createGameRoomUiRuntime = function createYahtzeeAwareGameRoomUiRuntime() {
    const base = createBaseRuntime();

    function withContextAvatars(yahtzeeState) {
      if (!yahtzeeState || typeof yahtzeeState !== "object") return yahtzeeState;
      if (!Array.isArray(yahtzeeState.players)) return yahtzeeState;
      const baseState = typeof base.getState === "function" ? base.getState() : null;
      const context = baseState && typeof baseState === "object" ? baseState.context : null;
      return {
        ...yahtzeeState,
        players: yahtzeeState.players.map(function (player) {
          if (!player || typeof player !== "object") return player;
          const avatarSrc = resolveSeatAvatar(context, player.seatId);
          return avatarSrc === undefined ? player : { ...player, avatarSrc: avatarSrc };
        }),
      };
    }

    function withContextAvatarsInMessage(message) {
      const payload = message && typeof message === "object" ? message.payload : null;
      const nextState = payload && typeof payload === "object" ? payload.state : null;
      if (!nextState || typeof nextState !== "object") return message;
      return {
        ...message,
        payload: {
          ...payload,
          state: withContextAvatars(nextState),
        },
      };
    }

    function refreshYahtzeeAvatars() {
      const yahtzeeUi = global.GameRoomYahtzeeUi;
      if (
        !yahtzeeUi ||
        typeof yahtzeeUi.getState !== "function" ||
        typeof yahtzeeUi.handleState !== "function"
      ) {
        return;
      }
      const currentState = yahtzeeUi.getState();
      if (!currentState || typeof currentState !== "object") return;
      yahtzeeUi.handleState({
        type: "yahtzee-state",
        payload: { state: withContextAvatars(currentState) },
      });
    }

    function isYahtzeeActive() {
      const state = typeof base.getState === "function" ? base.getState() : null;
      return Boolean(
        state &&
        state.context &&
        state.context.activeFeature &&
        state.context.activeFeature.id === "yahtzee"
      );
    }

    function render() {
      if (
        isYahtzeeActive() &&
        global.GameRoomYahtzeeUi &&
        typeof global.GameRoomYahtzeeUi.render === "function"
      ) {
        // Let the base Game Room runtime release feature-specific resources first.
        // Its explicit Yahtzee branch does not mount another game before returning.
        base.render();
        const root = document.getElementById("app");
        const baseState = typeof base.getState === "function" ? base.getState() : null;
        if (typeof global.GameRoomYahtzeeUi.setTranslations === "function") {
          global.GameRoomYahtzeeUi.setTranslations(
            withYahtzeeMultiplayerTranslations(baseState && baseState.translations)
          );
        }
        if (root) global.GameRoomYahtzeeUi.render(root);
        return;
      }
      const root = document.getElementById("app");
      if (root) root.classList.remove("yahtzee-root");
      if (global.GameRoomYahtzeeUi && typeof global.GameRoomYahtzeeUi.dispose === "function") {
        global.GameRoomYahtzeeUi.dispose();
      }
      base.render();
    }

    function handleHostMessage(message) {
      if (message && typeof message === "object" && message.type === "yahtzee-state") {
        if (
          global.GameRoomYahtzeeUi &&
          typeof global.GameRoomYahtzeeUi.handleState === "function"
        ) {
          global.GameRoomYahtzeeUi.handleState(withContextAvatarsInMessage(message));
        }
        render();
        return;
      }

      base.handleHostMessage(message);
      if (isYahtzeeActive()) {
        if (message && typeof message === "object" && message.type === "host-context") {
          refreshYahtzeeAvatars();
        }
        render();
      }
    }

    function start() {
      const roomApi = global.roomAPI;

      base.start();

      if (roomApi && typeof roomApi.onHostMessage === "function") {
        if (typeof roomApi.offHostMessage === "function") {
          roomApi.offHostMessage(base.handleHostMessage);
        }
        roomApi.onHostMessage(handleHostMessage);
      }

      if (isYahtzeeActive()) render();
    }

    return {
      getState: base.getState,
      handleHostMessage: handleHostMessage,
      render: render,
      start: start,
    };
  };
})(window);
