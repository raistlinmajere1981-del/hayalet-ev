const { contextBridge, ipcRenderer } = require("electron");

const ROOM_HOST_MESSAGE_CHANNEL = "room-host-message";
const hostMessageHandlers = new Set();

function emitToHost(channel, payload = {}) {
  try {
    ipcRenderer.sendToHost(channel, payload);
    return true;
  } catch (_) {
    return false;
  }
}

function normalizeName(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function addHostMessageHandler(callback) {
  if (typeof callback !== "function") {
    return () => {};
  }

  hostMessageHandlers.add(callback);
  return () => {
    hostMessageHandlers.delete(callback);
  };
}

ipcRenderer.on(ROOM_HOST_MESSAGE_CHANNEL, (_event, payload) => {
  for (const handler of hostMessageHandlers) {
    try {
      handler(payload);
    } catch (_) {}
  }
});

contextBridge.exposeInMainWorld("roomAPI", {
  ready: (payload = {}) => emitToHost("room-ready", payload),
  sendCommand: (command, payload = {}) => {
    const normalized = normalizeName(command);
    if (normalized === "") {
      return false;
    }
    return emitToHost("room-command", {
      command: normalized,
      payload,
    });
  },
  sendEvent: (type, payload = {}) => {
    const normalized = normalizeName(type);
    if (normalized === "") {
      return false;
    }
    return emitToHost("room-event", {
      type: normalized,
      payload,
    });
  },
  onHostMessage: (callback) => addHostMessageHandler(callback),
  offHostMessage: (callback) => {
    if (typeof callback !== "function") {
      return;
    }
    hostMessageHandlers.delete(callback);
  },
});

window.addEventListener("load", () => {
  emitToHost("room-ready", {
    stage: "load",
    url: window.location.href,
  });
});
