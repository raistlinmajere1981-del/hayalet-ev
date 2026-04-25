import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createRoomBuiltArtifact } from "./helpers/room-installed-copy.ts";

class ElementStub {
  innerHTML = "";
  scrollTop = 0;
  dataset: Record<string, string> = {};
  classList = {
    add() {},
    remove() {},
    toggle() {},
  };

  querySelector(): null {
    return null;
  }

  querySelectorAll(): [] {
    return [];
  }

  addEventListener(): void {}

  removeEventListener(): void {}

  replaceChildren(): void {}
}

function createMinimalLaboratoryUiEnvironment() {
  const runtimeRoot = new ElementStub();
  let readyPayload: Record<string, unknown> | null = null;

  const descriptors = {
    document: Object.getOwnPropertyDescriptor(globalThis, "document"),
    navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
    window: Object.getOwnPropertyDescriptor(globalThis, "window"),
    HTMLElement: Object.getOwnPropertyDescriptor(globalThis, "HTMLElement"),
  };

  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: ElementStub,
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      language: "en-US",
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: {
        dataset: {},
        lang: "en",
        style: {
          setProperty() {},
        },
      },
      body: Object.assign(new ElementStub(), {
        style: {
          setProperty() {},
        },
      }),
      addEventListener() {},
      removeEventListener() {},
      getElementById(id: string) {
        return id === "app" ? runtimeRoot : null;
      },
      querySelector() {
        return null;
      },
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener() {},
      removeEventListener() {},
      roomAPI: {
        onHostMessage() {},
        ready(payload: Record<string, unknown>) {
          readyPayload = payload;
        },
        sendEvent() {},
      },
    },
  });

  return {
    readyPayload: () => readyPayload,
    restore() {
      Object.entries(descriptors).forEach(([key, descriptor]) => {
        if (descriptor) {
          Object.defineProperty(globalThis, key, descriptor);
        } else {
          Reflect.deleteProperty(globalThis, key);
        }
      });
    },
    runtimeRoot,
  };
}

test("laboratory UI shell evaluates under minimal runtime stubs", async () => {
  const environment = createMinimalLaboratoryUiEnvironment();
  const buildArtifact = await createRoomBuiltArtifact("laboratory");

  try {
    await import(
      `${pathToFileURL(resolve(buildArtifact.rootDir, "ui/index.js")).href}?smoke=${Date.now()}`
    );

    assert.match(
      environment.runtimeRoot.innerHTML,
      /Loading Laboratory|Laboratuvar Yukleniyor|Laboratuvar Yükleniyor/
    );
    assert.deepEqual(environment.readyPayload(), {
      feature: "media-analysis",
      room: "laboratory",
      stage: "ui-ready",
    });
  } finally {
    await buildArtifact.cleanup();
    environment.restore();
  }
});

