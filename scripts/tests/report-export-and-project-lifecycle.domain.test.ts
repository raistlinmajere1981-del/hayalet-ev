import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRoomBuiltArtifact, createRoomInstalledCopy } from "./helpers/room-installed-copy.ts";
import { createLaboratoryHostActivation } from "../../rooms/laboratory/shared/host/activation.ts";
import { createLaboratoryProjectLifecycleRuntime } from "../../rooms/laboratory/shared/host/project-lifecycle.ts";
import { createMediaExportActionRuntime } from "../../rooms/laboratory/features/media-analysis/host/action-handlers-export.ts";
import { createAudioAnalysisProbeRuntime } from "../../rooms/laboratory/features/audio-analysis/host/analysis-probes.ts";
import { createMediaLocalSourceIntakeRuntime } from "../../rooms/laboratory/features/media-analysis/host/source-intake-local.ts";
import { createLaboratoryJobStateRuntime } from "../../rooms/laboratory/shared/host/job-state.ts";
import { createLaboratoryProcessRuntime } from "../../rooms/laboratory/shared/host/process-runtime.ts";
import { syncSourceLabAssetForProject } from "../../rooms/laboratory/shared/host/lab-assets.ts";
import { createLaboratoryReportExportRuntime } from "../../rooms/laboratory/shared/host/reporting-export.ts";
import {
  createLaboratoryHostUtils,
  sanitizeLaboratoryFileSegment,
  toLaboratoryFfmpegTimestamp,
} from "../../rooms/laboratory/shared/host/host-utils.ts";

