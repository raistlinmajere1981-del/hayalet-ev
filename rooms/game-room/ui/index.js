(function () {
  const ROOM_ID = "game-room";
  const FEATURE_ID = "xox";
  const TEAM_TETRIS_FEATURE_ID = "team-tetris";

  const BOOTSTRAP_COPY = {
    en: {
      roomTitle: "Game Room",
      loadingTitle: "Loading Game Room",
      loadingBody: "Waiting for room context and translations.",
      userLabel: "User",
      roomApiUnavailable: "Room API bridge is not connected.",
      commandSendFailed: "The command could not be sent to the room host.",
    },
    tr: {
      roomTitle: "Oyun Odasi",
      loadingTitle: "Oyun Odasi Yukleniyor",
      loadingBody: "Oda baglami ve ceviriler bekleniyor.",
      userLabel: "Kullanici",
      roomApiUnavailable: "Room API koprusu bagli degil.",
      commandSendFailed: "Komut oda host'una gonderilemedi.",
    },
  };

  function resolveLocale(value) {
    return typeof value === "string" && value.toLowerCase().startsWith("tr") ? "tr" : "en";
  }

  function createSlot(slotId) {
    return {
      slotId: slotId,
      nickname: slotId.toUpperCase(),
      assigned: false,
      connected: false,
      ready: false,
      state: "empty",
      urlExcluded: false,
      remoteUserId: null,
    };
  }

  function createInviteEntry() {
    return {
      roomId: ROOM_ID,
      featureId: FEATURE_ID,
      inviteId: "",
      remoteUserId: "",
      nickname: "US1",
      senderEmail: "",
      note: "",
      starter: "user",
      localSessionId: "",
      conversationId: "",
      sentAt: null,
    };
  }

  function createContext() {
    return {
      room: {
        id: ROOM_ID,
        name: BOOTSTRAP_COPY.en.roomTitle,
      },
      features: [
        {
          id: FEATURE_ID,
          name: "XOX",
          description: "",
        },
        {
          id: TEAM_TETRIS_FEATURE_ID,
          name: "Team Tetris",
          description: "",
        },
      ],
      activeFeature: {
        id: FEATURE_ID,
        name: "XOX",
        description: "",
      },
      user: {
        nickname: BOOTSTRAP_COPY.en.userLabel,
      },
      slots: {
        ai1: createSlot("ai1"),
        ai2: createSlot("ai2"),
        us1: createSlot("us1"),
      },
    };
  }

  let state = null;

  function readPath(source, path) {
    let current = source;
    for (let index = 0; index < path.length; index += 1) {
      const key = path[index];
      if (!current || typeof current !== "object" || Array.isArray(current)) {
        return undefined;
      }
      current = current[key];
    }
    return typeof current === "string" ? current : undefined;
  }

  function text(path) {
    return readPath(state.translations, path) || path.join(".");
  }

  function bootstrapText(key) {
    return (
      readPath(BOOTSTRAP_COPY[state.locale], [key]) || readPath(BOOTSTRAP_COPY.en, [key]) || key
    );
  }

  function normalizePresentationMode(value) {
    return value === "scene-view" ? "scene-view" : "classic";
  }

  function applyPresentationMode(mode) {
    state.presentation.mode = normalizePresentationMode(mode);
    if (document.body && document.body.dataset) {
      document.body.dataset.presentationMode = state.presentation.mode;
    }
    if (document.documentElement && document.documentElement.dataset) {
      document.documentElement.dataset.presentationMode = state.presentation.mode;
    }
  }

  function statusText(key) {
    return (
      readPath(state.translations, ["xox", "status", key]) ||
      bootstrapText(key === "roomApiUnavailable" ? "roomApiUnavailable" : "commandSendFailed")
    );
  }

  function createElement(tagName, className, textContent) {
    const element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    if (textContent !== undefined) {
      element.textContent = textContent;
    }
    return element;
  }

  function normalizeSlot(candidate, slotId) {
    const source =
      candidate && typeof candidate === "object" && Array.isArray(candidate) === false
        ? candidate
        : {};
    return {
      slotId: slotId,
      nickname:
        typeof source.nickname === "string" && source.nickname.trim() !== ""
          ? source.nickname.trim()
          : slotId.toUpperCase(),
      assigned: source.assigned === true,
      connected: source.connected === true,
      ready:
        source.ready === true ||
        (source.assigned === true && source.connected === true && source.urlExcluded !== true),
      state:
        typeof source.state === "string" && source.state.trim() !== ""
          ? source.state.trim()
          : "empty",
      urlExcluded: source.urlExcluded === true,
      remoteUserId:
        typeof source.remoteUserId === "string" && source.remoteUserId.trim() !== ""
          ? source.remoteUserId.trim()
          : null,
    };
  }

  function normalizeContext(payload) {
    const source =
      payload && typeof payload === "object" && Array.isArray(payload) === false ? payload : {};
    const slotsSource =
      source.slots && typeof source.slots === "object" && Array.isArray(source.slots) === false
        ? source.slots
        : {};
    const roomSource =
      source.room && typeof source.room === "object" && Array.isArray(source.room) === false
        ? source.room
        : {};
    const userSource =
      source.user && typeof source.user === "object" && Array.isArray(source.user) === false
        ? source.user
        : {};
    const features = Array.isArray(source.features)
      ? source.features.map(function (feature) {
          const featureSource =
            feature && typeof feature === "object" && Array.isArray(feature) === false
              ? feature
              : {};
          const id =
            featureSource.id === TEAM_TETRIS_FEATURE_ID ? TEAM_TETRIS_FEATURE_ID : FEATURE_ID;
          return {
            id: id,
            name:
              typeof featureSource.name === "string" && featureSource.name.trim() !== ""
                ? featureSource.name.trim()
                : id === TEAM_TETRIS_FEATURE_ID
                  ? "Team Tetris"
                  : "XOX",
            description:
              typeof featureSource.description === "string" &&
              featureSource.description.trim() !== ""
                ? featureSource.description.trim()
                : "",
          };
        })
      : createContext().features;
    const activeFeatureSource =
      source.activeFeature &&
      typeof source.activeFeature === "object" &&
      Array.isArray(source.activeFeature) === false
        ? source.activeFeature
        : {};
    const activeFeatureId =
      activeFeatureSource.id === TEAM_TETRIS_FEATURE_ID ? TEAM_TETRIS_FEATURE_ID : FEATURE_ID;

    return {
      room: {
        id:
          typeof roomSource.id === "string" && roomSource.id.trim() !== ""
            ? roomSource.id.trim()
            : ROOM_ID,
        name:
          typeof roomSource.name === "string" && roomSource.name.trim() !== ""
            ? roomSource.name.trim()
            : bootstrapText("roomTitle"),
      },
      features: features,
      activeFeature:
        features.find(function (feature) {
          return feature.id === activeFeatureId;
        }) || {
          id: activeFeatureId,
          name: activeFeatureId === TEAM_TETRIS_FEATURE_ID ? "Team Tetris" : "XOX",
          description: "",
        },
      user: {
        nickname:
          typeof userSource.nickname === "string" && userSource.nickname.trim() !== ""
            ? userSource.nickname.trim()
            : bootstrapText("userLabel"),
      },
      slots: {
        ai1: normalizeSlot(slotsSource.ai1, "ai1"),
        ai2: normalizeSlot(slotsSource.ai2, "ai2"),
        us1: normalizeSlot(slotsSource.us1, "us1"),
      },
    };
  }

  function applyLocale(nextLocale) {
    state.locale = resolveLocale(nextLocale);
    document.documentElement.lang = state.locale;
  }

  function getActiveFeatureId() {
    return state.context.activeFeature && state.context.activeFeature.id === TEAM_TETRIS_FEATURE_ID
      ? TEAM_TETRIS_FEATURE_ID
      : FEATURE_ID;
  }

  function getFeatureLabel(featureId) {
    const feature = Array.isArray(state.context.features)
      ? state.context.features.find(function (entry) {
          return entry.id === featureId;
        })
      : null;
    if (feature && feature.name) {
      return feature.name;
    }
    return text(["features", featureId]);
  }

  function isRoomApiAvailable() {
    return !!(window.roomAPI && typeof window.roomAPI.sendCommand === "function");
  }

  function sendRoomCommand(command, payload) {
    if (!isRoomApiAvailable()) {
      state.lastCommandMessage = statusText("roomApiUnavailable");
      render();
      return;
    }

    const sent = window.roomAPI.sendCommand(command, payload || {});
    if (sent !== true) {
      state.lastCommandMessage = statusText("commandSendFailed");
      render();
    }
  }

  const factories = window.GameRoomUiFactories || {};
  const xoxUi = factories.createXoxUiModule({
    getState: function () {
      return state;
    },
    roomId: ROOM_ID,
    featureId: FEATURE_ID,
    createSlot: createSlot,
    createInviteEntry: createInviteEntry,
    normalizeSlot: normalizeSlot,
    bootstrapText: bootstrapText,
    text: text,
    statusText: statusText,
    createElement: createElement,
    render: render,
    sendRoomCommand: sendRoomCommand,
    isRoomApiAvailable: isRoomApiAvailable,
    getFeatureLabel: getFeatureLabel,
  });
  const teamTetrisUi = factories.createTeamTetrisUiModule({
    getState: function () {
      return state;
    },
    featureId: TEAM_TETRIS_FEATURE_ID,
    createSlot: createSlot,
    createElement: createElement,
    text: text,
    render: render,
    sendRoomCommand: sendRoomCommand,
    getFeatureLabel: getFeatureLabel,
  });

  state = {
    locale: resolveLocale(document.documentElement.lang || navigator.language),
    translations: null,
    context: createContext(),
    game: xoxUi.createGameState(),
    teamTetris: teamTetrisUi.createTeamTetrisState(),
    teamTetrisDraft: teamTetrisUi.createTeamTetrisDraft(),
    presentation: {
      mode: "scene-view",
    },
    preferences: {
      target: "ai1",
      starter: "user",
      inviteMessage: "",
      teamTetrisHiddenPairs: true,
    },
    lastCommandMessage: "",
  };

  function render() {
    const root = document.getElementById("app");
    if (!root) {
      return;
    }

    if (!state.translations) {
      xoxUi.renderBootstrap(root);
      return;
    }

    if (getActiveFeatureId() === TEAM_TETRIS_FEATURE_ID) {
      teamTetrisUi.renderTeamTetris(root);
      return;
    }

    xoxUi.renderXox(root);
  }

  function handleHostMessage(message) {
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      return;
    }

    if (message.type === "host-context") {
      const presentation =
        message.presentation &&
        typeof message.presentation === "object" &&
        Array.isArray(message.presentation) === false
          ? message.presentation
          : {};
      applyPresentationMode(presentation.mode);
      if (typeof message.locale === "string") {
        applyLocale(message.locale);
      }
      if (
        message.translations &&
        typeof message.translations === "object" &&
        Array.isArray(message.translations) === false
      ) {
        state.translations = message.translations;
      }
      const previousTarget = state.preferences.target;
      state.context = normalizeContext(message);
      state.preferences.target =
        previousTarget === "ai1" || previousTarget === "ai2" || previousTarget === "us1"
          ? previousTarget
          : "ai1";
      render();
      return;
    }

    if (message.type === "xox-state") {
      const payload =
        message.payload &&
        typeof message.payload === "object" &&
        Array.isArray(message.payload) === false
          ? message.payload
          : {};
      state.game = xoxUi.sanitizeGameState(payload.state);
      xoxUi.syncPreferencesFromGame();
      state.lastCommandMessage = "";
      render();
      return;
    }

    if (message.type === "team-tetris-state") {
      const payload =
        message.payload &&
        typeof message.payload === "object" &&
        Array.isArray(message.payload) === false
          ? message.payload
          : {};
      state.teamTetris = teamTetrisUi.sanitizeTeamTetrisState(payload.state);
      teamTetrisUi.syncTeamTetrisPreferencesFromState();
      teamTetrisUi.syncTeamTetrisDraftFromState();
      state.lastCommandMessage = "";
      render();
      return;
    }

    if (message.type === "command-result") {
      const result =
        message.result &&
        typeof message.result === "object" &&
        Array.isArray(message.result) === false
          ? message.result
          : {};
      if (typeof result.message === "string" && result.message.trim() !== "") {
        state.lastCommandMessage = result.message.trim();
      }
      render();
    }
  }

  if (window.roomAPI && typeof window.roomAPI.onHostMessage === "function") {
    window.roomAPI.onHostMessage(handleHostMessage);
  } else {
    state.lastCommandMessage = bootstrapText("roomApiUnavailable");
  }

  if (window && typeof window === "object") {
    window.__gameRoomTeamTetrisTest__ = teamTetrisUi.getTestBridge();
  }

  applyPresentationMode(state.presentation.mode);
  applyLocale(state.locale);
  render();

  if (window.roomAPI && typeof window.roomAPI.ready === "function") {
    window.roomAPI.ready({
      room: ROOM_ID,
      feature: getActiveFeatureId(),
      stage: "ui-ready",
    });
  }
})();
