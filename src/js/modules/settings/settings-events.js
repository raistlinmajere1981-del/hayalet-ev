// Lightweight event emitter + BroadcastChannel wrapper.

export class Emitter {
  constructor() {
    this.listeners = new Set();
  }
  on(fn) {
    if (typeof fn === "function") this.listeners.add(fn);
    return () => this.off(fn);
  }
  off(fn) {
    this.listeners.delete(fn);
  }
  emit(payload) {
    for (const fn of Array.from(this.listeners)) {
      try {
        fn(payload);
      } catch (err) {
        console.warn("Emitter listener error:", err);
      }
    }
  }
}

export function createSettingsBroadcast(channelName = "hayalet-settings") {
  try {
    const bc = new BroadcastChannel(channelName);
    return {
      post: (msg) => bc.postMessage(msg),
      on: (handler) => {
        bc.onmessage = (e) => handler?.(e?.data);
        return () => {
          try {
            bc.onmessage = null;
            bc.close();
          } catch {
            /* noop */
          }
        };
      },
    };
  } catch {
    // Fallback: no broadcast
    return {
      post: () => {},
      on: () => () => {},
    };
  }
}
