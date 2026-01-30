/**
 * OpenCode SSE Server - Event Bus
 */

import { EventEmitter } from 'events';
import type { SSEEvent } from './types.ts';

export class OpenCodeEventBus extends EventEmitter {
  publish(event: SSEEvent): void {
    // Emit for internal listeners
    this.emit('event', event);
    this.emit(event.type, event);
  }

  onEvent(listener: (event: SSEEvent) => void): () => void {
    this.on('event', listener);
    return () => this.off('event', listener);
  }
}
