import { Logger } from "./logger/index.js";
import { getErrorMessage } from "@shared/index.js";

const callDevice = async (
  action: string,
  payload: unknown
): Promise<{ success: boolean; message?: string }> => {
  try {
    if (window.electronAPI?.deviceAction !== undefined) {
      return (await window.electronAPI.deviceAction(action, payload)) as {
        success: boolean;
        message?: string;
      };
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    Logger.errorT("device", "app.logs.deviceManager.actionError", {
      message: getErrorMessage(error),
    });
    return { success: false, message: getErrorMessage(error) };
  }
  Logger.infoT("device", "app.logs.deviceManager.fallbackCalled", { action }, { action, payload });
  return { success: true, message: "stub" };
};

const deviceManager: {
  moveMouse: (x: number, y: number) => Promise<{ success: boolean; message?: string }>;
  click: (button?: number) => Promise<{ success: boolean; message?: string }>;
  clickHold: (button?: number) => Promise<{ success: boolean; message?: string }>;
  clickRelease: (button?: number) => Promise<{ success: boolean; message?: string }>;
  rightClick: () => Promise<{ success: boolean; message?: string }>;
  key: (key: string) => Promise<{ success: boolean; message?: string }>;
  write: (text: string) => Promise<{ success: boolean; message?: string }>;
  copy: (text: string) => Promise<{ success: boolean; message?: string }>;
  paste: () => Promise<{ success: boolean; message?: string }>;
} = {
  moveMouse: async (x: number, y: number) => await callDevice("move_mouse", [x, y]),
  click: async (button = 1) => await callDevice("click", [button]),
  clickHold: async (button = 1) => await callDevice("mousedown", [button]),
  clickRelease: async (button = 1) => await callDevice("mouseup", [button]),
  rightClick: async () => await callDevice("click", [3]),
  key: async (key: string) => await callDevice("key", [key]),
  write: async (text: string) => await callDevice("type", [text]),
  copy: async (text: string) => await callDevice("copy", [text]),
  paste: async () => await callDevice("paste", []),
};

export default deviceManager;
