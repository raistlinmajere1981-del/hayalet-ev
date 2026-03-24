const ROOM_ID = "laboratory";
const FEATURE_ID = "media-analysis";

function toRecord(value) {
  if (value !== null && typeof value === "object" && Array.isArray(value) === false) {
    return value;
  }
  return {};
}

function normalizeLocale(value) {
  return typeof value === "string" && value.toLowerCase().startsWith("tr") ? "tr" : "en";
}

function sanitizeContext(payload, api) {
  const source = toRecord(payload);
  const room = toRecord(source.room);
  const user = toRecord(source.user);
  const presentation = toRecord(source.presentation);
  const translations = toRecord(source.translations);
  const slots = toRecord(source.slots);

  return {
    room: {
      id: ROOM_ID,
      name:
        typeof room.name === "string" && room.name.trim() !== "" ? room.name.trim() : "Laboratory",
    },
    user: {
      nickname:
        typeof user.nickname === "string" && user.nickname.trim() !== ""
          ? user.nickname.trim()
          : "Operator",
    },
    presentation: {
      mode: presentation.mode === "scene-view" ? "scene-view" : "classic",
    },
    locale:
      typeof source.locale === "string" && source.locale.trim() !== ""
        ? normalizeLocale(source.locale)
        : normalizeLocale(api.getLocale()),
    translations: translations,
    slots: slots,
    roomId:
      typeof source.roomId === "string" && source.roomId.trim() !== ""
        ? source.roomId.trim()
        : ROOM_ID,
    featureId:
      typeof source.featureId === "string" && source.featureId.trim() !== ""
        ? source.featureId.trim()
        : FEATURE_ID,
  };
}

function loadContext(api) {
  return sanitizeContext(api.getState("context"), api);
}

function saveContext(api, payload) {
  const nextContext = sanitizeContext(payload, api);
  api.setState("context", nextContext);
  return nextContext;
}

function pushHostContext(api) {
  api.notifyRoom("host-context", loadContext(api));
}

module.exports = {
  activate: function activate(api) {
    api.log("info", "Laboratory media analysis host activated.");
    saveContext(api, {});

    return {
      onRoomReady: function onRoomReady() {
        pushHostContext(api);
      },
      onRoomEvent: function onRoomEvent(payload) {
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
          return;
        }

        if (payload.type === "host-context") {
          saveContext(api, payload);
          pushHostContext(api);
          return;
        }

        if (payload.type === "request-refresh") {
          pushHostContext(api);
        }
      },
      dispose: function dispose() {
        api.log("info", "Laboratory media analysis host disposed.");
      },
    };
  },
};
