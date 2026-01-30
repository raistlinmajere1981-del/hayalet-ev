/**
 * TimeoutHandler - Slot timeout ve hata yönetimi
 * 
 * Bu modül slot işlemlerinin timeout ve hata durumlarını yönetir:
 * - Timeout başlatma/temizleme
 * - Bağlantı hatası yönetimi
 * - Hata sonrası temizlik
 */

import { getErrorMessage } from "../../types/index.js";
import type { SlotId } from "../../types/index.js";

/**
 * Timeout'ları saklamak için map
 */
const timeouts: Record<string, ReturnType<typeof setTimeout>> = {};

/**
 * Timeout başlat
 */
export function startTimeout(slot: string, operation: string, ms: number, callback: () => void) {
  const key = `${slot}-${operation}`;
  clearTimeout(slot, operation);
  timeouts[key] = setTimeout(callback, ms);
}

/**
 * Timeout'u temizle
 */
export function clearTimeout(slot: string, operation: string) {
  const key = `${slot}-${operation}`;
  if (timeouts[key]) {
    globalThis.clearTimeout(timeouts[key]);
    delete timeouts[key];
  }
}

interface SlotState {
  error?: Error | null;
  trafficStarted?: boolean;
  webview?: unknown;
  domReady?: boolean;
}

type LogFn = (slot: string, level: string, message: string, context?: Record<string, unknown>) => void;
type EmitFn = (slot: string, event: string, data: Record<string, unknown>) => void;
type TransitionFn = (slot: string, state: string) => void;
type CleanupFn = (slot: string, correlationId: string) => void;

/**
 * Bağlantı timeout'unu işle
 */
export function handleConnectTimeout(
  slotState: SlotState,
  slot: string,
  correlationId: string,
  errorState: string,
  logFn: LogFn,
  emitFn: EmitFn,
  transitionFn: TransitionFn,
  connectFailedEvent: string,
  cleanupFn: CleanupFn
) {
  logFn(slot, "error", "Connection timeout", { correlationId });
  
  slotState.error = new Error("Connection timeout");
  emitFn(slot, connectFailedEvent, { correlationId, error: "timeout" });
  
  cleanupFn(slot, correlationId);
  transitionFn(slot, errorState);
}

/**
 * Bağlantı hatasını işle
 */
export function handleConnectError(
  slotState: SlotState,
  slot: string,
  correlationId: string,
  error: unknown,
  errorState: string,
  logFn: LogFn,
  emitFn: EmitFn,
  transitionFn: TransitionFn,
  connectFailedEvent: string,
  cleanupFn: CleanupFn
): { success: boolean; message: string; correlationId: string } {
  const errorMsg = getErrorMessage(error);
  logFn(slot, "error", `Connection failed: ${errorMsg}`, { correlationId });
  
  slotState.error = error instanceof Error ? error : new Error(errorMsg);
  emitFn(slot, connectFailedEvent, { correlationId, error: errorMsg });
  
  cleanupFn(slot, correlationId);
  transitionFn(slot, errorState);
  
  return { success: false, message: errorMsg, correlationId };
}

/**
 * Hata sonrası temizlik yap
 */
export async function cleanupAfterError(
  slotState: SlotState,
  slot: string,
  correlationId: string,
  logFn: LogFn,
  clearUrlChangeHandlerFn: (slot: SlotId | string) => void,
  clearDomReadyHandlerFn: (slot: SlotId | string) => void,
  stopTrafficFn: (slot: string, correlationId: string) => Promise<void>,
  detachWebviewFn: (slot: string, correlationId: string) => Promise<void>
) {
  try {
    clearUrlChangeHandlerFn(slot);
    clearDomReadyHandlerFn(slot);
    
    if (slotState.trafficStarted) {
      await stopTrafficFn(slot, correlationId);
    }
    
    if (slotState.webview) {
      await detachWebviewFn(slot, correlationId);
    }
    
    slotState.domReady = false;
    slotState.trafficStarted = false;
  } catch (err) {
    logFn(slot, "warning", `Cleanup warning: ${getErrorMessage(err)}`, { correlationId });
  }
}
