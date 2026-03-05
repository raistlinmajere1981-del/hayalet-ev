/**
 * Session Manager - Electron session/cache yönetimi
 *
 * Uygulama açılışında cache temizliği yapar.
 * Login bilgilerini (cookies, localStorage) korur.
 *
 * @module electron/session-manager
 */

import { session } from "electron";
import { getLoggerCore } from "./logger/index.js";
import { LogCategory, LogLevel } from "@shared/index.js";
import { PARTITIONS } from "@slots";

const logger = getLoggerCore();

interface ClearResult {
  success: boolean;
  cleared: string[];
  error?: string;
}

const CLEARABLE_STORAGES: ("cachestorage" | "serviceworkers")[] = [
  "cachestorage", // Service worker cache (~100-300 MB)
  "serviceworkers", // SW registrations
];

async function clearPartitionCache(partitionName: string): Promise<ClearResult> {
  try {
    const ses = session.fromPartition(partitionName);

    await ses.clearStorageData({
      storages: CLEARABLE_STORAGES,
    });

    await ses.clearCache();

    await logger.logInternal(LogCategory.MAIN, LogLevel.INFO, "Cache cleared for partition", {
      partition: partitionName,
      storages: [...CLEARABLE_STORAGES, "httpcache"],
    });

    return {
      success: true,
      cleared: [...CLEARABLE_STORAGES, "httpcache"],
    };
  } catch (error) {
    await logger.logInternal(
      LogCategory.MAIN,
      LogLevel.ERROR,
      `Cache clear error: ${(error as Error).message}`,
      {
        partition: partitionName,
        error: {
          name: (error as Error).name,
          message: (error as Error).message,
          stack: (error as Error).stack,
        },
      }
    );

    return {
      success: false,
      cleared: [],
      error: (error as Error).message,
    };
  }
}

export async function clearStartupCache(): Promise<{ main: ClearResult; asistan: ClearResult }> {
  await logger.logInternal(LogCategory.MAIN, LogLevel.INFO, "Startup cache clearing started", {});

  const results = {
    main: await clearPartitionCache(PARTITIONS.MAIN),
    asistan: await clearPartitionCache(PARTITIONS.ASISTAN),
  };

  const totalSuccess = results.main.success && results.asistan.success;

  await logger.logInternal(
    LogCategory.MAIN,
    LogLevel.INFO,
    `Startup cache clearing ${totalSuccess ? "completed" : "partially failed"}`,
    { mainSuccess: results.main.success, asistanSuccess: results.asistan.success }
  );

  return results;
}

const sessionManager = {
  PARTITIONS,
  clearStartupCache,
  clearPartitionCache,
};

export { sessionManager as SessionManager };
