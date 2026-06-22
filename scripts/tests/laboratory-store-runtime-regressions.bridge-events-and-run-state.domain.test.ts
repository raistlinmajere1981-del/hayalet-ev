import { assert, createLabHostBridge, createLabStore, test } from "./laboratory-runtime-truth.helpers.ts";

describe("bridge events and run state", () => {
  void test("laboratory bridge forwards only canonical lab events into the store", () => {
    const emitted: string[] = [];
    const bridge = createLabHostBridge({
      emit(event) {
        emitted.push(event.type);
      },
    });

    bridge.handleHostMessage({
      type: "media-job",
      payload: {
        action: "process-run",
        stage: "queued",
        toolId: "ffmpeg",
        featureStage: "process",
      },
    });

    bridge.handleHostMessage({
      type: "lab-event",
      payload: {
        id: "evt-run-1",
        kind: "activity",
        severity: "info",
        message: "Analiz basladi",
        detail: null,
        timestamp: Date.now(),
        source: "host",
        action: "process-run",
        stage: "queued",
        scope: "run",
        moduleId: null,
        rawLine: null,
      },
    });

    assert.deepEqual(emitted, ["host-event-received"]);
  });
  void test("laboratory store derives run state from canonical events without inventing modules", () => {
    const store = createLabStore();
    store.dispatch({
      type: "host-event-received",
      event: {
        id: "evt-run",
        kind: "activity",
        severity: "info",
        message: "Analiz basladi",
        detail: null,
        timestamp: Date.now(),
        source: "host",
        action: "process-run",
        stage: "running",
        scope: "run",
        moduleId: null,
        rawLine: null,
      },
    });

    const state = store.getState();
    assert.equal(state.run?.state, "running");
    assert.deepEqual(state.run.moduleOrder, []);
  });
});
