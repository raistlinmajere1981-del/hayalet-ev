import { createLaboratoryActionRouter } from "./action-router.js";

export function createLaboratoryHostActionRuntime(deps) {
  let actionRouter = null;
  const toolMutationRuntime = deps.toolMutationRuntime;

  function getActionRouter() {
    if (actionRouter === null) {
      actionRouter = createLaboratoryActionRouter({
        asNonEmptyString: deps.asNonEmptyString,
        createRequestId: deps.createRequestId,
        ensureHydrated: deps.ensureHydrated,
        getFeatureIdFromContext: deps.getFeatureIdFromContext,
        loadContext: deps.loadContext,
        mediaActionRuntime: deps.mediaActionRuntime,
        persistProfileModelState: deps.persistProfileModelState,
        persistToolState: deps.persistToolState,
        pushActionResult: deps.pushActionResult,
        pushMediaState: deps.pushMediaState,
        subtitleActionRuntime: deps.getSubtitleActionRuntime(),
        toRecord: deps.toRecord,
      });
    }

    return actionRouter;
  }

  async function handleToolMutation(api, runtime, requestId, action, toolId, featureStage) {
    return toolMutationRuntime.handleToolMutation(
      api,
      runtime,
      requestId,
      action,
      toolId,
      featureStage
    );
  }

  async function handleMediaAction(api, runtime, payload) {
    return getActionRouter().dispatch(api, runtime, payload);
  }

  return {
    handleMediaAction: handleMediaAction,
    handleToolMutation: handleToolMutation,
  };
}
