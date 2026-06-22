import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { renderLabWaveformTimeline } from "../../rooms/laboratory/ui/lab-waveform-timeline.ts";
import { getLabLayoutKind, renderLabLayout } from "../../rooms/laboratory/ui/lab-layout.ts";
import { createLabI18n } from "../../rooms/laboratory/ui/lab-i18n.ts";
import { renderLabSourcePanel } from "../../rooms/laboratory/ui/lab-source-panel.ts";
import {
  buildLabDecisionSnapshot,
  deriveLabDecisionSignals,
  deriveLabDecisionSignalsFromState,
  readLabDecisionActiveBlocks,
  resolveLabDecisionIntent,
  resolveLabDecisionState,
} from "../../rooms/laboratory/ui/lab-decision-layer.ts";
import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import {
  formatLabUserActionDisplayText,
  translateLabRuntimeText,
} from "../../rooms/laboratory/ui/lab-runtime-i18n.ts";
import { createRoomBuiltArtifact } from "./helpers/room-installed-copy.ts";
import { readCssWithImports } from "./helpers/css-imports.ts";
import { importLabRootModuleWithDomStub } from "./laboratory-runtime-truth.helpers.ts";
import type { LabDecisionSnapshot, LabRun } from "../../rooms/laboratory/domain/lab-types.ts";
import type { LabWaveformTimelineModel } from "../../rooms/laboratory/ui/lab-waveform-timeline-types.ts";

