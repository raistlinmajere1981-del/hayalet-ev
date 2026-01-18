import { join } from "path";
import { existsSync } from "fs";
import { pathToFileURL } from "url";
import { registerHandler } from "./ipc-helpers.ts";
import type { ProviderConfig as _ProviderConfig } from "../types/index.ts";

export function setupProviderHandlers(__dirname: string): void {
  const PATHS = {
    providerConfig: (providerId: string) =>
      join(
        __dirname,
        "..",
        "src",
        "js",
        "modules",
        "webview",
        "providers",
        providerId,
        "config.js"
      ),
  };

  registerHandler("get-preload-path", async () => {
    return `file://${join(__dirname, "webview-preload.cjs")}`;
  });

  registerHandler("get-provider-config", async (_event, providerId: string) => {
    if (!providerId) return null;
    const cfgPath = PATHS.providerConfig(providerId);
    if (!existsSync(cfgPath)) return null;

    try {
      const mod = await import(pathToFileURL(cfgPath).href);
      const cfg = mod?.config || mod?.default || mod;
      if (!cfg) return null;
      return {
        id: cfg.id,
        name: cfg.name,
        baseUrl: cfg.baseUrl,
        loginUrl: cfg.loginUrl,
        selectors: cfg.selectors,
        scrollerSelectors: cfg.scrollerSelectors,
        filters: cfg.filters || null,
        telemetry: cfg.telemetry || null,
      };
    } catch (err) {
      console.error(`Error loading provider config for ${providerId}:`, err);
      return null;
    }
  });
}
