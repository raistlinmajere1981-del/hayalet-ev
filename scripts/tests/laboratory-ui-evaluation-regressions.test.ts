import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { renderLabWaveformTimeline } from "../../rooms/laboratory/ui/lab-waveform-timeline.ts";
import { createLabI18n } from "../../rooms/laboratory/ui/lab-i18n.ts";
import {
  formatLabExpectedOutputLabel,
  formatLabUserActionDisplayText,
  translateLabRuntimeText,
} from "../../rooms/laboratory/ui/lab-runtime-i18n.ts";
import { createRoomBuiltArtifact } from "./helpers/room-installed-copy.ts";

class ElementStub {
  innerHTML = "";
  scrollTop = 0;
  dataset: Record<string, string> = {};
  classList = {
    add() {},
    remove() {},
    toggle() {},
  };

  querySelector(): null {
    return null;
  }

  querySelectorAll(): [] {
    return [];
  }

  addEventListener(): void {}

  removeEventListener(): void {}

  replaceChildren(): void {}
}

function createMinimalLaboratoryUiEnvironment() {
  const runtimeRoot = new ElementStub();
  let readyPayload: Record<string, unknown> | null = null;

  const descriptors = {
    document: Object.getOwnPropertyDescriptor(globalThis, "document"),
    navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
    window: Object.getOwnPropertyDescriptor(globalThis, "window"),
    HTMLElement: Object.getOwnPropertyDescriptor(globalThis, "HTMLElement"),
  };

  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: ElementStub,
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      language: "en-US",
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: {
        dataset: {},
        lang: "en",
        style: {
          setProperty() {},
        },
      },
      body: Object.assign(new ElementStub(), {
        style: {
          setProperty() {},
        },
      }),
      addEventListener() {},
      removeEventListener() {},
      getElementById(id: string) {
        return id === "app" ? runtimeRoot : null;
      },
      querySelector() {
        return null;
      },
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener() {},
      removeEventListener() {},
      roomAPI: {
        onHostMessage() {},
        ready(payload: Record<string, unknown>) {
          readyPayload = payload;
        },
        sendEvent() {},
      },
    },
  });

  return {
    readyPayload: () => readyPayload,
    restore() {
      Object.entries(descriptors).forEach(([key, descriptor]) => {
        if (descriptor) {
          Object.defineProperty(globalThis, key, descriptor);
        } else {
          Reflect.deleteProperty(globalThis, key);
        }
      });
    },
    runtimeRoot,
  };
}

function createExecutionReadinessTimelineModel(
  overrides: Record<string, unknown> = {}
): Parameters<typeof renderLabWaveformTimeline>[0] {
  return {
    activeSelection: {
      id: "selection-1",
      startMs: 1000,
      endMs: 3000,
      type: "clip",
      intent: "audio",
      createdAt: 1,
    },
    bookmarks: [],
    dualPreviewActive: false,
    durationMs: 4000,
    endMs: 3000,
    startMs: 1000,
    waveformSourceLabel: "Embedded audio",
    waveformSyncLabel: "Preview and waveform share the same master axis.",
    waveformWindowDurationMs: 4000,
    waveformWindowStartMs: 0,
    ...overrides,
  };
}

function extractCandidatePanelMarkup(markup: string) {
  const attrIndex = markup.indexOf('data-lab-execution-candidate="true"');
  assert.notEqual(attrIndex, -1);
  const start = markup.lastIndexOf('<div class="lab-execution-candidate"', attrIndex);
  let end = markup.indexOf('<div class="lab-execution-commitment', attrIndex);
  if (end === -1) {
    end = markup.indexOf('<div class="lab-interpretation-panel"', attrIndex);
  }
  if (end === -1) {
    end = markup.indexOf('<div\n            class="labx-timeline__selection', attrIndex);
  }
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return markup.slice(start, end);
}

function extractCommitmentPanelMarkup(markup: string) {
  const attrIndex = markup.indexOf('data-lab-execution-commitment="true"');
  assert.notEqual(attrIndex, -1);
  const start = markup.lastIndexOf('<div class="lab-execution-commitment', attrIndex);
  let end = markup.indexOf('<div class="lab-execution-staging"', attrIndex);
  if (end === -1) {
    end = markup.indexOf('<div class="lab-interpretation-panel"', attrIndex);
  }
  if (end === -1) {
    end = markup.indexOf('<div\n            class="labx-timeline__selection', attrIndex);
  }
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return markup.slice(start, end);
}

function extractStagingPanelMarkup(markup: string) {
  const attrIndex = markup.indexOf('data-lab-execution-staging="true"');
  assert.notEqual(attrIndex, -1);
  const start = markup.lastIndexOf('<div class="lab-execution-staging"', attrIndex);
  let end = markup.indexOf('<div class="lab-interpretation-panel"', attrIndex);
  if (end === -1) {
    end = markup.indexOf('<div\n            class="labx-timeline__selection', attrIndex);
  }
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return markup.slice(start, end);
}

function extractCollapsibleOpeningTag(markup: string, panelId: string) {
  const match = new RegExp(`<details[\\s\\S]*?data-panel-id="${panelId}"[\\s\\S]*?>`).exec(markup);
  assert.notEqual(match, null, `Expected collapsible panel ${panelId}`);
  return match?.[0] ?? "";
}

function extractExecutionDetailsOverlayMarkup(markup: string) {
  const attrIndex = markup.indexOf('data-lab-execution-details-overlay="true"');
  assert.notEqual(attrIndex, -1);
  const start = markup.lastIndexOf('<div class="lab-execution-details-overlay"', attrIndex);
  const end = markup.indexOf('<div\n            class="labx-timeline__selection', attrIndex);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return markup.slice(start, end);
}

