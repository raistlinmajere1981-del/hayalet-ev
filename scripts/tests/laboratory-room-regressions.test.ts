import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { validateRoomManifest } from "../../src/types/rooms.ts";

const requiredFiles = [
  "rooms/laboratory/manifest.json",
  "rooms/laboratory/host/index.js",
  "rooms/laboratory/ui/index.html",
  "rooms/laboratory/ui/index.js",
  "rooms/laboratory/ui/style.css",
  "rooms/laboratory/i18n/en.json",
  "rooms/laboratory/i18n/tr.json",
  "rooms/laboratory/assets/room-background.webp",
  "rooms/laboratory/assets/video-analysis-view.webp",
];

test("laboratory workspace keeps the required room package files", () => {
  requiredFiles.forEach((filePath) => {
    assert.equal(existsSync(filePath), true, filePath);
  });
});

test("laboratory manifest validates with the video analysis room contract", () => {
  const manifest = JSON.parse(readFileSync("rooms/laboratory/manifest.json", "utf8"));
  const validation = validateRoomManifest(manifest);

  assert.equal(validation.valid, true);
  assert.equal(validation.manifest?.id, "laboratory");
  assert.equal(validation.manifest?.defaultFeatureId, "video-analysis");
  assert.equal(validation.manifest?.features[0]?.id, "video-analysis");
  assert.equal(validation.manifest?.runtime.uiEntry, "ui/index.html");
  assert.equal(validation.manifest?.runtime.hostEntry, "host/index.js");
  assert.equal(validation.manifest?.storageNamespace, "laboratory");
});

function createLaboratoryHostRuntime() {
  const source = readFileSync("rooms/laboratory/host/index.js", "utf8");
  const module = { exports: {} as any };
  const evaluator = new Function("module", "exports", source);
  evaluator(module, module.exports);

  const previousWindow = (globalThis as { window?: unknown }).window;
  const dialogCalls: Array<Record<string, unknown>> = [];
  (globalThis as { window?: unknown }).window = {
    electronAPI: {
      showOpenDialog: async (options: Record<string, unknown>) => {
        dialogCalls.push(options);
        return {
          canceled: true,
          filePaths: [],
        };
      },
    },
    setInterval,
    clearInterval,
  };

  const state = new Map<string, unknown>();
  const api = {
    getLocale: () => "tr",
    getState: (key: string) => state.get(key),
    setState: (key: string, value: unknown) => {
      state.set(key, value);
      return value;
    },
    deleteState: (key: string) => state.delete(key),
    notifyRoom: () => undefined,
    log: () => undefined,
  };

  const exported =
    typeof module.exports === "function" ? module.exports(api) : module.exports.activate(api);

  return {
    dialogCalls,
    exported,
    restoreWindow() {
      if (previousWindow === undefined) {
        delete (globalThis as { window?: unknown }).window;
        return;
      }
      (globalThis as { window?: unknown }).window = previousWindow;
    },
  };
}

test("laboratory host unwraps room event payloads before opening the local file dialog", async () => {
  const runtime = createLaboratoryHostRuntime();

  try {
    await runtime.exported.onRoomEvent({
      type: "laboratory-action",
      payload: {
        action: "pick-local-file",
      },
    });
  } finally {
    runtime.restoreWindow();
  }

  assert.equal(runtime.dialogCalls.length, 1);
  assert.deepEqual(runtime.dialogCalls[0]?.properties, ["openFile"]);
});

