type LaboratoryRecord = Record<string, unknown>;

type LaboratoryHostApi = {
  log: (level: string, message: string) => void;
};

type LaboratoryRuntimeRecord = LaboratoryRecord;

type LaboratoryHostActivationDeps = {
  createRuntimeState: () => LaboratoryRuntimeRecord;
  ensureHydrated: (api: LaboratoryHostApi, runtime: LaboratoryRuntimeRecord) => Promise<unknown>;
  ensureRoomToolsSubscription: (api: LaboratoryHostApi, runtime: LaboratoryRuntimeRecord) => void;
  handleMediaAction: (
    api: LaboratoryHostApi,
    runtime: LaboratoryRuntimeRecord,
    payload: LaboratoryRecord
  ) => Promise<unknown>;
  pushMediaState: (
    api: LaboratoryHostApi,
    runtime: LaboratoryRuntimeRecord,
    requestId: string | null
  ) => void;
  saveContext: (api: LaboratoryHostApi, payload: LaboratoryRecord) => void;
  tearDownRoomToolsSubscription: (runtime: LaboratoryRuntimeRecord) => void;
  toRecord: (value: unknown) => LaboratoryRecord;
};

type LaboratoryHostEventPayload = LaboratoryRecord & {
  payload?: unknown;
  type?: unknown;
};

export function createLaboratoryHostActivation(deps: LaboratoryHostActivationDeps) {
  const {
    createRuntimeState,
    ensureHydrated,
    ensureRoomToolsSubscription,
    handleMediaAction,
    pushMediaState,
    saveContext,
    tearDownRoomToolsSubscription,
    toRecord,
  } = deps;

  return {
    activate(api: LaboratoryHostApi) {
      const runtime = createRuntimeState();
      api.log("info", "Laboratory media analysis host activated.");
      saveContext(api, {});
      ensureRoomToolsSubscription(api, runtime);

      return {
        onRoomReady(payload: unknown) {
          saveContext(api, toRecord(payload));
          void ensureHydrated(api, runtime)
            .then(function () {
              pushMediaState(api, runtime, null);
            })
            .catch(function (error) {
              api.log(
                "warn",
                `Laboratory media host bootstrap failed: ${
                  error instanceof Error ? error.message : String(error)
                }`
              );
            });
        },
        onRoomEvent(payload: unknown) {
          if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
            return;
          }

          const eventPayload = toRecord(payload) as LaboratoryHostEventPayload;
          if (eventPayload.type === "host-context") {
            saveContext(api, eventPayload);
            pushMediaState(api, runtime, null);
            return;
          }

          if (eventPayload.type === "source-action" || eventPayload.type === "media-action") {
            void handleMediaAction(api, runtime, toRecord(eventPayload.payload));
          }
        },
        dispose() {
          tearDownRoomToolsSubscription(runtime);
          api.log("info", "Laboratory media analysis host disposed.");
        },
      };
    },
  };
}