function createPassiveExecutionChainFixture() {
  const activePlan = {
    id: "plan:audio-inspect:inspect-audio:audio:audio:clip:audio:1000:3000:noroi",
    suggestionId: "audio-inspect",
    actionType: "inspect-audio" as const,
    title: "Audio inspection plan",
    steps: [
      {
        id: "isolate",
        label: "Isolate",
      },
    ],
    expectedOutputs: ["Spectral profile"],
    confidence: 0.78,
  };
  const activeSimulation = {
    id: `simulation:${activePlan.id}`,
    planId: activePlan.id,
    summary: "If applied, the preview would emphasize spectral behavior.",
    predictedEffects: ["Frequency bands would read as more distinct."],
    metrics: {
      intensity: "medium" as const,
      risk: "low" as const,
      confidence: 0.78,
    },
  };
  const activeReadiness = {
    id: `readiness:${activePlan.id}`,
    planId: activePlan.id,
    status: "ready" as const,
    summary: "This looks ready to carry forward as a preview-only execution candidate.",
    confidence: 0.81,
  };
  const activePayload = {
    id: `payload:${activePlan.id}`,
    planId: activePlan.id,
    actionType: "inspect-audio",
    summary: "The dry-run bridge would describe the selected audio window.",
    dryRunShape: {
      previewInput: {
        audioWindow: {
          startMs: 1000,
          endMs: 3000,
          sourceKind: "audio",
        },
      },
      previewParameters: {
        bandFocus: "full-spectrum",
        transientScan: "enabled",
      },
      previewExpectedOutputs: ["frequencyClusters", "transientPeaks"],
    },
    readinessStatus: "ready" as const,
    readinessPassesPreview: true,
  };
  const activeReflection = {
    id: `reflection:${activePlan.id}`,
    planId: activePlan.id,
    summary: "This path appears stable as a passive dry-run decision.",
    decision: "proceed" as const,
    reasoning: ["Readiness and simulation signals align with a stable dry-run path."],
    tradeoffs: ["Audio-focused review can expose signal detail while amplifying preview bias."],
    confidence: 0.82,
  };
  const activeAlternatives = {
    id: `alternatives:${activePlan.id}`,
    planId: activePlan.id,
    summary:
      "The selected path appears stable; alternatives mainly trade precision, coverage, or tempo against that stable baseline.",
    alternatives: [
      {
        actionType: "analyze-segment",
        label: "Broader segment review",
        summary: "An alternative approach would evaluate the full selected window.",
        tradeoff: "This path would trade local clarity for higher contextual coverage.",
        relativeAdvantage: "higher-coverage" as const,
      },
    ],
    comparisonNote:
      "Compared to the selected path, these alternatives can expose different evidence at the cost of changing the current balance.",
    confidence: 0.84,
  };
  const activeCandidate = {
    id: `candidate:${activePlan.id}`,
    planId: activePlan.id,
    status: "viable" as const,
    summary: "This path is structurally ready for execution.",
    structuralIntegrity: "complete" as const,
    readinessStatus: "ready" as const,
    reflectionDecision: "proceed" as const,
    notes: ["Payload preview is structurally aligned with the readiness signal."],
    confidence: 0.87,
  };
  const activeCommitment = {
    id: `commitment:${activePlan.id}`,
    planId: activePlan.id,
    status: "committed" as const,
    candidateStatus: "viable" as const,
    summary: "This path has been consciously chosen as the current passive commitment.",
    committedAt: 1,
    notes: activeCandidate.notes,
    uncertainties: ["Alternative paths still trade precision for coverage."],
    confidence: 0.87,
  };
  const activeStaging = {
    id: `staging:${activePlan.id}`,
    planId: activePlan.id,
    status: "staged" as const,
    summary: "This path is prepared and can be staged for execution.",
    commitmentStatus: "committed" as const,
    candidateStatus: "viable" as const,
    readinessStatus: "ready" as const,
    notes: ["Alternative paths remain visible for comparison before staging."],
    warnings: ["Candidate uncertainty: Alternative paths still trade precision for coverage."],
    confidence: 0.88,
  };

  return {
    activeAlternatives,
    activeCandidate,
    activeCommitment,
    activePayload,
    activePlan,
    activeReadiness,
    activeReflection,
    activeSimulation,
    activeStaging,
  };
}

test("laboratory UI shell evaluates under minimal runtime stubs", async () => {
  const environment = createMinimalLaboratoryUiEnvironment();
  const buildArtifact = await createRoomBuiltArtifact("laboratory");

  try {
    await import(
      `${pathToFileURL(resolve(buildArtifact.rootDir, "ui/index.js")).href}?smoke=${Date.now()}`
    );

    assert.match(environment.runtimeRoot.innerHTML, /class="labx-shell"/);
    assert.match(environment.runtimeRoot.innerHTML, /data-ready="false"/);
    assert.match(environment.runtimeRoot.innerHTML, /Laboratory environment starting|Initializing/);
    assert.deepEqual(environment.readyPayload(), {
      feature: "media-analysis",
      room: "laboratory",
      stage: "ui-ready",
    });
  } finally {
    await buildArtifact.cleanup();
    environment.restore();
  }
});

