import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { getLabLayoutKind, renderLabLayout } from "../../rooms/laboratory/ui/lab-layout.ts";
import { renderLabSourcePanel } from "../../rooms/laboratory/ui/lab-source-panel.ts";
import { buildLabDecisionSnapshot } from "../../rooms/laboratory/ui/lab-decision-layer.ts";
import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";

describe("mounted shell and source panel", () => {
  void test("laboratory mounted shell keeps chrome when YouTube is selected as a source mode", async () => {
    const environment = createMountedLaboratoryTransitionEnvironment();

    try {
      await import(
        `${pathToFileURL(resolve("rooms/laboratory/ui/lab-root.ts")).href}?mountedImport=${Date.now()}`
      );

      assert.deepEqual(environment.readyPayload(), {
        feature: "media-analysis",
        room: "laboratory",
        stage: "ui-ready",
      });
      assert.match(environment.runtimeRoot.innerHTML, /data-layout-kind="laboratory"/);
      assert.match(environment.runtimeRoot.innerHTML, /data-ready="false"/);
      assert.match(environment.runtimeRoot.innerHTML, /class="labx-top-bar"/);
      assert.match(environment.runtimeRoot.innerHTML, /class="labx-drawer labx-context-panel"/);
      assert.match(environment.runtimeRoot.innerHTML, /class="labx-process-strip"/);

      environment.runtimeRoot.mountedQueriesEnabled = true;

      const clickListener = environment.listener("click");
      assert.ok(clickListener);
      clickListener({
        target: new MountedActionElement("analysis-prep-group-drawer-toggle", "audio-signal"),
      } as unknown as Event);
      assert.match(environment.runtimeRoot.innerHTML, /data-lab-value="audio-signal"/);
      assert.match(
        environment.runtimeRoot.innerHTML,
        /data-lab-value="audio-signal"[\s\S]*aria-expanded="true"/
      );

      clickListener({
        target: new MountedActionElement("analysis-prep-group-drawer-toggle", "audio-signal"),
      } as unknown as Event);
      assert.match(
        environment.runtimeRoot.innerHTML,
        /data-lab-value="audio-signal"[\s\S]*aria-expanded="false"/
      );

      const changeListener = environment.listener("change");
      assert.ok(changeListener);
      changeListener({
        target: new MountedSelectElement("source.mode", "youtube"),
      } as unknown as Event);

      assert.match(environment.runtimeRoot.innerHTML, /data-layout-kind="laboratory"/);
      assert.match(environment.runtimeRoot.innerHTML, /class="labx-top-bar"/);
      assert.match(environment.runtimeRoot.innerHTML, /class="labx-drawer labx-context-panel"/);
      assert.match(environment.runtimeRoot.innerHTML, /class="labx-process-strip"/);
      assert.doesNotMatch(environment.runtimeRoot.innerHTML, /class="labx-import-workspace"/);
      assert.doesNotMatch(
        environment.runtimeRoot.innerHTML,
        /data-lab-action="exit-youtube-import-mode"/
      );
    } finally {
      environment.restore();
    }
  });
  void test("laboratory mounted shell coalesces store side effects into one animation frame", async () => {
    const environment = createMountedLaboratoryTransitionEnvironment({ animationFrame: true });

    try {
      await import(
        `${pathToFileURL(resolve("rooms/laboratory/ui/lab-root.ts")).href}?rafCoalescing=${Date.now()}`
      );

      environment.flushAnimationFrames();
      environment.resetStorageWriteCount();
      environment.runtimeRoot.mountedQueriesEnabled = true;

      const clickListener = environment.listener("click");
      assert.ok(clickListener);

      clickListener({
        target: new MountedActionElement("analysis-prep-group-drawer-toggle", "audio-signal"),
      } as unknown as Event);
      clickListener({
        target: new MountedActionElement("analysis-prep-group-drawer-toggle", "audio-signal"),
      } as unknown as Event);

      assert.equal(environment.animationFrameCount(), 1);
      assert.equal(environment.storageWriteCount(), 0);

      environment.flushAnimationFrames();

      assert.equal(environment.animationFrameCount(), 0);
      assert.equal(environment.storageWriteCount(), 1);
    } finally {
      environment.restore();
    }
  });
  void test("laboratory mounted fallback logs missing region diagnostics before preserving debug replacement", async () => {
    const environment = createMountedLaboratoryTransitionEnvironment();

    try {
      await import(
        `${pathToFileURL(resolve("rooms/laboratory/ui/lab-root.ts")).href}?mountedFallback=${Date.now()}`
      );

      environment.runtimeRoot.mountedQueriesEnabled = true;
      environment.runtimeRoot.setShellAttribute("data-lab-debug-regions", "true");
      environment.runtimeRoot.clearLayoutWrites();

      const clickListener = environment.listener("click");
      assert.ok(clickListener);

      const debugLogs = captureDebugLogs(function () {
        clickListener({
          target: new MountedActionElement("analysis-prep-group-drawer-toggle", "audio-signal"),
        } as unknown as Event);
      });
      const debugMessages = debugLogs.map(function (entry) {
        return entry[0];
      });

      assert.equal(debugMessages[0], "[lab][fallback] triggered -> regionsFound: 0");
      assert.deepEqual(debugLogs[0]?.[1], {
        missing: [
          "topbar",
          "left-rail",
          "main-stage",
          "context-panel",
          "inspector",
          "process-strip",
        ],
        regionsFound: 0,
      });
      assert.deepEqual(
        debugMessages.slice(1, 7).sort(),
        [
          "[lab][region] context-panel -> missing",
          "[lab][region] inspector -> missing",
          "[lab][region] topbar -> missing",
          "[lab][region] left-rail -> missing",
          "[lab][region] main-stage -> missing",
          "[lab][region] process-strip -> missing",
        ].sort()
      );
      assert.ok(
        debugMessages.some(function (message) {
          return typeof message === "string" && message.startsWith("[lab][decision] ");
        })
      );
      assert.ok(environment.runtimeRoot.layoutWrites.length >= 1);
      assert.match(environment.runtimeRoot.innerHTML, /data-lab-debug-regions="true"/);
    } finally {
      environment.restore();
    }
  });
  void test("laboratory YouTube source panel renders checked stream controls without import-only shell", () => {
    const sourcePresets = JSON.parse(
      readFileSync("rooms/laboratory/tools/source-presets.json", "utf8")
    ) as Record<string, unknown>;
    const ytDlpForm = JSON.parse(
      readFileSync("rooms/laboratory/tools/yt-dlp.form.json", "utf8")
    ) as Record<string, unknown>;
    const store = createLabStore();
    store.dispatch({
      type: "snapshot-received",
      payload: {
        ready: true,
        featureId: "media-analysis",
        activeProjectId: "project-1",
        projects: [{ id: "project-1", name: "YouTube Draft", hasSource: false }],
        activeProject: {
          id: "project-1",
          name: "YouTube Draft",
          source: {
            kind: "video",
            mode: "youtube",
            status: "idle",
            drafts: {
              urlInput: "",
              youtubeUrl: "https://youtube.com/watch?v=abc123",
              youtubePreset: "custom",
              youtubeCaptureMode: "video+audio",
              youtubeCustom: {
                mergeOutputFormat: "mp4",
                writeSubtitles: true,
                retries: 12,
              },
            },
          },
          edit: {},
          profile: { preflight: {} },
          process: { records: {} },
          report: { records: {} },
        },
        sourcePresets,
        ytDlpForm,
        toolState: { tools: { "yt-dlp": { installed: true } } },
      },
    });
    store.dispatch({ type: "project-import-method-changed", kind: "video", method: "youtube" });
    store.dispatch({
      type: "project-import-url-check-started",
      url: "https://youtube.com/watch?v=abc123",
    });
    store.dispatch({
      type: "host-event-received",
      event: {
        id: "evt-url-check",
        kind: "request-result",
        severity: "success",
        message: "URL check completed",
        detail: null,
        action: "project-import-check-url",
        stage: "completed",
        timestamp: Date.now(),
        source: "host",
        scope: "global",
        moduleId: null,
        rawLine: null,
        result: {
          url: "https://youtube.com/watch?v=abc123",
          isYoutube: true,
          kind: "video",
          preview: {
            title: "Sample Video Title",
            duration: 154,
            thumbnail: "https://img.youtube.com/vi/abc123/hqdefault.jpg",
          },
          formats: [
            {
              formatId: "137",
              label: "Video 1080p",
              kind: "video",
              extension: "mp4",
            },
            {
              formatId: "140",
              label: "Audio m4a",
              kind: "audio",
              extension: "m4a",
            },
          ],
          selectedVideoFormatId: "137",
          selectedAudioFormatId: "140",
        },
      } as never,
    });
    const state = store.getState();
    const panelMarkup = renderLabSourcePanel(state);
    const shellMarkup = renderLabLayout(state, {
      main: `<div id="lab-workspace-main"></div>`,
      side: "",
    });

    assert.equal(getLabLayoutKind(state), "laboratory");
    assert.match(shellMarkup, /data-layout-kind="laboratory"/);
    assert.match(shellMarkup, /class="labx-top-bar"/);
    assert.match(shellMarkup, /class="labx-process-strip"/);
    assert.doesNotMatch(shellMarkup, /data-layout-kind="import-only"/);
    assert.doesNotMatch(shellMarkup, /class="labx-import-workspace"/);
    assert.match(panelMarkup, /class="labx-project-import__youtube-result"/);
    assert.match(panelMarkup, /Sample Video Title/);
    const actionsIndex = panelMarkup.indexOf('class="labx-sp-url__actions"');
    const progressIndex = panelMarkup.indexOf('class="labx-project-import__progress"');
    const youtubeResultIndex = panelMarkup.indexOf('class="labx-project-import__youtube-result"');
    assert.ok(actionsIndex >= 0);
    assert.ok(progressIndex > actionsIndex);
    assert.ok(youtubeResultIndex > progressIndex);
    assert.match(panelMarkup, /data-lab-field="project-import\.youtubeCaptureMode"/);
    assert.match(panelMarkup, /data-lab-field="project-import\.youtubeVideoFormat"/);
    assert.match(panelMarkup, /data-lab-field="project-import\.youtubeAudioFormat"/);
    assert.match(panelMarkup, /<option value="137" selected>Video 1080p<\/option>/);
    assert.match(panelMarkup, /<option value="140" selected>Audio m4a<\/option>/);
    assert.match(panelMarkup, /data-lab-field="project-import\.youtubeCustom\.mergeOutputFormat"/);
    assert.doesNotMatch(
      panelMarkup,
      /data-lab-field="project-import\.youtubeCustom\.writeSubtitles"/
    );
    assert.doesNotMatch(
      panelMarkup,
      /data-lab-field="project-import\.youtubeCustom\.writeAutoSubtitles"/
    );
    assert.doesNotMatch(
      panelMarkup,
      /data-lab-field="project-import\.youtubeCustom\.subtitlesLang"/
    );
    assert.match(panelMarkup, /data-lab-field="project-import\.youtubeCustom\.retries"/);
    assert.doesNotMatch(panelMarkup, /data-lab-action="youtube-import-set-strategy"/);
    assert.doesNotMatch(panelMarkup, /data-lab-field="youtube-import\.custom/);
    assert.doesNotMatch(panelMarkup, /data-lab-field="project-import\.youtubeCustom\.format"/);
    assert.doesNotMatch(panelMarkup, /class="labx-strategy-list"/);

    const enTranslations = JSON.parse(
      readFileSync("rooms/laboratory/i18n/en.json", "utf8")
    ) as Record<string, unknown>;
    const trTranslations = JSON.parse(
      readFileSync("rooms/laboratory/i18n/tr.json", "utf8")
    ) as Record<string, unknown>;
    assert.deepEqual(
      Object.keys(
        (
          (enTranslations["mediaAnalysis"] as Record<string, unknown>)["source"] as Record<
            string,
            unknown
          >
        )["youtubeImport"] as Record<string, unknown>
      ).sort(),
      Object.keys(
        (
          (trTranslations["mediaAnalysis"] as Record<string, unknown>)["source"] as Record<
            string,
            unknown
          >
        )["youtubeImport"] as Record<string, unknown>
      ).sort()
    );
  });
  void test("laboratory shell preserves workspace preview nodes while diffing live panels", () => {
    const labRootSource = readFileSync("rooms/laboratory/ui/lab-root.ts", "utf8");
    const labRootObservabilitySource = readFileSync(
      "rooms/laboratory/ui/lab-root-observability.ts",
      "utf8"
    );
    const labDomSyncSource = readFileSync("rooms/laboratory/ui/lab-dom-sync.ts", "utf8");
    readFileSync("rooms/laboratory/ui/workspace-surface.ts", "utf8");
    const workspaceSourceIntakeSource = readFileSync(
      "rooms/laboratory/ui/workspace-source-intake.ts",
      "utf8"
    );

    assert.match(labDomSyncSource, /function updateRenderedElement\(/);
    assert.match(labDomSyncSource, /function syncChildNodes\(/);
    assert.match(labDomSyncSource, /function canReuseElement\(/);
    assert.match(labRootSource, /from "\.\/lab-root-observability\.js"/);
    assert.match(labRootObservabilitySource, /const LAB_REGION_SELECTORS = \{/);
    assert.match(
      labRootObservabilitySource,
      /topBar: \['\[data-lab-region="topbar"\]', '\[data-lab-region="top-bar"\]', "\.labx-top-bar"\]/
    );
    assert.match(
      labRootObservabilitySource,
      /leftRail: \[\s*'\[data-lab-region="source-panel"\]',\s*'\[data-lab-region="left-rail-source"\]',\s*'\[data-lab-region="left-rail"\]',\s*"\.labx-source-panel",\s*"\.labx-left-rail",\s*\]/
    );
    assert.match(
      labRootObservabilitySource,
      /mainStage: \['\[data-lab-region="main-stage"\]', "\.labx-center-panel"\]/
    );
    assert.match(
      labRootObservabilitySource,
      /contextPanel: \['\[data-lab-region="context-panel"\]', "\.labx-drawer"\]/
    );
    assert.match(
      labRootObservabilitySource,
      /inspectorPanel: \['\[data-lab-region="inspector-panel"\]', "\.labx-workspace-inspector"\]/
    );
    assert.match(
      labRootObservabilitySource,
      /processStrip: \['\[data-lab-region="process-strip"\]', "\.labx-process-strip"\]/
    );
    assert.match(
      labRootObservabilitySource,
      /function queryRegion\(root: ParentNode, selectors: readonly string\[\]\)/
    );
    assert.match(labRootObservabilitySource, /for \(const selector of selectors\)/);
    assert.match(
      labRootSource,
      /element:\s*queryRegion\(runtimeRoot, LAB_REGION_SELECTORS\[descriptor\.key\]\)/
    );
    assert.match(labRootObservabilitySource, /function syncRegion\(input: \{/);
    assert.match(
      labRootObservabilitySource,
      /const currentElement = queryRegion\(input\.root, input\.selectors\);/
    );
    assert.match(labRootObservabilitySource, /return false;/);
    assert.match(labRootObservabilitySource, /function shouldFallback\(regionsFound: number\)/);
    assert.match(labRootObservabilitySource, /return regionsFound < 3;/);
    assert.match(labRootObservabilitySource, /const LAB_OVERLAY_SELECTORS = \{/);
    assert.match(labRootObservabilitySource, /function syncOverlayRoot\(/);
    assert.match(labRootSource, /const regionDescriptors: LabRegionDescriptor\[\] = \[/);
    assert.match(
      labRootSource,
      /key: "topBar"[\s\S]*key: "leftRail"[\s\S]*key: "mainStage"[\s\S]*key: "contextPanel"[\s\S]*key: "inspectorPanel"[\s\S]*key: "processStrip"/
    );
    assert.match(
      labRootSource,
      /key: "inspectorPanel"[\s\S]*render\(\) \{[\s\S]*return surface\.inspector \?\? "";[\s\S]*\}/
    );
    assert.match(labRootSource, /shouldFallback\(regionsFound\)/);
    assert.doesNotMatch(labRootSource, /shouldFallback\(regionsFound\) \|\| !overlayRoot/);
    assert.match(labRootObservabilitySource, /function debugLabRegionLifecycle\(/);
    assert.match(labRootObservabilitySource, /function debugLabFallback\(/);
    assert.match(labRootObservabilitySource, /function debugLabOverlay\(/);
    assert.match(labRootObservabilitySource, /function syncLabDebugPanel\(/);
    assert.match(labRootObservabilitySource, /\[lab\]\[region\]/);
    assert.match(labRootObservabilitySource, /\[lab\]\[fallback\]/);
    assert.match(labRootObservabilitySource, /\[lab\]\[overlay\]/);
    assert.match(labRootSource, /\[lab\]\[decision\]/);
    assert.match(labRootSource, /buildLabDecisionSnapshot\(\{ shell, state \}\)/);
    assert.match(labRootSource, /lastDecisionLogKey = null;/);
    assert.match(
      labRootSource,
      /debugLabFallback\(shell, regionsFound, missingRegions\);[\s\S]*replaceLabLayout\(state, surface, copy\);/
    );
    assert.match(labRootSource, /mountedShell\.setAttribute\("data-lab-debug-regions", "true"\)/);
    assert.doesNotMatch(labRootSource, /\[lab-root\] regions synced/);
    assert.match(
      labDomSyncSource,
      /const preserveKey = readPreservedMediaKey\(currentElement\) \|\| readPreservedMediaKey\(nextElement\);/
    );
    assert.match(labDomSyncSource, /function readPreservedDetailsState\(/);
    assert.match(labDomSyncSource, /element\.hasAttribute\("data-lab-interpretation-panel"\)/);
    assert.match(labDomSyncSource, /element\.hasAttribute\("data-lab-collapsible-panel"\)/);
    assert.match(labDomSyncSource, /currentElement\.open = preservedDetailsState;/);
    assert.match(labDomSyncSource, /currentElement\.scrollTop = scrollTop;/);
    assert.match(
      labRootSource,
      /syncRegion\(\{[\s\S]*debugShell: shell,[\s\S]*documentRef,[\s\S]*regionKey: region\.key,[\s\S]*render: region\.render,[\s\S]*root: runtimeRoot,[\s\S]*selectors: LAB_REGION_SELECTORS\[region\.key\],[\s\S]*\}\);/
    );
    assert.match(workspaceSourceIntakeSource, /preserveKey \|\| "workspace-preview"/);
    assert.match(
      workspaceSourceIntakeSource,
      /data-lab-preserve-media="\$\{escapeHtml\(preserveKey\)\}"/
    );
  });
});
