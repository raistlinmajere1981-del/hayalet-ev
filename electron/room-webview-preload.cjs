/* global console */
const { contextBridge, ipcRenderer, webUtils } = require("electron");

const ROOM_HOST_MESSAGE_CHANNEL = "room-host-message";
const storageRequests = new Map();

function requestStorageCommand(command, request) {
  const requestId = globalThis.crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      storageRequests.delete(requestId);
      reject(new Error("Room command acknowledgement timed out"));
    }, 15000);
    storageRequests.set(requestId, { command, request, resolve, reject, timer });
    emitToHost("room-command", { command, payload: { requestId } });
  });
}

const hostMessageHandlers = new Set();
const visibilityHandlers = new Set();
let hostVisible = false;
let latestContext;
const pendingHostEvents = [];
let pendingHostFlushTimer = null;
let pendingAutoRoomReadyTimer = null;
let explicitRoomReadySent = false;

function trySendToHost(channel, payload) {
  ipcRenderer.sendToHost(channel, payload);
}

function schedulePendingHostFlush() {
  if (pendingHostFlushTimer !== null) {
    return;
  }

  pendingHostFlushTimer = globalThis.setTimeout(() => {
    pendingHostFlushTimer = null;
    flushPendingHostEvents();
  }, 50);
}

function flushPendingHostEvents() {
  if (pendingHostEvents.length === 0) {
    return;
  }

  while (pendingHostEvents.length > 0) {
    const next = pendingHostEvents[0];
    try {
      trySendToHost(next.channel, next.payload);
      pendingHostEvents.shift();
    } catch {
      schedulePendingHostFlush();
      return;
    }
  }
}

function emitToHost(channel, payload = {}) {
  try {
    trySendToHost(channel, payload);
    return true;
  } catch {
    pendingHostEvents.push({ channel, payload });
    schedulePendingHostFlush();
    return true;
  }
}

function clearPendingAutoRoomReady() {
  if (pendingAutoRoomReadyTimer === null) {
    return;
  }

  globalThis.clearTimeout(pendingAutoRoomReadyTimer);
  pendingAutoRoomReadyTimer = null;
}

function normalizeName(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function addHostMessageHandler(callback, replayContext = false) {
  if (typeof callback !== "function") {
    return () => {};
  }

  hostMessageHandlers.add(callback);
  if (replayContext && latestContext) callback(latestContext);
  return () => {
    hostMessageHandlers.delete(callback);
  };
}

ipcRenderer.on(ROOM_HOST_MESSAGE_CHANNEL, (_event, payload) => {
  if (payload?.type === "room-storage-dispatch") {
    const { requestId, command } = payload.payload ?? {};
    const pending = storageRequests.get(requestId);
    if (!pending || pending.command !== command) return;
    storageRequests.delete(requestId);
    // The request stays in the initiating guest so main can authenticate its actual sender.
    ipcRenderer
      .invoke("room-storage-command", command, pending.request)
      .then(pending.resolve, pending.reject)
      .finally(() => globalThis.clearTimeout(pending.timer));
    return;
  }
  if (payload?.type === "host-visibility" && typeof payload.visible === "boolean") {
    if (hostVisible === payload.visible) return;
    hostVisible = payload.visible;
    for (const handler of visibilityHandlers) handler(hostVisible);
    return;
  }
  if (payload?.type === "host-context") latestContext = payload;
  for (const handler of hostMessageHandlers) {
    try {
      handler(payload);
    } catch (error) {
      console.error("Room host message handler failed.", {
        type: payload && typeof payload.type === "string" ? payload.type : null,
        reason: payload && typeof payload.reason === "string" ? payload.reason : null,
        error: error instanceof Error ? error.stack || error.message : String(error),
      });
      continue;
    }
  }
});

contextBridge.exposeInMainWorld("electronAPI", {
  showOpenDialog: (options) => ipcRenderer.invoke("show-open-dialog", options),
  openPath: (path) => ipcRenderer.invoke("open-path", path),
  patternRoomArchiveFile: (file, payload = {}) => {
    const sourcePath = webUtils.getPathForFile(file);
    return ipcRenderer.invoke("pattern-room-archive-file", {
      ...payload,
      sourcePath,
    });
  },
  patternRoomListArchiveFiles: () => ipcRenderer.invoke("pattern-room-list-archive-files"),
  patternRoomOpenArchiveFile: (fileId) =>
    ipcRenderer.invoke("pattern-room-open-archive-file", fileId),
  patternRoomRevealArchiveFile: (fileId) =>
    ipcRenderer.invoke("pattern-room-reveal-archive-file", fileId),
});

contextBridge.exposeInMainWorld("roomAPI", {
  requestStorageCommand,
  ready: (payload = {}) => {
    explicitRoomReadySent = true;
    clearPendingAutoRoomReady();
    return emitToHost("room-ready", payload);
  },
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
  close: () => emitToHost("room-close", { stage: "ui-request" }),
  onVisibilityChange: (callback) => {
    if (typeof callback !== "function") return () => {};
    visibilityHandlers.add(callback);
    callback(hostVisible);
    return () => visibilityHandlers.delete(callback);
  },
  onHostMessage: (callback, replayContext) => addHostMessageHandler(callback, replayContext),
  offHostMessage: (callback) => {
    if (typeof callback !== "function") {
      return;
    }
    hostMessageHandlers.delete(callback);
  },
});

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("load", () => {
    if (explicitRoomReadySent) {
      return;
    }

    clearPendingAutoRoomReady();
    // Delay the preload fallback so explicit room bootstraps do not hydrate twice.
    pendingAutoRoomReadyTimer = globalThis.setTimeout(() => {
      pendingAutoRoomReadyTimer = null;
      if (explicitRoomReadySent) {
        return;
      }

      emitToHost("room-ready", {
        stage: "load",
        url: globalThis.location?.href ?? "",
      });
    }, 100);
  });
}
