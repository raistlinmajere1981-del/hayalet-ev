import test from "node:test";
import assert from "node:assert/strict";
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
      },
      body: new ElementStub(),
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

    assert.match(environment.runtimeRoot.innerHTML, /Loading Laboratory|Laboratuvar Yukleniyor/);
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

test("laboratory subtitle UI runtime resolves the room-local subtitle panel runtime", async () => {
  const runtimeModule = await import(
    `${pathToFileURL(resolve("rooms/laboratory/main-functions/subtitle-analysis/ui/runtime.ts")).href}?smoke=${Date.now()}`
  );

  assert.equal(typeof runtimeModule.createSubtitleAnalysisUiRuntime, "function");
});
