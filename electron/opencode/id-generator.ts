/**
 * OpenCode Manager - ID Generation
 * 
 * Adapted from CodeNomad's session-actions.ts
 */

import { ID_LENGTH, BASE62_CHARS } from './types.ts';

let _lastTimestamp = 0;
let _localCounter = 0;

/**
 * Generate random base62 string
 */
export function randomBase62(length: number): string {
  let result = "";
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    const bytes = new Uint8Array(length);
    cryptoObj.getRandomValues(bytes);
    for (let i = 0; i < length; i++) {
      result += BASE62_CHARS[bytes[i] % BASE62_CHARS.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      const idx = Math.floor(Math.random() * BASE62_CHARS.length);
      result += BASE62_CHARS[idx];
    }
  }
  return result;
}

/**
 * Create a unique, sortable ID with prefix
 * Format: prefix_timestamp(hex)_random
 */
export function createId(prefix: string): string {
  const timestamp = Date.now();
  if (timestamp !== _lastTimestamp) {
    _lastTimestamp = timestamp;
    _localCounter = 0;
  }
  _localCounter++;

  const value = (BigInt(timestamp) << BigInt(12)) + BigInt(_localCounter);
  const bytes = new Array<number>(6);
  for (let i = 0; i < 6; i++) {
    const shift = BigInt(8 * (5 - i));
    bytes[i] = Number((value >> shift) & BigInt(0xff));
  }
  const hex = bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  const random = randomBase62(ID_LENGTH - 12);

  return `${prefix}_${hex}${random}`;
}
