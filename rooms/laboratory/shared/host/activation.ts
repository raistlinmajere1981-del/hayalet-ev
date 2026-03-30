export function createLaboratoryHostActivation(deps: any) {
  const createRuntimeState = deps.createRuntimeState;
  const ensureHydrated = deps.ensureHydrated;
  const ensureRoomToolsSubscription = deps.ensureRoomToolsSubscription;
  const handleMediaAction = deps.handleMediaAction;
  const pushMediaState = deps.pushMediaState;
  const saveContext = deps.saveContext;
  const tearDownRoomToolsSubscription = deps.tearDownRoomToolsSubscription;
  const toRecord = deps.toRecord;

  return {
    activate: function activate(api: any) {
      const runtime = createRuntimeState();
      api.log("info", "Laboratory media analysis host activated.");
      saveContext(api, {});
      ensureRoomToolsSubscription(api, runtime);

      return {
        onRoomReady: function onRoomReady(payload: any) {
          saveContext(api, payload);
          void ensureHydrated(api, runtime)
            .then(function () {
              pushMediaState(api, runtime, null);
            })
            .catch(function (error: any) {
              api.log(
                "warn",
                `Laboratory media host bootstrap failed: ${
                  error instanceof Error ? error.message : String(error)
                }`
              );
            });
        },
        onRoomEvent: function onRoomEvent(payload: any) {
          if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
            return;
          }

          if (payload.type === "host-context") {
            saveContext(api, payload);
            pushMediaState(api, runtime, null);
            return;
          }

          if (payload.type === "source-action" || payload.type === "media-action") {
            void handleMediaAction(api, runtime, toRecord(payload.payload));
          }
        },
        dispose: function dispose() {
          tearDownRoomToolsSubscription(runtime);
          api.log("info", "Laboratory media analysis host disposed.");
        },
      };
    },
  };
}
