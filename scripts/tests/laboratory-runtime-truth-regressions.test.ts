import test from "node:test";
import assert from "node:assert/strict";
import { createLabHostBridge } from "../../rooms/laboratory/runtime/lab-host-bridge.ts";
import {
  getIntentDirtyMap,
  getReportFreshness,
  getRunSnapshotSummary,
  getWorkspaceDiff,
} from "../../rooms/laboratory/runtime/lab-selectors.ts";
import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import { extractFindings } from "../../rooms/laboratory/services/finding-engine.ts";
import { parseProcessOutput } from "../../rooms/laboratory/services/process-output-parser.ts";

test("laboratory process output parser translates known ffmpeg and download lines", () => {
  const blackdetectEvent = parseProcessOutput("blackdetect=duration:0.42");
  const frameEvent = parseProcessOutput("frame= 248 fps=24");
  const downloadEvent = parseProcessOutput("[download] 42.1% of 12.31MiB");
  const subtitleEvent = parseProcessOutput("subtitle stream has 12 entries");
  const mergeEvent = parseProcessOutput("Merging formats into \"clip.mp4\"");

  assert.equal(blackdetectEvent?.message, "Siyah sahne tespiti calisiyor");
  assert.equal(blackdetectEvent?.moduleId, "motion");
  assert.equal(frameEvent?.detail, "248 kare incelendi");
  assert.equal(downloadEvent?.message, "Kaynak indiriliyor");
  assert.equal(downloadEvent?.scope, "global");
  assert.equal(subtitleEvent?.message, "Altyazi girdisi taraniyor");
  assert.equal(mergeEvent?.message, "Kaynak birlestiriliyor");
});

test("laboratory process output parser leaves unknown lines in raw-log only flow", () => {
  const unknownEvent = parseProcessOutput("totally unknown tool output");
  assert.equal(unknownEvent, null);
});

test("laboratory finding engine derives findings from semantic events and stays quiet on thin runs", () => {
  const anomalyFindings = extractFindings([
    {
      id: "evt-1",
      kind: "activity",
      severity: "info",
      message: "Siyah sahne segmenti bulundu",
      detail: "black_start:12.5",
      timestamp: Date.now(),
      source: "host",
      action: "process-run",
      stage: "stdout",
      scope: "run",
      moduleId: "motion",
      rawLine: "black_start:12.5",
    },
    {
      id: "evt-2",
      kind: "activity",
      severity: "info",
      message: "Freeze segmenti bulundu",
      detail: "freeze_duration:1.2",
      timestamp: Date.now(),
      source: "host",
      action: "process-run",
      stage: "stdout",
      scope: "run",
      moduleId: "motion",
      rawLine: "freeze_duration:1.2",
    },
  ]);

  assert.equal(anomalyFindings.length >= 2, true);
  assert.equal(anomalyFindings.some((entry) => entry.title.includes("Siyah sahne")), true);
  assert.equal(anomalyFindings.some((entry) => entry.title.includes("Freeze")), true);

  const noAnomalyFindings = extractFindings([
    {
      id: "evt-coverage",
      kind: "activity",
      severity: "info",
      message: "Kare analizi aktif",
      detail: "248 kare incelendi",
      timestamp: Date.now(),
      source: "host",
      action: "process-run",
      stage: "stdout",
      scope: "run",
      moduleId: "motion",
      rawLine: "frame=248",
    },
    {
      id: "evt-3",
      kind: "activity",
      severity: "success",
      message: "Analiz tamamlandi",
      detail: null,
      timestamp: Date.now(),
      source: "host",
      action: "process-run",
      stage: "completed",
      scope: "run",
      moduleId: null,
      rawLine: null,
    },
  ]);

  assert.equal(noAnomalyFindings.length, 1);
  assert.equal(noAnomalyFindings[0]?.title, "Belirgin anomali tespit edilmedi");

  const thinRunFindings = extractFindings([
    {
      id: "evt-4",
      kind: "activity",
      severity: "success",
      message: "Analiz tamamlandi",
      detail: null,
      timestamp: Date.now(),
      source: "host",
      action: "process-run",
      stage: "completed",
      scope: "run",
      moduleId: null,
      rawLine: null,
    },
  ]);

  assert.equal(thinRunFindings.length, 0);
});

