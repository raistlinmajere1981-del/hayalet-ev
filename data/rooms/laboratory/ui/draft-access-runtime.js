export function createLaboratoryUiDraftAccessRuntime(deps) {
  const laboratoryUiDraftRuntime = deps.laboratoryUiDraftRuntime;

  function getCurrentDrafts() {
    return laboratoryUiDraftRuntime.getCurrentDrafts();
  }

  function getCurrentEditDraft() {
    return laboratoryUiDraftRuntime.getCurrentEditDraft();
  }

  function buildNestedPatch(path, value) {
    return laboratoryUiDraftRuntime.buildNestedPatch(path, value);
  }

  function syncLocalEditField(path, value) {
    laboratoryUiDraftRuntime.syncLocalEditField(path, value);
  }

  function buildCurrentDraftPayload() {
    return laboratoryUiDraftRuntime.buildCurrentDraftPayload();
  }

  return {
    buildCurrentDraftPayload: buildCurrentDraftPayload,
    buildNestedPatch: buildNestedPatch,
    getCurrentDrafts: getCurrentDrafts,
    getCurrentEditDraft: getCurrentEditDraft,
    syncLocalEditField: syncLocalEditField,
  };
}
