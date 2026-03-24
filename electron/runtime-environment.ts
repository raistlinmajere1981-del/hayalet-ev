import { spawnSync } from "node:child_process";

type WineRuntimeOptions = {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  regQuery?: (() => boolean) | undefined;
};

let cachedDefaultWineRuntime: boolean | null = null;

function hasWineEnvironmentMarkers(env: NodeJS.ProcessEnv): boolean {
  return ["WINEPREFIX", "WINESERVER", "WINELOADERNOEXEC"].some((key) => {
    const value = env[key];
    return typeof value === "string" && value.trim() !== "";
  });
}

export function isWineRuntime(options: WineRuntimeOptions = {}): boolean {
  const platform = options.platform ?? process.platform;
  if (platform !== "win32") {
    return false;
  }

  const env = options.env ?? process.env;
  if (hasWineEnvironmentMarkers(env)) {
    return true;
  }

  if (typeof options.regQuery === "function") {
    return options.regQuery();
  }

  if (
    options.platform === undefined &&
    options.env === undefined &&
    cachedDefaultWineRuntime !== null
  ) {
    return cachedDefaultWineRuntime;
  }

  const detected = ((): boolean => {
    try {
      const result = spawnSync("reg", ["query", "HKCU\\Software\\Wine"], {
        stdio: "ignore",
        windowsHide: true,
      });
      return result.status === 0;
    } catch {
      return false;
    }
  })();

  if (options.platform === undefined && options.env === undefined) {
    cachedDefaultWineRuntime = detected;
  }

  return detected;
}
