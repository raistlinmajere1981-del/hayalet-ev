type LaboratoryUiDraftRuntime<
  TDrafts,
  TEditDraft,
  TNestedPatch,
  TPath,
  TValue,
  TDraftPayload,
> = {
  getCurrentDrafts: () => TDrafts;
  getCurrentEditDraft: () => TEditDraft;
  buildNestedPatch: (path: TPath, value: TValue) => TNestedPatch;
  syncLocalEditField: (path: TPath, value: TValue) => void;
  buildCurrentDraftPayload: () => TDraftPayload;
};

type LaboratoryUiDraftAccessRuntimeDeps<
  TDrafts,
  TEditDraft,
  TNestedPatch,
  TPath,
  TValue,
  TDraftPayload,
> = {
  laboratoryUiDraftRuntime: LaboratoryUiDraftRuntime<
    TDrafts,
    TEditDraft,
    TNestedPatch,
    TPath,
    TValue,
    TDraftPayload
  >;
};

export function createLaboratoryUiDraftAccessRuntime<
  TDrafts,
  TEditDraft,
  TNestedPatch,
  TPath,
  TValue,
  TDraftPayload,
>(
  deps: LaboratoryUiDraftAccessRuntimeDeps<
    TDrafts,
    TEditDraft,
    TNestedPatch,
    TPath,
    TValue,
    TDraftPayload
  >,
) {
  const laboratoryUiDraftRuntime = deps.laboratoryUiDraftRuntime;

  function getCurrentDrafts(): TDrafts {
    return laboratoryUiDraftRuntime.getCurrentDrafts();
  }

  function getCurrentEditDraft(): TEditDraft {
    return laboratoryUiDraftRuntime.getCurrentEditDraft();
  }

  function buildNestedPatch(path: TPath, value: TValue): TNestedPatch {
    return laboratoryUiDraftRuntime.buildNestedPatch(path, value);
  }

  function syncLocalEditField(path: TPath, value: TValue): void {
    laboratoryUiDraftRuntime.syncLocalEditField(path, value);
  }

  function buildCurrentDraftPayload(): TDraftPayload {
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
