import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizeLabOperationSettings } from "../../rooms/laboratory/domain/lab-capabilities.ts";
import { LAB_OPERATION_SETTINGS_FIELDS } from "../../rooms/laboratory/domain/lab-operation-settings.ts";
import {
  buildImageComparisonTransformCss,
  getImageComparisonMarkerMetrics,
  readImageComparisonGeometry,
} from "../../rooms/laboratory/domain/lab-image-comparison-workbench.ts";
import { renderLabSettingsFields } from "../../rooms/laboratory/ui/lab-settings-controls.ts";

test("image comparison settings expose independent A/B geometry and half-face composition", function () {
  const settings = normalizeLabOperationSettings("image-comparison", {
    primaryZoom: 2,
    primaryAspectLock: true,
    primaryScaleX: 3,
    primaryScaleY: 0.5,
    primaryOffsetX: 12,
    primaryOffsetY: -8,
    primaryRotation: 4,
    referenceZoom: 1.25,
    referenceAspectLock: false,
    referenceScaleX: 1.2,
    referenceScaleY: 0.8,
    compositeMode: "reference-left-primary-right",
    manipulationMode: "resize",
    showImageFrames: false,
  });
  const geometry = readImageComparisonGeometry(settings);

  assert.equal(geometry.compositeMode, "reference-left-primary-right");
  assert.equal(settings.manipulationMode, "resize");
  assert.equal(settings.showImageFrames, false);
  assert.equal(geometry.transforms.primary.aspectLocked, true);
  assert.equal(geometry.transforms.reference.aspectLocked, false);
  assert.match(buildImageComparisonTransformCss(geometry.transforms.primary), /scale\(2, 2\)/);
  assert.match(buildImageComparisonTransformCss(geometry.transforms.primary), /translate\(12%, -8%\)/);
  assert.match(buildImageComparisonTransformCss(geometry.transforms.primary), /rotate\(4deg\)/);
  assert.match(buildImageComparisonTransformCss(geometry.transforms.reference), /scale\(1\.5, 1\)/);
});

test("manual comparison markers produce normalized geometry without identity scoring", function () {
  const settings = normalizeLabOperationSettings("image-comparison", {
    marker1Enabled: true,
    marker1Side: "primary",
    marker1X: 10,
    marker1Y: 10,
    marker2Enabled: true,
    marker2Side: "primary",
    marker2X: 40,
    marker2Y: 50,
    marker3Enabled: true,
    marker3Side: "primary",
    marker3X: 70,
    marker3Y: 10,
    referenceZoom: 1,
  });
  const metrics = getImageComparisonMarkerMetrics(settings);

  assert.equal(metrics.primary.count, 3);
  assert.equal(Number(metrics.primary.d12?.toFixed(2)), 50);
  assert.equal(Number(metrics.primary.d23?.toFixed(2)), 50);
  assert.equal(Number(metrics.primary.d13?.toFixed(2)), 60);
  assert.equal(metrics.reference.count, 0);
});

test("comparison settings split precise move and resize controls into icon tools", function () {
  const moveSettings = normalizeLabOperationSettings("image-comparison", {
    manipulationMode: "move",
    showImageFrames: false,
  });
  const moveMarkup = renderLabSettingsFields({
    fields: LAB_OPERATION_SETTINGS_FIELDS["image-comparison"],
    prefix: "operationSettings.image-comparison",
    resetAction: "operation-settings-reset",
    resetValue: "image-comparison",
    settings: moveSettings,
    title: "Settings",
    variant: "inline",
  });

  assert.match(moveMarkup, /data-lab-image-comparison-toolbox="true"/);
  assert.match(moveMarkup, /data-lab-comparison-tool-mode="true"/);
  assert.match(moveMarkup, /value="move"[^>]*checked/);
  assert.match(moveMarkup, /primaryOffsetX/);
  assert.doesNotMatch(moveMarkup, /primaryZoom/);
  assert.match(moveMarkup, /showImageFrames/);
  assert.doesNotMatch(moveMarkup, /showImageFrames"[^>]*checked/);

  const resizeSettings = normalizeLabOperationSettings("image-comparison", {
    manipulationMode: "resize",
  });
  const resizeMarkup = renderLabSettingsFields({
    fields: LAB_OPERATION_SETTINGS_FIELDS["image-comparison"],
    prefix: "operationSettings.image-comparison",
    resetAction: "operation-settings-reset",
    resetValue: "image-comparison",
    settings: resizeSettings,
    title: "Settings",
    variant: "inline",
  });

  assert.match(resizeMarkup, /value="resize"[^>]*checked/);
  assert.match(resizeMarkup, /primaryZoom/);
  assert.match(resizeMarkup, /referenceScaleY/);
  assert.doesNotMatch(resizeMarkup, /primaryOffsetX/);
});

test("comparison renderer applies transform, composite clipping, guides and markers in the workspace", function () {
  const surface = readFileSync(
    new URL("../../rooms/laboratory/ui/workspace-surface.ts", import.meta.url),
    "utf8"
  );
  const settings = readFileSync(
    new URL("../../rooms/laboratory/domain/lab-operation-settings.ts", import.meta.url),
    "utf8"
  );
  const styles = readFileSync(
    new URL(
      "../../rooms/laboratory/ui/styles/lab-image-comparison-tools.css",
      import.meta.url
    ),
    "utf8"
  );
  const controls = readFileSync(
    new URL("../../rooms/laboratory/ui/workspace-operation-controls.ts", import.meta.url),
    "utf8"
  );
  const mouseTools = readFileSync(
    new URL("../../rooms/laboratory/ui/lab-image-comparison-mouse-tools.ts", import.meta.url),
    "utf8"
  );

  assert.match(surface, /buildImageComparisonTransformCss/);
  assert.match(surface, /data-composite-mode=/);
  assert.match(surface, /labx-workspace-comparison__image--left/);
  assert.match(surface, /labx-workspace-comparison__marker/);
  assert.match(surface, /toolSettings: imageComparisonSettings/);
  assert.match(settings, /primaryAspectLock/);
  assert.match(settings, /referenceAspectLock/);
  assert.match(settings, /primaryOffsetX/);
  assert.match(settings, /referenceRotation/);
  assert.match(settings, /primary-left-reference-right/);
  assert.match(settings, /reference-left-primary-right/);
  assert.match(settings, /marker3Y/);
  assert.match(styles, /labx-workspace-comparison__center-guide/);
  assert.match(styles, /labx-operation-card__geometry-metrics/);
  assert.match(styles, /showImageFrames/);
  assert.match(styles, /data-lab-comparison-tool-mode/);
  assert.match(controls, /data-lab-comparison-manual-metrics/);
  assert.match(controls, /kimlik doğrulama skoru değildir/);
  assert.match(mouseTools, /stopImmediatePropagation/);
  assert.match(mouseTools, /initialOffsetX/);
  assert.match(mouseTools, /initialScaleX/);
  assert.match(mouseTools, /initialZoom/);
});
