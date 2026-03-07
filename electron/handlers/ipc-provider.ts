import { join } from "path";
import { existsSync } from "fs";
import { pathToFileURL } from "url";
import { webContents } from "electron";
import { registerHandler } from "./ipc-helpers.ts";
import { getLoggerCore } from "../logger/index.js";
import { LogCategory, LogLevel } from "@shared/index.js";
import { Paths } from "../paths.ts";
import { loadSettings } from "../settings-manager.ts";
import {
  collectPromotableSelectors,
  resolvePromotionLocaleFromSettings,
} from "../provider-tester/selector-evidence.ts";
import { promoteProviderConfigFile } from "../provider-tester/selector-promotion.ts";

const logger = getLoggerCore();
const PROVIDER_TEST_PROGRESS_CHANNEL = "provider-test:progress";

import type { ProviderTester as ProviderTesterType } from "../provider-tester/index.ts";
let providerTesterCtor: typeof ProviderTesterType | null = null;
type ProviderTesterConfig = ConstructorParameters<typeof ProviderTesterType>[1];

async function importModuleByPath(modulePath: string, fresh = false): Promise<unknown> {
  const moduleUrl = pathToFileURL(modulePath);
  if (fresh) {
    moduleUrl.searchParams.set("t", `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  }
  return await import(moduleUrl.href);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function resolveConfigRecord(moduleValue: unknown): Record<string, unknown> | null {
  if (!isRecord(moduleValue)) return null;

  const configCandidate = moduleValue["config"] ?? moduleValue["default"] ?? moduleValue;

  if (!isRecord(configCandidate)) return null;

  if (
    typeof configCandidate["id"] !== "string" ||
    typeof configCandidate["name"] !== "string" ||
    typeof configCandidate["baseUrl"] !== "string" ||
    !isRecord(configCandidate["selectors"])
  ) {
    return null;
  }

  return configCandidate;
}

function resolveConfigExport(moduleValue: unknown): ProviderTesterConfig | null {
  const configRecord = resolveConfigRecord(moduleValue);
  return configRecord !== null ? (configRecord as unknown as ProviderTesterConfig) : null;
}

function resolveProviderTesterExport(moduleValue: unknown): typeof ProviderTesterType | null {
  if (!isRecord(moduleValue)) return null;
  const tester = moduleValue["ProviderTester"];
  return typeof tester === "function" ? (tester as typeof ProviderTesterType) : null;
}

async function loadProviderConfigRecord(
  cfgPath: string,
  options: { fresh?: boolean } = {}
): Promise<Record<string, unknown> | null> {
  const mod: unknown = await importModuleByPath(cfgPath, options.fresh === true);
  return resolveConfigRecord(mod);
}

async function loadProviderConfigExport(
  cfgPath: string,
  options: { fresh?: boolean } = {}
): Promise<ProviderTesterConfig | null> {
  const mod: unknown = await importModuleByPath(cfgPath, options.fresh === true);
  return resolveConfigExport(mod);
}

export function setupProviderHandlers(): void {
  registerHandler("get-preload-path", () => {
    return Paths.getPreloadFileUrl("webview-preload.cjs");
  });

  registerHandler("get-provider-config", async (_event, providerId: string) => {
    if (providerId.length === 0) return null;

    const cfgPath = Paths.getProviderConfigPath(providerId);

    if (cfgPath.length === 0) return null;

    try {
      const cfg = await loadProviderConfigRecord(cfgPath, { fresh: true });
      if (cfg === null) return null;
      return {
        id: asString(cfg["id"]),
        name: asString(cfg["name"]),
        baseUrl: asString(cfg["baseUrl"]),
        loginUrl: asString(cfg["loginUrl"]),
        selectors: cfg["selectors"],
        scrollerSelectors: cfg["scrollerSelectors"],
        filters: cfg["filters"] ?? null,
        telemetry: cfg["telemetry"] ?? null,
      };
    } catch (err) {
      await logger.logInternal(
        LogCategory.IPC,
        LogLevel.ERROR,
        `Error loading provider config: ${(err as Error).message}`,
        {
          providerId,
          error: {
            name: (err as Error).name,
            message: (err as Error).message,
            stack: (err as Error).stack,
          },
        }
      );
      return null;
    }
  });

  registerHandler("test-provider", async (event, { slot }: { slot: "ai0" | "ai1" | "ai2" }) => {
    try {
      if (providerTesterCtor === null) {
        const testerPathTs = join(
          Paths.getProjectRoot(),
          "electron",
          "provider-tester",
          "index.ts"
        );
        const testerPathJs = join(
          Paths.getProjectRoot(),
          "dist",
          "electron",
          "provider-tester",
          "index.js"
        );
        const testerPath = existsSync(testerPathTs) ? testerPathTs : testerPathJs;

        if (!existsSync(testerPath)) {
          throw new Error(`ProviderTester not found at ${testerPath}`);
        }

        const testerModule: unknown = await importModuleByPath(testerPath);
        providerTesterCtor = resolveProviderTesterExport(testerModule);
        if (providerTesterCtor === null) {
          throw new Error(`ProviderTester export not found at ${testerPath}`);
        }
      }

      const webviewIdRaw: unknown = await event.sender.executeJavaScript(`
        (function() {
          const slotState = window.SlotController?.getSlotState?.('${slot}');
          if (slotState?.webview?.getWebContentsId) {
            return slotState.webview.getWebContentsId();
          }
          
          // Fallback: try WebviewManager
          const webview = window.WebviewManager?.webviews?.['${slot}'];
          if (webview?.getWebContentsId) {
            return webview.getWebContentsId();
          }
          
          const el = document.getElementById('${slot}-webview');
          if (el?.getWebContentsId) {
            return el.getWebContentsId();
          }
          
          return null;
        })()
      `);

      const webviewId = typeof webviewIdRaw === "number" ? webviewIdRaw : null;

      if (webviewId === null) {
        throw new Error(
          `Webview not accessible for ${slot}. Make sure the slot is connected and webview is registered.`
        );
      }

      const webviewContents = webContents.fromId(webviewId);
      if (webviewContents === undefined) {
        throw new Error(`WebContents not found for webview ${slot}`);
      }

      const providerIdRaw: unknown = await event.sender.executeJavaScript(`
        window.AppState?.getProviderIdForSlot?.('${slot}') || null
      `);
      const providerId = typeof providerIdRaw === "string" ? providerIdRaw : null;
      if (providerId === null || providerId.length === 0) {
        throw new Error(`No provider assigned to ${slot}`);
      }

      const cfgPath = Paths.getProviderConfigPath(providerId);

      if (cfgPath.length === 0) {
        throw new Error(`Provider config not found for ${providerId}`);
      }

      const config = await loadProviderConfigExport(cfgPath);

      if (config === null) {
        throw new Error(`Invalid provider config for ${providerId}`);
      }

      const webviewWrapper = {
        getURL: (): string => webviewContents.getURL(),
        loadURL: async (url: string): Promise<void> => {
          await webviewContents.loadURL(url);
        },
        executeJavaScript: async (script: string): Promise<unknown> =>
          await webviewContents.executeJavaScript(script),
        addEventListener: (
          event: "did-finish-load",
          listener: () => void,
          options?: { once?: boolean }
        ): void => {
          if (options?.once === true) {
            webviewContents.once(event, listener);
          } else {
            webviewContents.on(event, listener);
          }
        },
      };

      const shellWrapper = {
        executeJavaScript: async (script: string): Promise<unknown> =>
          await event.sender.executeJavaScript(script),
      };

      await logger.logInternal(
        LogCategory.IPC,
        LogLevel.INFO,
        `Starting provider test suite for ${providerId} on ${slot}`,
        { slot, providerId }
      );

      const locale = resolvePromotionLocaleFromSettings(await loadSettings());

      const tester = new providerTesterCtor(webviewWrapper, config, slot, shellWrapper, {
        emitProgress: (progressEvent): void => {
          event.sender.send(PROVIDER_TEST_PROGRESS_CHANNEL, progressEvent);
        },
        appLanguage: locale,
      });
      const results = await tester.runTestSuite();

      const promotions = collectPromotableSelectors({
        locale,
        aborted: results.aborted === true,
        failed: results.failed,
        warnings: results.warnings,
        results: results.results,
      });

      let refreshedConfig: Record<string, unknown> | null = null;

      if (promotions.length > 0) {
        await promoteProviderConfigFile({
          configPath: cfgPath,
          locale,
          promotions,
        });

        refreshedConfig = await loadProviderConfigRecord(cfgPath, { fresh: true });
      }

      await logger.logInternal(
        LogCategory.IPC,
        LogLevel.INFO,
        `Provider test completed: ${results.passed}/${results.totalTests} passed`,
        {
          slot,
          providerId,
          passed: results.passed,
          failed: results.failed,
          skipped: results.skipped,
          warnings: results.warnings,
        }
      );

      return refreshedConfig !== null ? { ...results, refreshedConfig } : results;
    } catch (err) {
      await logger.logInternal(
        LogCategory.IPC,
        LogLevel.ERROR,
        `Provider test failed: ${(err as Error).message}`,
        {
          slot,
          error: {
            name: (err as Error).name,
            message: (err as Error).message,
            stack: (err as Error).stack,
          },
        }
      );
      throw err;
    }
  });
}