describe("report export and project lifecycle", () => {
  void test("laboratory report export registers user and ai report assets", async () => {
    let activeProject = {
      id: "project-report-1",
      slug: "project-report",
      source: {
        kind: "video",
        storedPath: "/tmp/source.mp4",
      },
      report: {
        records: {
          "media-analysis": {
            status: "ready",
            sourceRunId: "run-report-1",
            exports: [],
            aiReport: {
              manifest: {},
            },
            userReport: {
              summary: "Ready",
            },
          },
        },
      },
      assets: [],
    } as Record<string, unknown>;
    const writtenPaths: string[] = [];
    const jobStages: string[] = [];
    const pushedJobStates: Array<Record<string, unknown>> = [];

    function getReportRecord(project: Record<string, unknown>, featureId: string) {
      return ((
        (project["report"] as Record<string, unknown>)["records"] as Record<string, unknown>
      )[featureId] ?? {}) as Record<string, unknown>;
    }

    const reportRuntime = createLaboratoryReportExportRuntime({
      buildReportMarkdown() {
        return "# Report";
      },
      clearJob() {},
      composeFeatureReport(_runtime, project, featureId) {
        return getReportRecord(project, featureId);
      },
      async ensureProjectDirectories() {},
      ensureReportJobSlotAvailable() {},
      getActiveProject() {
        return activeProject as Record<string, unknown> & { id: string; slug: string };
      },
      getFeatureReportDir() {
        return "/tmp/project/report";
      },
      getFeatureReportExportAction() {
        return "report-export";
      },
      getFeatureReportRecord: getReportRecord,
      normalizeReportExport(value) {
        return value !== null && typeof value === "object" && Array.isArray(value) === false
          ? (value as Record<string, unknown>)
          : {};
      },
      async patchActiveProject(_runtime, patcher) {
        activeProject = patcher(
          activeProject as Record<string, unknown> & { id: string; slug: string }
        );
      },
      pushJobState(_api, payload) {
        pushedJobStates.push({ ...payload });
        if (typeof payload["stage"] === "string") {
          jobStages.push(payload["stage"]);
        }
      },
      registerJob() {},
      sanitizeFileSegment(value, fallback) {
        return typeof value === "string" && value.trim() !== "" ? value : fallback;
      },
      setFeatureReportRecord(project, featureId, record) {
        const report = project["report"] as Record<string, unknown>;
        const records = report["records"] as Record<string, unknown>;
        records[featureId] = record;
      },
      async writeTextFile(filePath, _value) {
        writtenPaths.push(filePath);
      },
    });

    await reportRuntime.exportFeatureReport({}, {}, "req-report", "media-analysis");

    assert.deepEqual(jobStages, ["queued", "completed"]);
    assert.equal(writtenPaths.length, 2);
    const assets = activeProject["assets"] as Array<Record<string, unknown>>;
    assert.equal(assets.length, 2);
    assert.deepEqual(
      assets.map((asset) => asset["type"]),
      ["report", "report"]
    );
    assert.deepEqual(
      assets.map((asset) => asset["runId"]),
      ["run-report-1", "run-report-1"]
    );
    assert.deepEqual(
      assets.map((asset) => (asset["metadata"] as Record<string, unknown>)["format"]).sort(),
      ["json", "md"]
    );
    const completedPayload =
      pushedJobStates.find(function (payload) {
        return payload["stage"] === "completed";
      }) ?? null;
    assert.deepEqual(
      completedPayload?.["resultAssetIds"],
      assets.map(function (asset) {
        return asset["id"];
      })
    );
  });

  void test("laboratory project lifecycle serializes concurrent active project asset patches", async () => {
    function asNonEmptyString(value: unknown) {
      return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
    }

    function toRecord(value: unknown): Record<string, unknown> {
      return value !== null && typeof value === "object" && Array.isArray(value) === false
        ? (value as Record<string, unknown>)
        : {};
    }

    const lifecycle = createLaboratoryProjectLifecycleRuntime({
      asNonEmptyString,
      buildEditManifest() {
        return {};
      },
      buildProcessManifest() {
        return {};
      },
      buildProfileManifest() {
        return {};
      },
      buildReportManifest() {
        return {};
      },
      callRoomTools() {
        return {};
      },
      async cancelJobsForProject() {},
      clone<T>(value: T): T {
        return JSON.parse(JSON.stringify(value)) as T;
      },
      createDefaultProfileModelEntry(modelId: string) {
        return { modelId };
      },
      createDefaultToolEntry(toolId: string) {
        return { toolId };
      },
      createDefaultToolState() {
        return { schemaVersion: 1, tools: {}, updatedAt: null };
      },
      createProjectRecord() {
        return {};
      },
      defaultFeatureId: "media-analysis",
      async ensureProjectDirectories() {},
      findProject(runtime: Record<string, unknown>, projectId: unknown) {
        const projects = runtime["projects"] as Array<Record<string, unknown>>;
        return (
          projects.find(function (project) {
            return (
              (typeof project["id"] === "string" ? project["id"] : "") ===
              (typeof projectId === "string" ? projectId : "")
            );
          }) ?? null
        );
      },
      getActiveProject(runtime: Record<string, unknown>) {
        const projects = runtime["projects"] as Array<Record<string, unknown>>;
        return (
          projects.find(function (project) {
            return (
              (typeof project["id"] === "string" ? project["id"] : "") ===
              (typeof runtime["activeProjectId"] === "string" ? runtime["activeProjectId"] : "")
            );
          }) ?? null
        );
      },
      getFeatureIdFromContext() {
        return "media-analysis";
      },
      getProjectDir() {
        return "/tmp/laboratory/project-parallel";
      },
      getProjectEditManifestPath() {
        return "/tmp/laboratory/edit-manifest.json";
      },
      getProjectMetaPath() {
        return "/tmp/laboratory/project.json";
      },
      getProjectProcessManifestPath() {
        return "/tmp/laboratory/process-manifest.json";
      },
      getProjectProfileManifestPath() {
        return "/tmp/laboratory/profile-manifest.json";
      },
      getProjectReportManifestPath() {
        return "/tmp/laboratory/report-manifest.json";
      },
      getRuntimeToolIds() {
        return [];
      },
      listDirectory() {
        return [];
      },
      loadContext() {
        return {};
      },
      normalizeProject(rawValue: unknown) {
        return toRecord(rawValue);
      },
      pushBootstrapState() {},
      readJsonFile() {
        return {};
      },
      async refreshProfileModelState() {},
      roomId: "laboratory",
      syncProjectFeatureProjections() {},
      toRecord,
      updateProjectTimestamps(project: Record<string, unknown>) {
        project["updatedAt"] = "2026-05-17T02:30:00.000Z";
      },
      async writeJsonFile() {
        await Promise.resolve();
      },
    } as unknown as Parameters<typeof createLaboratoryProjectLifecycleRuntime>[0]);

    type LifecycleRuntime = Parameters<typeof lifecycle.patchActiveProject>[0];
    const runtime = {
      activeProjectId: "project-parallel",
      bootstrap: {
        active: false,
        currentStep: 0,
        currentStepId: null,
        error: null,
        message: null,
        status: "ready",
        steps: [],
        totalSteps: 0,
      },
      editPresets: {},
      hydrated: true,
      hydrating: null,
      paths: {
        projectsDir: "/tmp/laboratory/projects",
        toolStatePath: "/tmp/laboratory/tool-state.json",
      },
      profileCapabilities: {},
      profileModelState: {
        activeLanguage: null,
        activeModelId: null,
        activeVariant: null,
        models: {},
        schemaVersion: 1,
        updatedAt: null,
      },
      profileModels: {},
      profilePresets: {},
      projects: [
        {
          assets: [],
          id: "project-parallel",
          source: {
            status: "ready",
            storedPath: "/tmp/laboratory/source.png",
          },
        },
      ],
      sourcePresets: {},
      toolState: {
        schemaVersion: 1,
        tools: {},
        updatedAt: null,
      },
    } as unknown as LifecycleRuntime;

    await Promise.all([
      lifecycle.patchActiveProject(runtime, function (project) {
        return {
          ...project,
          assets: [
            ...((project.assets as Array<Record<string, unknown>> | undefined) ?? []),
            { id: "asset-primary-crop", type: "image" },
          ],
        };
      }),
      lifecycle.patchActiveProject(runtime, function (project) {
        return {
          ...project,
          assets: [
            ...((project.assets as Array<Record<string, unknown>> | undefined) ?? []),
            { id: "asset-reference-crop", type: "image" },
          ],
        };
      }),
    ]);

    const activeProject = runtime.projects[0] as Record<string, unknown>;
    const assetIds = (activeProject["assets"] as Array<Record<string, unknown>>)
      .map(function (asset) {
        return asset["id"];
      })
      .sort();
    assert.deepEqual(assetIds, ["asset-primary-crop", "asset-reference-crop"]);
  });
});
