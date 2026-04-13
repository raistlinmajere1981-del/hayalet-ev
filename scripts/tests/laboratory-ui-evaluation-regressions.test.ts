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

test("laboratory edit stage wiring forwards room-local copy and edit summary accessors", () => {
  const coreBootstrapSource = readFileSync("rooms/laboratory/ui/core-bootstrap.ts", "utf8");
  const mediaAnalysisDepsMatch = coreBootstrapSource.match(
    /const mediaAnalysisUiRuntimeDeps = \{([\s\S]*?)\n  \};\n  const mediaAnalysisUiRuntime = deps\.createMediaAnalysisUiRuntime/
  );
  const uiRuntimeSource = readFileSync("rooms/laboratory/ui/laboratory-ui-runtime.ts", "utf8");
  const featureRuntimeDepsMatch = uiRuntimeSource.match(
    /const laboratoryFeatureStageRuntimeDeps = \{([\s\S]*?)\n  \};\n  const laboratoryFeatureStageRuntime = createLaboratoryFeatureStageRuntime/
  );

  assert.ok(mediaAnalysisDepsMatch, "Expected mediaAnalysisUiRuntimeDeps to be defined");
  assert.match(mediaAnalysisDepsMatch[1], /(^|\s)subtitleText,/);
  assert.match(mediaAnalysisDepsMatch[1], /(^|\s)textFromKey,/);

  assert.ok(featureRuntimeDepsMatch, "Expected laboratoryFeatureStageRuntimeDeps to be defined");
  assert.match(featureRuntimeDepsMatch[1], /(^|\s)getCurrentResizeLabel:\s*coreRuntime\.getCurrentResizeLabel,/);
});

test("laboratory edit stage uses edit presets and dark themed selects", () => {
  const featureStagePanelsSource = readFileSync(
    "rooms/laboratory/ui/feature-stage-panels.ts",
    "utf8"
  );
  const controlsSource = readFileSync(
    "rooms/laboratory/shared/styles/components/controls.css",
    "utf8"
  );

  assert.match(featureStagePanelsSource, /function getCurrentEditPresetOptionsSafe\(\)/);
  assert.match(
    featureStagePanelsSource,
    /getCurrentEditPresetOptions:\s*getCurrentEditPresetOptionsSafe,/
  );
  assert.doesNotMatch(
    featureStagePanelsSource,
    /getCurrentEditPresetOptions:\s*getProfilePresetOptionsSafe,/
  );
  assert.match(controlsSource, /\.lab-select option,\s*\.lab-select optgroup\s*\{/);
  assert.match(controlsSource, /color-scheme:\s*dark;/);
});

test("laboratory edit stage routes progress into the side rail and hides verbose tool output", () => {
  const editStageSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/ui/edit-stage.ts",
    "utf8"
  );
  const editOutputPanelsSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/ui/edit-output-panels.ts",
    "utf8"
  );
  const editWorkspaceSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/ui/edit-workspace-panels.ts",
    "utf8"
  );
  const editStylesSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/styles/edit.css",
    "utf8"
  );
  const hostMessagesSource = readFileSync(
    "rooms/laboratory/shared/ui/host-messages.ts",
    "utf8"
  );

  assert.match(editStageSource, /renderEditProgressPanel:\s*\(\)\s*=>\s*string;/);
  assert.match(editStageSource, /\$\{renderEditProgressPanel\(\)\}/);
  assert.match(editOutputPanelsSource, /function renderEditProgressPanel\(\)/);
  assert.match(editOutputPanelsSource, /progressToolOutputHidden/);
  assert.match(editWorkspaceSource, /lab-preview-card lab-preview-card--edit/);
  assert.doesNotMatch(editWorkspaceSource, /lab-status-stack/);
  assert.match(editStylesSource, /\.lab-preview-card--edit\s*\{/);
  assert.match(editStylesSource, /\.lab-edit-frame\s*\{[\s\S]*min-height:\s*22rem;/);
  assert.match(hostMessagesSource, /function formatJobProgressMessage/);
  assert.match(hostMessagesSource, /function shouldHideInlineActionResult/);
  assert.match(
    hostMessagesSource,
    /"profile-run-preflight",[\s\S]*"profile-cancel-preflight",[\s\S]*"process-run",[\s\S]*"audio-process-run",[\s\S]*"process-cancel",[\s\S]*"audio-process-cancel"/
  );
  assert.match(hostMessagesSource, /function shouldHideInlineJobProgress/);
  assert.match(
    hostMessagesSource,
    /\["profile-run-preflight", "process-run", "audio-process-run"\]\.includes\(actionId \|\| ""\)/
  );
  assert.doesNotMatch(hostMessagesSource, /setLastAction\(toString\(payload\.message\)\)/);
});
