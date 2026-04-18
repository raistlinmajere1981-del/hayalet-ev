export function createLaboratoryHostActivation(deps) {
  const {
    createRuntimeState,
    ensureHydrated,
    ensureRoomToolsSubscription,
    handleMediaAction,
    pushMediaState,
    saveContext,
    tearDownRoomToolsSubscription,
    toRecord
  } = deps;
  return {
    activate(api) {
      const runtime = createRuntimeState();
      api.log("info", "Laboratory media analysis host activated.");
      saveContext(api, {});
      ensureRoomToolsSubscription(api, runtime);
      return {
        onRoomReady(payload) {
          saveContext(api, toRecord(payload));
          void ensureHydrated(api, runtime).then(function() {
            pushMediaState(api, runtime, null);
          }).catch(function(error) {
            api.log(
              "warn",
              `Laboratory media host bootstrap failed: ${error instanceof Error ? error.message : String(error)}`
            );
          });
        },
        onRoomEvent(payload) {
          if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
            return;
          }
          const eventPayload = toRecord(payload);
          if (eventPayload.type === "host-context") {
            saveContext(
              api,
              eventPayload.payload !== void 0 ? toRecord(eventPayload.payload) : eventPayload
            );
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
        }
      };
    }
  };
}
