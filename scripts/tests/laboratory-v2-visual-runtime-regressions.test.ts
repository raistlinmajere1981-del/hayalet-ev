import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("laboratory v2 visual runtime keeps catalog, readiness, and UI control seams aligned", () => {
  const visualCatalog = JSON.parse(
    readFileSync("rooms/laboratory/shared/data/tools/visual-analysis-catalog.json", "utf8")
  );
  const visualProviders = JSON.parse(
    readFileSync("rooms/laboratory/shared/data/tools/visual-analysis-providers.json", "utf8")
  );
  const enTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/en.json", "utf8"));
  const trTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/tr.json", "utf8"));
  const activationSource = readFileSync("rooms/laboratory/shared/host/activation.ts", "utf8");
  const processStageSource = readFileSync("rooms/laboratory/ui/stages/process-stage.ts", "utf8");
  const reportStageSource = readFileSync("rooms/laboratory/ui/stages/report-stage.ts", "utf8");
  const controllerSource = readFileSync("rooms/laboratory/runtime/lab-run-controller.ts", "utf8");
  const selectorSource = readFileSync("rooms/laboratory/runtime/lab-selectors.ts", "utf8");
  const visualRuntimeSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/host/visual-analysis-runtime.ts",
    "utf8"
  );
  const targetingSource = readFileSync("rooms/laboratory/shared/host/process-targeting.ts", "utf8");
  const mediaRunnerSource = readFileSync(
    "rooms/laboratory/shared/host/process-managed-media-runner.ts",
    "utf8"
  );

  assert.equal(Array.isArray(visualCatalog.modules), true);
  assert.ok(
    visualCatalog.modules.some((entry: { id?: string }) => entry.id === "hidden-detail-reveal")
  );
  assert.ok(
    visualProviders.providers.some((entry: { id?: string }) => entry.id === "ffmpeg-visual-reveal")
  );
  assert.equal(
    enTranslations.visualAnalysis.catalog.modules["gamma-scan"].title,
    "Gamma Scan"
  );
  assert.equal(
    trTranslations.visualAnalysis.catalog.modules["gamma-scan"].title,
    "Gamma Taramasi"
  );
  assert.equal(
    enTranslations.mediaAnalysis.process.steps.visualSignal,
    "Visual Signal Amplification"
  );
  assert.equal(
    trTranslations.mediaAnalysis.process.steps.visualSignal,
    "Gorsel Sinyal Guclendirme"
  );

  assert.match(activationSource, /interactive-adjustment-applied/);
  assert.match(processStageSource, /Scope ve Module Controls/);
  assert.match(processStageSource, /data-lab-field="scope\.focus"/);
  assert.match(processStageSource, /data-lab-action="toggle-analysis-controls"/);
  assert.match(processStageSource, /data-lab-action="module-toggle"/);
  assert.match(processStageSource, /Canli Bulgu Akisi/);
  assert.match(processStageSource, /Aktif Preview/);
  assert.match(reportStageSource, /Frozen Scope/);
  assert.match(reportStageSource, /Latest Preview/);
  assert.match(controllerSource, /case "module-toggle":/);
  assert.match(controllerSource, /case "toggle-live-findings":/);
  assert.match(controllerSource, /case "toggle-analysis-controls":/);
  assert.match(controllerSource, /field\.startsWith\("scope\."\)/);
  assert.match(selectorSource, /export function getProcessAnalysisScope/);
  assert.match(selectorSource, /export function getVisibleLiveFindings/);
  assert.match(selectorSource, /export function getActivePreviewArtifact/);
  assert.match(visualRuntimeSource, /toolReady/);
  assert.match(visualRuntimeSource, /sourceSupported/);
  assert.match(targetingSource, /logicalLayer:\s*"visual-analysis"/);
  assert.match(targetingSource, /visual-signal/);
  assert.match(mediaRunnerSource, /kind:\s*"preview-artifact"/);
  assert.match(mediaRunnerSource, /comparisonVariant:/);
});

test("laboratory v2 module toggles propagate into audio and subtitle process builders", () => {
  const audioProjectionSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/host/module-projection.ts",
    "utf8"
  );
  const subtitleProcessSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/host/process-analysis.ts",
    "utf8"
  );
  const processRuntimeSource = readFileSync(
    "rooms/laboratory/shared/host/process-runtime.ts",
    "utf8"
  );

  assert.match(audioProjectionSource, /moduleToggles/);
  assert.match(audioProjectionSource, /status:\s*"skipped"/);
  assert.match(subtitleProcessSource, /moduleToggles/);
  assert.match(subtitleProcessSource, /Disabled from the active workbench scope\./);
  assert.match(processRuntimeSource, /buildSubtitleProcessModules\(runtime, project, target\)/);
});
