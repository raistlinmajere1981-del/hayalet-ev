// @ts-nocheck
// Send Tracker - Gönder butonu durumunu izler
import { LogManager } from "../log-manager.js";

export class SendTracker {
  constructor(config) {
    this.config = config;
  }

  /**
   * Handle probe data for send button tracking
   * @param {string} provider - Provider identifier (ai1/ai2)
   * @param {Object} viewState - Current state
   * @param {Object} data - Probe data containing sendState
   * @param {number} now - Current timestamp
   * @returns {Object} { indicator: string, newState: Object }
   */
  handleProbe(provider, viewState, data, now) {
    const sendState = data.sendState || "missing";
    const indicator = this.getSendStatus(sendState);
    return { indicator, newState: viewState };
  }

  /**
   * Get the send indicator status based on send button state
   * @param {string} sendState - The send button state: 'enabled', 'disabled', or 'missing'
   * @returns {string} Status: 'idle' (green), 'busy' (red)
   */
  getSendStatus(sendState) {
    if (sendState === "enabled") {
      return "idle"; // Green - ready to send
    } else {
      return "busy"; // Red - disabled/missing/not ready
    }
  }

  /**
   * Check if send button was triggered (for starting thinking state)
   * @param {Object} viewState - Current state
   * @param {number} lastSendTime - Last send timestamp from probe
   * @returns {boolean} True if send was just triggered
   */
  isSendTriggered(viewState, lastSendTime) {
    return lastSendTime > viewState.lastSendSeen;
  }

  /**
   * Wait for send button to become enabled
   * @param {Function} getState - Function to get current state
   * @param {number} timeout - Maximum wait time in ms
   * @param {number} interval - Check interval in ms
   * @returns {Promise<boolean>} True if enabled within timeout
   */
  waitForSendEnabled(getState, timeout = 4000, interval = 100) {
    return new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
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
