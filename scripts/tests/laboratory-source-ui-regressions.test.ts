import test from "node:test";
import assert from "node:assert/strict";

import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import { renderLabLeftRail } from "../../rooms/laboratory/ui/lab-left-rail.ts";
import { renderSourceStage } from "../../rooms/laboratory/ui/stages/source-stage.ts";

function createSeededState() {
  const store = createLabStore();
  store.dispatch({
    type: "hydrate",
    payload: {
      currentStage: "source",
      featureId: "media-analysis",
      projectIndex: {
        activeProjectId: "project-1",
        projects: [{ id: "project-1", name: "Lab Session 2026-04-16 15:33" }],
      },
      workbench: {
        activeModuleId: "media-analysis",
        availableModuleIds: ["media-analysis", "audio-analysis", "subtitle-analysis"],
        selectedModuleIds: ["media-analysis", "audio-analysis"],
      },
      source: {
        status: "ready",
        kind: "video",
        mode: "local",
        previewUrl: "file:///tmp/lab-demo.mp4",
        storedFileName: "lab-demo.mp4",
        routeLabel: "Yerel dosya",
        metadata: {
          width: 640,
          height: 360,
          durationSeconds: 801,
          sizeBytes: 86100000,
        },
      },
      sourceProbeStatus: "completed",
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

test("laboratory left rail exposes module management and Turkish workbench copy", () => {
  const store = createSeededState();
  store.dispatch({ type: "module-manager-toggled", open: true });
  const html = renderLabLeftRail(store.getState());

  assert.match(html, /Modül Yönetimi/);
  assert.match(html, /Seçili Modüller/);
  assert.match(html, /Yoğun operatör tezgahı/);
  assert.doesNotMatch(html, /Dense operator workbench|Modules|Focus/);
});

test("laboratory source stage renders quick module controls and a media preview panel", () => {
  const surface = renderSourceStage({
    primaryDetail: "Probe tamamlandı",
    primaryDisabled: false,
    primaryLabel: "Kaynağı Yenile",
    state: createSeededState().getState(),
  });

  assert.match(surface.main, /Kaynak Seçimi/);
  assert.match(surface.main, /Seçili akış:/);
  assert.match(surface.main, /Hızlı modül seçimi burada yapılır/);
  assert.match(surface.main, /Modül ekle|Seçimden çıkar/);
  assert.match(surface.side, /Kaynak Önizleme/);
  assert.match(surface.side, /lab-demo\.mp4/);
  assert.match(surface.side, /<video class="labx-preview-media/);
  assert.match(surface.side, /Tamamlandı/);
  assert.doesNotMatch(surface.side, /Source State|Guidance|Blocking Rule/);
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
