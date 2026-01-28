/**
 * Message Store - Event Subscription
 * 
 * Pub/sub pattern for store changes
 */

import type { StoreEvent, StoreListener } from './types.ts';

export class EventBus {
  private listeners = new Set<StoreListener>();
  private globalRevision = 0;

  subscribe(listener: StoreListener): () => boolean {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(event: Omit<StoreEvent, 'timestamp'>): void {
    this.globalRevision++;
    const eventWithTimestamp: StoreEvent = {
      ...event,
      timestamp: Date.now(),
    };

    this.listeners.forEach((listener) => {
      try {
        listener(eventWithTimestamp);
      } catch (err) {
        console.error('[MessageStore] Listener error:', err);
      }
    });
  }

  getGlobalRevision(): number {
    return this.globalRevision;
  }

  getListenerCount(): number {
    return this.listeners.size;
  }
}
