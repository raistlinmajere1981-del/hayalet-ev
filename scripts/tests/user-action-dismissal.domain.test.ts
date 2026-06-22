import {
  assert,
  createLabEventBus,
  createLabRunController,
  createLabStore,
  FakeActionElement,
  FakeControllerDocument,
  FakeDualPreviewDocument,
  FakeMediaElement,
  FakeMouseEvent,
  FakePlayheadElement,
  FakeTextElement,
  FakeTimelineActionElement,
  FakeTimelineRoot,
  FakeTimelineTrack,
  FakeWindowEventTarget,
  getActiveInspectionSnapshot,
  getActiveSelection,
  getInspectionMode,
  getRoiFocusActive,
  getSelectionDuration,
  importLabRootModuleWithDomStub,
  installTimerMock,
  isSelectionValid,
  LAB_USER_ACTION_HUB_SUCCESS_WINDOW_MS,
  test,
} from "./laboratory-runtime-truth.helpers.ts";
import { closeLabAssetMenusForClick } from "../../rooms/laboratory/runtime/controller/lab-asset-context-menu-controller.ts";
import { resolveDrawerMode } from "../../rooms/laboratory/runtime/lab-selectors.ts";

describe("user action dismissal", () => {
  void test("laboratory run controller dismisses successful user actions from the topbar after the success window", () => {
    const timerMock = installTimerMock();

    try {
      const eventBus = createLabEventBus();
      const store = createLabStore();
      eventBus.subscribe(function (event) {
        store.dispatch(event);
      });
      createLabRunController({
        documentRef: {} as Document,
        eventBus,
        store,
        windowRef: {} as Window,
      });

      eventBus.emit({
        type: "user-action-added",
        actionEvent: {
          id: "user-action-success",
          type: "export-clip",
          label: "Klip çıkarılıyor",
          status: "running",
          startedAt: Date.now() - 1000,
          dismissedFromHubAt: null,
          projectId: "project-1",
          requestId: "req-export-1",
          sourceAction: "export-timeline-clip",
        },
      });

      assert.equal(timerMock.scheduled.length, 0);

      eventBus.emit({
        type: "user-action-updated",
        id: "user-action-success",
        patch: {
          status: "success",
          finishedAt: Date.now(),
          message: "Klip hazır",
        },
      });

      assert.equal(timerMock.scheduled.length, 1);
      assert.equal(timerMock.scheduled[0]?.delay, LAB_USER_ACTION_HUB_SUCCESS_WINDOW_MS);
      assert.equal(store.getState().userActions[0]?.dismissedFromHubAt, null);

      timerMock.scheduled[0].fn();

      assert.equal(typeof store.getState().userActions[0]?.dismissedFromHubAt, "number");
    } finally {
      timerMock.restore();
    }
  });

  void test("laboratory run controller waits for linked assets before dismissing success chips", () => {
    const timerMock = installTimerMock();

    try {
      const eventBus = createLabEventBus();
      const store = createLabStore();
      eventBus.subscribe(function (event) {
        store.dispatch(event);
      });
      createLabRunController({
        documentRef: {} as Document,
        eventBus,
        store,
        windowRef: {} as Window,
      });

      eventBus.emit({
        type: "user-action-added",
        actionEvent: {
          id: "user-action-success-pending-output",
          type: "grab-frame",
          label: "Frame alınıyor",
          status: "success",
          startedAt: Date.now() - 3000,
          finishedAt: Date.now() - 1000,
          message: "Frame alındı",
          requestId: "req-frame-success",
          resultAssetIds: ["asset-frame-result"],
          sourceAction: "export-frame-grab",
        },
      });

      assert.equal(timerMock.scheduled.length, 0);

      eventBus.emit({
        type: "asset-added",
        asset: {
          id: "asset-frame-result",
          type: "frame",
          name: "frame_01.png",
          localPath: "/tmp/frame_01.png",
          createdAt: Date.now(),
        },
      });

      assert.equal(timerMock.scheduled.length, 1);
      assert.equal(timerMock.scheduled[0]?.delay, LAB_USER_ACTION_HUB_SUCCESS_WINDOW_MS);
    } finally {
      timerMock.restore();
    }
  });
});
