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

describe("process output parser", () => {
  void test("laboratory finding engine derives findings from semantic events and stays quiet on thin runs", () => {
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
    assert.equal(
      anomalyFindings.some((entry) => entry.title.includes("Siyah sahne")),
      true
    );
    assert.equal(
      anomalyFindings.some((entry) => entry.title.includes("Freeze")),
      true
    );

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
});
