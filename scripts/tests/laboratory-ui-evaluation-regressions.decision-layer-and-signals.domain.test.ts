import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLabDecisionSnapshot,
  deriveLabDecisionSignals,
  deriveLabDecisionSignalsFromState,
  readLabDecisionActiveBlocks,
  resolveLabDecisionIntent,
  resolveLabDecisionState,
} from "../../rooms/laboratory/ui/lab-decision-layer.ts";
import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import type { LabRun } from "../../rooms/laboratory/domain/lab-types.ts";

describe("decision layer and signals", () => {
  void test("laboratory decision layer maps compact signals into the intent backbone", () => {
    assert.deepEqual(
      deriveLabDecisionSignals({
        hasResult: false,
        hasSelection: false,
        hasSource: false,
        isRunning: false,
      }),
      []
    );
    assert.deepEqual(
      deriveLabDecisionSignals({
        hasResult: true,
        hasSelection: true,
        hasSource: true,
        isRunning: true,
      }),
      ["has-selection", "has-source", "is-running", "has-result"]
    );

    assert.equal(
      resolveLabDecisionIntent("setup", ["has-selection", "has-source"]),
      "ready-to-run"
    );
    assert.equal(resolveLabDecisionIntent("setup", ["has-selection"]), "preparing-analysis");
    assert.equal(resolveLabDecisionIntent("running", []), "running-analysis");
    assert.equal(resolveLabDecisionIntent("result", []), "reviewing-results");
    assert.equal(resolveLabDecisionIntent("explore", []), "exploring-alternatives");
    assert.equal(resolveLabDecisionIntent("unknown", []), "idle");

    assert.equal(resolveLabDecisionState("ready-to-run"), "ready");
    assert.equal(resolveLabDecisionState("running-analysis"), "running");
    assert.equal(resolveLabDecisionState("reviewing-results"), "done");
    assert.equal(resolveLabDecisionState("exploring-alternatives"), "done");
    assert.equal(resolveLabDecisionState("preparing-analysis"), "idle");
    assert.equal(resolveLabDecisionState("idle"), "idle");
  });
  void test("laboratory decision layer reads active pipeline blocks in rendered DOM order", () => {
    const shell = {
      querySelectorAll(selector: string) {
        assert.equal(selector, ".labx-pipeline-block");
        return [
          {
            getAttribute(name: string) {
              return name === "data-block-id" ? "analysis-prep" : null;
            },
          },
          {
            getAttribute() {
              return "";
            },
          },
          {
            getAttribute() {
              return null;
            },
          },
          {
            getAttribute(name: string) {
              return name === "data-block-id" ? "preflight" : null;
            },
          },
          {
            getAttribute(name: string) {
              return name === "data-block-id" ? "analysis-prep" : null;
            },
          },
        ];
      },
    };

    assert.deepEqual(readLabDecisionActiveBlocks(shell as unknown as ParentNode), [
      "analysis-prep",
      "preflight",
      "analysis-prep",
    ]);
  });
  void test("laboratory decision snapshot mirrors current UI state without driving behavior", () => {
    const store = createLabStore();
    const emptySnapshot = buildLabDecisionSnapshot({
      shell: null,
      state: store.getState(),
      timestamp: 1,
    });
    assert.equal(emptySnapshot.mode, "setup");
    assert.equal(emptySnapshot.intent, "preparing-analysis");
    assert.equal(emptySnapshot.state, "idle");
    assert.deepEqual(emptySnapshot.triggers, []);

    store.dispatch({
      type: "source-config-patched",
      patch: { kind: "video", mode: "local", storedPath: "/tmp/source.mp4" },
    });
    store.dispatch({ type: "source-probe-completed", action: "source-pick-local" });
    store.dispatch({ type: "workspace-timeline-updated", startMs: 1000, endMs: 3000 });

    const readyShell = {
      querySelectorAll(selector: string) {
        if (selector !== ".labx-pipeline-block") {
          return [];
        }
        return [
          {
            getAttribute(name: string) {
              return name === "data-block-id" ? "analysis-prep" : null;
            },
          },
          {
            getAttribute(name: string) {
              return name === "data-block-id" ? "preflight" : null;
            },
          },
          {
            getAttribute(name: string) {
              return name === "data-block-id" ? "analysis-cta" : null;
            },
          },
        ];
      },
    };
    const readySnapshot = buildLabDecisionSnapshot({
      shell: readyShell as unknown as ParentNode,
      state: store.getState(),
      timestamp: 2,
    });

    assert.equal(readySnapshot.mode, "setup");
    assert.equal(readySnapshot.intent, "ready-to-run");
    assert.equal(readySnapshot.state, "ready");
    assert.deepEqual(readySnapshot.triggers, ["has-selection", "has-source"]);
    assert.deepEqual(readySnapshot.activeBlocks, ["analysis-prep", "preflight", "analysis-cta"]);
  });
  void test("laboratory decision signals follow UI readiness instead of raw source presence", () => {
    const store = createLabStore();
    store.dispatch({
      type: "source-config-patched",
      patch: {
        kind: "video",
        mode: "local",
        routeLabel: "youtube",
        storedPath: "/tmp/source.mp4",
      },
    });
    store.dispatch({ type: "source-probe-completed", action: "source-pick-local" });
    store.dispatch({ type: "workspace-timeline-updated", startMs: 1000, endMs: 3000 });

    const snapshot = buildLabDecisionSnapshot({
      state: store.getState(),
      timestamp: 3,
    });

    assert.deepEqual(snapshot.triggers, ["has-selection"]);
    assert.equal(snapshot.intent, "preparing-analysis");
    assert.equal(snapshot.state, "idle");
    assert.deepEqual(deriveLabDecisionSignalsFromState(store.getState()), ["has-selection"]);
  });
  void test("laboratory decision signals keep explore intent separate from result payload presence", () => {
    const store = createLabStore();
    store.dispatch({
      type: "source-config-patched",
      patch: { kind: "video", mode: "local", storedPath: "/tmp/source.mp4" },
    });
    store.dispatch({ type: "source-probe-completed", action: "source-pick-local" });
    store.dispatch({ type: "workspace-timeline-updated", startMs: 1000, endMs: 3000 });

    const state = store.getState();
    state.run = {
      analysisScope: null,
      artifacts: [],
      comparisonVariants: [],
      confidence: null,
      emptyReason: "No reportable findings.",
      endedAt: Date.now() - 1000,
      error: null,
      events: [],
      findings: [],
      hypothesisSummary: null,
      id: "run-empty-result",
      liveFindings: [],
      moduleOrder: [],
      moduleTrace: [],
      modules: {},
      previewArtifacts: [],
      progress: 100,
      rawLog: [],
      startedAt: Date.now() - 2000,
      state: "completed",
      targetLabel: null,
      warnings: [],
    } satisfies LabRun;

    const snapshot = buildLabDecisionSnapshot({
      state,
      timestamp: 4,
    });

    assert.equal(snapshot.mode, "explore");
    assert.equal(snapshot.intent, "exploring-alternatives");
    assert.equal(snapshot.state, "done");
    assert.deepEqual(snapshot.triggers, ["has-selection", "has-source"]);
  });
});
