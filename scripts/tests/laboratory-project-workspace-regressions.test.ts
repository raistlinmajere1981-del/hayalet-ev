import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import { createLabI18n } from "../../rooms/laboratory/ui/lab-i18n.ts";
import { renderLabSourcePanel } from "../../rooms/laboratory/ui/lab-source-panel.ts";
import { renderProjectWorkspaceOverlay } from "../../rooms/laboratory/ui/project-workspace-overlay.ts";
import { readCssWithImports } from "./helpers/css-imports.ts";

const sourcePresets = JSON.parse(
  readFileSync("rooms/laboratory/shared/data/tools/source-presets.json", "utf8")
);
const ytDlpForm = JSON.parse(
  readFileSync("rooms/laboratory/shared/data/tools/yt-dlp.form.json", "utf8")
);

function readLabThemeSource() {
  return readCssWithImports("rooms/laboratory/ui/lab-theme.css");
}

function createSourceProjectState(
  _open: boolean,
  options: {
    activeProjectId?: string;
    assets?: Array<{
      id: string;
      type: "source" | "clip" | "frame" | "audio" | "image" | "report" | "artifact";
      name: string;
      localPath?: string;
      createdAt: number;
      metadata?: Record<string, unknown>;
      runId?: string;
      intentIds?: string[];
    }>;
    projects?: Array<Record<string, unknown>>;
    selectedEntityIds?: string[];
  } = {}
) {
  const store = createLabStore();
  const activeProjectId = options.activeProjectId || "project-1";
  const projects = options.projects || [
    { id: "project-1", name: "Workspace Project", hasSource: true },
  ];
  store.dispatch({
    type: "snapshot-received",
    payload: {
      ready: true,
      featureId: "media-analysis",
      activeProjectId,
      projects,
      activeProject: {
        id: activeProjectId,
        name:
          String(
            projects.find(function (project) {
              return String(project["id"] || "") === activeProjectId;
            })?.["name"] || ""
          ) || "Workspace Project",
        createdAt: "2026-04-29T10:00:00.000Z",
        source: {
          kind: "video",
          mode: "local",
          status: "idle",
          storedFileName: null,
          storedPath: null,
          routeLabel: null,
          metadata: {},
          drafts: {
            urlInput: "",
            youtubeUrl: "",
            youtubePreset: "medium",
            youtubeCustom: {},
          },
        },
        edit: {},
        profile: {
          preflight: {},
        },
        process: {
          records: {},
        },
        report: {
          records: {},
        },
        assets: [],
      },
      workbench: {
        activeModuleId: "media-analysis",
        availableModuleIds: ["media-analysis"],
        selectedModuleIds: ["media-analysis"],
      },
      sourcePresets,
      ytDlpForm,
      toolState: { tools: {} },
      profileModels: [],
      sourceProbeStatus: "idle",
      activityFeed: [],
    },
  });
  options.assets?.forEach(function (asset) {
    store.dispatch({
      type: "asset-added",
      asset,
    });
  });
  return store.getState();
}

test("laboratory keeps the compatibility project root closed", () => {
  const html = renderProjectWorkspaceOverlay(createSourceProjectState(false));

  assert.match(html, /id="lab-project-workspace-root"/);
  assert.match(html, /aria-hidden="true"/);
  assert.doesNotMatch(html, /class="labx-pw-overlay"/);
});

