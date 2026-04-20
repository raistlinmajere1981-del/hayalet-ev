export function createLaboratoryHostActivation(deps) {
  const {
    createRuntimeState,
    emitEvent,
    ensureHydrated,
    ensureRoomToolsSubscription,
    handleMediaAction,
    loadContext,
    pushMediaState,
    queueInteractiveReprocess,
    saveContext,
    tearDownRoomToolsSubscription,
    toRecord
  } = deps;
  function getWorkbenchAdjustmentState(previousContext, nextContext) {
    const previousWorkbench = toRecord(toRecord(previousContext)["workbench"]);
    const nextWorkbench = toRecord(toRecord(nextContext)["workbench"]);
    const previousProcessShape = {
      analysisScope: previousWorkbench["analysisScope"],
      moduleToggles: previousWorkbench["moduleToggles"]
    };
    const nextProcessShape = {
      analysisScope: nextWorkbench["analysisScope"],
      moduleToggles: nextWorkbench["moduleToggles"]
    };
    const previousViewShape = {
      activePreviewArtifactId: previousWorkbench["activePreviewArtifactId"],
      activeLiveFindingsStreamId: previousWorkbench["activeLiveFindingsStreamId"],
      controlsCollapsed: previousWorkbench["controlsCollapsed"]
    };
    const nextViewShape = {
      activePreviewArtifactId: nextWorkbench["activePreviewArtifactId"],
      activeLiveFindingsStreamId: nextWorkbench["activeLiveFindingsStreamId"],
      controlsCollapsed: nextWorkbench["controlsCollapsed"]
    };
    return {
      changed: JSON.stringify(previousProcessShape) !== JSON.stringify(nextProcessShape) || JSON.stringify(previousViewShape) !== JSON.stringify(nextViewShape),
      processChanged: JSON.stringify(previousProcessShape) !== JSON.stringify(nextProcessShape)
    };
  }
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
            const previousContext = loadContext(api);
            const nextContext = saveContext(
              api,
              eventPayload.payload !== void 0 ? toRecord(eventPayload.payload) : eventPayload
            );
            const workbenchAdjustment = getWorkbenchAdjustmentState(previousContext, nextContext);
            if (workbenchAdjustment.changed) {
              const workbench = toRecord(toRecord(nextContext)["workbench"]);
              const scope = toRecord(workbench["analysisScope"]);
              if (workbenchAdjustment.processChanged && typeof queueInteractiveReprocess === "function") {
                void queueInteractiveReprocess(api, runtime, toRecord(nextContext)).catch(function(error) {
                  api.log(
                    "warn",
                    `Laboratory queued reprocess sync failed: ${error instanceof Error ? error.message : String(error)}`
                  );
                });
              }
              emitEvent(api, {
                kind: "interactive-adjustment-applied",
                action: "host-context",
                stage: "process",
                scope: "run",
                message: "Analysis controls updated",
                detail: (typeof scope["hypothesis"] === "string" && scope["hypothesis"].trim() !== "" ? scope["hypothesis"].trim() : "Workbench scope and module controls were updated.") || null,
                analysisScope: workbench["analysisScope"]
              });
            }
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