test("laboratory ui unwraps host state payloads before syncing the room view", () => {
  const uiSource = readFileSync("rooms/laboratory/ui/index.js", "utf8");

  assert.match(
    uiSource,
    /if \(message\.type === "laboratory-state"\) \{\s+const payload =[\s\S]+message\.payload[\s\S]+\.\.\.payload,[\s\S]+cloneSelection\(payload\.selection\)[\s\S]+normalizeLocale\(payload\.locale \|\| state\.locale\)/
  );
});

test("laboratory ui keeps a dedicated YouTube intake action wired into the source panel", () => {
  const uiSource = readFileSync("rooms/laboratory/ui/index.js", "utf8");

  assert.match(uiSource, /data-action="submit-youtube-url"/);
  assert.match(uiSource, /data-input="youtube-url"/);
  assert.match(uiSource, /sourceKindYouTube/);
});

test("laboratory ui exposes project selection, report overlay, and locale controls", () => {
  const uiSource = readFileSync("rooms/laboratory/ui/index.js", "utf8");

  assert.match(uiSource, /data-action="select-project"/);
  assert.match(uiSource, /data-action="delete-project"/);
  assert.match(uiSource, /data-action="open-report-overlay"/);
  assert.match(uiSource, /data-action="close-report-overlay"/);
  assert.match(uiSource, /data-select="report-locale"/);
  assert.match(uiSource, /sendHostContext/);
  assert.match(uiSource, /sync-workflow-settings/);
  assert.match(uiSource, /downloadPreset/);
  assert.match(uiSource, /previewPolicy/);
});

test("laboratory host exposes project-aware room state alongside legacy entry state", () => {
  const hostSource = readFileSync("rooms/laboratory/host/index.js", "utf8");

  assert.match(hostSource, /reportLocale:/);
  assert.match(hostSource, /workflowSettings:/);
  assert.match(hostSource, /projects:/);
  assert.match(hostSource, /activeProjectId:/);
  assert.match(hostSource, /activeProject:/);
  assert.match(hostSource, /laboratoryListProjects/);
  assert.match(hostSource, /laboratoryReadProject/);
  assert.match(hostSource, /sync-workflow-settings/);
});

test("laboratory ipc accepts the YouTube source kind for preparation jobs", () => {
  const ipcSource = readFileSync("electron/handlers/ipc-laboratory-video-analysis.ts", "utf8");

  assert.match(
    ipcSource,
    /kind !== "local-file" && kind !== "direct-url" && kind !== "youtube-url"/
  );
  assert.match(ipcSource, /laboratory-start-source-preparation/);
  assert.match(ipcSource, /laboratory-get-source-preparation-job/);
  assert.match(ipcSource, /projectId/);
  assert.match(ipcSource, /reportLocale/);
  assert.match(ipcSource, /workflowSettings/);
});

test("laboratory ipc exposes project list, read, and delete handlers", () => {
  const ipcSource = readFileSync("electron/handlers/ipc-laboratory-video-analysis.ts", "utf8");
  const preloadSource = readFileSync("electron/preload.cjs", "utf8");

  assert.match(ipcSource, /laboratory-list-projects/);
  assert.match(ipcSource, /laboratory-read-project/);
  assert.match(ipcSource, /laboratory-delete-project/);
  assert.match(preloadSource, /laboratoryListProjects/);
  assert.match(preloadSource, /laboratoryReadProject/);
  assert.match(preloadSource, /laboratoryDeleteProject/);
});

test("laboratory source resolver prefers a current yt-dlp build and enables JS runtime support for YouTube", () => {
  const resolverSource = readFileSync("electron/laboratory/source-resolver.ts", "utf8");

  assert.match(resolverSource, /MIN_YT_DLP_VERSION_LABEL = "2025\.11\.12"/);
  assert.match(resolverSource, /join\(homeDir, "\.local", "bin", "yt-dlp"\)/);
  assert.match(resolverSource, /--remote-components", "ejs:github"/);
  assert.match(resolverSource, /--js-runtimes/);
});

test("laboratory job runner resolves the bundled analysis worker from the laboratory dist folder", () => {
  const jobRunnerSource = readFileSync("electron/laboratory/job-runner.ts", "utf8");

  assert.match(
    jobRunnerSource,
    /new Worker\(new URL\("\.\/laboratory\/analysis-worker\.cjs", import\.meta\.url\),/
  );
});
