export function createLaboratoryRuntimeStorage(deps) {
  const { lifecycleRuntime, profileModelRuntime, toRecord } = deps;
  async function loadRuntimeConfigs(api, runtime) {
    return lifecycleRuntime.loadRuntimeConfigs(api, runtime);
  }
  async function loadProjects(runtime) {
    return lifecycleRuntime.loadProjects(runtime);
  }
  async function saveProject(runtime, project) {
    return lifecycleRuntime.saveProject(runtime, project);
  }
  async function persistToolState(runtime) {
    return lifecycleRuntime.persistToolState(runtime);
  }
  async function persistProfileModelState(runtime) {
    return lifecycleRuntime.persistProfileModelState(runtime);
  }
  async function loadToolState(runtime) {
    return lifecycleRuntime.loadToolState(runtime);
  }
  async function loadProfileModelState(runtime) {
    return lifecycleRuntime.loadProfileModelState(runtime);
  }
  function getProfileModelDescriptorMap(runtime) {
    return toRecord(toRecord(runtime.profileModels)["models"]);
  }
  function getProfileModelDescriptor(runtime, modelId) {
    return toRecord(getProfileModelDescriptorMap(runtime)[modelId]);
  }
  async function refreshProfileModelState(runtime) {
    return profileModelRuntime.refreshProfileModelStateWithStorage(runtime);
  }
  return {
    getProfileModelDescriptor,
    getProfileModelDescriptorMap,
    loadProfileModelState,
    loadProjects,
    loadRuntimeConfigs,
    loadToolState,
    persistProfileModelState,
    persistToolState,
    refreshProfileModelState,
    saveProject
  };
}
