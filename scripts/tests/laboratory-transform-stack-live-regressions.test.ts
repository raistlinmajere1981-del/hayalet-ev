import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildLaboratoryTransformStackRecipePatch,
  readLaboratoryTransformStackActionResult,
} from "../../rooms/laboratory/runtime/controller/lab-transform-stack-live-controller.ts";
import {
  attachLaboratoryTransformStackRenderContext,
  readLaboratoryTransformStackRenderContext,
} from "../../rooms/laboratory/shared/transform-stack-render-context.ts";
import { renderWorkspaceAudioFocus } from "../../rooms/laboratory/ui/workspace-audio-focus.ts";
import {
  renderWorkspaceInteractiveControls,
  renderWorkspaceVisualTransformControls,
} from "../../rooms/laboratory/ui/workspace-interactive-controls.ts";

const copy = {
  locale: "en",
  t(_key: string, fallback = "") {
    return fallback;
  },
} as never;

void test("transform render context is non-enumerable and remains readable by inspector renderers", () => {
  const settings = attachLaboratoryTransformStackRenderContext(
    {
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
    {
      editConfig: {
        recipe: {
          video: {
            transformStages: [
              { id: "gamma-live", kind: "gamma", enabled: true, params: { value: 1.7 } },
            ],
          },
        },
      },
      featureId: "media-analysis",
      locked: false,
      sourceKind: "video",
    }
  );

  assert.equal(Object.keys(settings).includes("transformStack"), false);
  assert.equal(readLaboratoryTransformStackRenderContext(settings)?.sourceKind, "video");

  const liveMarkup = renderWorkspaceInteractiveControls(settings, copy);
  const transformMarkup = renderWorkspaceVisualTransformControls(settings, copy);
  assert.doesNotMatch(liveMarkup, /data-lab-transform-stack="visual"/);
  assert.match(transformMarkup, /data-lab-transform-stack="visual"/);
  assert.match(transformMarkup, /data-lab-transform-stage="gamma-live"/);
  assert.match(transformMarkup, /data-lab-transform-recipe-section="video"/);
  assert.match(liveMarkup, /workspace view/);
  assert.match(liveMarkup, /Visual Transform Stack/);
  assert.match(transformMarkup, /data-lab-action-feedback="true"/);
});

void test("audio inspector renders the reproducible audio stack beside live audition controls", () => {
  const audioFocus = attachLaboratoryTransformStackRenderContext(
    {
      gain: 1,
      filterType: "none" as const,
      filterFrequency: 1000,
      filterQ: 1,
      playbackRate: 1,
      preservePitch: true,
      visualizationMode: "waveform" as const,
      eqBands: [],
    },
    {
      editConfig: {
        recipe: {
          audio: {
            transformStages: [
              {
                id: "band-live",
                kind: "band-pass",
                enabled: true,
                params: { lowHz: 120, highHz: 3200 },
              },
            ],
          },
        },
      },
      featureId: "audio-analysis",
      locked: false,
      sourceKind: "audio",
    }
  );

  const markup = renderWorkspaceAudioFocus(audioFocus, {}, copy);
  assert.match(markup, /data-lab-transform-stack="audio"/);
  assert.match(markup, /data-lab-transform-stage="band-live"/);
  assert.match(markup, /data-lab-transform-feature-id="audio-analysis"/);
  assert.match(markup, /reproducible audio recipe/);
});

void test("locked transform stack disables mutation and preview controls", () => {
  const settings = attachLaboratoryTransformStackRenderContext(
    {
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
    {
      editConfig: {
        recipe: {
          image: {
            transformStages: [
              { id: "bright-live", kind: "brightness", enabled: true, params: { value: 0.2 } },
            ],
          },
        },
      },
      featureId: "media-analysis",
      locked: true,
      sourceKind: "image",
    }
  );

  const markup = renderWorkspaceVisualTransformControls(settings, copy);
  assert.match(markup, /data-lab-transform-locked="true"/);
  assert.match(markup, /data-lab-transform-stage-enabled="true"\s+disabled/);
  assert.match(markup, /data-lab-action="workspace-transform-preview"[\s\S]*?disabled/);
});

void test("transform action feedback resolves only matching terminal host results", () => {
  assert.deepEqual(
    readLaboratoryTransformStackActionResult({
      type: "lab-event",
      payload: {
        action: "edit-preview",
        kind: "request-result",
        requestId: "request-preview-1",
        stage: "completed",
      },
    }),
    {
      action: "edit-preview",
      requestId: "request-preview-1",
      state: "success",
    }
  );
  assert.deepEqual(
    readLaboratoryTransformStackActionResult({
      type: "lab-event",
      payload: {
        action: "edit-control-injection",
        kind: "request-result",
        requestId: "request-control-1",
        stage: "failed",
      },
    }),
    {
      action: "edit-control-injection",
      requestId: "request-control-1",
      state: "error",
    }
  );
  assert.equal(
    readLaboratoryTransformStackActionResult({
      type: "media-state",
      payload: { requestId: "request-preview-1" },
    }),
    null
  );
});

void test("live controller builds the same ordered recipe patch that host edit-update-recipe consumes", () => {
  const patch = buildLaboratoryTransformStackRecipePatch(
    {
      featureId: "media-analysis",
      locked: false,
      recipeSection: "video",
      scope: "visual",
      stages: [
        { id: "gamma-1", kind: "gamma", enabled: true, params: { value: 1.5 } },
        { id: "blur-1", kind: "blur", enabled: true, params: { radius: 2 } },
      ],
    } as never,
    { type: "move", stageId: "blur-1", direction: "up" }
  );

  assert.deepEqual(patch, {
    video: {
      transformStages: [
        { id: "blur-1", kind: "blur", enabled: true, params: { radius: 2 } },
        { id: "gamma-1", kind: "gamma", enabled: true, params: { value: 1.5 } },
      ],
    },
  });
});

void test("Laboratory UI entry explicitly installs the transform stack interaction binder", async () => {
  const source = await readFile("rooms/laboratory/ui/index.ts", "utf8");
  const controllerSource = await readFile(
    "rooms/laboratory/runtime/controller/lab-transform-stack-live-controller.ts",
    "utf8"
  );
  assert.match(source, /bindLaboratoryTransformStackInteractions/);
  assert.match(source, /documentRef: document/);
  assert.match(source, /windowRef: window/);
  assert.match(controllerSource, /onHostMessage/);
});
