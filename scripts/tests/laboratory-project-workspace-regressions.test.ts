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
            fileNameHint: "",
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

test("laboratory project workspace owns source intake, hypothesis, grid, and empty inspector", () => {
  const html = renderProjectWorkspaceOverlay(createProjectWorkspaceState(true));

  assert.match(html, /class="labx-pw-overlay"/);
  assert.match(html, /data-lab-action="project-workspace-close"/);
  assert.match(html, /class="labx-pw-nav__intake"/);
  assert.match(html, /data-lab-field="source\.kind"/);
  assert.match(html, /data-lab-field="workspace\.hypothesis"/);
  assert.match(html, /data-lab-field="project-workspace-sort"/);
  assert.match(html, /data-lab-field="project-workspace-filter"/);
  assert.match(html, /data-lab-field="project-workspace-group"/);
  assert.match(html, /data-lab-field="project-workspace-search"/);
  assert.match(html, /class="labx-pw-inspector labx-pw-inspector--empty"/);
  assert.match(html, /class="labx-pw-bar labx-pw-bar--hidden"/);
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
  assert.doesNotMatch(html, /Hidden Draft/);
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

  assert.match(html, /Proje Calisma Alani/);
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
  assert.match(html, /2 secili/);
  assert.match(html, /Kaynak Olarak Kullan/);
  assert.match(html, /AI&#39;ye Gonder/);
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

test("laboratory project workspace i18n keys exist in English and Turkish catalogs", () => {
  const enTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/en.json", "utf8"));
  const trTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/tr.json", "utf8"));
  const sourceFiles = [
    "rooms/laboratory/ui/asset-card.ts",
    "rooms/laboratory/ui/asset-grid.ts",
    "rooms/laboratory/ui/asset-inspector.ts",
    "rooms/laboratory/ui/context-action-bar.ts",
    "rooms/laboratory/ui/lab-top-bar.ts",
    "rooms/laboratory/ui/project-navigation.ts",
    "rooms/laboratory/ui/project-workspace-overlay.ts",
  ];
  const keys = new Set<string>();

  sourceFiles.forEach(function (filePath) {
    const source = readFileSync(filePath, "utf8");
    for (const match of source.matchAll(
      /copy\.t\("((?:mediaAnalysis\.(?:projectWorkspace|topBar))[^"]+)"/g
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

  assert.ok(keys.size > 60);
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
  assert.match(overlayCss, /\.labx-pw-card\[data-selected="true"\]/);
  assert.match(overlayCss, /\.labx-pw-bar\s*\{[\s\S]*grid-area:\s*bar;/);
  assert.match(themeSource, /\.labx-top-bar__project-btn\s*\{/);
  assert.match(themeSource, /\.labx-timeline__highlight\s*\{/);
});
