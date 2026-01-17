
import { LogManager } from "../log-manager.js";
import { getErrorMessage } from "../../types/index.js";

type ListenerFn = (payload: any) => void;

export class Emitter {
  listeners: Set<ListenerFn>;

  constructor() {
    this.listeners = new Set();
  }
  on(fn: ListenerFn) {
    if (typeof fn === "function") this.listeners.add(fn);
    return () => this.off(fn);
  }
  off(fn: ListenerFn) {
    this.listeners.delete(fn);
  }
  emit(payload: any) {
    for (const fn of Array.from(this.listeners)) {
      try {
        fn(payload);
      } catch (err: any) {
        LogManager.addEvent("settings-events", "warning", "Listener error", { error: getErrorMessage(err) });
      }
    }
  }
}

export function createSettingsBroadcast(channelName = "hayalet-settings") {
  try {
    const bc = new BroadcastChannel(channelName);
    return {
      post: (msg: unknown) => {
        bc.postMessage(msg);
      },
      on: (handler: (data: unknown) => void) => {
        bc.onmessage = (e) => {
          handler?.(e?.data);
        };
        return () => {
          try {
            bc.onmessage = null;
            bc.close();
          } catch {
          }
        };
      },
    };
  } catch (err) {
    LogManager.addEvent("settings-events", "warning", `Failed to create BroadcastChannel: ${channelName}`, { error: getErrorMessage(err) });
    return {
      post: () => {},
      on: () => () => {},
    };
  }
}
