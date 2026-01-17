// ============================================================================
// Types
// ============================================================================

interface ThinkingConfig {
  thinking: {
    stopButtonDetectionTimeoutMs: number;
  };
}

interface ViewState {
  status?: {
    thinking?: string;
  };
  lastSendSeen?: number;
  stopButtonLastSeen?: number;
  stopButtonDisappearedAt?: number;
  thinkingJustEnded?: boolean;
  thinkingEndedAt?: number;
}

interface ProbeData {
  stopVisible?: boolean;
  sendState?: string;
  voiceMode?: boolean;
  lastSend?: number;
}

interface ThinkingEvent {
  type: string;
  message: string;
}

interface ProbeResult {
  indicator: string;
  newState: ViewState;
  event: ThinkingEvent | null;
}

interface CheckResult {
  shouldEnd: boolean;
  newState: ViewState;
}

// ============================================================================
// ThinkingTracker
// ============================================================================

export class ThinkingTracker {
  config: ThinkingConfig;

  constructor(config: ThinkingConfig) {
    this.config = config;
  }

  /**
   * Handle probe data for thinking tracking
   */
  handleProbe(provider: string, viewState: ViewState, data: ProbeData, now: number): ProbeResult {
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
   */
  startThinking(viewState: ViewState, now: number, lastSendTime: number): ViewState {
    viewState.lastSendSeen = lastSendTime;
    viewState.stopButtonLastSeen = now;
    viewState.stopButtonDisappearedAt = 0;
    return viewState;
  }

  /**
   * Check if thinking should end based on stop button visibility and send state
   */
  checkThinkingEnd(_provider: string, viewState: ViewState, data: ProbeData, now: number): CheckResult {
    const sendState = data.sendState || "missing";
    const stopVisible = !!data.stopVisible;
    const voiceMode = !!data.voiceMode;

    if (viewState.status?.thinking !== "busy") {
      return { shouldEnd: false, newState: viewState };
    }

    // Stop button is still visible - continue thinking
    if (stopVisible) {
      viewState.stopButtonLastSeen = now;
      viewState.stopButtonDisappearedAt = 0;
      return { shouldEnd: false, newState: viewState };
    }

    // Stop button disappeared - start countdown
    if (!viewState.stopButtonDisappearedAt) {
      viewState.stopButtonDisappearedAt = now;
    }

    const timeSinceDisappeared = now - (viewState.stopButtonDisappearedAt || 0);
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
   */
  endThinking(viewState: ViewState, now: number): ViewState {
    viewState.thinkingJustEnded = true;
    viewState.thinkingEndedAt = now;
    return viewState;
  }

  /**
   * Clear the "just ended" flag after a delay
   */
  clearJustEnded(viewState: ViewState): ViewState {
    viewState.thinkingJustEnded = false;
    return viewState;
  }
}