test("laboratory shell routes host traffic through lab-root orchestration seams", () => {
  const uiIndexSource = readFileSync("rooms/laboratory/ui/index.ts", "utf8");
  const labRootSource = readFileSync("rooms/laboratory/ui/lab-root.ts", "utf8");
  const labLayoutSource = readFileSync("rooms/laboratory/ui/lab-layout.ts", "utf8");
  const hostBridgeSource = readFileSync("rooms/laboratory/runtime/lab-host-bridge.ts", "utf8");

  assert.match(uiIndexSource, /import "\.\/lab-root\.js";/);
  assert.match(labRootSource, /return renderWorkspaceSurface\(state, \{/);
  assert.match(labRootSource, /runtimeRoot\.innerHTML = renderLabLayout\(state, surface, copy\);/);
  assert.match(labRootSource, /const BOOT_OVERLAY_SETTLE_MS = 450;/);
  assert.match(labRootSource, /let bootBootstrapSeen = false;/);
  assert.match(labRootSource, /function getBootOverlayBootstrapStatus\(state: LabStoreState\)/);
  assert.match(labRootSource, /const bootstrapStatus = getBootOverlayBootstrapStatus\(state\);/);
  assert.match(labRootSource, /bootstrapStatus === "ready" \|\| bootstrapStatus === "error"/);
  assert.match(
    labRootSource,
    /shell\.dataset\["ready"\] = isBootOverlayActive\(state\) \? "false" : "true";/
  );
  assert.match(labRootSource, /bootBootstrapSeen = true;/);
  assert.match(labRootSource, /scheduleBootOverlayUnlock\(state\);/);
  assert.match(labRootSource, /renderToolManagementOverlay\(state, copy\)/);
  assert.match(labRootSource, /emit:\s*eventBus\.emit,/);
  assert.match(labRootSource, /roomAPI\.ready\(\{\s*feature:\s*"media-analysis",\s*room:\s*"laboratory",\s*stage:\s*"ui-ready"/);
  assert.match(labLayoutSource, /renderToolManagementOverlay\(state, copy\)/);
  assert.match(hostBridgeSource, /type === "source-state"/);
  assert.match(hostBridgeSource, /type:\s*"source-snapshot-received"/);
  assert.match(hostBridgeSource, /type === "lab-event"/);
  assert.doesNotMatch(hostBridgeSource, /buildLifecycleEventsFromHostEvent/);
});

test("laboratory shell preserves workspace preview nodes while diffing live panels", () => {
  const labRootSource = readFileSync("rooms/laboratory/ui/lab-root.ts", "utf8");
  const workspaceSurfaceSource = readFileSync("rooms/laboratory/ui/workspace-surface.ts", "utf8");

  assert.match(labRootSource, /function updateRenderedElement\(/);
  assert.match(labRootSource, /function syncChildNodes\(/);
  assert.match(labRootSource, /function canReuseElement\(/);
  assert.match(labRootSource, /const preserveKey = readPreservedMediaKey\(currentElement\) \|\| readPreservedMediaKey\(nextElement\);/);
  assert.match(labRootSource, /function readPreservedDetailsState\(/);
  assert.match(labRootSource, /element\.hasAttribute\("data-lab-interpretation-panel"\)/);
  assert.match(labRootSource, /element\.hasAttribute\("data-lab-collapsible-panel"\)/);
  assert.match(labRootSource, /currentElement\.open = preservedDetailsState;/);
  assert.match(labRootSource, /currentElement\.scrollTop = scrollTop;/);
  assert.match(
    labRootSource,
    /updateRenderedElement\(\s*documentRef,\s*centerPanel as HTMLElement,\s*renderLabCenterPanel\(surface\),\s*true\s*\);/
  );
  assert.match(
    labRootSource,
    /updateRenderedElement\(\s*documentRef,\s*rightPanel as HTMLElement,\s*renderLabRightPanel\(state, surface, copy\),\s*true\s*\);/
  );
  assert.match(
    workspaceSurfaceSource,
    /preserveKey \|\| "workspace-preview"/
  );
  assert.match(workspaceSurfaceSource, /data-lab-preserve-media="\$\{escapeHtml\(preserveKey\)\}"/);
});

test("laboratory shell persists workspace-facing state and exposes tool lifecycle controls", () => {
  const labRootSource = readFileSync("rooms/laboratory/ui/lab-root.ts", "utf8");
  const toolOverlaySource = readFileSync("rooms/laboratory/ui/tool-management-overlay.ts", "utf8");
  const workspaceSurfaceSource = readFileSync("rooms/laboratory/ui/workspace-surface.ts", "utf8");

  assert.match(labRootSource, /schemaVersion:\s*4,/);
  assert.match(labRootSource, /workspace:\s*state\.ui\.workspace,/);
  assert.match(labRootSource, /state\.run\.state === "running" \|\| state\.run\.state === "queued"/);
  assert.match(toolOverlaySource, /mediaAnalysis\.toolManager\.ariaLabel/);
  assert.match(toolOverlaySource, /data-lab-action="tool-update-all"/);
  assert.match(toolOverlaySource, /data-lab-action="tool-install"/);
  assert.match(toolOverlaySource, /data-lab-action="tool-check-updates"/);
  assert.match(workspaceSurfaceSource, /Source setup controls/);
  assert.match(workspaceSurfaceSource, /Analizi Başlat/);
  assert.match(workspaceSurfaceSource, /data-lab-action="run-deep-analysis"/);
  assert.match(workspaceSurfaceSource, /Bu analiz şunları yapacak:/);
});

test("laboratory theme widens the left rail and normalizes rail asset spacing", () => {
  const themeSource = readFileSync("rooms/laboratory/ui/lab-theme.css", "utf8");

  assert.match(themeSource, /grid-template-columns:\s*16\.8rem minmax\(0, 1fr\) minmax\(17rem, 20rem\);/);
  assert.match(themeSource, /\.labx-left-rail\s*\{[\s\S]*gap:\s*0\.8rem;[\s\S]*padding:\s*0\.85rem;/);
  assert.match(themeSource, /\.labx-project-assets\s*\{[\s\S]*gap:\s*0\.55rem;[\s\S]*padding:\s*0\.9rem 0\.95rem;/);
  assert.match(themeSource, /\.labx-project-assets__preview\s*\{[\s\S]*gap:\s*0\.45rem;[\s\S]*padding:\s*0\.42rem 0\.5rem;/);
});

test("laboratory micro inspection UI exposes roi focus precedence and lens affordances in the preview shell", () => {
  const overlaySource = readFileSync("rooms/laboratory/ui/workspace-roi-overlay.ts", "utf8");
  const surfaceSource = readFileSync("rooms/laboratory/ui/workspace-surface.ts", "utf8");
  const timelineSelectionSource = readFileSync(
    "rooms/laboratory/ui/timeline/timeline-selection.ts",
    "utf8"
  );

  assert.match(
    overlaySource,
    /data-lab-selection-roi="true"[\s\S]*data-lab-selection-roi-ignore="true"/
  );
  assert.match(overlaySource, /data-lab-selection-roi-focus-toggle="true"/);
  assert.match(overlaySource, /data-lab-selection-roi-capture="true"/);
  assert.match(surfaceSource, /data-lab-preview-inspection-stage="true"/);
  assert.match(surfaceSource, /data-lab-preview-inspection-content="true"/);
  assert.match(timelineSelectionSource, /Selection micro zoom/);
  assert.match(timelineSelectionSource, /id="lab-audio-viz-inspection"/);
});

test("laboratory selection preview exposes soft execution intent affordances without run semantics", () => {
  const timelineSelectionSource = readFileSync(
    "rooms/laboratory/ui/timeline/timeline-selection.ts",
    "utf8"
  );

  assert.match(timelineSelectionSource, /Selected action/);
  assert.match(timelineSelectionSource, /data-lab-execution-intent-accept=/);
  assert.match(timelineSelectionSource, /data-lab-execution-intent-dismiss=/);
  assert.match(timelineSelectionSource, /data-lab-execution-intent-queue=/);
  assert.match(timelineSelectionSource, /data-lab-execution-intent-clear="true"/);
  assert.match(timelineSelectionSource, /mediaAnalysis\.timeline\.intentSelected/);
  assert.match(timelineSelectionSource, /mediaAnalysis\.timeline\.wantThis/);
  assert.match(timelineSelectionSource, /mediaAnalysis\.timeline\.notNow/);
  assert.match(timelineSelectionSource, /mediaAnalysis\.timeline\.queueForLater/);
  assert.doesNotMatch(timelineSelectionSource, />Run</);
});

test("laboratory execution plan UI stays passive and derived from active intent", () => {
  const timelineSource = readFileSync("rooms/laboratory/ui/lab-waveform-timeline-render.ts", "utf8");

  assert.match(timelineSource, /data-lab-execution-plan="true"/);
  assert.match(timelineSource, /Execution plan/);
  assert.match(timelineSource, /The system would approach this by:/);
  assert.match(timelineSource, /Expected outputs/);
  assert.match(timelineSource, /Planning notes/);
  assert.doesNotMatch(timelineSource, />Run this</);
  assert.doesNotMatch(timelineSource, />Start execution</);
});

test("laboratory execution simulation UI stays passive and derived from active plan", () => {
  const timelineSource = readFileSync("rooms/laboratory/ui/lab-waveform-timeline-render.ts", "utf8");

  assert.match(timelineSource, /data-lab-execution-simulation="true"/);
  assert.match(timelineSource, /Simulation preview/);
  assert.match(timelineSource, /What would happen/);
  assert.match(timelineSource, /Simulation warnings/);
  assert.match(timelineSource, /If applied, you would observe/);
  assert.doesNotMatch(timelineSource, />Run</);
  assert.doesNotMatch(timelineSource, />Apply</);
  assert.doesNotMatch(timelineSource, />Execute</);
});

test("laboratory execution readiness UI stays passive and owned by active readiness only", () => {
  const timelineSource = readFileSync("rooms/laboratory/ui/lab-waveform-timeline-render.ts", "utf8");

  assert.match(timelineSource, /data-lab-execution-readiness="true"/);
  assert.match(timelineSource, /Execution readiness/);
  assert.match(timelineSource, /Readiness blockers/);
  assert.match(timelineSource, /Review notes/);
  assert.match(timelineSource, /Execution readiness looks stable/);
  assert.match(timelineSource, /This path needs review before any execution step/);
  assert.match(timelineSource, /This path is not yet execution-ready/);
  assert.match(
    timelineSource,
    /hasSemanticSelection && activeExecutionPlan !== null && activeExecutionSimulation !== null/
  );
  assert.doesNotMatch(timelineSource, />Run</);
  assert.doesNotMatch(timelineSource, />Execute</);
  assert.doesNotMatch(timelineSource, /Start execution/);
});

test("laboratory execution readiness render ownership stays tied to active readiness", () => {
  const previewOnlyMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeSuggestionPreview: {
        suggestionId: "audio-inspect",
        title: "Audio preview",
        steps: ["Step 1"],
        expectedOutputs: ["Output"],
      },
    })
  );
  assert.doesNotMatch(previewOnlyMarkup, /data-lab-execution-readiness="true"/);

  const queuedOnlyMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionIntent: null,
      activeSuggestionPreview: null,
      selectionSuggestions: [
        {
          id: "audio-inspect",
          label: "Inspect audio",
          actionType: "inspect-audio",
          confidence: 0.82,
        },
      ],
    })
  );
  assert.doesNotMatch(queuedOnlyMarkup, /data-lab-execution-readiness="true"/);

  const simulationMissingMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: {
        id: "plan:audio-inspect:inspect-audio:audio:audio:clip:audio:1000:3000:noroi",
        suggestionId: "audio-inspect",
        actionType: "inspect-audio",
        title: "Audio inspection plan",
        steps: [
          {
            id: "isolate",
            label: "Isolate",
          },
        ],
        expectedOutputs: ["Spectral profile"],
        confidence: 0.78,
      },
      activeExecutionSimulation: null,
      activeExecutionReadiness: null,
    })
  );
  assert.doesNotMatch(simulationMissingMarkup, /data-lab-execution-readiness="true"/);
});

test("laboratory execution payload preview UI stays passive and technical", () => {
  const timelineSource = readFileSync("rooms/laboratory/ui/lab-waveform-timeline-render.ts", "utf8");

  assert.match(timelineSource, /data-lab-execution-payload-preview="true"/);
  assert.match(timelineSource, /Execution payload \(preview\)/);
  assert.match(timelineSource, /This is how the system would structure the execution input/);
  assert.match(timelineSource, /No execution is performed/);
  assert.match(timelineSource, /Preview input/);
  assert.match(timelineSource, /Preview parameters/);
  assert.match(timelineSource, /Preview expected outputs/);
  assert.doesNotMatch(timelineSource, /safeToExecute/);
  assert.doesNotMatch(timelineSource, /safe-to-execute/);
  assert.doesNotMatch(timelineSource, />Run</);
  assert.doesNotMatch(timelineSource, />Execute</);
  assert.doesNotMatch(timelineSource, />Apply</);
  assert.doesNotMatch(timelineSource, /Start execution/);
});

test("laboratory execution payload preview render ownership stays tied to active payload", () => {
  const activePlan = {
    id: "plan:audio-inspect:inspect-audio:audio:audio:clip:audio:1000:3000:noroi",
    suggestionId: "audio-inspect",
    actionType: "inspect-audio" as const,
    title: "Audio inspection plan",
    steps: [
      {
        id: "isolate",
        label: "Isolate",
      },
    ],
    expectedOutputs: ["Spectral profile"],
    confidence: 0.78,
  };
  const activeSimulation = {
    id: `simulation:${activePlan.id}`,
    planId: activePlan.id,
    summary: "If applied, the preview would emphasize spectral behavior.",
    predictedEffects: ["Frequency bands would read as more distinct."],
    metrics: {
      intensity: "medium" as const,
      risk: "low" as const,
      confidence: 0.78,
    },
  };
  const activeReadiness = {
    id: `readiness:${activePlan.id}`,
    planId: activePlan.id,
    status: "ready" as const,
    summary: "This looks ready to carry forward as a preview-only execution candidate.",
    confidence: 0.81,
  };
  const activePayload = {
    id: `payload:${activePlan.id}`,
    planId: activePlan.id,
    actionType: "inspect-audio",
    summary: "The dry-run bridge would describe the selected audio window.",
    dryRunShape: {
      previewInput: {
        audioWindow: {
          startMs: 1000,
          endMs: 3000,
          sourceKind: "audio",
        },
      },
      previewParameters: {
        bandFocus: "full-spectrum",
        transientScan: "enabled",
      },
      previewExpectedOutputs: ["frequencyClusters", "transientPeaks"],
    },
    readinessStatus: "ready" as const,
    readinessPassesPreview: true,
  };

  const previewOnlyMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeSuggestionPreview: {
        suggestionId: "audio-inspect",
        title: "Audio preview",
        steps: ["Step 1"],
        expectedOutputs: ["Output"],
      },
    })
  );
  assert.doesNotMatch(previewOnlyMarkup, /data-lab-execution-payload-preview="true"/);

  const readinessMissingMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: activePlan,
      activeExecutionSimulation: activeSimulation,
      activeExecutionReadiness: null,
      activeExecutionPayloadPreview: activePayload,
    })
  );
  assert.doesNotMatch(readinessMissingMarkup, /data-lab-execution-payload-preview="true"/);

  const payloadMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: activePlan,
      activeExecutionSimulation: activeSimulation,
      activeExecutionReadiness: activeReadiness,
      activeExecutionPayloadPreview: activePayload,
    })
  );
  assert.match(payloadMarkup, /data-lab-execution-payload-preview="true"/);
  assert.match(payloadMarkup, /frequencyClusters/);
  assert.match(payloadMarkup, /bandFocus/);
});

