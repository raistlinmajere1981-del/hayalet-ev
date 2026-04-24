import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import { renderLabProjectAssetsPanel } from "../../rooms/laboratory/ui/lab-project-assets-panel.ts";
import { renderWorkspaceSurface } from "../../rooms/laboratory/ui/workspace-surface.ts";

const sourcePresets = JSON.parse(
  readFileSync("rooms/laboratory/shared/data/tools/source-presets.json", "utf8")
);
const ytDlpForm = JSON.parse(
  readFileSync("rooms/laboratory/shared/data/tools/yt-dlp.form.json", "utf8")
);

function createLineageState(
  options: {
    dualPreviewEnabled?: boolean;
    dualPreviewAudioAssetId?: string | null;
    startOffsetMs?: number;
  } = {}
) {
  const store = createLabStore();
  store.dispatch({
    type: "snapshot-received",
    payload: {
      featureId: "media-analysis",
      ready: true,
      activeProjectId: "project-1",
      projects: [{ id: "project-1", name: "lab-demo.mp4", hasSource: true }],
      activeProject: {
        id: "project-1",
        name: "lab-demo.mp4",
        createdAt: "2026-04-23T18:30:00.000Z",
        source: {
          status: "ready",
          kind: "video",
          mode: "local",
          previewUrl: "file:///tmp/lab-demo.mp4",
          storedFileName: "lab-demo.mp4",
          storedPath: "/tmp/lab-demo.mp4",
          routeLabel: "Local Copy",
          drafts: {
            fileNameHint: "lab-demo.mp4",
            urlInput: "",
            youtubeUrl: "",
            youtubePreset: "medium",
            youtubeCustom: {},
          },
          metadata: {
            durationSeconds: 1.4,
            sizeBytes: 2048,
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
        assets: [
          {
            id: "source-active",
            type: "source",
            name: "lab-demo.mp4",
            localPath: "/tmp/lab-demo.mp4",
            createdAt: 100,
            sourceId: "source-active",
            metadata: {
              storedFileName: "lab-demo.mp4",
            },
          },
          {
            id: "asset-audio-linked",
            type: "audio",
            name: "audio.wav",
            localPath: "/tmp/audio.wav",
            createdAt: 200,
            sourceId: "source-active",
            derivedFromAssetId: "source-active",
            derivedFromSourceId: "source-active",
            metadata: {
              durationMs: 1400,
              startOffsetMs: options.startOffsetMs ?? 0,
            },
          },
          {
            id: "asset-audio-linked-newer",
            type: "audio",
            name: "audio-newer.wav",
            localPath: "/tmp/audio-newer.wav",
            createdAt: 300,
            sourceId: "source-active",
            derivedFromAssetId: "source-active",
            derivedFromSourceId: "source-active",
            metadata: {
              durationMs: 1400,
              startOffsetMs: 0,
              ...(options.startOffsetMs === undefined ? {} : { startOffsetMs: options.startOffsetMs }),
            },
          },
        ],
      },
      workbench: {
        activeModuleId: "media-analysis",
        availableModuleIds: ["media-analysis"],
        selectedModuleIds: ["media-analysis"],
      },
      sourcePresets,
      ytDlpForm,
      toolRegistry: [],
      toolState: {
        tools: {},
      },
      sourceProbeStatus: "completed",
      profileModels: [],
      reports: {
        user: null,
        ai: null,
        emptyReason: "Rapor henüz üretilmedi.",
      },
      activityFeed: [],
    },
  });
  if (options.dualPreviewEnabled === true) {
    store.dispatch({
      type: "workspace-dual-preview-toggled",
      force: true,
      audioAssetId: options.dualPreviewAudioAssetId || "asset-audio-linked-newer",
    });
  }
  return store.getState();
}

test("laboratory project assets panel renders linked source and sync label for audio assets", () => {
  const panelHtml = renderLabProjectAssetsPanel(createLineageState());

  assert.match(panelHtml, /audio\.wav/);
  assert.match(panelHtml, /data-lab-action="focus-source-preview"/);
  assert.match(panelHtml, /Source: lab-demo\.mp4/);
  assert.match(panelHtml, /Senkron: ✓ Aynı zaman ekseni/);
});

test("laboratory workspace surface renders linked audio bar above the preview in deterministic order", () => {
  const surface = renderWorkspaceSurface(createLineageState());

  assert.match(surface.main, /Bu kaynağın ses çıktıları mevcut:/);
  assert.match(surface.main, /audio\.wav/);
  assert.match(surface.main, /audio-newer\.wav/);
  assert.match(surface.main, /🎧 Ses ile birlikte aç/);
  assert.match(
    surface.main,
    /data-lab-action="asset-preview"[\s\S]*data-lab-value="asset-audio-linked"/
  );
  assert.ok(
    surface.main.indexOf("labx-linked-audio-bar") < surface.main.indexOf("lab-workspace-preview")
  );
  assert.ok(surface.main.indexOf("audio-newer.wav") < surface.main.indexOf("audio.wav"));
});

test("laboratory workspace surface renders split dual preview with shared transport controls", () => {
  const surface = renderWorkspaceSurface(
    createLineageState({
      dualPreviewEnabled: true,
      dualPreviewAudioAssetId: "asset-audio-linked-newer",
      startOffsetMs: 250,
    })
  );

  assert.match(surface.main, /data-preview-mode="dual"/);
  assert.match(surface.main, /data-lab-role="dual-preview-master"/);
  assert.match(surface.main, /data-lab-role="dual-preview-slave"/);
  assert.match(surface.main, /data-lab-action="dual-preview-toggle-play"/);
  assert.match(surface.main, /data-lab-action="workspace-close-dual-preview"/);
  assert.match(surface.main, /data-lab-action="workspace-dual-preview-audio-select"/);
  assert.match(surface.main, /Senkron: Ofset \+250 ms/);
  assert.match(surface.main, /labx-timeline__waveform-window/);
  assert.match(surface.main, /id="lab-audio-viz"/);
  assert.doesNotMatch(surface.main, /workspace\.audioFocus\.visualizationMode/);
  assert.doesNotMatch(surface.main, /labx-dual-preview-audio__meter/);
  assert.ok(
    surface.main.indexOf("labx-workspace-preview__video-stage") <
      surface.main.indexOf("labx-roi-overlay")
  );
  assert.ok(surface.main.indexOf("labx-dual-preview-audio__meta") < surface.main.indexOf("lab-audio-viz"));
});
