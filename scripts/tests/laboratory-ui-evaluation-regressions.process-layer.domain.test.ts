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

describe("process layer", () => {
  void test("laboratory process layer is single-source and old right panel is retired", () => {
    const surfaceSource = readFileSync("rooms/laboratory/ui/workspace-surface.ts", "utf8");
    const drawerSource = readFileSync("rooms/laboratory/ui/lab-drawer.ts", "utf8");
    const drawerResultExploreSource = readFileSync(
      "rooms/laboratory/ui/lab-drawer-result-explore.ts",
      "utf8"
    );
    const processStripSource = readFileSync("rooms/laboratory/ui/lab-process-strip.ts", "utf8");
    const themeSource = readLabThemeSource();

    assert.doesNotMatch(surfaceSource, /data-lab-global-process="true"/);
    assert.doesNotMatch(surfaceSource, /renderWorkspaceProcessPanel/);
    assert.equal(existsSync("rooms/laboratory/ui/workspace-process-panel.ts"), false);
    assert.match(drawerResultExploreSource, /getLaboratoryRightPanelContext/);
    assert.match(processStripSource, /getLaboratoryProcessSummary/);
    assert.doesNotMatch(drawerSource, /labx-process-panel/);
    assert.doesNotMatch(themeSource, /labx-process-panel|labx-intent-map|labx-output-trace/);
  });
});