test("laboratory execution reflection UI stays passive and advisory", () => {
  const timelineSource = readFileSync("rooms/laboratory/ui/lab-waveform-timeline-render.ts", "utf8");

  assert.match(timelineSource, /data-lab-execution-reflection="true"/);
  assert.match(timelineSource, /Execution reflection/);
  assert.match(timelineSource, /This path appears stable/);
  assert.match(timelineSource, /This path may require additional review/);
  assert.match(timelineSource, /This path is not recommended in its current form/);
  assert.match(timelineSource, /Reasoning/);
  assert.match(timelineSource, /Tradeoffs/);
  assert.match(timelineSource, /Alternatives/);
  assert.doesNotMatch(timelineSource, />\s*Run\s*</);
  assert.doesNotMatch(timelineSource, />\s*Execute\s*</);
  assert.doesNotMatch(timelineSource, />\s*Apply\s*</);
  assert.doesNotMatch(timelineSource, /Start execution/);
});

test("laboratory execution reflection render ownership stays tied to active reflection", () => {
  const activePlan = {
    id: "plan:audio-inspect:inspect-audio:audio:audio:clip:audio:1000:3000:noroi",
    suggestionId: "audio-inspect",
    actionType: "inspect-audio" as const,
    title: "Audio inspection plan",
    steps: [
      {
        id: "isolate",
        label: "Isolate",
      },
    ],
    expectedOutputs: ["Spectral profile"],
    confidence: 0.78,
  };
  const activeSimulation = {
    id: `simulation:${activePlan.id}`,
    planId: activePlan.id,
    summary: "If applied, the preview would emphasize spectral behavior.",
    predictedEffects: ["Frequency bands would read as more distinct."],
    metrics: {
      intensity: "medium" as const,
      risk: "low" as const,
      confidence: 0.78,
    },
  };
  const activeReadiness = {
    id: `readiness:${activePlan.id}`,
    planId: activePlan.id,
    status: "ready" as const,
    summary: "This looks ready to carry forward as a preview-only execution candidate.",
    confidence: 0.81,
  };
  const activePayload = {
    id: `payload:${activePlan.id}`,
    planId: activePlan.id,
    actionType: "inspect-audio",
    summary: "The dry-run bridge would describe the selected audio window.",
    dryRunShape: {
      previewInput: {
        audioWindow: {
          startMs: 1000,
          endMs: 3000,
          sourceKind: "audio",
        },
      },
      previewParameters: {
        bandFocus: "full-spectrum",
        transientScan: "enabled",
      },
      previewExpectedOutputs: ["frequencyClusters", "transientPeaks"],
    },
    readinessStatus: "ready" as const,
    readinessPassesPreview: true,
  };
  const activeReflection = {
    id: `reflection:${activePlan.id}`,
    planId: activePlan.id,
    summary: "This path may require additional review before it is carried further.",
    decision: "review" as const,
    reasoning: ["Payload preview asks for additional review before this path is carried further."],
    tradeoffs: ["Audio-focused review can expose signal detail while amplifying preview bias."],
    alternatives: ["Expand selection range"],
    confidence: 0.72,
  };

  const previewOnlyMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeSuggestionPreview: {
        suggestionId: "audio-inspect",
        title: "Audio preview",
        steps: ["Step 1"],
        expectedOutputs: ["Output"],
      },
    })
  );
  assert.doesNotMatch(previewOnlyMarkup, /data-lab-execution-reflection="true"/);

  const payloadMissingMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: activePlan,
      activeExecutionSimulation: activeSimulation,
      activeExecutionReadiness: activeReadiness,
      activeExecutionPayloadPreview: null,
      activeExecutionReflection: activeReflection,
    })
  );
  assert.doesNotMatch(payloadMissingMarkup, /data-lab-execution-reflection="true"/);

  const reflectionMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: activePlan,
      activeExecutionSimulation: activeSimulation,
      activeExecutionReadiness: activeReadiness,
      activeExecutionPayloadPreview: activePayload,
      activeExecutionReflection: activeReflection,
    })
  );
  assert.match(reflectionMarkup, /data-lab-execution-reflection="true"/);
  assert.match(reflectionMarkup, /data-decision="review"/);
  assert.match(reflectionMarkup, /Expand selection range/);
  assert.match(reflectionMarkup, /Payload preview asks for additional review/);
});

