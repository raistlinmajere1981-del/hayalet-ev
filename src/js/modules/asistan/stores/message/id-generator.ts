/**
 * Message Store - ID Generator
 * 
 * Generate unique, sortable IDs (sortable base62 timestamps)
 * Adapted from CodeNomad's session-actions.ts
 */

const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

let _lastTimestamp = 0;
let _localCounter = 0;

/**
 * Generate random base62 string
 */
export function randomBase62(length: number): string {
  let result = '';
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) {
    result += BASE62_CHARS[arr[i] % 62];
  }
  return result;
}

/**
 * Create a unique, sortable ID with prefix
 * Format: prefix_timestamp(base62)_counter_random
 */
export function createId(prefix = 'id'): string {
  const now = Date.now();

  // Reset counter if timestamp changed
  if (now !== _lastTimestamp) {
    _lastTimestamp = now;
    _localCounter = 0;
  } else {
    _localCounter++;
  }

  // Convert timestamp to base62
  let ts = now;
  let tsBase62 = '';
  while (ts > 0) {
    tsBase62 = BASE62_CHARS[ts % 62] + tsBase62;
    ts = Math.floor(ts / 62);
  }

  // Counter in base62
  let counter = _localCounter;
  let counterBase62 = '';
  do {
    counterBase62 = BASE62_CHARS[counter % 62] + counterBase62;
    counter = Math.floor(counter / 62);
  } while (counter > 0);

  // Random suffix
  const random = randomBase62(4);

  return `${prefix}_${tsBase62}${counterBase62}${random}`;
}
