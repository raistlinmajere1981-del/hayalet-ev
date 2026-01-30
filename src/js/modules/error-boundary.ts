/**
 * ErrorBoundary - Global hata yakalama ve yönetimi
 * 
 * Bu modül renderer process'te oluşan hataları yakalar ve güvenli bir şekilde
 * işler. Kritik hataların tüm uygulamayı etkilemesini önler.
 * 
 * Kullanım:
 * - Async fonksiyonları wrap etmek için: ErrorBoundary.wrap()
 * - Global hata yakalama için: ErrorBoundary.init()
 */

import { LogManager } from "./log-manager.js";
import { getErrorMessage } from "../types/index.js";

// ============================================================================
// Types
// ============================================================================

interface ErrorContext {
  source: string;
  operation?: string;
  metadata?: Record<string, unknown>;
}

interface ErrorReport {
  message: string;
  stack?: string;
  source: string;
  operation?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

type ErrorCallback = (report: ErrorReport) => void;

// ============================================================================
// ErrorBoundary Class
// ============================================================================

class ErrorBoundaryClass {
  private _initialized = false;
  private _errorCallbacks: ErrorCallback[] = [];
  private _recentErrors: ErrorReport[] = [];
  private _maxRecentErrors = 50;

  /**
   * Global error handler'ları kur
   */
  init(): void {
    if (this._initialized) return;

    // Unhandled promise rejections
    window.addEventListener("unhandledrejection", (event) => {
      const error = event.reason;
      this._handleError(error, { source: "unhandled-rejection" });
      // Varsayılan davranışı engelleme - sadece logla
      event.preventDefault();
    });

    // Global errors
    window.addEventListener("error", (event) => {
      this._handleError(event.error || event.message, {
        source: "global-error",
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
      // Varsayılan davranışı engelleme
      event.preventDefault();
    });

    this._initialized = true;
    LogManager.addEvent("error-boundary", "info", "ErrorBoundary initialized", { visibility: 2 });
  }

  /**
   * Async fonksiyonu güvenli bir şekilde çalıştır
   * Hata oluşursa loglar ve null döner
   * 
   * @example
   * const result = await ErrorBoundary.wrap(
   *   () => riskyAsyncOperation(),
   *   "module-name",
   *   "operation-description"
   * );
   */
  async wrap<T>(
    fn: () => Promise<T>,
    source: string,
    operation?: string
  ): Promise<T | null> {
    try {
      return await fn();
    } catch (error) {
      this._handleError(error, { source, operation });
      return null;
    }
  }

  /**
   * Sync fonksiyonu güvenli bir şekilde çalıştır
   */
  wrapSync<T>(
    fn: () => T,
    source: string,
    operation?: string
  ): T | null {
    try {
      return fn();
    } catch (error) {
      this._handleError(error, { source, operation });
      return null;
    }
  }

  /**
   * Callback fonksiyonunu güvenli bir şekilde çalıştır
   * Event handler'lar için ideal
   */
  safeCallback<T extends (...args: unknown[]) => unknown>(
    fn: T,
    source: string
  ): T {
    return ((...args: unknown[]) => {
      try {
        const result = fn(...args);
        // Promise ise wrap et
        if (result instanceof Promise) {
          return result.catch((error) => {
            this._handleError(error, { source, operation: "callback-async" });
            return null;
          });
        }
        return result;
      } catch (error) {
        this._handleError(error, { source, operation: "callback-sync" });
        return null;
      }
    }) as T;
  }

  /**
   * Hata callback'i ekle
   * UI'da hata göstermek veya telemetry için kullanılabilir
   */
  onError(callback: ErrorCallback): () => void {
    this._errorCallbacks.push(callback);
    return () => {
      this._errorCallbacks = this._errorCallbacks.filter((cb) => cb !== callback);
    };
  }

  /**
   * Son hataları getir (debugging için)
   */
  getRecentErrors(): ErrorReport[] {
    return [...this._recentErrors];
  }

  /**
   * Hata geçmişini temizle
   */
  clearErrors(): void {
    this._recentErrors = [];
  }

  /**
   * Internal: Hata işle
   */
  private _handleError(error: unknown, context: ErrorContext): void {
    const report: ErrorReport = {
      message: getErrorMessage(error),
      stack: error instanceof Error ? error.stack : undefined,
      source: context.source,
      operation: context.operation,
      timestamp: Date.now(),
      metadata: context.metadata,
    };

    // Recent errors listesine ekle
    this._recentErrors.unshift(report);
    if (this._recentErrors.length > this._maxRecentErrors) {
      this._recentErrors.pop();
    }

    // Log
    const logMessage = context.operation
      ? `[${context.source}:${context.operation}] ${report.message}`
      : `[${context.source}] ${report.message}`;
    
    LogManager.addEvent("error-boundary", "error", logMessage, {
      stack: report.stack,
      ...context.metadata,
    });

    // Callback'leri çağır
    for (const callback of this._errorCallbacks) {
      try {
        callback(report);
      } catch (_e) {
        // Callback hatalarını sessizce geç
      }
    }
  }
}

export const ErrorBoundary = new ErrorBoundaryClass();
