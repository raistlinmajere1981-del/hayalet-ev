
export class ThinkingTracker {
  constructor(config) {
    this.config = config;
  }

  /**
   * Handle probe data for thinking tracking
   * @param {string} provider - Provider identifier (ai1/ai2)
   * @param {Object} viewState - Current state
   * @param {Object} data - Probe data containing stopVisible, sendState, voiceMode, lastSend
   * @param {number} now - Current timestamp
   * @returns {Object} { indicator: string, newState: Object, event: Object|null }
   */
  handleProbe(provider, viewState, data, now) {
    const lastSend = data.lastSend || 0;

    let event = null;
    let indicator = viewState.status?.thinking || "idle";

    if (lastSend > viewState.lastSendSeen) {
      this.startThinking(viewState, now, lastSend);
      indicator = "busy";
      event = {
        type: "thinking-started",
        message: `send detected for ${provider} (lastSend=${lastSend})`,
      };
    }

    if (viewState.status?.thinking === "busy") {
      const result = this.checkThinkingEnd(provider, viewState, data, now);
      if (result.shouldEnd) {
        indicator = "idle";
        event = {
          type: "thinking-ended",
          message: `thinking ended for ${provider}`,
        };
      }
      viewState = result.newState;
    }

    return { indicator, newState: viewState, event };
  }

  /**
   * Start thinking state when send button is triggered
   * @param {Object} viewState - The provider's state object
   * @param {number} now - Current timestamp
   * @param {number} lastSendTime - The timestamp of the send event
   * @returns {Object} Updated state
   */
  startThinking(viewState, now, lastSendTime) {
    viewState.lastSendSeen = lastSendTime;
    viewState.stopButtonLastSeen = now;
    viewState.stopButtonDisappearedAt = 0;
    return viewState;
  }

  /**
   * Check if thinking should end based on stop button visibility and send state
   * @param {string} provider - Provider identifier (ai1/ai2)
   * @param {Object} viewState - Current state
   * @param {Object} data - Probe data containing stopVisible, sendState, voiceMode
   * @param {number} now - Current timestamp
   * @returns {Object} { shouldEnd: boolean, newState: Object }
   */
  checkThinkingEnd(provider, viewState, data, now) {
    const sendState = data.sendState || "missing";
    const stopVisible = !!data.stopVisible;
    const voiceMode = !!data.voiceMode;

    if (viewState.status.thinking !== "busy") {
      return { shouldEnd: false, newState: viewState };
    }

    // Stop button is still visible - continue thinking
    if (stopVisible) {
      viewState.stopButtonLastSeen = now;
      viewState.stopButtonDisappearedAt = 0;
      return { shouldEnd: false, newState: viewState };
    }

    // Stop button disappeared - start countdown
    if (viewState.stopButtonDisappearedAt === 0) {
      viewState.stopButtonDisappearedAt = now;
    }

    const timeSinceDisappeared = now - viewState.stopButtonDisappearedAt;
    const shouldCheckEndThinking =
      timeSinceDisappeared >=
      this.config.thinking.stopButtonDetectionTimeoutMs;

    if (!shouldCheckEndThinking) {
      return { shouldEnd: false, newState: viewState };
    }

    // Thinking bitiş koşulları:
    // 1. Stop button kaybolmuş (yukarıda kontrol edildi)
    // 2. Send button görünür (enabled veya disabled)
    // 3. Veya voice mode aktif (bazı provider'larda)
    // 
    // Not: ChatGPT thinking bittiğinde önce disabled send button gösteriyor,
    // sonra enabled oluyor. Bu yüzden disabled da geçerli bitiş durumu.
    const shouldEndThinking =
      sendState === "enabled" || sendState === "disabled" || voiceMode;

    if (shouldEndThinking) {
      return {
        shouldEnd: true,
        newState: this.endThinking(viewState, now),
      };
    }

    return { shouldEnd: false, newState: viewState };
  }

  /**
   * End thinking state
   * @param {Object} viewState - The provider's state object
   * @param {number} now - Current timestamp
   * @returns {Object} Updated state
   */
  endThinking(viewState, now) {
    viewState.thinkingJustEnded = true;
    viewState.thinkingEndedAt = now;
    return viewState;
  }

  /**
   * Clear the "just ended" flag after a delay
   * @param {Object} viewState - The provider's state object
   * @returns {Object} Updated state
   */
  clearJustEnded(viewState) {
    viewState.thinkingJustEnded = false;
    return viewState;
  }
}