test("laboratory execution alternatives UI stays passive and comparative", () => {
  const timelineSource = readFileSync("rooms/laboratory/ui/lab-waveform-timeline-render.ts", "utf8");

  assert.match(timelineSource, /data-lab-execution-alternatives="true"/);
  assert.match(timelineSource, /Alternative evaluation/);
  assert.match(timelineSource, /An alternative approach would be/);
  assert.match(timelineSource, /lab-execution-alternatives__tradeoff/);
  assert.match(timelineSource, /lab-execution-alternatives__comparison/);
  assert.doesNotMatch(timelineSource, /Try this instead/);
  assert.doesNotMatch(timelineSource, /You should use/);
  assert.doesNotMatch(timelineSource, /Better option/);
  assert.doesNotMatch(timelineSource, /lab-execution-alternatives[\s\S]{0,2400}<button/);
  assert.doesNotMatch(timelineSource, />\s*Run\s*</);
  assert.doesNotMatch(timelineSource, />\s*Execute\s*</);
  assert.doesNotMatch(timelineSource, />\s*Apply\s*</);
  assert.doesNotMatch(timelineSource, /Start execution/);
});

test("laboratory execution alternatives render ownership stays tied to active reflection", () => {
  const activePlan = {
    id: "plan:audio-inspect:inspect-audio:audio:audio:clip:audio:1000:3000:noroi",
    suggestionId: "audio-inspect",
    actionType: "inspect-audio" as const,
    title: "Audio inspection plan",
    steps: [
      {
        id: "isolate",
        label: "Isolate",
      },
    ],
    expectedOutputs: ["Spectral profile"],
    confidence: 0.78,
  };
  const activeSimulation = {
    id: `simulation:${activePlan.id}`,
    planId: activePlan.id,
    summary: "If applied, the preview would emphasize spectral behavior.",
    predictedEffects: ["Frequency bands would read as more distinct."],
    metrics: {
      intensity: "medium" as const,
      risk: "low" as const,
      confidence: 0.78,
    },
  };
  const activeReadiness = {
    id: `readiness:${activePlan.id}`,
    planId: activePlan.id,
    status: "ready" as const,
    summary: "This looks ready to carry forward as a preview-only execution candidate.",
    confidence: 0.81,
  };
  const activePayload = {
    id: `payload:${activePlan.id}`,
    planId: activePlan.id,
    actionType: "inspect-audio",
    summary: "The dry-run bridge would describe the selected audio window.",
    dryRunShape: {
      previewInput: {
        audioWindow: {
          startMs: 1000,
          endMs: 3000,
          sourceKind: "audio",
        },
      },
      previewParameters: {
        bandFocus: "full-spectrum",
        transientScan: "enabled",
      },
      previewExpectedOutputs: ["frequencyClusters", "transientPeaks"],
    },
    readinessStatus: "ready" as const,
    readinessPassesPreview: true,
  };
  const activeReflection = {
    id: `reflection:${activePlan.id}`,
    planId: activePlan.id,
    summary: "This path appears stable as a passive dry-run decision.",
    decision: "proceed" as const,
    reasoning: ["Readiness and simulation signals align with a stable dry-run path."],
    tradeoffs: ["Audio-focused review can expose signal detail while amplifying preview bias."],
    confidence: 0.82,
  };
  const activeAlternatives = {
    id: `alternatives:${activePlan.id}`,
    planId: activePlan.id,
    summary:
      "The selected path appears stable; alternatives mainly trade precision, coverage, or tempo against that stable baseline.",
    alternatives: [
      {
        actionType: "analyze-segment",
        label: "Broader segment review",
        summary: "An alternative approach would evaluate the full selected window.",
        tradeoff: "This path would trade local clarity for higher contextual coverage.",
        relativeAdvantage: "higher-coverage" as const,
      },
    ],
    comparisonNote:
      "Compared to the selected path, these alternatives can expose different evidence at the cost of changing the current balance.",
    confidence: 0.84,
  };

  const previewOnlyMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeSuggestionPreview: {
        suggestionId: "audio-inspect",
        title: "Audio preview",
        steps: ["Step 1"],
        expectedOutputs: ["Output"],
      },
    })
  );
  assert.doesNotMatch(previewOnlyMarkup, /data-lab-execution-alternatives="true"/);

  const reflectionMissingMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: activePlan,
      activeExecutionSimulation: activeSimulation,
      activeExecutionReadiness: activeReadiness,
      activeExecutionPayloadPreview: activePayload,
      activeExecutionReflection: null,
      activeExecutionAlternatives: activeAlternatives,
    })
  );
  assert.doesNotMatch(reflectionMissingMarkup, /data-lab-execution-alternatives="true"/);

  const alternativesMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: activePlan,
      activeExecutionSimulation: activeSimulation,
      activeExecutionReadiness: activeReadiness,
      activeExecutionPayloadPreview: activePayload,
      activeExecutionReflection: activeReflection,
      activeExecutionAlternatives: activeAlternatives,
    })
  );
  assert.match(alternativesMarkup, /data-lab-execution-alternatives="true"/);
  assert.match(alternativesMarkup, /Broader segment review/);
  assert.match(alternativesMarkup, /This path would trade local clarity/);
  assert.match(alternativesMarkup, /Higher Coverage/);
});

test("laboratory execution candidate UI stays passive and structural", () => {
  const timelineSource = readFileSync("rooms/laboratory/ui/lab-waveform-timeline-render.ts", "utf8");
  const candidateFunctionStart = timelineSource.indexOf("function renderExecutionCandidate");
  const candidateFunctionEnd = timelineSource.indexOf(
    "function formatCommitmentTimestamp",
    candidateFunctionStart
  );
  assert.notEqual(candidateFunctionStart, -1);
  assert.notEqual(candidateFunctionEnd, -1);
  const candidateFunctionSource = timelineSource.slice(candidateFunctionStart, candidateFunctionEnd);

  assert.match(timelineSource, /data-lab-execution-candidate="true"/);
  assert.match(timelineSource, /Execution candidate/);
  assert.match(timelineSource, /Structural integrity/);
  assert.match(timelineSource, /formatCandidateStatus/);
  assert.match(timelineSource, /formatStructuralIntegrity/);
  assert.doesNotMatch(candidateFunctionSource, /<button/);
  assert.doesNotMatch(candidateFunctionSource, /data-lab-action/);
  assert.doesNotMatch(candidateFunctionSource, /onclick/);
});

