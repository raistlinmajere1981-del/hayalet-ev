import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import { createLabI18n } from "../../rooms/laboratory/ui/lab-i18n.ts";
import { renderProjectWorkspaceOverlay } from "../../rooms/laboratory/ui/project-workspace-overlay.ts";

const sourcePresets = JSON.parse(
  readFileSync("rooms/laboratory/shared/data/tools/source-presets.json", "utf8")
);
const ytDlpForm = JSON.parse(
  readFileSync("rooms/laboratory/shared/data/tools/yt-dlp.form.json", "utf8")
);

function createProjectWorkspaceState(
  open: boolean,
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
  store.dispatch({
    type: "project-workspace-toggled",
    open,
  });
  options.assets?.forEach(function (asset) {
    store.dispatch({
      type: "asset-added",
      asset,
    });
  });
  if (options.selectedEntityIds && options.selectedEntityIds.length > 0) {
    store.dispatch({
      type: "project-workspace-entity-selected",
      entityIds: options.selectedEntityIds,
    });
  }
  return store.getState();
}

test("laboratory project workspace keeps a closed placeholder root", () => {
  const html = renderProjectWorkspaceOverlay(createProjectWorkspaceState(false));

  assert.match(html, /id="lab-project-workspace-root"/);
  assert.match(html, /aria-hidden="true"/);
  assert.doesNotMatch(html, /class="labx-pw-overlay"/);
});

