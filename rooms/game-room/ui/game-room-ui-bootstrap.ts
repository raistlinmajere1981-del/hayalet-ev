/* global document, navigator, window */

(function (global) {
  type UnknownRecord = Record<string, unknown>;
  type BootstrapCopy = Record<string, Record<string, string>>;
  type FeatureRecord = { id: string; name: string; description: string };
  type BootstrapFeatureSummary = { id: string; name?: string | null };
  type BootstrapContext = {
    activeFeature?: { id?: unknown } | null;
    features?: BootstrapFeatureSummary[] | null;
  };
  type BootstrapState = {
    locale: string;
    translations: unknown;
    context: BootstrapContext;
    game: unknown;
    teamTetris: unknown;
    teamTetrisDraft: unknown;
    fateKnots: unknown;
    presentation: {
      mode: string;
      uiScale: number;
    };
    preferences: {
      target: string;
      starter: string;
      inviteMessage: string;
      teamTetrisHiddenPairs: boolean;
    };
    lastCommandMessage: string;
  };
  type BootstrapRuntimeOptions = {
    document?: Document;
    navigator?: Navigator;
    render?: () => void;
  };
  type BootstrapFeatureContract = {
    ROOM_ID?: unknown;
    FEATURE_ID?: unknown;
    TEAM_TETRIS_FEATURE_ID?: unknown;
    FATE_KNOTS_FEATURE_ID?: unknown;
    getBootstrapCopy?: () => BootstrapCopy;
    getFeatureRecords?: () => FeatureRecord[];
  };
  type ContextRuntime = {
    readPath: (source: unknown, path: string[]) => string | null;
    normalizePresentationMode: (value: unknown) => string;
    normalizeUiScale: (value: unknown) => number;
    resolveLocale: (value: unknown) => string;
    createContext: () => BootstrapContext;
    createSlot: (...args: unknown[]) => unknown;
    createInviteEntry: (...args: unknown[]) => unknown;
    normalizeSlot: (...args: unknown[]) => unknown;
    createElement: (...args: unknown[]) => unknown;
  };
  type XoxUiModule = {
    createGameState: () => unknown;
  };
  type TeamTetrisUiModule = {
    createTeamTetrisState: () => unknown;
    createTeamTetrisDraft: () => unknown;
  };
  type FateKnotsUiModule = {
    createFateKnotsState: () => unknown;
  };
  type FactoryRegistry = {
    createXoxUiModule: (options: UnknownRecord) => XoxUiModule;
    createTeamTetrisUiModule: (options: UnknownRecord) => TeamTetrisUiModule;
    createFateKnotsUiModule: (options: UnknownRecord) => FateKnotsUiModule;
  };
  type RoomApi = {
    sendCommand: (command: string, payload: UnknownRecord) => boolean;
  };

  function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === "object" && value !== null && Array.isArray(value) === false;
  }

  function readString(value: unknown, fallback: string): string {
    return typeof value === "string" && value !== "" ? value : fallback;
  }

  function readRuntimeOptions(value: unknown): BootstrapRuntimeOptions {
    return isRecord(value) ? (value as BootstrapRuntimeOptions) : {};
  }

  function readFeatureContract(value: unknown): BootstrapFeatureContract {
    return isRecord(value) ? (value as BootstrapFeatureContract) : {};
  }

  function readRoomApi(value: unknown): RoomApi | null {
    return isRecord(value) && typeof value.sendCommand === "function" ? (value as RoomApi) : null;
  }

  const registryHost = global as unknown as typeof globalThis & Record<string, unknown>;
  const registry =
    (registryHost.GameRoomUiBootstrapRuntime as Record<string, unknown> | undefined) ||
    ((registryHost.GameRoomUiBootstrapRuntime = {}) as Record<string, unknown>);

  registry.createGameRoomUiBootstrapRuntime = function createGameRoomUiBootstrapRuntime(options: unknown) {
    const runtimeOptions = readRuntimeOptions(options);
    const documentRef = runtimeOptions.document || document;
    const navigatorRef = runtimeOptions.navigator || navigator;
    const render = typeof runtimeOptions.render === "function" ? runtimeOptions.render : function () {};

    const featureContract = readFeatureContract(global.GameRoomUiFeatureContract);
    const roomId = readString(featureContract.ROOM_ID, "game-room");
    const featureId = readString(featureContract.FEATURE_ID, "xox");
    const teamTetrisFeatureId = readString(featureContract.TEAM_TETRIS_FEATURE_ID, "team-tetris");
    const fateKnotsFeatureId = readString(featureContract.FATE_KNOTS_FEATURE_ID, "fate-knots");
    const bootstrapCopy =
      typeof featureContract.getBootstrapCopy === "function"
        ? featureContract.getBootstrapCopy()
        : {
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
    const featureRecords =
      typeof featureContract.getFeatureRecords === "function"
        ? featureContract.getFeatureRecords()
        : [
            { id: featureId, name: "XOX", description: "" },
            { id: teamTetrisFeatureId, name: "Team Tetris", description: "" },
            { id: fateKnotsFeatureId, name: "Fate Knots", description: "" },
          ];

    const contextFactories = (global.GameRoomUiContextRuntime || {}) as {
      createGameRoomUiContextRuntime?: (options: UnknownRecord) => ContextRuntime;
    };
    const contextRuntimeFactory = contextFactories.createGameRoomUiContextRuntime;
    if (typeof contextRuntimeFactory !== "function") {
      throw new Error("Game Room UI context runtime is unavailable.");
    }

    const scrollRuntimeFactories = (global.GameRoomUiScrollRuntime || {}) as {
      createGameRoomUiScrollRuntime?: () => unknown;
    };
    const createScrollRuntime = scrollRuntimeFactories.createGameRoomUiScrollRuntime;
    if (typeof createScrollRuntime !== "function") {
      throw new Error("Game Room UI scroll runtime is unavailable.");
    }

    const contextRuntime = contextRuntimeFactory({
      roomId: roomId,
      featureId: featureId,
      bootstrapCopy: bootstrapCopy,
      featureRecords: featureRecords,
    });
    const scrollRuntime = createScrollRuntime();
    const stateRef = { current: null as BootstrapState | null };

    function getState(): BootstrapState {
      return stateRef.current as BootstrapState;
    }

    function text(path: string[]): string {
      return contextRuntime.readPath(getState().translations, path) || path.join(".");
    }

    function bootstrapText(key: string): string {
      const state = getState();
      return (
        contextRuntime.readPath(bootstrapCopy[state.locale], [key]) ||
        contextRuntime.readPath(bootstrapCopy.en, [key]) ||
        key
      );
    }

    function formatScaleFactor(value: number): string {
      return value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
    }

    function applyPresentationMode(nextPresentation: unknown) {
      const state = getState();
      const presentation =
        isRecord(nextPresentation)
          ? nextPresentation
          : { mode: nextPresentation };
      state.presentation.mode = contextRuntime.normalizePresentationMode(presentation.mode);
      state.presentation.uiScale = contextRuntime.normalizeUiScale(presentation.uiScale);
      const scaleFactor = formatScaleFactor(state.presentation.uiScale / 100);
      if (documentRef.body && documentRef.body.dataset) {
        documentRef.body.dataset.presentationMode = state.presentation.mode;
        documentRef.body.dataset.roomUiScale = String(state.presentation.uiScale);
        if (documentRef.body.style && typeof documentRef.body.style.setProperty === "function") {
          documentRef.body.style.setProperty("--room-runtime-ui-scale-factor", scaleFactor);
        }
      }
      if (documentRef.documentElement && documentRef.documentElement.dataset) {
        documentRef.documentElement.dataset.presentationMode = state.presentation.mode;
        documentRef.documentElement.dataset.roomUiScale = String(state.presentation.uiScale);
        if (
          documentRef.documentElement.style &&
          typeof documentRef.documentElement.style.setProperty === "function"
        ) {
          documentRef.documentElement.style.setProperty("--room-runtime-ui-scale-factor", scaleFactor);
        }
      }
    }

    function statusText(key: string): string {
      return (
        contextRuntime.readPath(getState().translations, ["xox", "status", key]) ||
        bootstrapText(key === "roomApiUnavailable" ? "roomApiUnavailable" : "commandSendFailed")
      );
    }

    function applyLocale(nextLocale: unknown) {
      const state = getState();
      state.locale = contextRuntime.resolveLocale(nextLocale);
      if (documentRef.documentElement) {
        documentRef.documentElement.lang = state.locale;
      }
    }

    function getActiveFeatureId(): string {
      const state = getState();
      const activeFeatureId =
        state.context &&
        state.context.activeFeature &&
        typeof state.context.activeFeature.id === "string"
          ? state.context.activeFeature.id
          : featureId;
      return featureRecords.some(function (feature) {
        return feature.id === activeFeatureId;
      })
        ? activeFeatureId
        : featureId;
    }

    function getFeatureLabel(activeFeatureId: string): string {
      const state = getState();
      const feature = Array.isArray(state.context.features)
        ? state.context.features.find(function (entry) {
            return entry.id === activeFeatureId;
          })
        : null;
      if (feature && feature.name) {
        return feature.name;
      }
      return text(["features", activeFeatureId]);
    }

    function isRoomApiAvailable(): boolean {
      return readRoomApi(global.roomAPI) !== null;
    }

    function sendRoomCommand(command: string, payload: unknown) {
      const state = getState();
      const roomApi = readRoomApi(global.roomAPI);
      if (roomApi === null) {
        state.lastCommandMessage = statusText("roomApiUnavailable");
        render();
        return;
      }

      const sent = roomApi.sendCommand(command, (payload || {}) as UnknownRecord);
      if (sent !== true) {
        state.lastCommandMessage = statusText("commandSendFailed");
        render();
      }
    }

    const factories = (global.GameRoomUiFactories || {}) as FactoryRegistry;
    const xoxUi = factories.createXoxUiModule({
      getState: getState,
      roomId: roomId,
      featureId: featureId,
      createSlot: contextRuntime.createSlot,
      createInviteEntry: contextRuntime.createInviteEntry,
      normalizeSlot: contextRuntime.normalizeSlot,
      bootstrapText: bootstrapText,
      text: text,
      statusText: statusText,
      createElement: contextRuntime.createElement,
      render: render,
      sendRoomCommand: sendRoomCommand,
      isRoomApiAvailable: isRoomApiAvailable,
      getFeatureLabel: getFeatureLabel,
    });
    const teamTetrisUi = factories.createTeamTetrisUiModule({
      getState: getState,
      featureId: teamTetrisFeatureId,
      createSlot: contextRuntime.createSlot,
      createElement: contextRuntime.createElement,
      text: text,
      render: render,
      sendRoomCommand: sendRoomCommand,
      getFeatureLabel: getFeatureLabel,
    });
    const fateKnotsUi = factories.createFateKnotsUiModule({
      getState: getState,
      featureId: fateKnotsFeatureId,
      createElement: contextRuntime.createElement,
      sendRoomCommand: sendRoomCommand,
      getFeatureLabel: getFeatureLabel,
      text: text,
    });

    const documentLocale =
      documentRef.documentElement && typeof documentRef.documentElement.lang === "string"
        ? documentRef.documentElement.lang
        : "";

    stateRef.current = {
      locale: contextRuntime.resolveLocale(documentLocale || navigatorRef.language),
      translations: null,
      context: contextRuntime.createContext(),
      game: xoxUi.createGameState(),
      teamTetris: teamTetrisUi.createTeamTetrisState(),
      teamTetrisDraft: teamTetrisUi.createTeamTetrisDraft(),
      fateKnots: fateKnotsUi.createFateKnotsState(),
      presentation: {
        mode: "classic",
        uiScale: 100,
      },
      preferences: {
        target: "ai1",
        starter: "user",
        inviteMessage: "",
        teamTetrisHiddenPairs: true,
      },
      lastCommandMessage: "",
    };

    return {
      roomId: roomId,
      featureId: featureId,
      teamTetrisFeatureId: teamTetrisFeatureId,
      fateKnotsFeatureId: fateKnotsFeatureId,
      contextRuntime: contextRuntime,
      scrollRuntime: scrollRuntime,
      stateRef: stateRef,
      getState: getState,
      xoxUi: xoxUi,
      teamTetrisUi: teamTetrisUi,
      fateKnotsUi: fateKnotsUi,
      bootstrapText: bootstrapText,
      applyPresentationMode: applyPresentationMode,
      applyLocale: applyLocale,
      getActiveFeatureId: getActiveFeatureId,
      getFeatureLabel: getFeatureLabel,
    };
  };
})(window);
