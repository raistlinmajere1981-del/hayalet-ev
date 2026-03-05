import { Logger } from "../logger/index.js";
import { LogCategory, LogLevel } from "@shared/index.js";

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

export class ThinkingTracker {
  config: ThinkingConfig;
  private probeCount = 0;

  constructor(config: ThinkingConfig) {
    this.config = config;
  }

  handleProbe(provider: string, viewState: ViewState, data: ProbeData, now: number): ProbeResult {
    this.probeCount++;
    const lastSend = data.lastSend ?? 0;
    const stopVisible = data.stopVisible === true;

    let event = null;
    const previousIndicator = viewState.status?.thinking ?? "idle";
    const indicator = stopVisible ? "busy" : "idle";

    if (lastSend > (viewState.lastSendSeen ?? 0)) {
      viewState.lastSendSeen = lastSend;
    }

    if (indicator === "busy") {
      viewState.stopButtonLastSeen = now;
      viewState.stopButtonDisappearedAt = 0;
    }

    if (previousIndicator !== indicator) {
      if (indicator === "busy") {
        event = {
          type: "thinking-started",
          message: `thinking started for ${provider} (stop button visible)`,
        };

        Logger.panel(LogCategory.TRAFFIC, LogLevel.INFO, "Thinking state started", {
          provider,
          lastSend,
          probeCount: this.probeCount,
          stopVisible,
        });
      } else {
        viewState = this.endThinking(viewState, now);
        event = {
          type: "thinking-ended",
          message: `thinking ended for ${provider} (stop button hidden)`,
        };

        Logger.panel(LogCategory.TRAFFIC, LogLevel.INFO, "Thinking state ended", {
          provider,
          probeCount: this.probeCount,
          stopVisible,
        });
      }
    }

    // Periodic debug removed - state changes are logged via Logger.panel above

    return { indicator, newState: viewState, event };
  }

  startThinking(viewState: ViewState, now: number, lastSendTime: number): ViewState {
    viewState.lastSendSeen = lastSendTime;
    viewState.stopButtonLastSeen = now;
    viewState.stopButtonDisappearedAt = 0;
    return viewState;
  }

  checkThinkingEnd(
    _provider: string,
    viewState: ViewState,
    data: ProbeData,
    now: number
  ): CheckResult {
    const sendState = data.sendState ?? "missing";
    const stopVisible = data.stopVisible === true;
    const voiceMode = data.voiceMode === true;

    if (viewState.status?.thinking !== "busy") {
      return { shouldEnd: false, newState: viewState };
    }

    if (stopVisible) {
      viewState.stopButtonLastSeen = now;
      viewState.stopButtonDisappearedAt = 0;
      return { shouldEnd: false, newState: viewState };
    }

    viewState.stopButtonDisappearedAt ??= now;

    const timeSinceDisappeared = now - (viewState.stopButtonDisappearedAt ?? 0);
    const shouldCheckEndThinking =
      timeSinceDisappeared >= this.config.thinking.stopButtonDetectionTimeoutMs;

    if (!shouldCheckEndThinking) {
      return { shouldEnd: false, newState: viewState };
    }

    const shouldEndThinking = sendState === "enabled" || sendState === "disabled" || voiceMode;

    if (shouldEndThinking) {
      return {
        shouldEnd: true,
        newState: this.endThinking(viewState, now),
      };
    }

    return { shouldEnd: false, newState: viewState };
  }

  endThinking(viewState: ViewState, now: number): ViewState {
    viewState.thinkingJustEnded = true;
    viewState.thinkingEndedAt = now;
    return viewState;
  }

  clearJustEnded(viewState: ViewState): ViewState {
    viewState.thinkingJustEnded = false;
    return viewState;
  }
}
