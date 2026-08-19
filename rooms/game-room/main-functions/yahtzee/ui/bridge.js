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
          blockedOpponent: yahtzee.status?.blockedOpponent || "Seçilen rakip şu anda kullanılamıyor.",
          syncFailed: yahtzee.status?.syncFailed || "Uzak oyun eşitlemesi başarısız oldu.",
        },
      },
    };
  }

  runtimeRegistry.createGameRoomUiRuntime = function createYahtzeeAwareGameRoomUiRuntime() {
    const base = createBaseRuntime();

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
          global.GameRoomYahtzeeUi.handleState(message);
        }
        render();
        return;
      }

      base.handleHostMessage(message);
      if (isYahtzeeActive()) render();
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