test("laboratory execution candidate render ownership stays tied to complete candidate chain", () => {
  const activePlan = {
    id: "plan:audio-inspect:inspect-audio:audio:audio:clip:audio:1000:3000:noroi",
    suggestionId: "audio-inspect",
    actionType: "inspect-audio" as const,
    title: "Audio inspection plan",
    steps: [
      {
        id: "isolate",
        label: "Isolate",
      },
    ],
    expectedOutputs: ["Spectral profile"],
    confidence: 0.78,
  };
  const activeSimulation = {
    id: `simulation:${activePlan.id}`,
    planId: activePlan.id,
    summary: "If applied, the preview would emphasize spectral behavior.",
    predictedEffects: ["Frequency bands would read as more distinct."],
    metrics: {
      intensity: "medium" as const,
      risk: "low" as const,
      confidence: 0.78,
    },
  };
  const activeReadiness = {
    id: `readiness:${activePlan.id}`,
    planId: activePlan.id,
    status: "ready" as const,
    summary: "This looks ready to carry forward as a preview-only execution candidate.",
    confidence: 0.81,
  };
  const activePayload = {
    id: `payload:${activePlan.id}`,
    planId: activePlan.id,
    actionType: "inspect-audio",
    summary: "The dry-run bridge would describe the selected audio window.",
    dryRunShape: {
      previewInput: {
        audioWindow: {
          startMs: 1000,
          endMs: 3000,
          sourceKind: "audio",
        },
      },
      previewParameters: {
        bandFocus: "full-spectrum",
        transientScan: "enabled",
      },
      previewExpectedOutputs: ["frequencyClusters", "transientPeaks"],
    },
    readinessStatus: "ready" as const,
    readinessPassesPreview: true,
  };
  const activeReflection = {
    id: `reflection:${activePlan.id}`,
    planId: activePlan.id,
    summary: "This path appears stable as a passive dry-run decision.",
    decision: "proceed" as const,
    reasoning: ["Readiness and simulation signals align with a stable dry-run path."],
    tradeoffs: ["Audio-focused review can expose signal detail while amplifying preview bias."],
    confidence: 0.82,
  };
  const activeAlternatives = {
    id: `alternatives:${activePlan.id}`,
    planId: activePlan.id,
    summary:
      "The selected path appears stable; alternatives mainly trade precision, coverage, or tempo against that stable baseline.",
    alternatives: [
      {
        actionType: "analyze-segment",
        label: "Broader segment review",
        summary: "An alternative approach would evaluate the full selected window.",
        tradeoff: "This path would trade local clarity for higher contextual coverage.",
        relativeAdvantage: "higher-coverage" as const,
      },
    ],
    comparisonNote:
      "Compared to the selected path, these alternatives can expose different evidence at the cost of changing the current balance.",
    confidence: 0.84,
  };
  const activeCandidate = {
    id: `candidate:${activePlan.id}`,
    planId: activePlan.id,
    status: "viable" as const,
    summary: "This path is structurally ready for execution.",
    structuralIntegrity: "complete" as const,
    readinessStatus: "ready" as const,
    reflectionDecision: "proceed" as const,
    notes: ["Payload preview is structurally aligned with the readiness signal."],
    confidence: 0.87,
  };

  const previewOnlyMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeSuggestionPreview: {
        suggestionId: "audio-inspect",
        title: "Audio preview",
        steps: ["Step 1"],
        expectedOutputs: ["Output"],
      },
      activeExecutionCandidate: activeCandidate,
    })
  );
  assert.doesNotMatch(previewOnlyMarkup, /data-lab-execution-candidate="true"/);

  const reflectionMissingMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: activePlan,
      activeExecutionSimulation: activeSimulation,
      activeExecutionReadiness: activeReadiness,
      activeExecutionPayloadPreview: activePayload,
      activeExecutionReflection: null,
      activeExecutionAlternatives: activeAlternatives,
      activeExecutionCandidate: activeCandidate,
    })
  );
  assert.doesNotMatch(reflectionMissingMarkup, /data-lab-execution-candidate="true"/);

  const alternativesMissingMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: activePlan,
      activeExecutionSimulation: activeSimulation,
      activeExecutionReadiness: activeReadiness,
      activeExecutionPayloadPreview: activePayload,
      activeExecutionReflection: activeReflection,
      activeExecutionAlternatives: null,
      activeExecutionCandidate: activeCandidate,
    })
  );
  assert.doesNotMatch(alternativesMissingMarkup, /data-lab-execution-candidate="true"/);

  const candidateMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: activePlan,
      activeExecutionSimulation: activeSimulation,
      activeExecutionReadiness: activeReadiness,
      activeExecutionPayloadPreview: activePayload,
      activeExecutionReflection: activeReflection,
      activeExecutionAlternatives: activeAlternatives,
      activeExecutionCandidate: activeCandidate,
    })
  );
  const candidatePanel = extractCandidatePanelMarkup(candidateMarkup);

  assert.match(candidatePanel, /data-lab-execution-candidate="true"/);
  assert.match(candidatePanel, /Viable/);
  assert.match(candidatePanel, /Complete/);
  assert.match(candidatePanel, /Readiness/);
  assert.match(candidatePanel, /Reflection/);
  assert.match(candidatePanel, /87% confidence/);
  assert.doesNotMatch(candidatePanel, /<button/);
  assert.doesNotMatch(candidatePanel, /onclick/);
  assert.doesNotMatch(candidatePanel, /data-lab-action/);
  assert.doesNotMatch(candidatePanel, />\s*(Run|Execute|Apply|Start|Commit)\s*</);
  assert.doesNotMatch(candidatePanel, /\bCommit\b/);
});

test("laboratory execution commitment UI is explicit, passive, and candidate-gated", () => {
  const fixture = createPassiveExecutionChainFixture();

  const previewOnlyMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeSuggestionPreview: {
        suggestionId: "audio-inspect",
        title: "Audio preview",
        steps: ["Step 1"],
        expectedOutputs: ["Output"],
      },
      activeExecutionCandidate: fixture.activeCandidate,
      activeExecutionCommitment: fixture.activeCommitment,
    })
  );
  assert.doesNotMatch(previewOnlyMarkup, /data-lab-execution-commitment="true"/);
  assert.doesNotMatch(previewOnlyMarkup, /data-lab-execution-commitment-set=/);

  const choiceMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: fixture.activePlan,
      activeExecutionSimulation: fixture.activeSimulation,
      activeExecutionReadiness: fixture.activeReadiness,
      activeExecutionPayloadPreview: fixture.activePayload,
      activeExecutionReflection: fixture.activeReflection,
      activeExecutionAlternatives: fixture.activeAlternatives,
      activeExecutionCandidate: fixture.activeCandidate,
      activeExecutionCommitment: null,
    })
  );
  const candidatePanel = extractCandidatePanelMarkup(choiceMarkup);
  assert.match(choiceMarkup, /data-lab-execution-commitment-control="true"/);
  assert.match(choiceMarkup, /data-lab-execution-commitment-set=/);
  assert.match(choiceMarkup, /Choose this path/);
  assert.doesNotMatch(choiceMarkup, /data-lab-execution-commitment="true"/);
  assert.doesNotMatch(candidatePanel, /<button/);

  const committedMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: fixture.activePlan,
      activeExecutionSimulation: fixture.activeSimulation,
      activeExecutionReadiness: fixture.activeReadiness,
      activeExecutionPayloadPreview: fixture.activePayload,
      activeExecutionReflection: fixture.activeReflection,
      activeExecutionAlternatives: fixture.activeAlternatives,
      activeExecutionCandidate: fixture.activeCandidate,
      activeExecutionCommitment: fixture.activeCommitment,
    })
  );
  const commitmentPanel = extractCommitmentPanelMarkup(committedMarkup);
  assert.match(commitmentPanel, /data-lab-execution-commitment="true"/);
  assert.match(commitmentPanel, /Committed/);
  assert.match(commitmentPanel, /Candidate: Viable/);
  assert.match(commitmentPanel, /Chosen recently/);
  assert.match(commitmentPanel, /Payload preview is structurally aligned/);
  assert.match(commitmentPanel, /Alternative paths still trade precision/);
  assert.match(commitmentPanel, /87% confidence/);
  assert.match(commitmentPanel, /data-lab-execution-commitment-revoke="true"/);
  assert.match(commitmentPanel, /Revoke choice/);
  assert.doesNotMatch(commitmentPanel, />\s*(Run|Execute|Apply|Start|Commit)\s*</);
});

