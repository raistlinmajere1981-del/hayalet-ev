import assert from "node:assert/strict";
import test from "node:test";

import { createMediaEditArtifactRuntime } from "../../rooms/laboratory/features/media-analysis/host/edit-artifacts.ts";
import { getInteractiveSettings } from "../../rooms/laboratory/runtime/selectors/lab-workspace-media-selectors.ts";
import { readLaboratoryTransformStackRenderContext } from "../../rooms/laboratory/shared/transform-stack-render-context.ts";
import { renderWorkspaceTransformStack } from "../../rooms/laboratory/ui/workspace-transform-stack.ts";

function createArtifactRuntime(calls: Array<Record<string, unknown>>) {
  return createMediaEditArtifactRuntime({
    asNonEmptyString(value: unknown) {
      return typeof value === "string" && value.trim() !== "" ? value : null;
    },
    asNumber(value: unknown) {
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    },
    buildBaselineEditCommand(_runtime, _project, targetPath) {
      return ["-y", "-i", "/source/input.png", targetPath];
    },
    async callRoomTools(payload) {
      calls.push(payload);
      return { run: { exitCode: 0 } };
    },
    clampNumber(value: unknown, min: number, max: number, fallback: number) {
      const numeric = typeof value === "number" && Number.isFinite(value) ? value : fallback;
      return Math.max(min, Math.min(max, numeric));
    },
    getProjectEditDir() {
      return "/project/edit";
    },
    getProjectEditOutputDir() {
      return "/project/edit/output";
    },
    getProjectEditPreviewDir() {
      return "/project/edit/preview";
    },
    async listDirectory() {
      return [];
    },
    roomId: "laboratory",
    toRecord(value: unknown) {
      return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    },
  });
}

void test("visual preview builds a transform-free baseline and true FFmpeg difference artifact", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const runtime = createArtifactRuntime(calls);
  const artifacts = await runtime.buildAuxiliaryArtifacts(
    {},
    {
      source: { kind: "image" },
      edit: {
        recipe: {
          image: {
            transformStages: [
              { id: "gamma-1", kind: "gamma", enabled: true, params: { value: 1.6 } },
            ],
          },
        },
      },
    },
    {
      baseName: "stress-preview",
      jobId: "job-1",
      mode: "preview",
      outputPath: "/project/edit/preview/stress-preview.png",
      requestId: "req-1",
    }
  );

  assert.equal(calls.length, 2);
  const baselineArgs = calls[0]?.["args"] as string[];
  const differenceArgs = calls[1]?.["args"] as string[];
  assert.equal(baselineArgs.at(-1), "/project/edit/preview/stress-preview-transform-source.png");
  assert.ok(differenceArgs.includes("/project/edit/preview/stress-preview-transform-source.png"));
  assert.ok(differenceArgs.includes("/project/edit/preview/stress-preview.png"));
  assert.match(differenceArgs.join(" "), /blend=all_mode=difference/);
  assert.deepEqual(
    artifacts.map((entry) => entry.kind),
    ["transform-source-baseline", "transform-difference"]
  );
  assert.equal(artifacts[1]?.metadata?.["differenceMethod"], "ffmpeg-blend-difference");
});

void test("disabled-only visual stacks do not generate misleading difference artifacts", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const runtime = createArtifactRuntime(calls);
  const artifacts = await runtime.buildAuxiliaryArtifacts(
    {},
    {
      source: { kind: "image" },
      edit: {
        recipe: {
          image: {
            transformStages: [
              { id: "blur-1", kind: "blur", enabled: false, params: { radius: 2 } },
            ],
          },
        },
      },
    },
    {
      baseName: "stress-preview",
      mode: "preview",
      outputPath: "/project/edit/preview/stress-preview.png",
    }
  );

  assert.equal(calls.length, 0);
  assert.deepEqual(artifacts, []);
});

void test("workspace transform context exposes current source transform and difference URLs", () => {
  const settings = getInteractiveSettings({
    featureId: "media-analysis",
    run: null,
    source: {
      kind: "image",
      previewUrl: "file:///source.png",
    },
    editConfig: {
      preview: {
        status: "ready",
        previewUrl: "file:///transform.png",
        artifacts: [
          { kind: "transform-source-baseline", previewUrl: "file:///baseline.png" },
          { kind: "transform-difference", previewUrl: "file:///difference.png" },
        ],
      },
    },
    ui: {
      workspace: {
        comparisonReferenceAssetId: null,
        comparisonViewMode: "difference",
        interactiveSettings: {
          brightness: 100,
          contrast: 100,
          gamma: 1,
          saturation: 100,
          hueRotate: 0,
          sharpness: 100,
          channelR: true,
          channelG: true,
          channelB: true,
          edgeHighlight: false,
          invert: false,
        },
      },
    },
  } as never);
  const context = readLaboratoryTransformStackRenderContext(settings);

  assert.equal(context?.sourcePreviewUrl, "file:///source.png");
  assert.equal(context?.baselinePreviewUrl, "file:///baseline.png");
  assert.equal(context?.transformPreviewUrl, "file:///transform.png");
  assert.equal(context?.differencePreviewUrl, "file:///difference.png");
  assert.equal(context?.transformPreviewMode, "difference");
});

void test("visual transform stack renders state-backed Source Transform Difference selection", () => {
  const markup = renderWorkspaceTransformStack({
    baselinePreviewUrl: "file:///baseline.png",
    differencePreviewUrl: "file:///difference.png",
    editConfig: {
      recipe: {
        image: {
          transformStages: [
            { id: "gamma-1", kind: "gamma", enabled: true, params: { value: 1.6 } },
          ],
        },
      },
    },
    featureId: "media-analysis",
    locked: false,
    previewStatus: "ready",
    sourceKind: "image",
    sourcePreviewUrl: "file:///source.png",
    scope: "visual",
    transformPreviewMode: "difference",
    transformPreviewUrl: "file:///transform.png",
  });

  assert.match(markup, /Source \/ Transform \/ Difference/);
  assert.match(markup, /data-lab-field="workspace\.comparison\.viewMode"/);
  assert.match(markup, /option value="difference" selected/);
  assert.match(markup, /src="file:\/\/\/difference\.png"/);
  assert.match(markup, /Difference is the pixel difference between the aligned outputs/);
});
