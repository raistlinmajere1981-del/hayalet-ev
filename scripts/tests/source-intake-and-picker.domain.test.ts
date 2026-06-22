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

describe("source intake and picker", () => {
  void test("laboratory source intake no longer exposes asset source promotion", () => {
    const sourceRuntime = createMediaLocalSourceIntakeRuntime({
      asNonEmptyString(value: unknown) {
        return typeof value === "string" && value.trim() !== "" ? value : null;
      },
      getActiveProject() {
        return {
          id: "project-asset-source",
          source: { kind: "video", status: "ready", storedPath: "/tmp/source.mp4" },
          assets: [],
        };
      },
      getElectronApi() {
        return null;
      },
      getProjectSourceDir() {
        return "/tmp/project/sources";
      },
      getSourceConfig() {
        return {};
      },
      normalizeMimeType(_fileName: unknown, kind: string) {
        return kind === "audio" ? "audio/wav" : kind === "image" ? "image/png" : "video/mp4";
      },
      async patchActiveProject() {},
      resetEditForCurrentSource() {},
      resetProfileForCurrentSource() {},
      resolvePreparedSource() {
        throw new Error("not used");
      },
    });

    assert.equal("handleAssetAsSource" in sourceRuntime, false);
  });

  void test("laboratory local source picker uses requested import kind filters", async () => {
    let activeProject = {
      id: "project-local-source",
      source: {
        kind: "video",
        status: "idle",
      },
    } as Record<string, unknown> & { source: Record<string, unknown> };
    const requestedKinds: unknown[] = [];
    const dialogFilters: unknown[] = [];
    const selectedPaths = ["/tmp/sound.wav", "/tmp/frame.png"];

    const sourceRuntime = createMediaLocalSourceIntakeRuntime({
      asNonEmptyString(value: unknown) {
        return typeof value === "string" && value.trim() !== "" ? value : null;
      },
      getActiveProject() {
        return activeProject;
      },
      getElectronApi(): any {
        return {
          copyFileTo(sourcePath: string, destinationDir: string) {
            const fileName = sourcePath.split(/[\\/]/).pop() ?? "source.bin";
            return {
              success: true,
              path: `${destinationDir}/${fileName}`,
              name: fileName,
            };
          },
          showOpenDialog(options: Record<string, unknown>) {
            dialogFilters.push(options["filters"]);
            return {
              canceled: false,
              filePaths: [selectedPaths[dialogFilters.length - 1]],
            };
          },
        };
      },
      getProjectSourceDir() {
        return "/tmp/project/sources";
      },
      getSourceConfig(_sourcePresets, sourceKind) {
        requestedKinds.push(sourceKind);
        if (sourceKind === "audio") {
          return { fileDialogFilters: [{ name: "Audio", extensions: ["wav"] }] };
        }
        if (sourceKind === "image") {
          return { fileDialogFilters: [{ name: "Images", extensions: ["png"] }] };
        }
        return { fileDialogFilters: [{ name: "Video", extensions: ["mp4"] }] };
      },
      normalizeMimeType(_fileName: unknown, kind: string) {
        return kind === "audio" ? "audio/wav" : kind === "image" ? "image/png" : "video/mp4";
      },
      async patchActiveProject(_runtime, updater) {
        activeProject = updater(activeProject);
      },
      resetEditForCurrentSource() {},
      resetProfileForCurrentSource() {},
      async resolvePreparedSource(_runtime, _project, options) {
        return {
          metadata: null,
          metadataError: null,
          mimeType: options["mimeType"] as string,
          storedFileName: options["storedFileName"] as string,
          storedPath: options["storedPath"] as string,
        };
      },
    });

    await sourceRuntime.handleLocalPick({}, {}, "req-audio", { kind: "audio" });
    await sourceRuntime.handleLocalPick({}, {}, "req-image", { kind: "image" });

    assert.deepEqual(requestedKinds, ["audio", "image"]);
    assert.deepEqual(dialogFilters, [
      [{ name: "Audio", extensions: ["wav"] }],
      [{ name: "Images", extensions: ["png"] }],
    ]);
    assert.equal(activeProject.source["kind"], "image");
    assert.equal(activeProject.source["storedFileName"], "frame.png");
    assert.equal(activeProject.source["mimeType"], "image/png");
  });

  void test("laboratory local source picker validates auto-detected image sources as images", async () => {
    let activeProject = {
      id: "project-auto-image-source",
      source: {
        kind: "video",
        status: "idle",
      },
    } as Record<string, unknown> & { source: Record<string, unknown> };
    const preparedKinds: unknown[] = [];

    const sourceRuntime = createMediaLocalSourceIntakeRuntime({
      asNonEmptyString(value: unknown) {
        return typeof value === "string" && value.trim() !== "" ? value : null;
      },
      getActiveProject() {
        return activeProject;
      },
      getElectronApi(): any {
        return {
          copyFileTo() {
            return {
              success: true,
              path: "/tmp/project/sources/frame.png",
              name: "frame.png",
            };
          },
          showOpenDialog() {
            return {
              canceled: false,
              filePaths: ["/tmp/frame.png"],
            };
          },
        };
      },
      getProjectSourceDir() {
        return "/tmp/project/sources";
      },
      getSourceConfig(_sourcePresets, sourceKind) {
        if (sourceKind === "image") {
          return { fileDialogFilters: [{ name: "Images", extensions: ["png"] }] };
        }
        if (sourceKind === "audio") {
          return { fileDialogFilters: [{ name: "Audio", extensions: ["wav"] }] };
        }
        return { fileDialogFilters: [{ name: "Video", extensions: ["mp4"] }] };
      },
      normalizeMimeType(_fileName: unknown, kind: string) {
        return kind === "image" ? "image/png" : "video/mp4";
      },
      async patchActiveProject(_runtime, updater) {
        activeProject = updater(activeProject);
      },
      resetEditForCurrentSource() {},
      resetProfileForCurrentSource() {},
      async resolvePreparedSource(_runtime, project, options) {
        preparedKinds.push(project.source["kind"]);
        return {
          metadata: null,
          metadataError: null,
          mimeType: options["mimeType"] as string,
          storedFileName: options["storedFileName"] as string,
          storedPath: options["storedPath"] as string,
        };
      },
    });

    await sourceRuntime.handleLocalPick({}, {}, "req-auto-image", { kind: "auto" });

    assert.deepEqual(preparedKinds, ["image"]);
    assert.equal(activeProject.source["kind"], "image");
    assert.equal(activeProject.source["mimeType"], "image/png");
  });
});