test("laboratory execution commitment controls avoid not-viable candidates and execution dispatch", () => {
  const fixture = createPassiveExecutionChainFixture();
  const blockedCandidate = {
    ...fixture.activeCandidate,
    id: `candidate:${fixture.activePlan.id}:blocked`,
    status: "not-viable" as const,
    structuralIntegrity: "insufficient" as const,
    readinessStatus: "blocked" as const,
    reflectionDecision: "avoid" as const,
    summary: "This path is not structurally suitable for execution.",
  };
  const blockedMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: fixture.activePlan,
      activeExecutionSimulation: fixture.activeSimulation,
      activeExecutionReadiness: fixture.activeReadiness,
      activeExecutionPayloadPreview: fixture.activePayload,
      activeExecutionReflection: fixture.activeReflection,
      activeExecutionAlternatives: fixture.activeAlternatives,
      activeExecutionCandidate: blockedCandidate,
      activeExecutionCommitment: null,
    })
  );

  assert.match(blockedMarkup, /data-lab-execution-commitment-control="true"/);
  assert.match(blockedMarkup, /not structurally suitable for a user choice yet/);
  assert.doesNotMatch(blockedMarkup, /data-lab-execution-commitment-set=/);

  const binderSource = readFileSync(
    "rooms/laboratory/ui/lab-selection-suggestion-binder.ts",
    "utf8"
  );
  assert.match(binderSource, /data-lab-execution-commitment-set/);
  assert.match(binderSource, /workspace-execution-commitment-set/);
  assert.match(binderSource, /data-lab-execution-commitment-revoke/);
  assert.match(binderSource, /workspace-execution-commitment-revoked/);
  assert.doesNotMatch(binderSource, /lab-run-controller|run-started|asset-added/);
});

test("laboratory execution staging UI renders only after a chosen candidate chain", () => {
  const fixture = createPassiveExecutionChainFixture();

  const previewOnlyMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeSuggestionPreview: {
        suggestionId: "audio-inspect",
        title: "Audio preview",
        steps: ["Step 1"],
        expectedOutputs: ["Output"],
      },
      activeExecutionStaging: fixture.activeStaging,
    })
  );
  assert.doesNotMatch(previewOnlyMarkup, /data-lab-execution-staging="true"/);

  const missingChoiceMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: fixture.activePlan,
      activeExecutionSimulation: fixture.activeSimulation,
      activeExecutionReadiness: fixture.activeReadiness,
      activeExecutionPayloadPreview: fixture.activePayload,
      activeExecutionReflection: fixture.activeReflection,
      activeExecutionAlternatives: fixture.activeAlternatives,
      activeExecutionCandidate: fixture.activeCandidate,
      activeExecutionCommitment: null,
      activeExecutionStaging: fixture.activeStaging,
    })
  );
  assert.doesNotMatch(missingChoiceMarkup, /data-lab-execution-staging="true"/);

  const stagingMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: fixture.activePlan,
      activeExecutionSimulation: fixture.activeSimulation,
      activeExecutionReadiness: fixture.activeReadiness,
      activeExecutionPayloadPreview: fixture.activePayload,
      activeExecutionReflection: fixture.activeReflection,
      activeExecutionAlternatives: fixture.activeAlternatives,
      activeExecutionCandidate: fixture.activeCandidate,
      activeExecutionCommitment: fixture.activeCommitment,
      activeExecutionStaging: fixture.activeStaging,
    })
  );
  const stagingPanel = extractStagingPanelMarkup(stagingMarkup);
  assert.match(stagingPanel, /data-lab-execution-staging="true"/);
  assert.match(stagingPanel, /Staged/);
  assert.match(stagingPanel, /User choice/);
  assert.match(stagingPanel, /Chosen/);
  assert.match(stagingPanel, /Candidate/);
  assert.match(stagingPanel, /Readiness/);
  assert.match(stagingPanel, /prepared and can be staged/);
  assert.match(stagingPanel, /Alternative paths remain visible/);
  assert.match(stagingPanel, /Candidate uncertainty/);
  assert.match(stagingPanel, /88% confidence/);
});

test("laboratory execution staging UI stays passive and avoids action language", () => {
  const fixture = createPassiveExecutionChainFixture();
  const stagingMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: fixture.activePlan,
      activeExecutionSimulation: fixture.activeSimulation,
      activeExecutionReadiness: fixture.activeReadiness,
      activeExecutionPayloadPreview: fixture.activePayload,
      activeExecutionReflection: fixture.activeReflection,
      activeExecutionAlternatives: fixture.activeAlternatives,
      activeExecutionCandidate: fixture.activeCandidate,
      activeExecutionCommitment: fixture.activeCommitment,
      activeExecutionStaging: fixture.activeStaging,
    })
  );
  const stagingPanel = extractStagingPanelMarkup(stagingMarkup);

  assert.doesNotMatch(stagingPanel, /<button/);
  assert.doesNotMatch(stagingPanel, /onclick/);
  assert.doesNotMatch(stagingPanel, /data-lab-action/);
  assert.doesNotMatch(stagingPanel, /data-lab-execution-commitment/);
  assert.doesNotMatch(stagingPanel, /\b(Run|Execute|Apply|Start|Commit|Queue)\b/);
  assert.doesNotMatch(stagingPanel, /commitmentStatus|committed|commitment/i);

  const timelineSource = readFileSync("rooms/laboratory/ui/lab-waveform-timeline-render.ts", "utf8");
  assert.match(timelineSource, /data-lab-execution-staging="true"/);
  assert.match(timelineSource, /function renderExecutionStaging/);
  assert.doesNotMatch(timelineSource, /workspace-execution-staging/);
});