test("laboratory source project management owns controls while the compatibility root stays empty", () => {
  const state = createSourceProjectState(true);
  const html = renderProjectWorkspaceOverlay(state);
  const sourcePanel = renderLabSourcePanel(state);

  assert.equal(html, `<div id="lab-project-workspace-root" aria-hidden="true"></div>`);
  assert.doesNotMatch(html, /class="labx-pw-overlay"/);
  assert.doesNotMatch(html, /data-lab-action="project-workspace-close"/);
  assert.match(sourcePanel, /class="labx-source-panel"/);
  assert.match(sourcePanel, /data-lab-action="project-import-local-add"/);
  assert.match(sourcePanel, /data-lab-action="project-import-check-url"/);
  assert.match(sourcePanel, /data-lab-action="project-import-clear"/);
  assert.doesNotMatch(html, /data-lab-action="project-import-kind"/);
  assert.doesNotMatch(html, /data-lab-action="project-import-method"/);
  assert.equal(html.includes("project-import." + "file" + "NameHint"), false);
  assert.doesNotMatch(html, /class="labx-pw-nav__intake"/);
  assert.doesNotMatch(html, /data-lab-field="source\.kind"/);
  assert.doesNotMatch(html, /data-lab-field="workspace\.hypothesis"/);
  assert.doesNotMatch(html, /data-lab-field="project-workspace-sort"/);
  assert.doesNotMatch(html, /data-lab-field="project-workspace-filter"/);
  assert.doesNotMatch(html, /data-lab-field="project-workspace-group"/);
  assert.doesNotMatch(html, /data-lab-field="project-workspace-search"/);
  assert.doesNotMatch(html, /class="labx-pw-inspector/);
  assert.doesNotMatch(html, /class="labx-pw-bar/);
});

test("laboratory source project management keeps the active source-less project navigable", () => {
  const html = renderLabSourcePanel(
    createSourceProjectState(true, {
      activeProjectId: "project-draft-active",
      projects: [
        { id: "project-1", name: "Workspace Project", hasSource: true },
        { id: "project-draft-active", name: "Draft Intake", hasSource: false },
        { id: "project-draft-hidden", name: "Hidden Draft", hasSource: false },
      ],
    })
  );

  assert.match(html, /Workspace Project/);
  assert.match(html, /Draft Intake/);
  assert.match(html, /data-lab-action="project-create"/);
  assert.match(html, /data-lab-action="project-delete"/);
  assert.doesNotMatch(html, /Hidden Draft/);
});

test("laboratory source project controls skip redundant button dispatches", () => {
  const source = readFileSync("rooms/laboratory/runtime/lab-run-controller.ts", "utf8");
  const sourceActionControllerSource = readFileSync(
    "rooms/laboratory/runtime/controller/lab-source-action-controller.ts",
    "utf8"
  );

  assert.match(sourceActionControllerSource, /state\.ui\.projectImport\.activeKind !== kind/);
  assert.match(
    sourceActionControllerSource,
    /state\.ui\.projectImport\.methods\[activeKind\] !== method/
  );
	  assert.doesNotMatch(sourceActionControllerSource, /youtube-import-set-strategy/);
  assert.doesNotMatch(source, /projectWorkspaceSelectedEntityIds/);
  assert.doesNotMatch(source, /projectWorkspaceSort/);
  assert.doesNotMatch(source, /projectWorkspaceFilter/);
  assert.doesNotMatch(source, /projectWorkspaceGroup/);
});

test("laboratory source panel renders localized asset groups and context actions", () => {
  const trTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/tr.json", "utf8"));
  const trCopy = createLabI18n({ locale: "tr", translations: trTranslations });
  const html = renderLabSourcePanel(
    createSourceProjectState(true, {
      assets: [
        {
          id: "asset-source-1",
          type: "source",
          name: "source.mp4",
          localPath: "/tmp/source.mp4",
          createdAt: 100,
          metadata: { duration: 61, selectionStartMs: 1000, selectionEndMs: 3000 },
        },
        {
          id: "asset-clip-1",
          type: "clip",
          name: "clip.mp4",
          localPath: "/tmp/clip.mp4",
          createdAt: 200,
        },
        {
          id: "asset-frame-1",
          type: "frame",
          name: "frame.png",
          localPath: "/tmp/frame.png",
          createdAt: 300,
        },
        {
          id: "asset-audio-1",
          type: "audio",
          name: "audio.wav",
          localPath: "/tmp/audio.wav",
          createdAt: 400,
        },
        {
          id: "asset-image-1",
          type: "image",
          name: "image.png",
          localPath: "/tmp/image.png",
          createdAt: 500,
        },
        {
          id: "asset-report-1",
          type: "report",
          name: "report.md",
          localPath: "/tmp/report.md",
          createdAt: 600,
          metadata: { findingCount: 2 },
        },
        {
          id: "asset-artifact-1",
          type: "artifact",
          name: "artifact.json",
          localPath: "/tmp/artifact.json",
          createdAt: 700,
        },
      ],
      selectedEntityIds: ["asset-source-1", "asset-report-1"],
    }),
    trCopy
  );

  assert.match(html, /Kaynaklar/);
  assert.match(html, /Klipler/);
  assert.match(html, /Kareler/);
  assert.match(html, /Ses/);
  assert.match(html, /Goruntuler/);
  assert.match(html, /Raporlar/);
  assert.match(html, /data-group-type="artifact"/);
  assert.match(html, /class="labx-sp-asset__thumb" data-kind="video"/);
  assert.match(html, /class="labx-sp-asset__thumb" data-kind="image"/);
  assert.match(html, /class="labx-sp-asset__badge labx-sp-asset__badge--audio"/);
  assert.match(html, /&#119070;/);
  assert.match(html, /data-extension="md">MD<\/span>/);
  assert.match(html, /data-extension="json">JSON<\/span>/);
  assert.doesNotMatch(html, />SRC<\/span>/);
  assert.doesNotMatch(html, />AUD<\/span>/);
  assert.match(html, /report\.md/);
  assert.match(html, /artifact\.json/);
  assert.doesNotMatch(html, /secili/);
  assert.match(html, /data-lab-action="asset-use-as-source"/);
  assert.match(html, /data-lab-action="open-report-overlay"/);
  assert.match(html, /data-lab-action="asset-remove"/);
});

test("laboratory source panel keeps selected assets separate from import progress review state", () => {
  const state = createSourceProjectState(true, {
    assets: [
      {
        id: "asset-image-1",
        type: "image",
        name: "selected-image.png",
        localPath: "/tmp/selected-image.png",
        createdAt: 500,
      },
    ],
    selectedEntityIds: ["asset-image-1"],
  });
  state.sourceProbeStatus = "completed";
  state.ui.projectImport.reviewFocus = "completed";
  state.ui.projectImport.lastAction = "source-pick-local";
  state.ui.projectImport.lastRequestId = "req-old-import";

  const html = renderLabSourcePanel(state);

  assert.match(html, /selected-image\.png/);
  assert.doesNotMatch(html, /Import Review/);
  assert.doesNotMatch(html, /class="labx-pw-inspector/);
});

test("laboratory compatibility root hides draft review content from committed source preview", () => {
  const state = createSourceProjectState(true);
  state.source = {
    kind: "video",
    mode: "local",
    status: "ready",
    storedFileName: "existing-source.mp4",
    storedPath: "/tmp/existing-source.mp4",
    previewUrl: "file:///tmp/existing-source.mp4",
    metadata: { durationSeconds: 99 },
  };
  state.ui.projectImport.activeKind = "image";
  state.ui.projectImport.reviewFocus = "draft";

  const html = renderProjectWorkspaceOverlay(state);

  assert.doesNotMatch(html, /Import Review/);
  assert.doesNotMatch(html, /existing-source\.mp4/);
  assert.doesNotMatch(html, /file:\/\/\/tmp\/existing-source\.mp4/);
  assert.doesNotMatch(html, /1:39/);
});

test("laboratory source panel hides download for assets without a file target", () => {
  const html = renderLabSourcePanel(
    createSourceProjectState(true, {
      assets: [
        {
          id: "asset-artifact-1",
          type: "artifact",
          name: "virtual artifact",
          createdAt: 700,
        },
      ],
      selectedEntityIds: ["asset-artifact-1"],
    })
  );

  assert.match(html, /virtual artifact/);
  assert.match(html, /data-lab-action="asset-preview"/);
  assert.doesNotMatch(html, /data-lab-action="asset-download"/);
});

test("laboratory source panel renders video source assets as selectable rows", () => {
  const html = renderLabSourcePanel(
    createSourceProjectState(true, {
      assets: [
        {
          id: "asset-source-1",
          type: "source",
          name: "CGI Analizi -1.mp4",
          localPath: "/tmp/CGI Analizi -1.mp4",
          createdAt: 700,
          metadata: { kind: "video" },
        },
      ],
      selectedEntityIds: ["asset-source-1"],
    })
  );

  assert.match(html, /data-asset-type="source"/);
  assert.match(html, /CGI Analizi -1\.mp4/);
  assert.match(html, /data-lab-action="asset-use-as-source"/);
  assert.match(html, /class="labx-sp-asset__thumb" data-kind="video"/);
  assert.doesNotMatch(html, /class="labx-pw-card__thumb-img/);
  assert.doesNotMatch(html, /class="labx-pw-inspector__preview-media/);
});

test("laboratory source panel renders visual analysis artifacts as asset rows", () => {
  const html = renderLabSourcePanel(
    createSourceProjectState(true, {
      assets: [
        {
          id: "asset-artifact-preview-1",
          type: "artifact",
          name: "contrast-scan.png",
          localPath: "/tmp/lab-analysis-contrast-scan.png",
          createdAt: 800,
          metadata: { kind: "transform-preview" },
        },
      ],
      selectedEntityIds: ["asset-artifact-preview-1"],
    })
  );

  assert.match(html, /data-asset-type="artifact"/);
  assert.match(html, /contrast-scan\.png/);
  assert.match(html, /data-lab-action="asset-download"/);
  assert.match(html, /data-lab-action="asset-remove"/);
  assert.doesNotMatch(html, /class="labx-pw-card__thumb-img/);
  assert.doesNotMatch(html, /class="labx-pw-inspector__preview/);
});

test("laboratory source project management i18n keys exist in English and Turkish catalogs", () => {
  const enTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/en.json", "utf8"));
  const trTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/tr.json", "utf8"));
  const sourceFiles = [
    "rooms/laboratory/ui/lab-source-panel.ts",
    "rooms/laboratory/ui/project-source-import.ts",
  ];
  const keys = new Set<string>();

  sourceFiles.forEach(function (filePath) {
    const source = readFileSync(filePath, "utf8");
    for (const match of source.matchAll(
      /copy\.t\("((?:mediaAnalysis\.(?:projectWorkspace|projectImport))[^"]+)"/g
    )) {
      keys.add(match[1]!);
    }
  });

  function readPath(record: Record<string, unknown>, key: string): unknown {
    return key.split(".").reduce<unknown>(function (current, part) {
      return current && typeof current === "object"
        ? (current as Record<string, unknown>)[part]
        : undefined;
    }, record);
  }

  const expectedProjectWorkspaceKeys = [
    "deleteProject",
    "managementTitle",
    "metadataDuration",
    "metadataName",
    "metadataSize",
    "newProject",
    "untitledProject",
  ];
  assert.deepEqual(
    Object.keys(enTranslations.mediaAnalysis.projectWorkspace).sort(),
    expectedProjectWorkspaceKeys
  );
  assert.deepEqual(
    Object.keys(trTranslations.mediaAnalysis.projectWorkspace).sort(),
    expectedProjectWorkspaceKeys
  );
  assert.ok(keys.has("mediaAnalysis.projectWorkspace.managementTitle"));
  assert.ok(keys.has("mediaAnalysis.projectWorkspace.metadataName"));
  keys.forEach(function (key) {
    assert.equal(typeof readPath(enTranslations, key), "string", key);
    assert.equal(typeof readPath(trTranslations, key), "string", key);
  });
});

test("laboratory source management css keeps active import styles without retired shell styles", () => {
  const styleSource = readFileSync("rooms/laboratory/ui/style.css", "utf8");
  const overlayCss = readFileSync("rooms/laboratory/ui/styles/project-workspace.css", "utf8");
  const themeSource = readLabThemeSource();

  assert.match(styleSource, /@import "\.\/styles\/project-workspace\.css";/);
	  assert.doesNotMatch(overlayCss, /\.labx-pw-/);
	  assert.doesNotMatch(overlayCss, /\.labx-import-review/);
	  assert.doesNotMatch(overlayCss, /\.labx-import-/);
	  assert.doesNotMatch(overlayCss, /\.labx-strategy-/);
	  assert.match(overlayCss, /\.labx-project-import__progress\s*\{[\s\S]*display:\s*grid;/);
	  assert.match(overlayCss, /\.labx-project-import__youtube-preview\s*\{[\s\S]*display:\s*grid;/);
	  assert.match(overlayCss, /\.labx-project-import__yt-controls\s*\{[\s\S]*display:\s*grid;/);
	  assert.match(
	    overlayCss,
	    /\.labx-project-import__yt-field\s*\{[\s\S]*display:\s*grid;/
	  );
	  assert.doesNotMatch(overlayCss, /\.labx-advanced-settings/);
  assert.doesNotMatch(themeSource, /\.labx-top-bar__project-btn\s*\{/);
  assert.match(themeSource, /\.labx-timeline__highlight\s*\{/);
});