test("laboratory project workspace owns project import, hypothesis, grid, and empty inspector", () => {
  const html = renderProjectWorkspaceOverlay(createProjectWorkspaceState(true));

  assert.match(html, /class="labx-pw-overlay"/);
  assert.match(html, /data-lab-action="project-workspace-close"/);
  assert.match(html, /class="labx-project-import"/);
  assert.match(html, /data-lab-action="project-import-local-add"/);
  assert.match(html, /data-lab-action="project-import-check-url"/);
  assert.match(html, /data-lab-action="project-import-clear"/);
  assert.doesNotMatch(html, /data-lab-action="project-import-kind"/);
  assert.doesNotMatch(html, /data-lab-action="project-import-method"/);
  assert.equal(html.includes("project-import." + "file" + "NameHint"), false);
  assert.doesNotMatch(html, /class="labx-pw-nav__intake"/);
  assert.doesNotMatch(html, /data-lab-field="source\.kind"/);
  assert.match(html, /data-lab-field="workspace\.hypothesis"/);
  assert.match(html, /data-lab-field="project-workspace-sort"/);
  assert.match(html, /data-lab-field="project-workspace-filter"/);
  assert.match(html, /data-lab-field="project-workspace-group"/);
  assert.match(html, /data-lab-field="project-workspace-search"/);
  assert.match(html, /class="labx-pw-inspector labx-pw-inspector--empty"/);
  assert.doesNotMatch(html, /class="labx-pw-bar/);
});

test("laboratory project workspace keeps the active source-less project navigable", () => {
  const html = renderProjectWorkspaceOverlay(
    createProjectWorkspaceState(true, {
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

test("laboratory project workspace controller skips redundant button dispatches", () => {
  const source = readFileSync("rooms/laboratory/runtime/lab-run-controller.ts", "utf8");

  assert.match(source, /state\.ui\.projectImport\.activeKind !== kind/);
  assert.match(source, /state\.ui\.projectImport\.methods\[activeKind\] !== method/);
  assert.match(source, /state\.ui\.youtubeImport\.strategy !== strategy/);
  assert.match(source, /state\.ui\.projectWorkspaceSelectedEntityIds\.length === 1/);
  assert.match(source, /state\.ui\.projectWorkspaceSort === sort/);
  assert.match(source, /state\.ui\.projectWorkspaceFilter === filter/);
  assert.match(source, /state\.ui\.projectWorkspaceGroup === group/);
});

test("laboratory project workspace renders localized asset groups and context actions", () => {
  const trTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/tr.json", "utf8"));
  const trCopy = createLabI18n({ locale: "tr", translations: trTranslations });
  const html = renderProjectWorkspaceOverlay(
    createProjectWorkspaceState(true, {
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

  assert.match(html, /Proje Yönetimi/);
  assert.match(html, /Kaynaklar/);
  assert.match(html, /Klipler/);
  assert.match(html, /Kareler/);
  assert.match(html, /Ses/);
  assert.match(html, /Gorseller/);
  assert.match(html, /Raporlar/);
  assert.match(html, /Ciktilar/);
  assert.match(html, /SRC/);
  assert.match(html, /CLP/);
  assert.match(html, /FRM/);
  assert.match(html, /AUD/);
  assert.match(html, /IMG/);
  assert.match(html, /RPT/);
  assert.match(html, /AST/);
  assert.match(html, /report\.md/);
  assert.match(html, /artifact\.json/);
  assert.doesNotMatch(html, /secili/);
  assert.match(html, /Analiz Kaynagi Olarak Kullan/);
  assert.match(html, /AI&#39;ye Gonder/);
});

test("laboratory project workspace lets selected assets override stale import review state", () => {
  const state = createProjectWorkspaceState(true, {
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

  const html = renderProjectWorkspaceOverlay(state);

  assert.match(html, /selected-image\.png/);
  assert.match(html, /Metadata/);
  assert.doesNotMatch(html, /Import Review/);
});

test("laboratory project workspace hides draft review instead of borrowing committed source preview", () => {
  const state = createProjectWorkspaceState(true);
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

test("laboratory project workspace hides download for assets without a file target", () => {
  const html = renderProjectWorkspaceOverlay(
    createProjectWorkspaceState(true, {
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
  assert.doesNotMatch(html, /data-lab-action="asset-download"/);
});

test("laboratory project workspace renders video source thumbnails as media", () => {
  const html = renderProjectWorkspaceOverlay(
    createProjectWorkspaceState(true, {
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

  assert.match(html, /<video class="labx-pw-card__thumb-img labx-pw-card__thumb-video"/);
  assert.match(
    html,
    /<video class="labx-pw-inspector__preview-media labx-pw-inspector__preview-media--video"/
  );
  assert.match(html, /file:\/\/\/tmp\/CGI%20Analizi%20-1\.mp4/);
  assert.doesNotMatch(html, /<img class="labx-pw-card__thumb-img"/);
});

test("laboratory project workspace renders visual analysis artifacts as previews", () => {
  const html = renderProjectWorkspaceOverlay(
    createProjectWorkspaceState(true, {
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

  assert.match(html, /data-lab-entity-type="artifact"/);
  assert.match(html, /class="labx-pw-card__thumb-img"/);
  assert.match(html, /src="file:\/\/\/tmp\/lab-analysis-contrast-scan\.png"/);
  assert.match(
    html,
    /class="labx-pw-inspector__preview"><img class="labx-pw-inspector__preview-media"/
  );
});

test("laboratory project workspace i18n keys exist in English and Turkish catalogs", () => {
  const enTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/en.json", "utf8"));
  const trTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/tr.json", "utf8"));
  const sourceFiles = [
    "rooms/laboratory/ui/asset-card.ts",
    "rooms/laboratory/ui/asset-grid.ts",
    "rooms/laboratory/ui/asset-inspector.ts",
    "rooms/laboratory/ui/lab-top-bar.ts",
    "rooms/laboratory/ui/project-import-review.ts",
    "rooms/laboratory/ui/project-navigation.ts",
    "rooms/laboratory/ui/project-source-import.ts",
    "rooms/laboratory/ui/project-workspace-overlay.ts",
  ];
  const keys = new Set<string>();

  sourceFiles.forEach(function (filePath) {
    const source = readFileSync(filePath, "utf8");
    for (const match of source.matchAll(
      /copy\.t\("((?:mediaAnalysis\.(?:projectWorkspace|projectImport|topBar))[^"]+)"/g
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

  assert.ok(keys.size > 80);
  keys.forEach(function (key) {
    assert.equal(typeof readPath(enTranslations, key), "string", key);
    assert.equal(typeof readPath(trTranslations, key), "string", key);
  });
});

test("laboratory project workspace css is imported and owns overlay/topbar/timeline contracts", () => {
  const styleSource = readFileSync("rooms/laboratory/ui/style.css", "utf8");
  const overlayCss = readFileSync("rooms/laboratory/ui/styles/project-workspace.css", "utf8");
  const themeSource = readFileSync("rooms/laboratory/ui/lab-theme.css", "utf8");

  assert.match(styleSource, /@import "\.\/styles\/project-workspace\.css";/);
  assert.match(
    overlayCss,
    /\.labx-pw-overlay\s*\{[\s\S]*grid-template-areas:[\s\S]*"nav\s+grid\s+inspect"/
  );
  assert.match(overlayCss, /\.labx-pw-main\s*\{[\s\S]*grid-area:\s*grid;/);
  assert.match(overlayCss, /\.labx-project-import\s*\{[\s\S]*border-bottom:/);
  assert.match(overlayCss, /\.labx-project-import__methods\s*\{[\s\S]*display:\s*grid;/);
  assert.match(overlayCss, /\.labx-project-import__progress\s*\{[\s\S]*display:\s*grid;/);
  assert.match(overlayCss, /\.labx-pw-card\[data-selected="true"\]/);
  assert.match(overlayCss, /\.labx-pw-main\s*\{[\s\S]*background:\s*rgb\(4, 14, 21\);/);
  assert.match(overlayCss, /\.labx-pw-grid\s*\{[\s\S]*background:\s*rgb\(4, 14, 21\);/);
  assert.match(themeSource, /\.labx-top-bar__project-btn\s*\{/);
  assert.match(themeSource, /\.labx-timeline__highlight\s*\{/);
});