test("laboratory execution panels are collapse-first with a non-persistent details overlay", () => {
  const fixture = createPassiveExecutionChainFixture();
  const collapsedMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: fixture.activePlan,
      activeExecutionSimulation: fixture.activeSimulation,
      activeExecutionReadiness: fixture.activeReadiness,
      activeExecutionPayloadPreview: fixture.activePayload,
      activeExecutionReflection: fixture.activeReflection,
      activeExecutionAlternatives: fixture.activeAlternatives,
      activeExecutionCandidate: fixture.activeCandidate,
      activeExecutionCommitment: fixture.activeCommitment,
      activeExecutionStaging: fixture.activeStaging,
    })
  );

  assert.match(collapsedMarkup, /data-lab-collapsible-panel="true"/);
  assert.match(collapsedMarkup, /data-panel-id="simulation"/);
  assert.match(collapsedMarkup, /data-panel-id="payload"/);
  assert.match(collapsedMarkup, /data-panel-id="reflection"/);
  assert.match(collapsedMarkup, /data-panel-id="alternatives"/);
  assert.doesNotMatch(collapsedMarkup, /data-panel-id="plan"/);
  assert.doesNotMatch(collapsedMarkup, /data-panel-id="readiness"/);
  ["simulation", "payload", "reflection", "alternatives"].forEach(function (panelId) {
    assert.doesNotMatch(extractCollapsibleOpeningTag(collapsedMarkup, panelId), /\sopen\b/);
  });
  ["candidate", "commitment", "staging"].forEach(function (panelId) {
    assert.match(extractCollapsibleOpeningTag(collapsedMarkup, panelId), /\sopen\b/);
  });
  assert.doesNotMatch(collapsedMarkup, /data-lab-execution-details-overlay="true"/);

  const overlayMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeOverlay: "execution-details",
      activeExecutionPlan: fixture.activePlan,
      activeExecutionSimulation: fixture.activeSimulation,
      activeExecutionReadiness: fixture.activeReadiness,
      activeExecutionPayloadPreview: fixture.activePayload,
      activeExecutionReflection: fixture.activeReflection,
      activeExecutionAlternatives: fixture.activeAlternatives,
      activeExecutionCandidate: fixture.activeCandidate,
      activeExecutionCommitment: fixture.activeCommitment,
      activeExecutionStaging: fixture.activeStaging,
    })
  );
  assert.match(overlayMarkup, /data-lab-execution-details-overlay="true"/);
  assert.match(overlayMarkup, /data-lab-execution-details-close="true"/);
  const detailsOverlay = extractExecutionDetailsOverlayMarkup(overlayMarkup);
  assert.match(detailsOverlay, /data-lab-execution-plan="true"/);
  assert.match(detailsOverlay, /data-lab-execution-simulation="true"/);
  assert.match(detailsOverlay, /data-lab-execution-readiness="true"/);
  assert.match(detailsOverlay, /data-lab-execution-reflection="true"/);
  assert.match(detailsOverlay, /data-lab-execution-alternatives="true"/);
  assert.doesNotMatch(detailsOverlay, /data-lab-execution-payload-preview="true"/);

  const rootSource = readFileSync("rooms/laboratory/ui/lab-root.ts", "utf8");
  assert.match(rootSource, /data-lab-execution-details-open/);
  assert.match(rootSource, /activeOverlay: LabWaveformTimelineModel\["activeOverlay"\]/);
  assert.doesNotMatch(rootSource, /processPanelCollapsedSections/);
  assert.doesNotMatch(rootSource, /workspace-process-section-toggled/);
});

test("laboratory phase 4.95 renders room-local i18n labels in English and Turkish", () => {
  const fixture = createPassiveExecutionChainFixture();
  const enTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/en.json", "utf8"));
  const trTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/tr.json", "utf8"));
  const enCopy = createLabI18n({ locale: "en", translations: enTranslations });
  const trCopy = createLabI18n({ locale: "tr", translations: trTranslations });

  const enMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeOverlay: "execution-details",
      activeExecutionPlan: fixture.activePlan,
      activeExecutionSimulation: fixture.activeSimulation,
      activeExecutionReadiness: fixture.activeReadiness,
      activeExecutionPayloadPreview: fixture.activePayload,
      activeExecutionReflection: fixture.activeReflection,
      activeExecutionAlternatives: fixture.activeAlternatives,
      activeExecutionCandidate: fixture.activeCandidate,
      activeExecutionCommitment: fixture.activeCommitment,
      activeExecutionStaging: fixture.activeStaging,
      copy: enCopy,
    })
  );
  const trMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeOverlay: "execution-details",
      activeExecutionPlan: fixture.activePlan,
      activeExecutionSimulation: fixture.activeSimulation,
      activeExecutionReadiness: fixture.activeReadiness,
      activeExecutionPayloadPreview: fixture.activePayload,
      activeExecutionReflection: fixture.activeReflection,
      activeExecutionAlternatives: fixture.activeAlternatives,
      activeExecutionCandidate: fixture.activeCandidate,
      activeExecutionCommitment: fixture.activeCommitment,
      activeExecutionStaging: fixture.activeStaging,
      copy: trCopy,
    })
  );

  assert.match(enMarkup, /View details/);
  assert.match(enMarkup, /Execution details/);
  assert.match(enMarkup, /Selection/);
  assert.match(enMarkup, /Type/);
  assert.match(enMarkup, /Simulation preview/);
  assert.match(enMarkup, /Execution candidate/);
  assert.match(trMarkup, /Detaylari gor/);
  assert.match(trMarkup, /Calistirma detaylari/);
  assert.match(trMarkup, /Secim/);
  assert.match(trMarkup, /Tip/);
  assert.match(trMarkup, /Simulasyon onizlemesi/);
  assert.match(trMarkup, /Calistirma adayi/);
});

test("laboratory runtime status copy resolves through room-local i18n catalogs", () => {
  const enTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/en.json", "utf8"));
  const trTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/tr.json", "utf8"));
  const enCopy = createLabI18n({ locale: "en", translations: enTranslations });
  const trCopy = createLabI18n({ locale: "tr", translations: trTranslations });

  assert.equal(translateLabRuntimeText("Kaynak henüz hazır değil.", enCopy), "Source is not ready yet.");
  assert.equal(translateLabRuntimeText("Eksik araç: ffmpeg", enCopy), "Missing tool: ffmpeg");
  assert.equal(translateLabRuntimeText("Eksik araç: ffmpeg", trCopy), "Eksik araç: ffmpeg");
  assert.equal(
    formatLabExpectedOutputLabel(
      { intentId: "audio-investigation", label: "Ses çıktısı", assetTypes: ["audio"] },
      enCopy
    ),
    "Audio output"
  );
  assert.equal(
    formatLabUserActionDisplayText(
      {
        id: "action-1",
        type: "extract-audio",
        label: "Ses çıkarılıyor",
        status: "success",
        startedAt: 1,
        message: "Ses çıkarıldı",
        sourceAction: "export-audio-track",
      },
      enCopy
    ),
    "Audio extracted"
  );
});

test("laboratory phase 4.95 i18n keys keep English and Turkish catalog parity", () => {
  const enTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/en.json", "utf8"));
  const trTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/tr.json", "utf8"));
  const phaseKeys = [
    "mediaAnalysis.processSummary",
    "mediaAnalysis.rightContext",
    "mediaAnalysis.executionDetails",
    "mediaAnalysis.executionPanels",
    "mediaAnalysis.timeline",
  ];

  function readPath(record: Record<string, unknown>, key: string): unknown {
    return key.split(".").reduce<unknown>(function (current, part) {
      return current && typeof current === "object"
        ? (current as Record<string, unknown>)[part]
        : undefined;
    }, record);
  }

  function collectKeys(value: unknown, prefix = ""): string[] {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return [prefix];
    }
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .flatMap(function (key) {
        const nextPrefix = prefix === "" ? key : `${prefix}.${key}`;
        return collectKeys((value as Record<string, unknown>)[key], nextPrefix);
      });
  }

  phaseKeys.forEach(function (key) {
    assert.deepEqual(collectKeys(readPath(enTranslations, key)), collectKeys(readPath(trTranslations, key)));
  });
});

test("laboratory global process layer is single-source and right panel no longer embeds process dashboard", () => {
  const surfaceSource = readFileSync("rooms/laboratory/ui/workspace-surface.ts", "utf8");
  const rightPanelSource = readFileSync("rooms/laboratory/ui/lab-right-panel.ts", "utf8");

  assert.match(surfaceSource, /data-lab-global-process="true"/);
  assert.match(surfaceSource, /getLaboratoryProcessSummary/);
  assert.doesNotMatch(surfaceSource, /renderWorkspaceProcessPanel/);
  assert.match(rightPanelSource, /data-lab-right-context="true"/);
  assert.match(rightPanelSource, /getLaboratoryRightPanelContext/);
  assert.doesNotMatch(rightPanelSource, /labx-process-panel/);
});
