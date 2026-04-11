(function(global) {
  function isRecord(value) {
    return typeof value === "object" && value !== null && Array.isArray(value) === false;
  }
  function readString(value, fallback) {
    return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
  }
  function createFeatureRecord(candidate, fallback) {
    const source = isRecord(candidate) ? candidate : {};
    return {
      id: readString(source["id"], fallback.id),
      name: readString(source["name"], fallback.name),
      description: readString(source["description"], fallback.description)
    };
  }
  const registry = global.GameRoomUiContextRuntime || (global.GameRoomUiContextRuntime = {});
  registry.createGameRoomUiContextRuntime = function createGameRoomUiContextRuntime(deps) {
    const runtimeDeps = isRecord(deps) ? deps : {};
    const ROOM_ID = readString(runtimeDeps["roomId"], "game-room");
    const FEATURE_ID = readString(runtimeDeps["featureId"], "xox");
    const bootstrapCopy = isRecord(runtimeDeps["bootstrapCopy"]) ? runtimeDeps["bootstrapCopy"] : {};
    const defaultFeatureRecord = {
      id: FEATURE_ID,
      name: "XOX",
      description: ""
    };
    const featureRecords = Array.isArray(runtimeDeps["featureRecords"]) ? runtimeDeps["featureRecords"].map(
      (entry) => createFeatureRecord(entry, defaultFeatureRecord)
    ) : [defaultFeatureRecord];
    const fallbackFeatureRecord = featureRecords[0] || {
      id: FEATURE_ID,
      name: "XOX",
      description: ""
    };
    const featureCatalog = new Map(
      featureRecords.map((entry) => [entry.id, entry])
    );
    function readBootstrapText(locale, key, fallback) {
      const localeCopy = isRecord(bootstrapCopy[locale]) ? bootstrapCopy[locale] : {};
      return readString(localeCopy[key], fallback);
    }
    function normalizeFeatureId(value) {
      const normalized = readString(value, fallbackFeatureRecord.id);
      return featureCatalog.has(normalized) ? normalized : fallbackFeatureRecord.id;
    }
    function resolveLocale(value) {
      return typeof value === "string" && value.toLowerCase().startsWith("tr") ? "tr" : "en";
    }
    function normalizePresentationMode(value) {
      return value === "scene-view" ? "scene-view" : "classic";
    }
    function normalizeUiScale(value) {
      const numeric = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
      if (!Number.isFinite(numeric) || numeric <= 0) {
        return 100;
      }
      return Math.max(70, Math.min(130, Math.round(numeric)));
    }
    function createSlot(slotId) {
      return {
        slotId,
        nickname: slotId.toUpperCase(),
        assigned: false,
        connected: false,
        ready: false,
        state: "empty",
        urlExcluded: false,
        remoteUserId: null
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
        sentAt: null
      };
    }
    function createContext() {
      return {
        room: {
          id: ROOM_ID,
          name: readBootstrapText(
            "en",
            "roomTitle",
            readBootstrapText("tr", "roomTitle", "Game Room")
          )
        },
        features: featureRecords.slice(),
        activeFeature: { ...fallbackFeatureRecord },
        user: {
          nickname: readBootstrapText(
            "en",
            "userLabel",
            readBootstrapText("tr", "userLabel", "User")
          )
        },
        slots: {
          ai1: createSlot("ai1"),
          ai2: createSlot("ai2"),
          us1: createSlot("us1")
        }
      };
    }
    function readPath(source, path) {
      let current = source;
      for (let index = 0; index < path.length; index += 1) {
        const key = path[index];
        if (key === void 0) {
          return null;
        }
        if (isRecord(current) === false) {
          return null;
        }
        current = current[key];
      }
      return typeof current === "string" ? current : null;
    }
    function createElement(tagName, className, textContent) {
      const element = document.createElement(tagName);
      if (className) {
        element.className = className;
      }
      if (textContent !== void 0) {
        element.textContent = textContent;
      }
      return element;
    }
    function normalizeSlot(candidate, slotId) {
      const source = isRecord(candidate) ? candidate : {};
      return {
        slotId,
        nickname: readString(source["nickname"], slotId.toUpperCase()),
        assigned: source["assigned"] === true,
        connected: source["connected"] === true,
        ready: source["ready"] === true || source["assigned"] === true && source["connected"] === true && source["urlExcluded"] !== true,
        state: readString(source["state"], "empty"),
        urlExcluded: source["urlExcluded"] === true,
        remoteUserId: readString(source["remoteUserId"], "") || null
      };
    }
    function normalizeContext(payload) {
      const source = isRecord(payload) ? payload : {};
      const slotsSource = isRecord(source["slots"]) ? source["slots"] : {};
      const roomSource = isRecord(source["room"]) ? source["room"] : {};
      const userSource = isRecord(source["user"]) ? source["user"] : {};
      const features = Array.isArray(source["features"]) ? source["features"].map(function(feature) {
        const featureSource = isRecord(feature) ? feature : {};
        const id = normalizeFeatureId(featureSource["id"]);
        const fallbackFeature = featureCatalog.get(id) || fallbackFeatureRecord;
        return createFeatureRecord(featureSource, {
          id,
          name: fallbackFeature.name,
          description: fallbackFeature.description
        });
      }) : featureRecords.slice();
      const activeFeatureSource = isRecord(source["activeFeature"]) ? source["activeFeature"] : {};
      const activeFeatureId = normalizeFeatureId(activeFeatureSource["id"]);
      const activeFallback = featureCatalog.get(activeFeatureId) || fallbackFeatureRecord;
      const activeFeature = features.find(function(feature) {
        return feature.id === activeFeatureId;
      }) || {
        id: activeFeatureId,
        name: activeFallback.name,
        description: activeFallback.description
      };
      return {
        room: {
          id: readString(roomSource["id"], ROOM_ID),
          name: readString(
            roomSource["name"],
            readBootstrapText("en", "roomTitle", readBootstrapText("tr", "roomTitle", "Game Room"))
          )
        },
        features,
        activeFeature,
        user: {
          nickname: readString(
            userSource["nickname"],
            readBootstrapText("en", "userLabel", readBootstrapText("tr", "userLabel", "User"))
          )
        },
        slots: {
          ai1: normalizeSlot(slotsSource["ai1"], "ai1"),
          ai2: normalizeSlot(slotsSource["ai2"], "ai2"),
          us1: normalizeSlot(slotsSource["us1"], "us1")
        }
      };
    }
    return {
      createContext,
      createElement,
      createInviteEntry,
      createSlot,
      normalizeContext,
      normalizePresentationMode,
      normalizeUiScale,
      normalizeSlot,
      readPath,
      resolveLocale
    };
  };
})(window);
