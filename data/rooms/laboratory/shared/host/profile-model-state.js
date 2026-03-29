export function createLaboratoryProfileModelStateRuntime(deps) {
  const { createDefaultProfileModelEntry, getProjectStateRuntime, toRecord } = deps;
  function readProfileModelEntries(runtime) {
    return toRecord(
      toRecord(runtime.profileModelState).models
    );
  }
  function readProfileModelDescriptor(runtime, modelId) {
    return getProjectStateRuntime().readProfileModelDescriptor(runtime, modelId);
  }
  function readProfileModelDescriptorMap(runtime) {
    return getProjectStateRuntime().readProfileModelDescriptorMap(runtime);
  }
  function saveProfileModelState(runtime) {
    return getProjectStateRuntime().saveProfileModelState(runtime);
  }
  function saveToolState(runtime) {
    return getProjectStateRuntime().saveToolState(runtime);
  }
  function reloadProfileModelState(runtime) {
    return getProjectStateRuntime().reloadProfileModelState(runtime);
  }
  function updateProfileModelEntry(runtime, modelId, patch) {
    runtime.profileModelState.models[modelId] = {
      ...createDefaultProfileModelEntry(modelId),
      ...readProfileModelEntries(runtime)[modelId],
      ...toRecord(patch),
      modelId
    };
    return runtime.profileModelState.models[modelId];
  }
  function updateProfileModelBusy(runtime, modelId, busy, lastError) {
    return updateProfileModelEntry(runtime, modelId, {
      busy: busy === true,
      lastError: lastError || null
    });
  }
  return {
    readProfileModelDescriptor,
    readProfileModelDescriptorMap,
    reloadProfileModelState,
    saveProfileModelState,
    saveToolState,
    updateProfileModelBusy,
    updateProfileModelEntry
  };
}
