import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import { createLabEventBus } from "../../rooms/laboratory/runtime/lab-event-bus.ts";
import { createLabRunController } from "../../rooms/laboratory/runtime/lab-run-controller.ts";
import {
  getMediaViewportState,
  getSelectionSuggestions,
  getSourceRetryBlockReason,
  getWorkspaceLockState,
  resolveDrawerMode,
} from "../../rooms/laboratory/runtime/lab-selectors.ts";
import { renderLabDrawer } from "../../rooms/laboratory/ui/lab-drawer.ts";
import { createLabI18n } from "../../rooms/laboratory/ui/lab-i18n.ts";
import { renderLabProcessStrip } from "../../rooms/laboratory/ui/lab-process-strip.ts";
import { renderWorkspaceSurface } from "../../rooms/laboratory/ui/workspace-surface.ts";
import type { LabRun } from "../../rooms/laboratory/models/lab-types.ts";
import { FakeActionElement, FakeControllerDocument } from "./laboratory-runtime-truth.helpers.ts";

const enTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/en.json", "utf8"));
const trTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/tr.json", "utf8"));

function createReadyStore() {
  const store = createLabStore();
  store.dispatch({
    type: "snapshot-received",
    payload: {
      featureId: "media-analysis",
      ready: true,
      activeProjectId: "project-1",
      projectIndex: {
        activeProjectId: "project-1",
        projects: [{ id: "project-1", name: "lab-demo.mp4", hasSource: true }],
      },
      activeProject: {
        id: "project-1",
        name: "lab-demo.mp4",
        source: {
          status: "ready",
          kind: "video",
          mode: "local",
          storedPath: "/tmp/lab-demo.mp4",
          storedFileName: "lab-demo.mp4",
          previewUrl: "file:///tmp/lab-demo.mp4",
          routeLabel: "Local Copy",
          metadata: {
            durationSeconds: 12,
            height: 360,
            sizeBytes: 42000,
            width: 640,
          },
        },
        edit: {},
        profile: { preflight: {} },
        process: { records: {} },
        report: { records: {} },
        assets: [],
      },
      sourceProbeStatus: "completed",
      toolState: {
        tools: {
          "yt-dlp": { installed: true },
        },
      },
      reports: {
        user: null,
        ai: null,
        emptyReason: "Rapor henüz üretilmedi.",
      },
      activityFeed: [],
    },
  });
  return store;
}

function setRun(
  state: ReturnType<ReturnType<typeof createLabStore>["getState"]>,
  patch: Partial<LabRun> = {}
) {
  state.run = {
    id: "run-wireframe-v2",
    state: "running",
    startedAt: Date.now() - 1000,
    modules: {},
    moduleOrder: [],
    events: [],
    rawLog: [],
    artifacts: [],
    findings: [],
    liveFindings: [],
    warnings: [],
    error: null,
    targetLabel: null,
    progress: null,
    emptyReason: null,
    analysisScope: null,
    previewArtifacts: [],
    confidence: null,
    moduleTrace: [],
    comparisonVariants: [],
    hypothesisSummary: null,
    ...patch,
  };
}

