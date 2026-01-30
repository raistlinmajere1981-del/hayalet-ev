/**
 * Timeout ve Interval sabitleri
 */

export const TIMEOUTS = {
  DOM_READY: 15000,
  CONNECTION: 30000,
  RESPONSE_WAIT: 120000,
  SEND_ENABLED: 4000,
  THINKING_COOLDOWN: 5000,
  THINKING_DEADLINE: 45000,
  WEBVIEW_LOAD: 10000,
  CLEANUP_INTERVAL: 10 * 60 * 1000, // 10 dakika - inactive webview cleanup
};

export const INTERVALS = {
  POLL: 1000,
  POLL_FAST: 100,
  POLL_MIN: 250,
  STATE_SNAPSHOT: 60000,
  AUTO_SCROLL: 300,
  BACKOFF_MAX: 16000,
  THINKING_TICK: 400, // Thinking state polling interval
};

export const DELAYS = {
  INITIAL_WAIT: 1500,
  RETRY: 500,
  UI_UPDATE: 100,
  DEBOUNCE: 300,
  STATE_CLEAR: 1500, // Loading/thinking just-ended state clear delay
};
