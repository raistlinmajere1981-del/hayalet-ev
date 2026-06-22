import {
  assert,
  createLabHostBridge,
  createLabStore,
  extractFindings,
  getActionOutputs,
  getAssetById,
  getAssets,
  getAssetsByRun,
  getAssetsBySource,
  getAssetsByType,
  getCurrentSourceAsset,
  getDualPreviewVolume,
  getLinkedAudioAssets,
  getParentSourceForAsset,
  getSelectedDualPreviewAudioAsset,
  isDualPreviewActive,
  isDualPreviewAvailable,
  parseProcessOutput,
  test,
} from "./laboratory-runtime-truth.helpers.ts";
import { loadLabPersistedState } from "../../rooms/laboratory/runtime/lab-persistence.ts";

describe("asset selectors and operations", () => {
  void test("laboratory action output selector resolves linked assets and ignores stale ids", () => {
    const store = createLabStore();

    store.dispatch({
      type: "asset-added",
      asset: {
        id: "asset-frame-result",
        type: "frame",
        name: "frame_01.png",
        localPath: "/tmp/frame_01.png",
        createdAt: 200,
      },
    });
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "asset-report-result",
        type: "report",
        name: "report.md",
        localPath: "/tmp/report.md",
        createdAt: 300,
      },
    });
    store.dispatch({
      type: "user-action-added",
      actionEvent: {
        id: "user-action-result",
        type: "grab-frame",
        label: "Frame alınıyor",
        status: "success",
        startedAt: Date.now() - 1000,
        finishedAt: Date.now(),
        message: "Frame alındı",
        requestId: "req-frame-result",
        projectId: null,
        resultAssetIds: ["asset-frame-result", "asset-missing", "asset-report-result"],
        sourceAction: "export-frame-grab",
      },
    });

    assert.deepEqual(
      getActionOutputs(store.getState(), "user-action-result").map((asset) => asset.id),
      ["asset-frame-result", "asset-report-result"]
    );
    assert.deepEqual(getActionOutputs(store.getState(), "user-action-missing"), []);
  });
  void test("laboratory operation outputs replace the targeted workspace media", () => {
    const store = createLabStore();

    store.dispatch({
      type: "asset-added",
      asset: {
        id: "asset-primary",
        type: "image",
        name: "primary.png",
        localPath: "/tmp/primary.png",
        createdAt: 100,
      },
    });
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "asset-reference",
        type: "image",
        name: "reference.png",
        localPath: "/tmp/reference.png",
        createdAt: 101,
      },
    });
    store.dispatch({ type: "workspace-asset-selected", assetId: "asset-primary" });
    store.dispatch({ type: "workspace-comparison-reference-set", assetId: "asset-reference" });
    store.dispatch({
      type: "selection-roi-updated",
      comparisonSide: "primary",
      roi: { x: 0.1, y: 0.1, width: 0.3, height: 0.3 },
    });
    store.dispatch({
      type: "selection-roi-updated",
      comparisonSide: "reference",
      roi: { x: 0.2, y: 0.2, width: 0.4, height: 0.4 },
    });
    store.dispatch({
      type: "workspace-operation-output-applied",
      assetId: "asset-primary-crop",
      comparisonSide: "primary",
    });
    store.dispatch({
      type: "workspace-operation-output-applied",
      assetId: "asset-reference-crop",
      comparisonSide: "reference",
    });

    assert.equal(store.getState().ui.activeWorkspaceAssetId, "asset-primary-crop");
    assert.equal(store.getState().ui.workspace.comparisonReferenceAssetId, "asset-reference-crop");
    assert.equal(store.getState().ui.workspace.comparisonRois.primary, null);
    assert.equal(store.getState().ui.workspace.comparisonRois.reference, null);

    store.dispatch({
      type: "workspace-operation-output-applied",
      assetId: "asset-single-crop",
      comparisonSide: "single",
    });

    assert.equal(store.getState().ui.activeWorkspaceAssetId, "asset-single-crop");
    assert.equal(store.getState().ui.workspace.comparisonReferenceAssetId, null);
  });
  void test("laboratory store no longer carries retired source project ui state", () => {
    const store = createLabStore();
    const uiState = store.getState().ui as unknown as Record<string, unknown>;

    assert.equal("projectWorkspaceOpen" in uiState, false);
    assert.equal("projectWorkspaceSelectedEntityIds" in uiState, false);
    assert.equal("projectWorkspaceSort" in uiState, false);
    assert.equal("projectWorkspaceFilter" in uiState, false);
    assert.equal("projectWorkspaceGroup" in uiState, false);
    assert.equal("projectWorkspaceSearch" in uiState, false);
    assert.equal("projectWorkspaceConfirmReplace" in uiState, false);
    assert.equal("projectWorkspaceTimelineHighlight" in uiState, false);
  });
});
