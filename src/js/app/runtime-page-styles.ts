export type RuntimePageStyleKey = "archives" | "whisper";
export type RuntimePageStyleLoader = () => Promise<unknown>;
export type RuntimePageStyleLoaders = Record<RuntimePageStyleKey, RuntimePageStyleLoader>;

export const runtimePageStyleLoaders: Readonly<RuntimePageStyleLoaders> = {
  archives: () => import("../../styles/archives.css"),
  whisper: () => import("../../styles/whisper.css"),
};

export interface RuntimePageStyleRegistry {
  ensureStyles(styleKey: RuntimePageStyleKey): Promise<void>;
}

export function createRuntimePageStyleRegistry(
  loaders: Readonly<RuntimePageStyleLoaders>
): RuntimePageStyleRegistry {
  const runtimePageStyleRequests = new Map<RuntimePageStyleKey, Promise<void>>();

  return {
    ensureStyles(styleKey: RuntimePageStyleKey): Promise<void> {
      const existingRequest = runtimePageStyleRequests.get(styleKey);
      if (existingRequest !== undefined) {
        return existingRequest;
      }

      const request = loaders[styleKey]()
        .then(() => undefined)
        .catch((error) => {
          runtimePageStyleRequests.delete(styleKey);
          throw error;
        });

      runtimePageStyleRequests.set(styleKey, request);
      return request;
    },
  };
}

const runtimePageStyleRegistry = createRuntimePageStyleRegistry(runtimePageStyleLoaders);

export function ensureRuntimePageStyles(styleKey: RuntimePageStyleKey): Promise<void> {
  return runtimePageStyleRegistry.ensureStyles(styleKey);
}
