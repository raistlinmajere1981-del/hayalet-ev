import { LogCategory } from "@shared/logging-core";
import { Logger } from "../logger/index.js";
import { getErrorMessage } from "@shared/index.js";
import type { AppSettings } from "@shared/settings.js";

interface SettingsPayload {
  settings: AppSettings;
  changedPaths: string[];
}

type ListenerFn = (payload: SettingsPayload) => void;

export class Emitter {
  listeners: Set<ListenerFn>;

  constructor() {
    this.listeners = new Set();
  }
  on(fn: ListenerFn): () => void {
    if (typeof fn === "function") this.listeners.add(fn);
    return () => {
      this.off(fn);
    };
  }
  off(fn: ListenerFn): void {
    this.listeners.delete(fn);
  }
  emit(payload: SettingsPayload): void {
    for (const fn of Array.from(this.listeners)) {
      try {
        fn(payload);
      } catch (err: unknown) {
        Logger.warn(LogCategory.SETTINGS, "Listener error", { error: getErrorMessage(err) });
      }
    }
  }
}

export function createSettingsBroadcast(channelName = "hayalet-settings"): {
  post: (msg: unknown) => void;
  on: (handler: (data: unknown) => unknown) => () => void;
} {
  try {
    const bc = new BroadcastChannel(channelName);
    return {
      post: (msg: unknown): void => {
        bc.postMessage(msg);
      },
      on: (handler: (data: unknown) => unknown): (() => void) => {
        bc.onmessage = (e): void => {
          handler(e.data);
        };
        return () => {
          try {
            bc.onmessage = null;
            bc.close();
          } catch {}
        };
      },
    };
  } catch (err) {
    Logger.warn(LogCategory.SETTINGS, `Failed to create BroadcastChannel: ${channelName}`, {
      error: getErrorMessage(err),
    });
    return {
      post: (): void => {},
      on: () => () => {},
    };
  }
}
