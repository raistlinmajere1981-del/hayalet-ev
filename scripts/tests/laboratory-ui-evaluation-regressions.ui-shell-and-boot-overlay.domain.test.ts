import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { getLabLayoutKind, renderLabLayout } from "../../rooms/laboratory/ui/lab-layout.ts";
import { createRoomBuiltArtifact } from "./helpers/room-installed-copy.ts";

describe("UI shell and boot overlay", () => {
  void test("laboratory UI shell evaluates under minimal runtime stubs", async () => {
    const environment = createMinimalLaboratoryUiEnvironment({
      fakeTimers: true,
    });
    const buildArtifact = await createRoomBuiltArtifact("laboratory");

    try {
      await import(
        `${pathToFileURL(resolve(buildArtifact.rootDir, "ui/index.js")).href}?smoke=${Date.now()}`
      );

      assert.match(environment.runtimeRoot.innerHTML, /class="labx-shell"/);
      assert.match(environment.runtimeRoot.innerHTML, /data-ready="false"/);
      assert.match(environment.runtimeRoot.innerHTML, /data-lab-boot-overlay="true"/);
      assert.match(environment.runtimeRoot.innerHTML, /class="labx-boot-panel"/);
      assert.match(environment.runtimeRoot.innerHTML, /data-lab-center-skeleton="true"/);
      assert.match(environment.runtimeRoot.innerHTML, /labx-center-skeleton__label/);
      assert.match(environment.runtimeRoot.innerHTML, /labx-drawer-skeleton/);
      assert.deepEqual(environment.readyPayload(), {
        feature: "media-analysis",
        room: "laboratory",
        stage: "ui-ready",
      });
    } finally {
      await buildArtifact.cleanup();
      environment.restore();
    }
  });
  void test("laboratory boot overlay unlocks from local ready without a room API bridge", async () => {
    const environment = createMinimalLaboratoryUiEnvironment({
      fakeTimers: true,
      roomApi: "none",
    });
    const buildArtifact = await createRoomBuiltArtifact("laboratory");

    try {
      await import(
        `${pathToFileURL(resolve(buildArtifact.rootDir, "ui/index.js")).href}?localBoot=${Date.now()}`
      );

      assert.match(environment.runtimeRoot.innerHTML, /data-ready="false"/);
      assert.match(environment.runtimeRoot.innerHTML, /data-lab-boot-overlay="true"/);
      assert.equal(environment.readyPayload(), null);

      environment.flushTimers(999);

      assert.match(environment.runtimeRoot.innerHTML, /data-ready="true"/);
      assert.doesNotMatch(environment.runtimeRoot.innerHTML, /data-lab-boot-overlay="true"/);
      assert.match(environment.runtimeRoot.innerHTML, /data-lab-center-skeleton="true"/);
      assert.match(environment.runtimeRoot.innerHTML, /labx-drawer-skeleton/);
      assert.doesNotMatch(environment.runtimeRoot.innerHTML, /lab-project-workspace-root/);
      assert.doesNotMatch(environment.runtimeRoot.innerHTML, /data-overlay="project-workspace"/);
    } finally {
      await buildArtifact.cleanup();
      environment.restore();
    }
  });
  void test("laboratory boot overlay waits for host data when a room API bridge exists", async () => {
    const environment = createMinimalLaboratoryUiEnvironment({
      fakeTimers: true,
    });
    const buildArtifact = await createRoomBuiltArtifact("laboratory");

    try {
      await import(
        `${pathToFileURL(resolve(buildArtifact.rootDir, "ui/index.js")).href}?bridgeBoot=${Date.now()}`
      );

      assert.deepEqual(environment.readyPayload(), {
        feature: "media-analysis",
        room: "laboratory",
        stage: "ui-ready",
      });

      environment.flushTimers(999);

      assert.match(environment.runtimeRoot.innerHTML, /data-ready="false"/);
      assert.match(environment.runtimeRoot.innerHTML, /data-lab-boot-overlay="true"/);
      assert.match(environment.runtimeRoot.innerHTML, /data-lab-center-skeleton="true"/);
      assert.match(environment.runtimeRoot.innerHTML, /labx-drawer-skeleton/);
    } finally {
      await buildArtifact.cleanup();
      environment.restore();
    }
  });
  void test("laboratory boot overlay fallback waits for idle before unlocking bridge loads", async () => {
    const environment = createMinimalLaboratoryUiEnvironment({
      fakeTimers: true,
    });
    const buildArtifact = await createRoomBuiltArtifact("laboratory");

    try {
      await import(
        `${pathToFileURL(resolve(buildArtifact.rootDir, "ui/index.js")).href}?fallbackBoot=${Date.now()}`
      );

      environment.flushTimers(7999);

      assert.match(environment.runtimeRoot.innerHTML, /data-ready="false"/);
      assert.match(environment.runtimeRoot.innerHTML, /data-lab-boot-overlay="true"/);

      environment.flushTimers(8000);

      assert.match(environment.runtimeRoot.innerHTML, /data-ready="true"/);
      assert.doesNotMatch(environment.runtimeRoot.innerHTML, /data-lab-boot-overlay="true"/);
    } finally {
      await buildArtifact.cleanup();
      environment.restore();
    }
  });
  void test("laboratory shell routes host traffic through lab-root orchestration seams", () => {
    const uiIndexSource = readFileSync("rooms/laboratory/ui/index.ts", "utf8");
    const labRootSource = readFileSync("rooms/laboratory/ui/lab-root.ts", "utf8");
    const labLayoutSource = readFileSync("rooms/laboratory/ui/lab-layout.ts", "utf8");
    const hostBridgeSource = readFileSync("rooms/laboratory/runtime/lab-host-bridge.ts", "utf8");

    assert.match(uiIndexSource, /import "\.\/lab-root\.js";/);
    assert.match(labRootSource, /return renderWorkspaceSurface\(state, \{/);
    assert.doesNotMatch(labRootSource, /state\.bootReady && state\.ui\.labMode/);
    assert.match(
      labRootSource,
      /runtimeRoot\.innerHTML = renderLabLayout\(state, surface, copy, \{\s*bootOverlayActive: isBootOverlayActive\(state\),\s*\}\);/
    );
    assert.match(labLayoutSource, /inspectorPanel: ""/);
    assert.match(labRootSource, /renderLabBootOverlay\(copy\)/);
    assert.match(labRootSource, /getLabLayoutKind\(state, \{/);
    assert.match(labRootSource, /currentLayoutKind !== nextLayoutKind/);
    assert.doesNotMatch(labRootSource, /nextLayoutKind === "import-only"/);
    assert.match(labRootSource, /function syncBootOverlay\(/);
    assert.match(labRootSource, /const BOOT_OVERLAY_SETTLE_MS = 450;/);
    assert.match(labRootSource, /const BOOT_OVERLAY_FALLBACK_READY_MS = 8000;/);
    assert.match(labRootSource, /const BOOT_OVERLAY_FAILSAFE_MS = 20000;/);
    assert.match(labRootSource, /let bootBootstrapSeen = false;/);
    assert.match(labRootSource, /function getBootOverlayBootstrapStatus\(state: LabStoreState\)/);
    assert.match(labRootSource, /function hasRoomReadyBridge\(\)/);
    assert.match(labRootSource, /function requestBootOverlayInteractiveUnlock\(\)/);
    assert.match(labRootSource, /requestIdleCallback/);
    assert.match(labRootSource, /function scheduleStoreSideEffects\(state: LabStoreState\)/);
    assert.match(
      labRootSource,
      /requestAnimationFrame\(function \(\) \{\s*storeSideEffectsFrame = null;\s*runStoreSideEffects\(\);/
    );
    assert.match(labRootSource, /function flushStoreSideEffects\(\)/);
    assert.match(
      labRootSource,
      /windowRef\.addEventListener\("beforeunload", handleBeforeUnload\);/
    );
    assert.match(
      labRootSource,
      /store\.subscribe\(function \(state\) \{\s*scheduleStoreSideEffects\(state\);/
    );
    assert.match(labRootSource, /const bootstrapStatus = getBootOverlayBootstrapStatus\(state\);/);
    assert.match(labRootSource, /bootstrapStatus === "ready" \|\| bootstrapStatus === "error"/);
    assert.match(labRootSource, /!hasRoomReadyBridge\(\)/);
    assert.doesNotMatch(labRootSource, /state\.roomReadySent \|\| !hasRoomReadyBridge\(\)/);
    assert.match(
      labRootSource,
      /shell\.dataset\["ready"\] = isBootOverlayActive\(state\) \? "false" : "true";/
    );
    assert.match(labRootSource, /bootBootstrapSeen = true;/);
    assert.match(labRootSource, /scheduleBootOverlayUnlock\(state\);/);
    assert.match(labRootSource, /renderToolManagementOverlay\(state, copy\)/);
    assert.match(labRootSource, /emit:\s*eventBus\.emit,/);
    assert.match(
      labRootSource,
      /roomAPI\.ready\(\{\s*feature:\s*"media-analysis",\s*room:\s*"laboratory",\s*stage:\s*"ui-ready"/
    );
    assert.doesNotMatch(labRootSource, /BOOT_MESSAGES/);
    assert.doesNotMatch(labRootSource, /startBootMessages/);
    assert.doesNotMatch(labRootSource, /stopBootMessages/);
    assert.match(labLayoutSource, /renderToolManagementOverlay\(state, copy\)/);
    assert.match(labLayoutSource, /data-lab-boot-overlay="true"/);
    assert.match(hostBridgeSource, /type === "source-state"/);
    assert.match(hostBridgeSource, /type:\s*"source-snapshot-received"/);
    assert.match(hostBridgeSource, /type === "lab-event"/);
    assert.doesNotMatch(hostBridgeSource, /buildLifecycleEventsFromHostEvent/);
  });
});