test("laboratory bridge forwards only canonical lab events into the store", () => {
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

test("laboratory store derives run state from canonical events without inventing modules", () => {
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
  assert.deepEqual(state.run?.moduleOrder, []);
});

test("laboratory store wires live findings and preview artifacts from custom runtime events", () => {
  const store = createLabStore();
  const eventTimestamp = Date.now();
  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-scope",
      kind: "analysis-scope-updated",
      severity: "info",
      message: "Analysis scope locked",
      detail: "Visual ROI active",
      timestamp: eventTimestamp,
      source: "host",
      action: "process-run",
      stage: "running",
      scope: "run",
      moduleId: null,
      rawLine: null,
      analysisScope: {
        focus: "visual",
        hypothesis: "gorunmeyen obje olabilir",
        region: {
          x: 12,
          y: 18,
          width: 160,
          height: 90,
        },
      },
    },
  });
  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-live",
      kind: "live-finding",
      severity: "warning",
      message: "Live finding emitted",
      detail: "Edge cluster batched",
      timestamp: eventTimestamp + 1,
      source: "host",
      action: "process-run",
      stage: "running",
      scope: "run",
      moduleId: "motion",
      rawLine: null,
      finding: {
        id: "finding-live-1",
        moduleId: "motion",
        title: "Edge cluster anomaly",
        detail: "Contrast window exposed a hidden contour.",
        level: "medium",
        confidence: "medium",
        kind: "derived",
        evidenceCount: 3,
        artifactIds: ["preview-live-1"],
        frameRange: {
          startFrame: 12,
          endFrame: 24,
        },
      },
      moduleTrace: {
        id: "trace-live-1",
        moduleId: "motion",
        stage: "process",
        status: "finding",
        timestamp: new Date(eventTimestamp + 1).toISOString(),
        message: "Live finding emitted",
        detail: "Edge cluster batched",
      },
      throttleWindow: "motion-module-batch",
    },
  });
  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-preview",
      kind: "preview-artifact",
      severity: "info",
      message: "Preview artifact ready",
      detail: "Frame preview",
      timestamp: eventTimestamp + 2,
      source: "host",
      action: "process-run",
      stage: "running",
      scope: "run",
      moduleId: "motion",
      rawLine: null,
      artifact: {
        id: "preview-live-1",
        moduleId: "motion",
        kind: "frame-preview",
        label: "Frame preview",
        path: "/tmp/frame-preview.png",
        fileName: "frame-preview.png",
        previewUrl: "file:///tmp/frame-preview.png",
        createdAt: new Date(eventTimestamp + 2).toISOString(),
        active: true,
      },
    },
  });

  const state = store.getState();
  assert.equal(state.run?.analysisScope?.focus, "visual");
  assert.equal(state.run?.analysisScope?.hypothesis, "gorunmeyen obje olabilir");
  assert.equal(state.run?.liveFindings[0]?.id, "finding-live-1");
  assert.equal(state.run?.liveFindings[0]?.windowKey, "motion-module-batch");
  assert.equal(state.run?.previewArtifacts[0]?.id, "preview-live-1");
  assert.equal(state.ui.activePreviewArtifactId, "preview-live-1");
  assert.equal(
    state.run?.moduleTrace.some(function (entry) {
      return entry.id === "trace-live-1";
    }),
    true
  );
});

test("laboratory store hydration normalizes live runs into safe persisted summaries", () => {
  const store = createLabStore();
  store.dispatch({
    type: "hydrate",
    payload: {
      currentStage: "process",
      featureId: "media-analysis",
      projectIndex: {
        activeProjectId: "project-1",
        projects: [],
      },
      workbench: {},
      sourceProbeStatus: "idle",
      reports: {
        user: null,
        ai: null,
        emptyReason: "Rapor yok.",
      },
      activityFeed: [],
      lastRun: {
        id: "run-1",
        state: "running",
        startedAt: Date.now() - 1000,
        modules: {
          motion: {
            id: "motion",
            status: "running",
            progress: null,
            progressMode: "none",
            message: "Analiz suruyor",
          },
        },
        moduleOrder: ["motion"],
        events: [
          {
            id: "evt-persisted",
            kind: "activity",
            severity: "info",
            message: "Analiz basladi",
            detail: null,
            timestamp: Date.now() - 900,
            source: "host",
            action: "process-run",
            stage: "running",
            scope: "run",
            moduleId: null,
            rawLine: null,
          },
          {
            id: "evt-raw",
            kind: "raw-log",
            severity: "info",
            message: "frame= 24",
            detail: null,
            timestamp: Date.now() - 800,
            source: "host",
            action: "process-run",
            stage: "stdout",
            scope: "run",
            moduleId: "motion",
            rawLine: "frame= 24",
          },
        ],
        rawLog: [
          {
            id: "evt-raw",
            kind: "raw-log",
            severity: "info",
            message: "frame= 24",
            detail: null,
            timestamp: Date.now() - 800,
            source: "host",
            action: "process-run",
            stage: "stdout",
            scope: "run",
            moduleId: "motion",
            rawLine: "frame= 24",
          },
        ],
        artifacts: [],
        findings: [],
        liveFindings: [
          {
            id: "live-1",
            moduleId: "motion",
            title: "Scope-local anomaly",
            detail: "Frame window highlighted an unstable edge cluster.",
            level: "medium",
            severity: "warning",
            confidence: "medium",
            kind: "derived",
            evidenceCount: 2,
            artifactIds: [],
            emittedAt: Date.now() - 850,
            windowKey: "frame-window-1",
            streamId: "media-analysis",
            frameRange: {
              startFrame: 24,
              endFrame: 48,
            },
          },
        ],
        warnings: [],
        error: null,
        targetLabel: null,
        progress: null,
        emptyReason: null,
        analysisScope: {
          frameRange: {
            startFrame: 24,
            endFrame: 48,
          },
          focus: "visual",
          hypothesis: "Gorunmeyen obje olabilir",
        },
        previewArtifacts: [
          {
            id: "preview-1",
            moduleId: "motion",
            kind: "frame-preview",
            label: "Frame preview",
            path: "/tmp/frame-preview.png",
            fileName: "frame-preview.png",
            previewUrl: "file:///tmp/frame-preview.png",
            createdAt: new Date(Date.now() - 750).toISOString(),
            status: "ready",
            active: true,
            region: {
              x: 10,
              y: 20,
              width: 120,
              height: 90,
            },
          },
        ],
        confidence: "medium",
        moduleTrace: [
          {
            id: "trace-1",
            moduleId: "motion",
            stage: "process",
            status: "running",
            timestamp: new Date(Date.now() - 950).toISOString(),
            message: "Frame batch analyzed",
            detail: "Window aggregation active",
            eventId: "evt-persisted",
          },
        ],
        comparisonVariants: [
          {
            id: "variant-1",
            kind: "gamma-scan",
            label: "Gamma Scan",
            status: "ready",
            summary: "Mid-band emphasis",
            artifactIds: ["preview-1"],
          },
        ],
        hypothesisSummary: "Gorunmeyen obje olabilir",
      },
    },
  });

  const state = store.getState();
  assert.equal(state.run?.state, "cancelled");
  assert.equal(state.run?.modules["motion"]?.status, "cancelled");
  assert.equal(state.run?.events.length, 1);
  assert.equal(state.run?.events[0]?.kind, "activity");
  assert.equal(state.run?.rawLog.length, 1);
  assert.equal(state.run?.analysisScope?.focus, "visual");
  assert.equal(state.run?.analysisScope?.lifecycle?.mutable, false);
  assert.equal(state.run?.liveFindings[0]?.windowKey, "frame-window-1");
  assert.equal(state.run?.previewArtifacts[0]?.kind, "frame-preview");
  assert.equal(state.run?.comparisonVariants[0]?.kind, "gamma-scan");
  assert.equal(state.run?.hypothesisSummary, "Gorunmeyen obje olabilir");
});

