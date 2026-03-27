(function (global) {
  const registry = global.GameRoomUiContextRuntime || (global.GameRoomUiContextRuntime = {});

  registry.createGameRoomUiContextRuntime = function createGameRoomUiContextRuntime(deps) {
    const ROOM_ID = deps.roomId;
    const FEATURE_ID = deps.featureId;
    const TEAM_TETRIS_FEATURE_ID = deps.teamTetrisFeatureId;
    const bootstrapCopy = deps.bootstrapCopy;

    function resolveLocale(value) {
      return typeof value === "string" && value.toLowerCase().startsWith("tr") ? "tr" : "en";
    }

    function normalizePresentationMode(value) {
      return value === "scene-view" ? "scene-view" : "classic";
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
          name:
            (bootstrapCopy.en && bootstrapCopy.en.roomTitle) ||
            (bootstrapCopy.tr && bootstrapCopy.tr.roomTitle) ||
            "Game Room",
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
          nickname:
            (bootstrapCopy.en && bootstrapCopy.en.userLabel) ||
            (bootstrapCopy.tr && bootstrapCopy.tr.userLabel) ||
            "User",
        },
        slots: {
          ai1: createSlot("ai1"),
          ai2: createSlot("ai2"),
          us1: createSlot("us1"),
        },
      };
    }

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
              : (bootstrapCopy.en && bootstrapCopy.en.roomTitle) ||
                (bootstrapCopy.tr && bootstrapCopy.tr.roomTitle) ||
                "Game Room",
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
              : (bootstrapCopy.en && bootstrapCopy.en.userLabel) ||
                (bootstrapCopy.tr && bootstrapCopy.tr.userLabel) ||
                "User",
        },
        slots: {
          ai1: normalizeSlot(slotsSource.ai1, "ai1"),
          ai2: normalizeSlot(slotsSource.ai2, "ai2"),
          us1: normalizeSlot(slotsSource.us1, "us1"),
        },
      };
    }

    return {
      createContext: createContext,
      createElement: createElement,
      createInviteEntry: createInviteEntry,
      createSlot: createSlot,
      normalizeContext: normalizeContext,
      normalizePresentationMode: normalizePresentationMode,
      normalizeSlot: normalizeSlot,
      readPath: readPath,
      resolveLocale: resolveLocale,
    };
  };
})(window);
