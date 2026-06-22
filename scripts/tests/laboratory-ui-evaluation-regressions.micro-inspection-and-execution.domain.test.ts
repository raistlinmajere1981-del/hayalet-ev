import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { renderLabWaveformTimeline } from "../../rooms/laboratory/ui/lab-waveform-timeline.ts";
import { getLabLayoutKind, renderLabLayout } from "../../rooms/laboratory/ui/lab-layout.ts";
import { createLabI18n } from "../../rooms/laboratory/ui/lab-i18n.ts";
import { renderLabSourcePanel } from "../../rooms/laboratory/ui/lab-source-panel.ts";
import {
  buildLabDecisionSnapshot,
  deriveLabDecisionSignals,
  deriveLabDecisionSignalsFromState,
  readLabDecisionActiveBlocks,
  resolveLabDecisionIntent,
  resolveLabDecisionState,
} from "../../rooms/laboratory/ui/lab-decision-layer.ts";
import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import {
  formatLabUserActionDisplayText,
  translateLabRuntimeText,
} from "../../rooms/laboratory/ui/lab-runtime-i18n.ts";
import { createRoomBuiltArtifact } from "./helpers/room-installed-copy.ts";
import { readCssWithImports } from "./helpers/css-imports.ts";
import { importLabRootModuleWithDomStub } from "./laboratory-runtime-truth.helpers.ts";
import type { LabDecisionSnapshot, LabRun } from "../../rooms/laboratory/domain/lab-types.ts";
import type { LabWaveformTimelineModel } from "../../rooms/laboratory/ui/lab-waveform-timeline-types.ts";

