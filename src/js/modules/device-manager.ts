import { LogManager } from "./log-manager.js";

const callDevice = async (action, payload) => {
  try {
    if (window?.electronAPI?.deviceAction) {
      return await window.electronAPI.deviceAction(action, payload);
    }
  } catch (err) {
    const error = /** @type {Error} */ (err);
    LogManager.addEvent(
      "device",
      "error",
      `deviceAction error: ${error?.message || error}`,
    );
    return { success: false, message: error?.message || String(error) };
  }
  LogManager.addEvent(
    "device",
    "info",
    `Fallback device stub called: ${action} ${JSON.stringify(payload)}`,
  );
  return { success: true, message: "stub" };
};

const DeviceManager = {
  moveMouse: (x: number, y: number) => callDevice("move_mouse", [x, y]),
  click: (button = 1) => callDevice("click", [button]),
  clickHold: (button = 1) => callDevice("mousedown", [button]),
  clickRelease: (button = 1) => callDevice("mouseup", [button]),
  rightClick: () => callDevice("click", [3]),
  key: (key: string) => callDevice("key", [key]),
  write: (text: string) => callDevice("type", [text]),
  copy: (text: string) => callDevice("copy", [text]),
  paste: () => callDevice("paste", []),
};

export default DeviceManager;