test("laboratory shell routes host traffic through lab-root orchestration seams", () => {
  const uiIndexSource = readFileSync("rooms/laboratory/ui/index.ts", "utf8");
  const labRootSource = readFileSync("rooms/laboratory/ui/lab-root.ts", "utf8");
  const labLayoutSource = readFileSync("rooms/laboratory/ui/lab-layout.ts", "utf8");
  const hostBridgeSource = readFileSync("rooms/laboratory/runtime/lab-host-bridge.ts", "utf8");

  assert.match(uiIndexSource, /import "\.\/lab-root\.js";/);
  assert.match(labRootSource, /return renderWorkspaceSurface\(state\);/);
  assert.match(labRootSource, /runtimeRoot\.innerHTML = renderLabLayout\(state, surface\);/);
  assert.match(labRootSource, /renderToolManagementOverlay\(state\)/);
  assert.match(labRootSource, /emit:\s*eventBus\.emit,/);
  assert.match(labRootSource, /roomAPI\.ready\(\{\s*feature:\s*"media-analysis",\s*room:\s*"laboratory",\s*stage:\s*"ui-ready"/);
  assert.match(labLayoutSource, /renderToolManagementOverlay\(state\)/);
  assert.match(hostBridgeSource, /type === "source-state"/);
  assert.match(hostBridgeSource, /type:\s*"source-snapshot-received"/);
  assert.match(hostBridgeSource, /type === "lab-event"/);
  assert.doesNotMatch(hostBridgeSource, /buildLifecycleEventsFromHostEvent/);
});

test("laboratory shell preserves workspace preview nodes while diffing live panels", () => {
  const labRootSource = readFileSync("rooms/laboratory/ui/lab-root.ts", "utf8");
  const workspaceSurfaceSource = readFileSync("rooms/laboratory/ui/workspace-surface.ts", "utf8");

  assert.match(labRootSource, /function updateRenderedElement\(/);
  assert.match(labRootSource, /function syncChildNodes\(/);
  assert.match(labRootSource, /function canReuseElement\(/);
  assert.match(labRootSource, /const preserveKey = readPreservedMediaKey\(currentElement\) \|\| readPreservedMediaKey\(nextElement\);/);
  assert.match(labRootSource, /function readPreservedDetailsState\(/);
  assert.match(labRootSource, /currentElement\.hasAttribute\("data-lab-interpretation-panel"\)/);
  assert.match(labRootSource, /currentElement\.open = preservedDetailsState;/);
  assert.match(labRootSource, /currentElement\.scrollTop = scrollTop;/);
  assert.match(
    labRootSource,
    /updateRenderedElement\(\s*documentRef,\s*centerPanel as HTMLElement,\s*renderLabCenterPanel\(surface\),\s*true\s*\);/
  );
  assert.match(
    labRootSource,
    /updateRenderedElement\(\s*documentRef,\s*rightPanel as HTMLElement,\s*renderLabRightPanel\(surface\),\s*true\s*\);/
  );
  assert.match(
    workspaceSurfaceSource,
    /preserveKey \|\| "workspace-preview"/
  );
  assert.match(workspaceSurfaceSource, /data-lab-preserve-media="\$\{escapeHtml\(preserveKey\)\}"/);
});

test("laboratory shell persists workspace-facing state and exposes tool lifecycle controls", () => {
  const labRootSource = readFileSync("rooms/laboratory/ui/lab-root.ts", "utf8");
  const toolOverlaySource = readFileSync("rooms/laboratory/ui/tool-management-overlay.ts", "utf8");
  const workspaceSurfaceSource = readFileSync("rooms/laboratory/ui/workspace-surface.ts", "utf8");

  assert.match(labRootSource, /schemaVersion:\s*4,/);
  assert.match(labRootSource, /workspace:\s*state\.ui\.workspace,/);
  assert.match(labRootSource, /state\.run\.state === "running" \|\| state\.run\.state === "queued"/);
  assert.match(toolOverlaySource, /aria-label="Araç Yönetimi"/);
  assert.match(toolOverlaySource, /data-lab-action="tool-update-all"/);
  assert.match(toolOverlaySource, /data-lab-action="tool-install"/);
  assert.match(toolOverlaySource, /data-lab-action="tool-check-updates"/);
  assert.match(workspaceSurfaceSource, /Source setup controls/);
  assert.match(workspaceSurfaceSource, /Derin Analiz Başlat/);
  assert.match(workspaceSurfaceSource, /data-lab-action="run-deep-analysis"/);
  assert.match(workspaceSurfaceSource, /Bu analiz şunları yapacak:/);
});

test("laboratory theme widens the left rail and normalizes rail asset spacing", () => {
  const themeSource = readFileSync("rooms/laboratory/ui/lab-theme.css", "utf8");

  assert.match(themeSource, /grid-template-columns:\s*16\.8rem minmax\(0, 1fr\) minmax\(17rem, 20rem\);/);
  assert.match(themeSource, /\.labx-left-rail\s*\{[\s\S]*gap:\s*0\.8rem;[\s\S]*padding:\s*0\.85rem;/);
  assert.match(themeSource, /\.labx-project-assets\s*\{[\s\S]*gap:\s*0\.55rem;[\s\S]*padding:\s*0\.9rem 0\.95rem;/);
  assert.match(themeSource, /\.labx-project-assets__preview\s*\{[\s\S]*gap:\s*0\.45rem;[\s\S]*padding:\s*0\.42rem 0\.5rem;/);
});

test("laboratory micro inspection UI exposes roi focus precedence and lens affordances in the preview shell", () => {
  const overlaySource = readFileSync("rooms/laboratory/ui/workspace-roi-overlay.ts", "utf8");
  const surfaceSource = readFileSync("rooms/laboratory/ui/workspace-surface.ts", "utf8");
  const timelineSource = readFileSync("rooms/laboratory/ui/lab-waveform-timeline-render.ts", "utf8");

  assert.match(
    overlaySource,
    /data-lab-selection-roi="true"[\s\S]*data-lab-selection-roi-ignore="true"/
  );
  assert.match(overlaySource, /data-lab-selection-roi-focus-toggle="true"/);
  assert.match(overlaySource, /data-lab-selection-roi-capture="true"/);
  assert.match(surfaceSource, /data-lab-preview-inspection-stage="true"/);
  assert.match(surfaceSource, /data-lab-preview-inspection-content="true"/);
  assert.match(timelineSource, /Selection micro zoom/);
  assert.match(timelineSource, /id="lab-audio-viz-inspection"/);
});

test("laboratory selection preview exposes soft execution intent affordances without run semantics", () => {
  const timelineSource = readFileSync("rooms/laboratory/ui/lab-waveform-timeline-render.ts", "utf8");

  assert.match(timelineSource, /Selected action/);
  assert.match(timelineSource, /data-lab-execution-intent-accept=/);
  assert.match(timelineSource, /data-lab-execution-intent-dismiss=/);
  assert.match(timelineSource, /data-lab-execution-intent-queue=/);
  assert.match(timelineSource, /data-lab-execution-intent-clear="true"/);
  assert.match(timelineSource, />\$\{executionIntentSelected \? "Intent selected" : "I want this"\}</);
  assert.match(timelineSource, />Not now</);
  assert.match(timelineSource, />Queue for later</);
  assert.doesNotMatch(timelineSource, />Run</);
});