test("laboratory wireframe v2 derives active-run workspace locks and blocks locked store mutations", () => {
  const store = createReadyStore();
  store.dispatch({ type: "workspace-timeline-updated", startMs: 1000, endMs: 3000 });
  store.dispatch({ type: "workspace-hypothesis-updated", text: "pre-run hypothesis" });
  store.dispatch({ type: "workspace-intent-set", intents: ["visual-inspection"] });

  setRun(store.getState());

  assert.deepEqual(getWorkspaceLockState(store.getState()), {
    source: true,
    timeline: true,
    roi: true,
    intents: true,
    hypothesis: true,
    focusControls: false,
  });
  assert.equal(getMediaViewportState(store.getState()), "active");

  store.dispatch({ type: "workspace-timeline-updated", startMs: 2000, endMs: 4000 });
  store.dispatch({ type: "workspace-hypothesis-updated", text: "mutated" });
  store.dispatch({ type: "workspace-intent-toggled", intentId: "audio-investigation" });
  store.dispatch({
    type: "selection-roi-updated",
    roi: { x: 0.1, y: 0.1, width: 0.3, height: 0.3 },
  });
  store.dispatch({ type: "workspace-interactive-updated", patch: { brightness: 112 } });

  const state = store.getState();
  assert.equal(state.ui.workspace.timelineStartMs, 1000);
  assert.equal(state.ui.workspace.timelineEndMs, 3000);
  assert.equal(state.ui.workspace.hypothesis, "pre-run hypothesis");
  assert.deepEqual(state.ui.workspace.selectedIntents, ["visual-inspection"]);
  assert.equal(state.ui.workspace.activeSelection?.roi, undefined);
  assert.equal(state.ui.workspace.interactiveSettings.brightness, 112);
});

test("laboratory wireframe v2 renders locked timeline and roi without native preview controls", () => {
  const store = createReadyStore();
  store.dispatch({ type: "workspace-timeline-updated", startMs: 1000, endMs: 3000 });
  setRun(store.getState());

  const surface = renderWorkspaceSurface(store.getState());

  assert.match(surface.main, /data-timeline-locked="true"/);
  assert.match(surface.main, /data-lab-roi-mutation-locked="true"/);
  assert.doesNotMatch(surface.main, /data-lab-field="workspace\.hypothesis"/);
  assert.match(surface.main, /labx-preview-media--workspace-video/);
  assert.doesNotMatch(
    surface.main,
    /labx-preview-media--workspace-video"[^>]*\scontrols(?:\s|>|=)/
  );
  assert.match(surface.main, /Visual Adjustments/);
  assert.match(surface.main, /workspace\.interactive\.brightness/);
  assert.match(surface.main, /data-lab-action="workspace-setting-adjust"/);
});

test("laboratory wireframe v2 failed source stays in setup with error viewport and idle strip", () => {
  const store = createReadyStore();
  store.dispatch({
    type: "source-probe-failed",
    action: "source-pick-local",
    detail: "probe failed",
  });

  const state = store.getState();
  const retryBlockReason = getSourceRetryBlockReason(state);
  const surface = renderWorkspaceSurface(state);
  const drawer = renderLabDrawer(state, surface);
  const strip = renderLabProcessStrip(state);

  assert.equal(getMediaViewportState(state), "error");
  assert.equal(retryBlockReason, "local-reselect-required");
  assert.equal(resolveDrawerMode(state), "setup");
  assert.match(surface.main, /data-media-viewport-state="error"/);
  assert.match(surface.main, /data-lab-action="source-probe-retry"[\s\S]*disabled/);
  assert.match(surface.main, /Choose the file again from the source panel/);
  assert.doesNotMatch(surface.main, /Yerel kaynak/);
  assert.doesNotMatch(surface.main, /class="labx-timeline"/);
  assert.doesNotMatch(drawer, /labx-drawer__intent-list/);
  assert.match(drawer, /data-lab-action="run-deep-analysis"[\s\S]*disabled/);
  assert.match(strip, /data-strip-state="idle"/);
});

test("laboratory wireframe v2 treats stale completed sources as empty viewport state", () => {
  const store = createReadyStore();
  const state = store.getState();
  state.source = {
    ...state.source,
    mode: "url",
    routeLabel: "Local Copy",
    sourceUrl: "https://example.test/source.mp4",
  };

  const surface = renderWorkspaceSurface(state);

  assert.equal(getMediaViewportState(state), "empty");
  assert.match(surface.main, /data-media-viewport-state="empty"/);
  assert.doesNotMatch(surface.main, /class="labx-timeline"/);
});

