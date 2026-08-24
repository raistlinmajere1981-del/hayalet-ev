import test from "node:test";
import assert from "node:assert/strict";

import { renderWorkspaceTransformStack } from "../../rooms/laboratory/ui/workspace-transform-stack.ts";

const copy = {
  locale: "en",
  t(_key: string, fallback = "") {
    return fallback;
  },
} as never;

void test("visual stack renders persisted recipe order and explicit movement controls", () => {
  const markup = renderWorkspaceTransformStack(
    {
      editConfig: {
        recipe: {
          video: {
            transformStages: [
              { id: "gamma-1", kind: "gamma", enabled: true, params: { value: 1.8 } },
              { id: "blur-1", kind: "blur", enabled: false, params: { radius: 2 } },
            ],
          },
        },
      },
      sourceKind: "video",
      scope: "visual",
    },
    copy
  );

  assert.ok(markup.indexOf("1. Gamma") < markup.indexOf("2. Blur"));
  assert.match(markup, /data-lab-action="workspace-transform-stage-move"/);
  assert.match(markup, /data-lab-transform-stage-id="gamma-1"/);
  assert.match(markup, /data-lab-transform-stage-id="blur-1"/);
  assert.match(markup, /data-enabled="false"/);
  assert.match(markup, /Preview Stack/);
});

void test("image stack reads image recipe instead of video recipe", () => {
  const markup = renderWorkspaceTransformStack(
    {
      editConfig: {
        recipe: {
          video: {
            transformStages: [
              { id: "gamma-1", kind: "gamma", enabled: true, params: { value: 2 } },
            ],
          },
          image: {
            transformStages: [
              { id: "channel-1", kind: "channel-isolation", enabled: true, params: { channel: "blue" } },
            ],
          },
        },
      },
      sourceKind: "image",
      scope: "visual",
    },
    copy
  );

  assert.match(markup, /RGB isolation/);
  assert.match(markup, /value="blue" selected/);
  assert.doesNotMatch(markup, /data-lab-transform-stage="gamma-1"/);
  assert.doesNotMatch(markup, />1\. Gamma</);
  assert.match(markup, /data-lab-transform-recipe-section="image"/);
});

void test("audio stack exposes only audio transform choices", () => {
  const markup = renderWorkspaceTransformStack(
    {
      editConfig: {
        recipe: {
          audio: {
            transformStages: [
              { id: "band-1", kind: "band-pass", enabled: true, params: { lowHz: 120, highHz: 3200 } },
            ],
          },
        },
      },
      sourceKind: "audio",
      scope: "audio",
    },
    copy
  );

  assert.match(markup, /Band-pass/);
  assert.match(markup, /High-pass/);
  assert.match(markup, /Low-pass/);
  assert.match(markup, /Gain/);
  assert.doesNotMatch(markup, /Brightness/);
  assert.match(markup, /data-lab-transform-recipe-section="audio"/);
});

void test("controls-only visual stack suppresses preview but retains stress-test actions", () => {
  const markup = renderWorkspaceTransformStack(
    {
      editConfig: {
        recipe: {
          video: {
            transformStages: [],
          },
        },
      },
      showPreview: false,
      sourceKind: "video",
      scope: "visual",
      temporalRequest: {
        startSeconds: 10,
        endSeconds: 16,
        sampleFps: 5,
        roi: null,
      },
    },
    copy
  );

  assert.doesNotMatch(markup, /data-lab-transform-comparison="true"/);
  assert.doesNotMatch(markup, /Source \/ Transform \/ Difference/);
  assert.match(markup, /data-lab-temporal-scan="true"/);
  assert.match(markup, /data-lab-control-injection="true"/);
  assert.match(markup, /data-lab-action="workspace-transform-preview"/);
});
