/* global document, window */

(function (global) {
  type UnknownRecord = Record<string, unknown>;
  type BootstrapCopy = Record<string, Record<string, string>>;
  type FeatureRecord = {
    id: string;
    name: string;
    description: string;
  };
  type SlotState = {
    slotId: string;
    nickname: string;
    assigned: boolean;
    connected: boolean;
    ready: boolean;
    state: string;
    urlExcluded: boolean;
    remoteUserId: string | null;
  };
  type InviteEntry = {
    roomId: string;
    featureId: string;
    inviteId: string;
    remoteUserId: string;
    nickname: string;
    senderEmail: string;
    note: string;
    starter: string;
    localSessionId: string;
    conversationId: string;
    sentAt: number | null;
  };
  type ContextState = {
    room: {
      id: string;
      name: string;
    };
    features: FeatureRecord[];
    activeFeature: FeatureRecord;
    user: {
      nickname: string;
    };
    slots: {
      ai1: SlotState;
      ai2: SlotState;
      us1: SlotState;
    };
  };
  type ContextRuntimeDeps = {
    roomId?: unknown;
    featureId?: unknown;
    bootstrapCopy?: unknown;
    featureRecords?: unknown;
  };

  function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === "object" && value !== null && Array.isArray(value) === false;
  }

  function readString(value: unknown, fallback: string): string {
    return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
  }

  const registry = global.GameRoomUiContextRuntime || (global.GameRoomUiContextRuntime = {});

  registry.createGameRoomUiContextRuntime = function createGameRoomUiContextRuntime(deps: unknown) {
    const runtimeDeps = isRecord(deps) ? (deps as ContextRuntimeDeps) : {};
    const ROOM_ID = readString(runtimeDeps.roomId, "game-room");
    const FEATURE_ID = readString(runtimeDeps.featureId, "xox");
    const bootstrapCopy = isRecord(runtimeDeps.bootstrapCopy)
      ? (runtimeDeps.bootstrapCopy as BootstrapCopy)
      : {};
    const featureRecords: FeatureRecord[] = Array.isArray(runtimeDeps.featureRecords)
      ? runtimeDeps.featureRecords
          .filter(function (entry) {
            return isRecord(entry);
          })
          .map(function (entry) {
            return {
              id: readString(entry.id, FEATURE_ID),
              name: readString(entry.name, FEATURE_ID.toUpperCase()),
              description: readString(entry.description, ""),
            };
          })
      : [
          {
            id: FEATURE_ID,
            name: "XOX",
            description: "",
          },
        ];
    const fallbackFeatureRecord = featureRecords[0] || {
      id: FEATURE_ID,
      name: "XOX",
      description: "",
    };
    const featureCatalog = new Map(
      featureRecords.map(function (entry) {
        return [entry.id, entry];
      })
    );

    function readBootstrapText(locale: string, key: string, fallback: string): string {
      const localeCopy = isRecord(bootstrapCopy[locale]) ? bootstrapCopy[locale] : {};
      return readString(localeCopy[key], fallback);
    }

    function normalizeFeatureId(value: unknown): string {
      const normalized = readString(value, fallbackFeatureRecord.id);
      return featureCatalog.has(normalized) ? normalized : fallbackFeatureRecord.id;
    }

    function resolveLocale(value: unknown): string {
      return typeof value === "string" && value.toLowerCase().startsWith("tr") ? "tr" : "en";
    }

    function normalizePresentationMode(value: unknown): string {
      return value === "scene-view" ? "scene-view" : "classic";
    }

    function normalizeUiScale(value: unknown): number {
      const numeric =
        typeof value === "number"
          ? value
          : typeof value === "string"
            ? Number.parseInt(value, 10)
            : Number.NaN;
      if (!Number.isFinite(numeric) || numeric <= 0) {
        return 100;
      }
      return Math.max(70, Math.min(130, Math.round(numeric)));
    }

    function createSlot(slotId: string): SlotState {
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

    function createInviteEntry(): InviteEntry {
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

    function createContext(): ContextState {
      return {
        room: {
          id: ROOM_ID,
          name: readBootstrapText("en", "roomTitle", readBootstrapText("tr", "roomTitle", "Game Room")),
        },
        features: featureRecords.slice(),
        activeFeature: { ...fallbackFeatureRecord },
        user: {
          nickname: readBootstrapText("en", "userLabel", readBootstrapText("tr", "userLabel", "User")),
        },
        slots: {
          ai1: createSlot("ai1"),
          ai2: createSlot("ai2"),
          us1: createSlot("us1"),
        },
      };
    }

    function readPath(source: unknown, path: string[]): string | undefined {
      let current = source;
      for (let index = 0; index < path.length; index += 1) {
        const key = path[index];
        if (isRecord(current) === false) {
          return undefined;
        }
        current = current[key];
      }
      return typeof current === "string" ? current : undefined;
    }

    function createElement(tagName: string, className?: string, textContent?: string) {
      const element = document.createElement(tagName);
      if (className) {
        element.className = className;
      }
      if (textContent !== undefined) {
        element.textContent = textContent;
      }
      return element;
    }

    function normalizeSlot(candidate: unknown, slotId: string): SlotState {
      const source = isRecord(candidate) ? candidate : {};
      return {
        slotId: slotId,
        nickname: readString(source.nickname, slotId.toUpperCase()),
        assigned: source.assigned === true,
        connected: source.connected === true,
        ready:
          source.ready === true ||
          (source.assigned === true && source.connected === true && source.urlExcluded !== true),
        state: readString(source.state, "empty"),
        urlExcluded: source.urlExcluded === true,
        remoteUserId: readString(source.remoteUserId, "") || null,
      };
    }

    function normalizeContext(payload: unknown): ContextState {
      const source = isRecord(payload) ? payload : {};
      const slotsSource = isRecord(source.slots) ? source.slots : {};
      const roomSource = isRecord(source.room) ? source.room : {};
      const userSource = isRecord(source.user) ? source.user : {};
      const features: FeatureRecord[] = Array.isArray(source.features)
        ? source.features.map(function (feature) {
            const featureSource = isRecord(feature) ? feature : {};
            const id = normalizeFeatureId(featureSource.id);
            const fallbackFeature = featureCatalog.get(id) || fallbackFeatureRecord;
            return {
              id: id,
              name: readString(featureSource.name, fallbackFeature.name),
              description: readString(featureSource.description, fallbackFeature.description),
            };
          })
        : featureRecords.slice();
      const activeFeatureSource = isRecord(source.activeFeature) ? source.activeFeature : {};
      const activeFeatureId = normalizeFeatureId(activeFeatureSource.id);
      const activeFallback = featureCatalog.get(activeFeatureId) || fallbackFeatureRecord;

      return {
        room: {
          id: readString(roomSource.id, ROOM_ID),
          name: readString(
            roomSource.name,
            readBootstrapText("en", "roomTitle", readBootstrapText("tr", "roomTitle", "Game Room")),
          ),
        },
        features: features,
        activeFeature:
          features.find(function (feature) {
            return feature.id === activeFeatureId;
          }) || {
            id: activeFeatureId,
            name: activeFallback.name,
            description: activeFallback.description,
          },
        user: {
          nickname: readString(
            userSource.nickname,
            readBootstrapText("en", "userLabel", readBootstrapText("tr", "userLabel", "User")),
          ),
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
      normalizeUiScale: normalizeUiScale,
      normalizeSlot: normalizeSlot,
      readPath: readPath,
      resolveLocale: resolveLocale,
    };
  };
})(window);