describe("micro inspection and execution", () => {
  void test("laboratory micro inspection UI exposes roi focus precedence and lens affordances in the preview shell", () => {
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
    assert.doesNotMatch(overlaySource, /labx-roi-selection-toolbar/);
    assert.doesNotMatch(overlaySource, /data-lab-selection-inspection-mode=/);
    assert.match(timelineSelectionSource, /data-lab-selection-roi-focus-toggle="true"/);
    assert.match(timelineSelectionSource, /data-lab-selection-roi-capture="true"/);
    assert.match(surfaceSource, /data-lab-preview-inspection-stage="true"/);
    assert.match(surfaceSource, /data-lab-preview-inspection-content="true"/);
    assert.match(timelineSelectionSource, /Selection micro zoom/);
    assert.match(timelineSelectionSource, /model\.selectionMicroZoomOpen !== true/);
    assert.match(timelineSelectionSource, /id="lab-audio-viz-inspection"/);
  });
  void test("laboratory selection preview exposes soft execution intent affordances without run semantics", () => {
    const timelineSelectionSource = readFileSync(
      "rooms/laboratory/ui/timeline/timeline-selection.ts",
      "utf8"
    );

    assert.match(timelineSelectionSource, /Selected action/);
    assert.match(timelineSelectionSource, /data-lab-execution-intent-accept=/);
    assert.match(timelineSelectionSource, /data-lab-execution-intent-dismiss=/);
    assert.match(timelineSelectionSource, /data-lab-execution-intent-queue=/);
    assert.match(timelineSelectionSource, /data-lab-execution-intent-clear="true"/);
    assert.match(timelineSelectionSource, /mediaAnalysis\.timeline\.actionSelected/);
    assert.match(timelineSelectionSource, /mediaAnalysis\.timeline\.wantThis/);
    assert.match(timelineSelectionSource, /mediaAnalysis\.timeline\.notNow/);
    assert.match(timelineSelectionSource, /mediaAnalysis\.timeline\.queueForLater/);
    assert.doesNotMatch(timelineSelectionSource, />Run</);
  });
  void test("laboratory execution detail helper panels are removed from the selection timeline surface", () => {
    const timelineSource = readLabWaveformTimelineSource();
    const rootSource = readFileSync("rooms/laboratory/ui/lab-root.ts", "utf8");
    const binderSource = readFileSync(
      "rooms/laboratory/ui/lab-selection-suggestion-binder.ts",
      "utf8"
    );
    const drawerResultExploreSource = readFileSync(
      "rooms/laboratory/ui/lab-drawer-result-explore.ts",
      "utf8"
    );
    const themeSource = readLabThemeSource();

    const removedTimelinePatterns = [
      /data-lab-execution-plan/,
      /data-lab-execution-simulation/,
      /data-lab-execution-readiness/,
      /data-lab-execution-payload-preview/,
      /data-lab-execution-reflection/,
      /data-lab-execution-alternatives/,
      /data-lab-execution-candidate/,
      /data-lab-execution-commitment/,
      /data-lab-execution-staging/,
      /data-lab-execution-details/,
      /renderExecutionPlan/,
      /renderExecutionSimulation/,
      /renderExecutionReadiness/,
      /renderExecutionPayloadPreview/,
      /renderExecutionReflection/,
      /renderExecutionAlternatives/,
      /renderExecutionCandidate/,
      /renderExecutionCommitment/,
      /renderExecutionStaging/,
      /renderCollapsibleExecutionPanel/,
      /executionPanels/,
      /executionDetails/,
    ];

    removedTimelinePatterns.forEach(function (pattern) {
      assert.doesNotMatch(timelineSource, pattern);
    });

    assert.match(timelineSource, /renderExecutionIntentStrip/);
    assert.match(timelineSource, /renderSuggestionPreview/);
    assert.match(binderSource, /data-lab-execution-intent-accept/);
    assert.match(binderSource, /data-lab-execution-intent-dismiss/);
    assert.match(binderSource, /data-lab-execution-intent-queue/);
    assert.match(binderSource, /data-lab-execution-intent-clear/);
    assert.doesNotMatch(
      binderSource,
      /data-lab-execution-commitment-set|workspace-execution-commitment-set|data-lab-execution-commitment-revoke|workspace-execution-commitment-revoked/
    );
    assert.doesNotMatch(
      rootSource,
      /data-lab-execution-details-open|activeOverlay|collapsedPanels|createLabExecutionDispatcher|getExecutionDispatchCandidate/
    );
    assert.doesNotMatch(
      drawerResultExploreSource,
      /buildExecutionBridge|data-lab-drawer-alternatives|formatDecisionCoherenceAdvisory|formatExecutionReadinessSignalAdvisory|getActiveExecutionAlternatives/
    );
    assert.doesNotMatch(
      themeSource,
      /lab-execution-collapsible|lab-execution-details|lab-execution-plan|lab-execution-simulation|lab-execution-readiness|lab-execution-payload|lab-execution-reflection|lab-execution-candidate|lab-execution-commitment|lab-execution-staging/
    );
  });
  void test("laboratory accepted selection renders selected action feedback without helper panels", () => {
    const markup = renderLabWaveformTimeline(
      createExecutionReadinessTimelineModel({
        activeExecutionIntent: {
          id: "audio-inspect",
          label: "Inspect audio",
          actionType: "inspect-audio",
          confidence: 0.82,
        },
        activeSuggestionPreview: null,
        selectionSuggestions: [],
      })
    );

    assert.match(markup, /Selected action/);
    assert.match(markup, /Inspect audio/);
    assert.match(markup, /data-lab-execution-intent-clear="true"/);
    assert.doesNotMatch(markup, /data-lab-execution-plan="true"/);
    assert.doesNotMatch(markup, /data-lab-execution-simulation="true"/);
    assert.doesNotMatch(markup, /data-lab-execution-readiness="true"/);
    assert.doesNotMatch(markup, /data-lab-execution-payload-preview="true"/);
    assert.doesNotMatch(markup, /data-lab-execution-reflection="true"/);
    assert.doesNotMatch(markup, /data-lab-execution-alternatives="true"/);
    assert.doesNotMatch(markup, /data-lab-execution-candidate="true"/);
    assert.doesNotMatch(markup, /data-lab-execution-commitment="true"/);
    assert.doesNotMatch(markup, /data-lab-execution-staging="true"/);
    assert.doesNotMatch(markup, /data-lab-execution-details-overlay="true"/);
    assert.doesNotMatch(markup, /Simulation preview|Execution payload|Execution candidate/);
  });
});
