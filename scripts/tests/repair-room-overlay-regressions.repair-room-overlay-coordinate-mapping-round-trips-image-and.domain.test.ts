import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveRepairAssetUrl } from "../../rooms/repair-room/ui/repair-asset-url.ts";
import {
  getContainedImageFrame,
  imagePointToStagePoint,
  imageRectToStageRect,
  stagePointToImagePoint,
} from "../../rooms/repair-room/ui/overlay/overlay-coords.ts";
import {
  applyRepairOverlaySelectionMode,
  getRepairFocusFrame,
  getRepairMarqueeSelection,
  getRepairSnapAssist,
  repairImageRectsIntersect,
} from "../../rooms/repair-room/ui/overlay/overlay-geometry.ts";

function countGridTemplateTracks(template: string): number {
  if (template === "none") return 0;
  return template.trim().split(/\s+/).filter(Boolean).length;
}

function readRepairUiStyleText(): string {
  const uiRoot = join(process.cwd(), "rooms/repair-room/ui");
  const entry = readFileSync(join(uiRoot, "style.css"), "utf8");
  const imported = [...entry.matchAll(/@import "\.\/styles\/([^"]+)";/g)]
    .map((match) => readFileSync(join(uiRoot, "styles", match[1] ?? ""), "utf8"))
    .join("\n");
  return `${entry}\n${imported}`;
}

function readRepairUiRuntimeText(): string {
  const uiRoot = join(process.cwd(), "rooms/repair-room/ui");
  return [
    "repair-room-ui-runtime.ts",
    "runtime/actions.ts",
    "runtime/capture-status-handlers.ts",
    "runtime/dictation-composer.ts",
    "runtime/measurement-dom.ts",
    "runtime/overlay-runtime.ts",
    "runtime/panel-signatures.ts",
    "runtime/sync-inspector-dom.ts",
    "runtime/tactical-feed-dom.ts",
    "runtime/visual-timeline-dom.ts",
  ]
    .map((relativePath) => readFileSync(join(uiRoot, relativePath), "utf8"))
    .join("\n");
}

class RepairFakeElement {
  children: RepairFakeElement[] = [];
  parentElement: RepairFakeElement | null = null;
  dataset: Record<string, string> = {};
  className = "";
  textContent = "";
  innerHTML = "";
  type = "";
  title = "";
  value = "";
  draggable = true;
  style: Record<string, string> = {};

  constructor(readonly tagName: string) {}

  append(...children: RepairFakeElement[]): void {
    children.forEach((child) => {
      child.parentElement = this;
      this.children.push(child);
    });
  }
}

class RepairFakeDocument {
  createElement(tagName: string): RepairFakeElement {
    return new RepairFakeElement(tagName.toLowerCase());
  }
}

function findRepairFakeElements(
  root: RepairFakeElement,
  predicate: (element: RepairFakeElement) => boolean
): RepairFakeElement[] {
  const matches: RepairFakeElement[] = [];
  if (predicate(root)) matches.push(root);
  root.children.forEach((child) => {
    matches.push(...findRepairFakeElements(child, predicate));
  });
  return matches;
}



