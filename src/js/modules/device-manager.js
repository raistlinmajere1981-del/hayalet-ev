// @ts-nocheck
// DeviceManager - basit/örnek cihaz etkileşim katmanı
import { LogManager } from "./log-manager.js";
// Use electronAPI.deviceAction when available; fallback to logging stub
const callDevice = async (action, payload) => {
  try {
    if (window?.electronAPI?.deviceAction) {
      return await window.electronAPI.deviceAction(action, payload);
    }
  } catch (err) {
    LogManager.addEvent(
      "device",
      "error",
      `deviceAction error: ${err?.message || err}`,
    );
    return { success: false, message: err?.message || String(err) };
  }
  LogManager.addEvent(
    "device",
    "info",
    `Fallback device stub called: ${action} ${JSON.stringify(payload)}`,
  );
  return { success: true, message: "stub" };
};

export async function DeviceManagerMoveMouse(x, y) {
  return callDevice("move_mouse", [x, y]);
}

export async function DeviceManagerClick(button = 1) {
  return callDevice("click", [button]);
}

export async function DeviceManagerClickHold(button = 1) {
  return callDevice("mousedown", [button]);
}

export async function DeviceManagerClickRelease(button = 1) {
  return callDevice("mouseup", [button]);
}

export async function DeviceManagerKey(key) {
  return callDevice("key", [key]);
}

export async function DeviceManagerWrite(text) {
  return callDevice("type", [text]);
}

export async function DeviceManagerCopy(text) {
  return callDevice("copy", [text]);
}

export async function DeviceManagerPaste() {
  return callDevice("paste", []);
}

const DeviceManager = {
  moveMouse: DeviceManagerMoveMouse,
  click: DeviceManagerClick,
  clickHold: DeviceManagerClickHold,
  clickRelease: DeviceManagerClickRelease,
  key: DeviceManagerKey,
  write: DeviceManagerWrite,
  copy: DeviceManagerCopy,
  paste: DeviceManagerPaste,
};

export default DeviceManager;
