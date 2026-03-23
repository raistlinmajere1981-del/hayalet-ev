import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { initPaths, Paths } from "../../electron/paths.ts";
import {
  deleteLaboratoryProject,
  getLaboratoryWorkspaceDir,
  listLaboratoryHistory,
  listLaboratoryProjects,
  persistLaboratoryResolvedSource,
  readLaboratoryHistoryEntry,
  readLaboratoryProject,
  saveLaboratoryHistoryEntry,
} from "../../electron/laboratory/history-store.ts";
import type {
  LaboratoryAnalyzerReport,
  LaboratorySourceDescriptor,
  LaboratoryTechnicalReport,
  LaboratoryUserReport,
} from "../../src/types/laboratory.ts";

const electronDir = join(process.cwd(), "electron");
initPaths(electronDir);

function createProjectId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createAnalyzerReport(summary: string): LaboratoryAnalyzerReport {
  return {
    status: "ok",
    score: 0.52,
    summary,
    findings: [summary],
    metrics: [{ label: "Sample metric", value: "52%" }],
    evidence: [
      {
        id: "evidence-1",
        title: "Evidence",
        summary,
        score: 0.52,
      },
    ],
    details: {},
  };
}

function createSourceDescriptor(projectId: string): LaboratorySourceDescriptor {
  const workspaceId = projectId;

  return {
    projectId,
    workspaceId,
    workspaceDir: getLaboratoryWorkspaceDir(workspaceId),
    kind: "local-file",
    label: "Regression Clip",
    originalInput: "/tmp/regression-clip.mp4",
    originalFileName: "regression-clip.mp4",
    workingSourcePath: join(getLaboratoryWorkspaceDir(workspaceId), "source", "regression-clip.mp4"),
    previewPath: join(getLaboratoryWorkspaceDir(workspaceId), "preview", "regression-clip-preview.mp4"),
    createdAt: new Date().toISOString(),
    sizeBytes: 2048,
    probe: {
      durationSec: 12.5,
      width: 1920,
      height: 1080,
      fps: 24,
      avgFrameRateRaw: "24/1",
      realFrameRateRaw: "24/1",
      frameCount: 300,
      bitrate: 1200000,
      container: "mp4",
      formatName: "mov,mp4,m4a,3gp,3g2,mj2",
      videoCodec: "h264",
      audioCodec: "aac",
      encoder: "Lavf",
      hasVideo: true,
      hasAudio: true,
    },
    workflowSettings: {
      downloadPreset: "best",
      previewPolicy: "dense",
      focus: {
        visual: true,
        audio: false,
        image: true,
        motion: true,
      },
    },
    cacheState: {
      sourcePresent: true,
      previewPresent: true,
      derivedMediaPresent: true,
      cleanedAt: null,
    },
  };
}

