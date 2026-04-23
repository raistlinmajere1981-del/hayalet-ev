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
  assert.match(labRootSource, /currentElement\.scrollTop = scrollTop;/);
  assert.match(
    labRootSource,
    /updateRenderedElement\(\s*documentRef,\s*centerPanel as HTMLElement,\s*renderLabCenterPanel\(surface\),\s*true\s*\);/
  );
  assert.match(
    labRootSource,
    /updateRenderedElement\(\s*documentRef,\s*rightPanel as HTMLElement,\s*renderLabRightPanel\(surface\),\s*true\s*\);/
  );
  assert.match(workspaceSurfaceSource, /data-lab-preserve-media="workspace-preview"/);
  assert.match(
    workspaceSurfaceSource,
    /<video class="labx-preview-media labx-preview-media--workspace-video"[\s\S]*data-lab-preserve-media="workspace-preview"/
  );
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
  assert.match(workspaceSurfaceSource, /Analiz arka planda çalışıyor/);
  assert.match(workspaceSurfaceSource, /Bu analiz şunları yapacak:/);
});