test("laboratory wireframe v2 source retry contract separates local block and replayable URLs", () => {
  const originalElement = globalThis.Element;
  const sentEvents: Array<{ eventName: string; payload: Record<string, unknown> }> = [];
  const documentRef = new FakeControllerDocument();
  const eventBus = createLabEventBus();
  const store = createReadyStore();

  class TestElement extends FakeActionElement {}

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: TestElement,
  });

  try {
    eventBus.subscribe(function (event) {
      store.dispatch(event);
    });
    const controller = createLabRunController({
      documentRef: documentRef as unknown as Document,
      eventBus,
      store,
      windowRef: {
        roomAPI: {
          sendEvent(eventName: string, payload: Record<string, unknown>) {
            sentEvents.push({ eventName, payload });
          },
        },
        addEventListener() {},
      } as unknown as Window,
    });
    controller.attach();
    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);

    store.dispatch({
      type: "source-probe-failed",
      action: "source-pick-local",
      detail: "probe failed",
    });
    clickListener?.({ target: new TestElement("source-probe-retry") } as Event);
    assert.equal(sentEvents.length, 0);
    assert.match(store.getState().activityFeed[0]?.message ?? "", /Choose the file again/);

    const state = store.getState();
    state.sourceProbeStatus = "failed";
    state.source = {
      ...state.source,
      mode: "url",
      routeLabel: "Direct URL",
      sourceUrl: "https://example.test/source.mp4",
    };
    state.ui.sourceDrafts.urlInput = "";
    clickListener?.({ target: new TestElement("source-probe-retry") } as Event);

    assert.equal(sentEvents.length, 1);
    assert.equal(sentEvents[0]?.eventName, "media-action");
    assert.equal(sentEvents[0]?.payload["action"], "source-download-url");

    state.sourceProbeStatus = "failed";
    state.source = {
      ...state.source,
      mode: "youtube",
      routeLabel: "YouTube",
      sourceUrl: "https://youtu.be/demo",
      youtubeUrl: "https://youtu.be/demo",
    };
    state.ui.sourceDrafts.youtubeUrl = "";
    state.toolState = { tools: { "yt-dlp": { installed: false } } };
    clickListener?.({ target: new TestElement("source-probe-retry") } as Event);
    assert.equal(sentEvents.length, 1);
    assert.match(store.getState().activityFeed[0]?.message ?? "", /yt-dlp is required/);

    store.getState().toolState = { tools: { "yt-dlp": { installed: true } } };
    clickListener?.({ target: new TestElement("source-probe-retry") } as Event);
    assert.equal(sentEvents.length, 2);
    assert.equal(sentEvents[1]?.payload["action"], "source-download-youtube");
  } finally {
    if (originalElement === undefined) {
      delete (globalThis as Record<string, unknown>).Element;
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

test("laboratory wireframe v2 result drawer uses localized decision labels and advisory defaults", () => {
  const store = createReadyStore();
  store.dispatch({ type: "workspace-timeline-updated", startMs: 1000, endMs: 3000 });

  const state = store.getState();
  const suggestions = getSelectionSuggestions(state);
  assert.ok(suggestions.length > 0);
  state.ui.activeExecutionIntentId = suggestions[0]!.id;
  setRun(state, {
    state: "completed",
    endedAt: Date.now(),
  });
  state.reports.user = {
    summary: "Report ready",
    confidence: "high",
    topFindings: [],
    suspiciousFrames: [],
    hypothesisResult: null,
    elapsedSeconds: 1,
    moduleSummary: [],
  };

  const trCopy = createLabI18n({ locale: "tr", translations: trTranslations });
  const enCopy = createLabI18n({ locale: "en", translations: enTranslations });
  const trDrawer = renderLabDrawer(state, renderWorkspaceSurface(state, { copy: trCopy }), trCopy);
  const enDrawer = renderLabDrawer(state, renderWorkspaceSurface(state, { copy: enCopy }), enCopy);

  assert.match(trDrawer, /data-decision-card="candidate"[\s\S]*(Gecerli|Dengesiz|Gecersiz)/);
  assert.match(trDrawer, /data-decision-card="commitment"[\s\S]*-/);
  assert.match(trDrawer, /data-decision-card="staging"[\s\S]*(Hazir|Beklemede|-)/);
  assert.match(enDrawer, /data-decision-card="candidate"[\s\S]*(Valid|Unstable|Invalid)/);
  assert.doesNotMatch(trDrawer, /<strong>viable<\/strong>|<strong>not-viable<\/strong>/);
});

test("laboratory wireframe v2 process strip covers partial, cancelled, and indeterminate states", () => {
  const partialStore = createReadyStore();
  setRun(partialStore.getState(), {
    state: "completed",
    endedAt: Date.now(),
    moduleOrder: ["source", "planner", "audio", "decision", "staging"],
    modules: {
      source: {
        id: "source",
        status: "completed",
        message: null,
        progress: 100,
        progressMode: "measured",
      },
      planner: {
        id: "planner",
        status: "completed",
        message: null,
        progress: 100,
        progressMode: "measured",
      },
      audio: {
        id: "audio",
        title: "Audio",
        status: "completed",
        message: null,
        progress: 100,
        progressMode: "measured",
      },
      decision: {
        id: "decision",
        status: "completed",
        message: null,
        progress: 100,
        progressMode: "measured",
      },
      staging: {
        id: "staging",
        status: "completed",
        message: null,
        progress: 100,
        progressMode: "measured",
      },
    },
    moduleTrace: [
      {
        id: "trace-audio-warning",
        moduleId: "audio",
        stage: "evaluate",
        status: "module-warning",
        timestamp: new Date().toISOString(),
        message: "audio module returned partial confidence",
        detail: "audio module returned partial confidence",
        eventId: "event-audio-warning",
      },
    ],
    warnings: ["audio module returned partial confidence"],
  });
  const trCopy = createLabI18n({ locale: "tr", translations: trTranslations });
  const enCopy = createLabI18n({ locale: "en", translations: enTranslations });
  const partialStrip = renderLabProcessStrip(partialStore.getState(), trCopy);
  const englishPartialStrip = renderLabProcessStrip(partialStore.getState(), enCopy);
  assert.match(partialStrip, /data-strip-state="partial"/);
  assert.match(partialStrip, /data-step="evaluate" data-dot="warning"/);
  assert.doesNotMatch(partialStrip, /data-step="stage" data-dot="warning"/);
  assert.match(partialStrip, /Tamamlandi \(uyarilarla\)/);
  assert.match(englishPartialStrip, /Completed with warnings/);

  const cancelledStore = createReadyStore();
  setRun(cancelledStore.getState(), {
    state: "cancelled",
    endedAt: Date.now(),
    moduleOrder: ["visual", "audio"],
    modules: {
      visual: {
        id: "visual",
        status: "completed",
        message: null,
        progress: 100,
        progressMode: "measured",
      },
      audio: {
        id: "audio",
        status: "cancelled",
        message: null,
        progress: null,
        progressMode: "none",
      },
    },
  });
  const cancelledStrip = renderLabProcessStrip(cancelledStore.getState());
  assert.match(cancelledStrip, /data-strip-state="cancelled"/);
  assert.doesNotMatch(cancelledStrip, /data-lab-action="run-deep-analysis"/);
  assert.doesNotMatch(cancelledStrip, /data-dot="error"/);

  const activeStore = createReadyStore();
  setRun(activeStore.getState());
  const activeStrip = renderLabProcessStrip(activeStore.getState());
  assert.match(activeStrip, /data-progress-mode="indeterminate"/);
  assert.match(activeStrip, /class="labx-strip-detail-toggle"/);
  assert.doesNotMatch(activeStrip, /data-lab-action="cancel-analysis"/);
  assert.doesNotMatch(activeStrip, /labx-strip-progress__pct">0%/);
});
