import { Logger } from "../logger/index.js";
import { LogCategory, LogLevel } from "@shared/index.js";

interface TrackerConfig {
  pollIntervalMs?: number;
  loading?: unknown;
  thinking?: unknown;
}

export class SendTracker {
  config: TrackerConfig;
  private probeCount = 0;

  constructor(config: TrackerConfig) {
    this.config = config;
  }

  /**
   * Handle probe data for send button tracking
   * @param {string} provider - Provider identifier (ai1/ai2)
   * @param {Object} viewState - Current state
   * @param {Object} data - Probe data containing sendState
   * @param {number} _now - Current timestamp (unused)
   * @returns {Object} { indicator: string, newState: Object }
   */
  handleProbe(
    provider: string,
    viewState: Record<string, unknown>,
    data: { sendState?: string },
    _now: number
  ): { indicator: string; newState: Record<string, unknown> } {
    this.probeCount++;
    const sendState = data.sendState ?? "missing";
    const prevIndicator = (viewState["status"] as { send?: string }).send ?? "busy";
    const indicator = this.getSendStatus(sendState);

    if (indicator !== prevIndicator) {
      Logger.panelT(
        LogCategory.TRAFFIC,
        LogLevel.INFO,
        "app.logs.traffic.sendStateChanged",
        { provider, sendState, indicator, previousIndicator: prevIndicator },
        {
          provider,
          sendState,
          indicator,
          previousIndicator: prevIndicator,
          probeCount: this.probeCount,
        }
      );
    }

    // Periodic debug removed - state changes are logged via Logger.panel above

    return { indicator, newState: viewState };
  }

  /**
   * Get the send indicator status based on send button state
   * @param {string} sendState - The send button state: 'enabled', 'disabled', or 'missing'
   * @returns {string} Status: 'idle' (green), 'busy' (red)
   */
  getSendStatus(sendState: string): string {
    if (sendState === "enabled") {
      return "idle";
    } else {
      return "busy";
    }
  }

  /**
   * Check if send button was triggered (for starting thinking state)
   * @param {Object} viewState - Current state
   * @param {number} lastSendTime - Last send timestamp from probe
   * @returns {boolean} True if send was just triggered
   */
  isSendTriggered(viewState: { lastSendSeen?: number }, lastSendTime: number): boolean {
    return lastSendTime > (viewState.lastSendSeen ?? 0);
  }

  /**
   * Wait for send button to become enabled
   * @param {Function} getState - Function to get current state
   * @param {number} timeout - Maximum wait time in ms
   * @param {number} interval - Check interval in ms
   * @returns {Promise<boolean>} True if enabled within timeout
   */
  async waitForSendEnabled(
    getState: () => { status: { send: string } },
    timeout = 4000,
    interval = 100
  ): Promise<boolean> {
    return await new Promise((resolve) => {
      const start = Date.now();
      const check = (): void => {
        const state = getState();
        if (state.status.send === "idle") {
          resolve(true);
          return;
        }
        if (Date.now() - start >= timeout) {
          resolve(false);
          return;
        }
        setTimeout(check, interval);
      };
      check();
    });
  }
}