describe("repair-room overlay coordinate mapping round-trips image and stage space", () => {
void test("repair-room overlay coordinate mapping round-trips image and stage space", () => {
  const frame = getContainedImageFrame(1000, 600, 1600, 900);
  assert.equal(frame.widthPx, 1000);
  assert.equal(frame.heightPx, 562.5);
  assert.equal(frame.leftPx, 0);
  assert.equal(frame.topPx, 18.75);

  const viewport = { zoom: 1.5, panXPx: 24, panYPx: -12 };
  const stagePoint = imagePointToStagePoint({ xPx: 400, yPx: 180 }, frame, viewport);
  const imagePoint = stagePointToImagePoint(stagePoint, frame, viewport);
  assert.equal(Math.round(imagePoint.xPx), 400);
  assert.equal(Math.round(imagePoint.yPx), 180);

  const stageRect = imageRectToStageRect(
    { xPx: 100, yPx: 80, widthPx: 240, heightPx: 120 },
    frame,
    viewport
  );
  assert.equal(stageRect.widthPx, 225);
  assert.equal(stageRect.heightPx, 112.5);
});
void test("repair-room Phase 2.8 geometry helpers cover marquee, refs, snap, and focus framing", () => {
  assert.equal(
    repairImageRectsIntersect(
      { xPx: 10, yPx: 10, widthPx: 20, heightPx: 20 },
      { xPx: 25, yPx: 25, widthPx: 10, heightPx: 10 }
    ),
    true
  );

  const selected = getRepairMarqueeSelection({ xPx: 0, yPx: 0, widthPx: 80, heightPx: 80 }, [
    { ref: { kind: "event", id: "evt-a" }, rect: { xPx: 20, yPx: 20, widthPx: 20, heightPx: 20 } },
    {
      ref: { kind: "investigation-region", id: "region-b" },
      rect: { xPx: 120, yPx: 120, widthPx: 20, heightPx: 20 },
    },
  ]);
  assert.deepEqual(selected, [{ kind: "event", id: "evt-a" }]);

  assert.deepEqual(
    applyRepairOverlaySelectionMode(
      [{ kind: "event", id: "evt-a" }],
      [
        { kind: "event", id: "evt-a" },
        { kind: "knowledge-region", id: "k1" },
      ],
      "toggle"
    ),
    [{ kind: "knowledge-region", id: "k1" }]
  );

  const softSnap = getRepairSnapAssist({ xPx: 48, yPx: 50 }, [{ xPx: 52, yPx: 50 }], 8, 2, false);
  assert.equal(softSnap?.softGuide, true);
  assert.equal(softSnap.hardSnap, false);
  const hardSnap = getRepairSnapAssist({ xPx: 51, yPx: 50 }, [{ xPx: 52, yPx: 50 }], 8, 2, true);
  assert.equal(hardSnap?.hardSnap, true);

  assert.deepEqual(
    getRepairFocusFrame({ xPx: 4, yPx: 4, widthPx: 20, heightPx: 20 }, 100, 80, 12),
    { xPx: 0, yPx: 0, widthPx: 36, heightPx: 36 }
  );
});
void test("repair-room keeps Konva pinned and isolated to the overlay module", () => {
  const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
  };
  assert.equal(packageJson.dependencies?.["konva"], "10.3.0");

  const overlayStagePath = join(process.cwd(), "rooms/repair-room/ui/overlay/overlay-stage.ts");
  const workbenchPanelPath = join(
    process.cwd(),
    "rooms/repair-room/ui/panels/workbench-stage-panel.ts"
  );
  const vendorPath = join(process.cwd(), "rooms/repair-room/shared/vendor/konva.min.js");
  assert.equal(existsSync(overlayStagePath), true);
  assert.equal(existsSync(vendorPath), true);
  const overlayStage = readFileSync(overlayStagePath, "utf8");
  const konvaLoader = readFileSync(
    join(process.cwd(), "rooms/repair-room/ui/overlay/konva-loader.ts"),
    "utf8"
  );
  assert.match(konvaLoader, /shared\/vendor\/konva\.min\.js/);
  assert.match(overlayStage, /loadKonvaNamespace/);
  assert.doesNotMatch(overlayStage, /import\("konva"\)/);
  assert.doesNotMatch(readFileSync(workbenchPanelPath, "utf8"), /from "konva"|import\("konva"\)/);
});
void test("repair-room resolves runtime assets from the UI entry directory", () => {
  const baseHref =
    "file:///home/raistlin/hayalet-ev/rooms/.build/repair-room/runtime/ui/index.html";

  assert.equal(
    resolveRepairAssetUrl("shared/assets/mock-pcb/atx-psu-top.svg", baseHref),
    "file:///home/raistlin/hayalet-ev/rooms/.build/repair-room/runtime/shared/assets/mock-pcb/atx-psu-top.svg"
  );
  assert.equal(
    resolveRepairAssetUrl(
      "main-functions/repair-workbench/assets/repair-workbench-view.svg",
      baseHref
    ),
    "file:///home/raistlin/hayalet-ev/rooms/.build/repair-room/runtime/main-functions/repair-workbench/assets/repair-workbench-view.svg"
  );
  assert.equal(
    resolveRepairAssetUrl("https://example.test/pcb.svg", baseHref),
    "https://example.test/pcb.svg"
  );
});
});
