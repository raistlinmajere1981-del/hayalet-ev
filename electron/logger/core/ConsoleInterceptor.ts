/**
 * Console Interceptor - Override main process console.*
 *
 * Intercepts console.log/warn/error/etc and routes them through LoggerCore
 *
 * @module electron/logger/core/ConsoleInterceptor
 */

import { LoggerCore } from "./LoggerCore.js";
import { LogLevel as LL, LogCategory as LC } from "@shared/index.js";

export class ConsoleInterceptor {
  private static isInstalled = false;
  private static originalMethods = {
    log: globalThis.console.log,
    info: globalThis.console.info,
    warn: globalThis.console.warn,
    error: globalThis.console.error,
    debug: globalThis.console.debug,
  };

  public static install(): void {
    if (ConsoleInterceptor.isInstalled) {
      globalThis.console.warn("[ConsoleInterceptor] Already installed");
      return;
    }

    const logger = LoggerCore.getInstance();

    globalThis.console.log = (...args: unknown[]): void => {
      ConsoleInterceptor.originalMethods.log(...args);
      void logger.logInternal(LC.LEGACY, LL.DEBUG, ConsoleInterceptor.formatArgs(args));
    };

    globalThis.console.info = (...args: unknown[]): void => {
      ConsoleInterceptor.originalMethods.info(...args);
      void logger.logInternal(LC.LEGACY, LL.INFO, ConsoleInterceptor.formatArgs(args));
    };

    globalThis.console.warn = (...args: unknown[]): void => {
      ConsoleInterceptor.originalMethods.warn(...args);
      void logger.logInternal(LC.LEGACY, LL.WARNING, ConsoleInterceptor.formatArgs(args));
    };

    globalThis.console.error = (...args: unknown[]): void => {
      ConsoleInterceptor.originalMethods.error(...args);
      const formatted = ConsoleInterceptor.formatArgs(args);
      const errorObj = args.find((arg): arg is Error => arg instanceof Error);

      void logger.logInternal(
        LC.LEGACY,
        LL.ERROR,
        formatted,
        errorObj !== undefined
          ? {
              error: {
                name: errorObj.name,
                message: errorObj.message,
                stack: errorObj.stack,
              },
            }
          : undefined
      );
    };

    globalThis.console.debug = (...args: unknown[]): void => {
      ConsoleInterceptor.originalMethods.debug(...args);
      void logger.logInternal(LC.LEGACY, LL.DEBUG, ConsoleInterceptor.formatArgs(args));
    };

    ConsoleInterceptor.isInstalled = true;
  }

  public static uninstall(): void {
    if (!ConsoleInterceptor.isInstalled) return;

    globalThis.console.log = ConsoleInterceptor.originalMethods.log;
    globalThis.console.info = ConsoleInterceptor.originalMethods.info;
    globalThis.console.warn = ConsoleInterceptor.originalMethods.warn;
    globalThis.console.error = ConsoleInterceptor.originalMethods.error;
    globalThis.console.debug = ConsoleInterceptor.originalMethods.debug;

    ConsoleInterceptor.isInstalled = false;
  }

  private static formatArgs(args: unknown[]): string {
    return args
      .map((arg) => {
        if (typeof arg === "string") {
          return arg;
        }
        if (typeof arg === "number" || typeof arg === "boolean" || typeof arg === "bigint") {
          return String(arg);
        }
        if (arg instanceof Error) {
          return `${arg.name}: ${arg.message}`;
        }
        if (arg !== null && typeof arg === "object") {
          try {
            return JSON.stringify(arg);
          } catch {
            return "[unserializable object]";
          }
        }
        return "";
      })
      .join(" ");
  }
}
