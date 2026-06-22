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

describe("observability helpers", () => {
  void test("laboratory observability helpers are debug gated and structured", async () => {
    const labRootModule = await importLabRootModuleWithDomStub<{
      __testOnlyLabRootObservability: {
        debugLabFallback: (
          shell: Element | null,
          regionsFound: number,
          missingRegions: string[]
        ) => void;
        debugLabOverlay: (
          shell: Element | null,
          overlayKey: "report" | "tools",
          event: "invalid" | "missing",
          detail?: Record<string, unknown>
        ) => void;
        debugLabRegionLifecycle: (
          shell: Element | null,
          regionKey:
            | "contextPanel"
            | "inspectorPanel"
            | "leftRail"
            | "mainStage"
            | "processStrip"
            | "topBar",
          event: "fallback" | "missing" | "mount" | "update",
          detail?: Record<string, unknown>
        ) => void;
        isLabRegionDebugEnabled: (shell: Element | null) => boolean;
        syncLabDebugPanel: (
          shell: HTMLElement | null,
          decisionSnapshot?: LabDecisionSnapshot | null
        ) => void;
      };
    }>();
    const observability = labRootModule.__testOnlyLabRootObservability;
    const debugShell = createObservabilityShell({
      debug: true,
      drawerMode: "result",
      pipelineBlocks: 4,
      regions: 9,
    });
    const quietShell = createObservabilityShell({ debug: false, existingPanel: true });

    const debugLogs = captureDebugLogs(function () {
      observability.debugLabRegionLifecycle(debugShell as unknown as Element, "topBar", "mount");
      observability.debugLabRegionLifecycle(
        debugShell as unknown as Element,
        "inspectorPanel",
        "update"
      );
      observability.debugLabFallback(debugShell as unknown as Element, 2, [
        "inspector",
        "context-panel",
      ]);
      observability.debugLabOverlay(debugShell as unknown as Element, "tools", "missing", {
        selector: ".labx-overlay-root",
      });
    });

    assert.deepEqual(
      debugLogs.map(function (entry) {
        return entry[0];
      }),
      [
        "[lab][region] topbar -> mounted",
        "[lab][region] inspector -> updated",
        "[lab][fallback] triggered -> regionsFound: 2",
        "[lab][overlay] tools -> missing",
      ]
    );
    assert.deepEqual(debugLogs[2]?.[1], {
      missing: ["inspector", "context-panel"],
      regionsFound: 2,
    });

    const quietLogs = captureDebugLogs(function () {
      observability.debugLabRegionLifecycle(quietShell as unknown as Element, "topBar", "mount");
      observability.debugLabFallback(quietShell as unknown as Element, 2, ["topbar"]);
      observability.debugLabOverlay(quietShell as unknown as Element, "tools", "missing");
    });
    assert.equal(quietLogs.length, 0);
    assert.equal(observability.isLabRegionDebugEnabled(debugShell as unknown as Element), true);
    assert.equal(observability.isLabRegionDebugEnabled(quietShell as unknown as Element), false);

    observability.syncLabDebugPanel(debugShell as unknown as HTMLElement);
    assert.match(debugShell.insertedHtml, /data-lab-debug-panel="true"/);
    assert.match(debugShell.insertedHtml, /data-region-count="9"/);
    assert.match(debugShell.insertedHtml, /data-pipeline-block-count="4"/);
    assert.match(debugShell.insertedHtml, /data-active-block-count="4"/);
    assert.match(debugShell.insertedHtml, /data-drawer-mode="result"/);
    assert.match(debugShell.insertedHtml, /data-decision-intent="idle"/);
    assert.match(debugShell.insertedHtml, /data-decision-state="idle"/);
    assert.match(debugShell.insertedHtml, /<span>mode result<\/span>/);
    assert.match(debugShell.insertedHtml, /<span>intent idle<\/span>/);
    assert.match(debugShell.insertedHtml, /<span>blocks 4<\/span>/);
    assert.match(debugShell.insertedHtml, /<span>state idle<\/span>/);
    assert.doesNotMatch(debugShell.insertedHtml, /triggers|has-selection|has-source/);

    const updateShell = createObservabilityShell({
      debug: true,
      drawerMode: "setup",
      existingPanel: true,
      pipelineBlocks: 4,
      regions: 9,
    });
    observability.syncLabDebugPanel(updateShell as unknown as HTMLElement, {
      activeBlocks: ["analysis-prep", "preflight", "analysis-cta"],
      intent: "ready-to-run",
      mode: "setup",
      state: "ready",
      timestamp: 12,
      triggers: ["has-selection", "has-source"],
    });
    assert.equal(updateShell.panelAttributes.get("data-active-block-count"), "3");
    assert.equal(updateShell.panelAttributes.get("data-decision-intent"), "ready-to-run");
    assert.equal(updateShell.panelAttributes.get("data-decision-state"), "ready");
    assert.match(updateShell.panelInnerHtml, /<span>mode setup<\/span>/);
    assert.match(updateShell.panelInnerHtml, /<span>intent ready-to-run<\/span>/);
    assert.match(updateShell.panelInnerHtml, /<span>blocks 3<\/span>/);
    assert.match(updateShell.panelInnerHtml, /<span>state ready<\/span>/);
    assert.doesNotMatch(updateShell.panelInnerHtml, /triggers|has-selection|has-source/);

    observability.syncLabDebugPanel(quietShell as unknown as HTMLElement);
    assert.equal(quietShell.panelRemoved, true);
  });
});