describe("process strip and theme", () => {
  void test("laboratory process strip owns heartbeat and expanded runtime detail rendering", () => {
    const labRootSource = readFileSync("rooms/laboratory/ui/lab-root.ts", "utf8");
    const processStripSource = readFileSync("rooms/laboratory/ui/lab-process-strip.ts", "utf8");
    const themeSource = readLabThemeSource();

    assert.match(labRootSource, /processStripHeartbeatInterval/);
    assert.match(labRootSource, /setInterval\(function \(\) \{\s*render\(\);/);
    assert.match(labRootSource, /shell\.dataset\["processView"\]/);
    assert.match(processStripSource, /data-lab-process-expanded="true"/);
    assert.match(processStripSource, /class="labx-strip-detail-toggle"/);
    assert.doesNotMatch(processStripSource, /class="labx-strip-expand"/);
    assert.doesNotMatch(processStripSource, /class="labx-strip-cancel"/);
    assert.match(processStripSource, /getUserActions\(state\)\.slice\(0, 5\)/);
    assert.match(processStripSource, /state\.run\?\.rawLog/);
    assert.match(
      themeSource,
      /\.labx-shell\[data-process-view="expanded"\]\s*\{[\s\S]*grid-template-rows:\s*var\(--lab-topbar-height\)\s+minmax\(\s*0,\s*1fr\s*\)\s+var\(--lab-shell-px-200\);/
    );
    assert.match(
      themeSource,
      /\.labx-process-strip\s*\{[\s\S]*flex-direction:\s*column;[\s\S]*height:\s*100%;/
    );
    assert.match(
      themeSource,
      /\.labx-strip-expanded\s*\{[\s\S]*display:\s*grid;[\s\S]*grid-template-columns:\s*minmax\(0, 35fr\) minmax\(0, 65fr\);[\s\S]*background:\s*var\(--lab-surface-1\);/
    );
    assert.match(
      themeSource,
      /\.labx-strip-expanded section\s*\{[\s\S]*background:\s*var\(--lab-status-shell-color-06\);/
    );
    assert.match(
      themeSource,
      /\.labx-strip-expanded__list li,[\s\S]*\.labx-strip-expanded__log li\s*\{[\s\S]*background:\s*var\(--lab-status-shell-color-08\);/
    );
    assert.match(
      themeSource,
      /\.labx-strip-expanded__log li\s*\{[\s\S]*font-family:\s*var\(--lab-font-mono\);[\s\S]*line-height:\s*var\(--lab-leading-snug\);[\s\S]*white-space:\s*normal;/
    );
  });
  void test("laboratory theme defines the multi-region shell grid and drawer layout contract", () => {
    const baseSource = readFileSync("rooms/laboratory/ui/styles/base.css", "utf8");
    const themeSource = readLabThemeSource();
    const sourceImportSource = readFileSync(
      "rooms/laboratory/ui/styles/lab-source-import.css",
      "utf8"
    );

    const tokenSource = readFileSync("rooms/laboratory/ui/styles/lab-tokens.css", "utf8");

    assert.match(baseSource, /@import "\.\/lab-tokens\.css";/);
    assert.match(baseSource, /@import "\.\/lab-primitives\.css";/);
    assert.match(tokenSource, /--labx-bg-main:\s*var\(--lab-surface-1\);/);
    assert.match(tokenSource, /--labx-bg-elevated:\s*var\(--lab-surface-2\);/);
    assert.match(tokenSource, /--labx-text-primary:\s*var\(--lab-text-strong\);/);
    assert.match(tokenSource, /--labx-text-muted:\s*var\(--lab-text-dim\);/);
    assert.match(tokenSource, /--labx-danger:\s*var\(--lab-error\);/);
    assert.match(
      themeSource,
      /\.labx-shell\s*\{[\s\S]*grid-template-columns:\s*minmax\(var\(--lab-shell-rem-14\), var\(--lab-shell-rem-18\)\)\s+minmax\(\s*0,\s*1fr\s*\)\s+minmax\(var\(--lab-shell-rem-18\), var\(--lab-shell-rem-24\)\);[\s\S]*grid-template-rows:\s*var\(--lab-topbar-height\)\s+minmax\(\s*0,\s*1fr\s*\)\s+var\(--lab-strip-height\);/
    );
    assert.match(
      themeSource,
      /\.labx-shell\s*\{[\s\S]*grid-template-areas:\s*"topbar topbar\s+topbar"\s*"panel\s+center\s+context"\s*"panel\s+strip\s+context";/
    );
    assert.match(
      themeSource,
      /\.labx-shell\[data-source-panel-collapsed="true"\]\s*\{[\s\S]*grid-template-columns:\s*0\s+minmax\(\s*0,\s*1fr\s*\)\s+minmax\(var\(--lab-shell-rem-18\), var\(--lab-shell-rem-24\)\);/
    );
    assert.match(
      themeSource,
      /\.labx-shell\[data-drawer-collapsed="true"\]\s*\{[\s\S]*grid-template-columns:\s*minmax\(var\(--lab-shell-rem-14\), var\(--lab-shell-rem-18\)\)\s+minmax\(\s*0,\s*1fr\s*\)\s+0;/
    );
    assert.match(
      themeSource,
      /\.labx-shell\[data-source-panel-collapsed="true"\]\[data-drawer-collapsed="true"\]\s*\{[\s\S]*grid-template-columns:\s*0\s+minmax\(\s*0,\s*1fr\s*\)\s+0;/
    );
    assert.doesNotMatch(themeSource, /\.labx-drawer--collapsed/);
    assert.doesNotMatch(themeSource, /\.labx-drawer__expand-btn/);
    assert.match(themeSource, /\.labx-center-skeleton__label\s*\{/);
    assert.match(themeSource, /\.labx-boot-overlay\s*\{[\s\S]*pointer-events:\s*auto;/);
    assert.match(
      themeSource,
      /\.labx-boot-panel\s*\{[\s\S]*border-radius:\s*var\(--lab-radius-lg\);/
    );
    assert.match(themeSource, /@keyframes labx-skeleton-breathe/);
    assert.doesNotMatch(themeSource, /\.labx-shell\[data-ready="false"\]::after/);
    assert.doesNotMatch(themeSource, /\.labx-shell\[data-ready="false"\]\s+\.labx-center-panel/);
    assert.doesNotMatch(themeSource, /labx-boot-breathe/);
    assert.match(
      themeSource,
      /\.labx-top-bar\s*\{\s*grid-area:\s*topbar;\s*\}[\s\S]*\.labx-source-panel\s*\{\s*grid-area:\s*panel;\s*\}[\s\S]*\.labx-center-panel\s*\{\s*grid-area:\s*center;\s*\}[\s\S]*\.labx-drawer\s*\{\s*grid-area:\s*context;\s*\}[\s\S]*\.labx-process-strip\s*\{\s*grid-area:\s*strip;\s*\}/
    );
    assert.doesNotMatch(themeSource, /\.labx-shell\[data-layout-kind="import-only"\]/);
    assert.doesNotMatch(sourceImportSource, /\.labx-import-/);
    assert.doesNotMatch(sourceImportSource, /\.labx-strategy-/);
    assert.doesNotMatch(sourceImportSource, /\.labx-pw-/);
    assert.doesNotMatch(sourceImportSource, /\.labx-import-review/);
    assert.match(
      sourceImportSource,
      /\.labx-project-import__youtube-preview\s*\{[\s\S]*display:\s*grid;/
    );
    assert.match(sourceImportSource, /\.labx-project-import__progress\s*\{[\s\S]*display:\s*grid;/);
    assert.match(
      sourceImportSource,
      /\.labx-project-import__yt-controls\s*\{[\s\S]*display:\s*grid;/
    );
    assert.match(
      sourceImportSource,
      /\.labx-project-import__yt-field\s*\{[\s\S]*grid-template-columns:\s*minmax\(var\(--lab-source-import-rem-7-5\), 0\.42fr\) minmax\(0, 1fr\);/
    );
    assert.doesNotMatch(sourceImportSource, /\.labx-advanced-settings/);
  });
});
