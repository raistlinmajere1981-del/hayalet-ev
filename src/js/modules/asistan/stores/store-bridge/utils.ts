/**
 * Store Bridge - Echo Detection & Normalization Utilities
 */

/**
 * Normalize string for echo comparison
 */
export function normalizeForComparison(str: string): string {
  if (!str) return '';
  return str
    .trim()
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Check if content is an echo of the last user message
 */
export function isEcho(content: string, lastUserMessage: string | null): boolean {
  if (!lastUserMessage) return false;

  const normalizedContent = normalizeForComparison(content);
  const normalizedLastMessage = normalizeForComparison(lastUserMessage);

  return normalizedContent === normalizedLastMessage;
}

/**
 * Generate echo filter state
 */
export function createEchoFilterState() {
  return {
    lastUserMessage: null as string | null,
    lastUserMessageByInstance: new Map<string, string>(),
    echoTimeoutByInstance: new Map<string, NodeJS.Timeout>(),
    ignoredMessageIds: new Set<string>(),
  };
}

/**
 * Clear echo filter state
 */
export function clearEchoFilter(state: any) {
  state.lastUserMessage = '';

  for (const timeoutId of state.echoTimeoutByInstance.values()) {
    clearTimeout(timeoutId);
  }
  state.echoTimeoutByInstance.clear();
  state.lastUserMessageByInstance.clear();
  state.ignoredMessageIds.clear();
}