test("laboratory history store persists draft and completed project records", async () => {
  const projectId = createProjectId("laboratory-project");
  const source = createSourceDescriptor(projectId);

  try {
    await persistLaboratoryResolvedSource(source, { reportLocale: "tr" });

    const draftProject = (await listLaboratoryProjects()).find(
      (item) => item.projectId === projectId
    );
    assert.equal(draftProject?.status, "ready");
    assert.equal(draftProject?.latestEntryId, null);
    assert.equal(draftProject?.reportLocale, "tr");

    const metadataReport = createAnalyzerReport("Metadata bulgusu");
    const motionReport = createAnalyzerReport("Hareket bulgusu");
    const visualReport = createAnalyzerReport("Gorsel bulgu");
    const audioReport = createAnalyzerReport("Ses bulgusu");
    const selection = {
      timeRange: { startSec: 1, endSec: 6 },
      region: { xPct: 10, yPct: 12, widthPct: 40, heightPct: 38 },
    };
    const technicalReport: LaboratoryTechnicalReport = {
      schemaVersion: 3,
      projectId,
      entryId: source.workspaceId,
      workspaceId: source.workspaceId,
      createdAt: new Date().toISOString(),
      overallScore: 0.52,
      riskLevel: "medium",
      interpretation: "Orta duzeyde tutarsizlik sinyali bulundu.",
      mode: "balanced",
      reportLocale: "tr",
      source,
      workflowSettings: source.workflowSettings,
      selection,
      metadata: metadataReport,
      motion: motionReport,
      visual: visualReport,
      audio: audioReport,
      sections: [
        {
          id: "metadata",
          title: "Metadata Analizi",
          status: metadataReport.status,
          score: metadataReport.score,
          summary: metadataReport.summary,
          findings: metadataReport.findings,
          metrics: metadataReport.metrics,
          evidence: metadataReport.evidence,
        },
        {
          id: "motion",
          title: "Hareket Analizi",
          status: motionReport.status,
          score: motionReport.score,
          summary: motionReport.summary,
          findings: motionReport.findings,
          metrics: motionReport.metrics,
          evidence: motionReport.evidence,
        },
        {
          id: "visual",
          title: "Gorsel Analiz",
          status: visualReport.status,
          score: visualReport.score,
          summary: visualReport.summary,
          findings: visualReport.findings,
          metrics: visualReport.metrics,
          evidence: visualReport.evidence,
        },
        {
          id: "audio",
          title: "Ses Analizi",
          status: audioReport.status,
          score: audioReport.score,
          summary: audioReport.summary,
          findings: audioReport.findings,
          metrics: audioReport.metrics,
          evidence: audioReport.evidence,
        },
      ],
    };
    const userReport: LaboratoryUserReport = {
      reportLocale: "tr",
      riskLevel: "medium",
      headline: "Orta risk",
      summary: "Bu klipte incelenmesi gereken orta duzey sinyaller var.",
      highlights: ["Bulgu 1", "Bulgu 2"],
      caveats: ["Sonuc olasiliksaldir."],
    };

    await saveLaboratoryHistoryEntry({
      source,
      selection,
      userReport,
      technicalReport,
    });

    const projectRecord = await readLaboratoryProject(projectId);
    assert.equal(projectRecord?.summary.status, "completed");
    assert.equal(projectRecord?.summary.latestEntryId, source.workspaceId);
    assert.equal(projectRecord?.summary.reportLocale, "tr");
    assert.equal(projectRecord?.latestEntry?.technicalReport.projectId, projectId);
    assert.equal(projectRecord?.latestEntry?.technicalReport.reportLocale, "tr");
    assert.equal(projectRecord?.latestEntry?.technicalReport.workflowSettings.downloadPreset, "best");
    assert.equal(projectRecord?.latestEntry?.technicalReport.workflowSettings.previewPolicy, "dense");
    assert.equal(projectRecord?.latestEntry?.technicalReport.workflowSettings.focus.audio, false);
    assert.equal(projectRecord?.source?.projectId, projectId);
    assert.equal(projectRecord?.source?.workflowSettings.downloadPreset, "best");
    assert.equal(projectRecord?.source?.workflowSettings.previewPolicy, "dense");

    const historyEntry = await readLaboratoryHistoryEntry(source.workspaceId);
    assert.equal(historyEntry?.summary.projectId, projectId);
    assert.equal(historyEntry?.summary.reportLocale, "tr");
    assert.equal(historyEntry?.source.workflowSettings.focus.audio, false);

    const historySummary = (await listLaboratoryHistory()).find(
      (item) => item.projectId === projectId
    );
    assert.equal(historySummary?.entryId, source.workspaceId);
    assert.equal(historySummary?.reportLocale, "tr");
  } finally {
    await deleteLaboratoryProject(projectId);
  }

  const deletedProject = await readLaboratoryProject(projectId);
  assert.equal(deletedProject, null);

  const deletedSummary = (await listLaboratoryProjects()).find(
    (item) => item.projectId === projectId
  );
  assert.equal(deletedSummary, undefined);

  const deletedEntry = await readLaboratoryHistoryEntry(projectId);
  assert.equal(deletedEntry, null);

  const roomDirExists = Paths.getInstalledRoomDir("laboratory");
  assert.equal(typeof roomDirExists, "string");
});