test("laboratory selectors expose frozen snapshot summary and live workspace drift separately", () => {
  const store = createLabStore();
  const baseWorkspace = store.getState().ui.workspace;

  store.dispatch({
    type: "hydrate",
    payload: {
      currentStage: "report",
      featureId: "media-analysis",
      projectIndex: {
        activeProjectId: "project-1",
        projects: [],
      },
      workbench: {},
      sourceProbeStatus: "completed",
      workspace: {
        ...baseWorkspace,
        timelineStartMs: 2400,
        timelineEndMs: 5600,
        hypothesis: "live workspace clue",
        selectedIntents: ["visual-inspection"],
      },
      reports: {
        user: {
          summary: "ready",
          confidence: "medium",
          topFindings: [],
          suspiciousFrames: [],
          hypothesisResult: "frozen clue",
          elapsedSeconds: 5,
          moduleSummary: [],
        },
        ai: null,
        emptyReason: null,
      },
      activityFeed: [],
      lastRun: {
        id: "run-1",
        state: "completed",
        startedAt: Date.now() - 5000,
        endedAt: Date.now() - 1000,
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
        progress: 100,
        emptyReason: null,
        analysisScope: {
          focus: "visual",
          timeRange: {
            startMs: 1200,
            endMs: 5400,
          },
          hypothesis: "frozen clue",
          intentIds: ["visual-inspection", "anomaly-detection"],
        },
        previewArtifacts: [],
        confidence: "medium",
        moduleTrace: [],
        comparisonVariants: [],
        hypothesisSummary: "frozen clue",
      },
    },
  });

  const state = store.getState();
  assert.deepEqual(getRunSnapshotSummary(state), {
    focus: "visual",
    timelineStartMs: 1200,
    timelineEndMs: 5400,
    hypothesis: "frozen clue",
    intentIds: ["visual-inspection", "anomaly-detection"],
  });
  assert.deepEqual(getIntentDirtyMap(state), {
    "visual-inspection": {
      intentId: "visual-inspection",
      inSnapshot: true,
      inWorkspace: true,
      dirty: true,
      changedKeys: ["timeline", "hypothesis"],
    },
    "anomaly-detection": {
      intentId: "anomaly-detection",
      inSnapshot: true,
      inWorkspace: false,
      dirty: true,
      changedKeys: ["selection", "timeline", "hypothesis"],
    },
  });
  assert.deepEqual(getWorkspaceDiff(state), {
    timelineChanged: true,
    hypothesisChanged: true,
    intentsChanged: true,
    workspaceDirty: true,
    changedKeys: ["timeline", "hypothesis", "intents"],
  });
  assert.deepEqual(getReportFreshness(state), {
    state: "current",
    workspaceDirty: true,
  });
  assert.deepEqual(state.run?.analysisScope?.intentIds, ["visual-inspection", "anomaly-detection"]);
  assert.deepEqual(state.ui.workspace.selectedIntents, ["visual-inspection"]);
});
