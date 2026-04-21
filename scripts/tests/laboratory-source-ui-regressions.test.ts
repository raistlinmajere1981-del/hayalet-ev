import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import { renderLabLeftRail } from "../../rooms/laboratory/ui/lab-left-rail.ts";
import { renderToolManagementOverlay } from "../../rooms/laboratory/ui/tool-management-overlay.ts";
import { renderWorkspaceSurface } from "../../rooms/laboratory/ui/workspace-surface.ts";

const sourcePresets = JSON.parse(
  readFileSync("rooms/laboratory/shared/data/tools/source-presets.json", "utf8")
);
const ytDlpForm = JSON.parse(
  readFileSync("rooms/laboratory/shared/data/tools/yt-dlp.form.json", "utf8")
);

function createSeededState() {
  const store = createLabStore();
  store.dispatch({
    type: "snapshot-received",
    payload: {
      featureId: "media-analysis",
      ready: true,
      activeProjectId: "project-1",
      projects: [
        { id: "project-1", name: "2026-04-21 12-00 - lab-demo.mp4", hasSource: true },
        { id: "draft-1", name: "Draft", hasSource: false },
      ],
      activeProject: {
        id: "project-1",
        name: "2026-04-21 12-00 - lab-demo.mp4",
        createdAt: "2026-04-21T12:00:00.000Z",
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
            width: 640,
            height: 360,
            durationSeconds: 801,
            sizeBytes: 86100000,
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
      },
      workbench: {
        activeModuleId: "media-analysis",
        availableModuleIds: ["media-analysis", "audio-analysis", "subtitle-analysis"],
        selectedModuleIds: ["media-analysis", "audio-analysis"],
      },
      sourcePresets,
      ytDlpForm,
      toolRegistry: [
        {
          toolId: "ffmpeg",
          displayName: "FFmpeg",
          availability: "system-command",
          manualHint: "FFmpeg runs local media transforms for the active workspace.",
          stageSupport: {
            source: "optional",
            process: "required",
          },
          usedBy: ["media-analysis", "audio-analysis"],
        },
        {
          toolId: "yt-dlp",
          displayName: "yt-dlp",
          availability: "installable",
          readinessImpact: "YouTube capture stays enabled from the source intake frame.",
          stageSupport: {
            source: "required",
          },
          usedBy: ["source-intake"],
        },
        {
          toolId: "whisper-cli",
          displayName: "Whisper CLI",
          availability: "installable",
          readinessImpact: "Optional transcription helpers stay available for room-local runs.",
          stageSupport: {
            process: "optional",
          },
          usedBy: ["subtitle-analysis"],
        },
      ],
      toolState: {
        tools: {
          ffmpeg: {
            installed: false,
          },
          "yt-dlp": {
            installed: true,
            version: "2026.04.20",
            latestVersion: "2026.04.20",
          },
          "whisper-cli": {
            installed: false,
          },
        },
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
  return store;
}

test("laboratory left rail reflects the active workspace shell navigation", () => {
  const store = createSeededState();
  store.dispatch({ type: "module-manager-toggled", open: true });
  const html = renderLabLeftRail(store.getState());

  assert.match(html, /Laboratory/);
  assert.match(html, /Media workspace/);
  assert.match(html, /PROJECT/);
  assert.match(html, /Tool Management/);
  assert.match(html, /Install, update, and refresh local analysis tools/);
  assert.match(html, /INTENTS/);
  assert.match(html, /STATUS/);
  assert.match(html, /Save/);
  assert.match(html, /Delete/);
  assert.doesNotMatch(html, /Modül Yönetimi|Seçili Modüller|Yoğun operatör tezgahı/);
});

test("laboratory workspace surface renders source intake, preview media, and deep-analysis CTA", () => {
  const surface = renderWorkspaceSurface(createSeededState().getState());

  assert.match(surface.main, /Source setup controls/);
  assert.match(
    surface.main,
    /Active source: lab-demo\.mp4\. Reopen this frame when you want to replace it or tune the import route\./
  );
  assert.match(surface.main, /lab-demo\.mp4/);
  assert.match(surface.main, /<video class="labx-preview-media labx-preview-media--workspace-video"/);
  assert.match(surface.main, /data-lab-action="workspace-toggle-source-intake"/);
  assert.match(surface.side, /Run Deep Analysis/);
  assert.match(surface.side, /Background process[^<]*does not lock UI/);
  assert.doesNotMatch(surface.main, /Kaynak Seçimi|Hızlı modül seçimi burada yapılır/);
});

test("laboratory tool overlay lists room-local tool lifecycle actions inside the live shell", () => {
  const store = createSeededState();
  store.dispatch({ type: "tool-manager-toggled", open: true });
  const html = renderToolManagementOverlay(store.getState());

  assert.match(html, /Araç Yönetimi/);
  assert.match(html, /Toplu güncelle/);
  assert.match(html, /Kurulu araç/);
  assert.match(html, /Güncelleme bekleyen/);
  assert.match(html, /yt-dlp/);
  assert.match(html, /FFmpeg/);
  assert.match(html, /data-lab-action="tool-check-updates"/);
  assert.match(html, /data-lab-action="tool-install"/);
  assert.doesNotMatch(html, /Dense operator workbench|Modules|Focus/);
});

test("laboratory store applies optimistic source and workbench patches for source controls", () => {
  const store = createSeededState();
  store.dispatch({
    type: "source-config-patched",
    patch: {
      kind: "audio",
      mode: "url",
    },
  });
  store.dispatch({
    type: "workbench-updated",
    workbench: {
      activeModuleId: "audio-analysis",
      availableModuleIds: ["media-analysis", "audio-analysis", "subtitle-analysis"],
      selectedModuleIds: ["media-analysis", "audio-analysis", "subtitle-analysis"],
    },
  });
  store.dispatch({ type: "module-manager-toggled", open: true });

  const state = store.getState();
  assert.equal(state.source?.["kind"], "audio");
  assert.equal(state.source?.["mode"], "url");
  assert.equal(state.workbench["activeModuleId"], "audio-analysis");
  assert.equal(state.ui.moduleManagerOpen, true);
});
