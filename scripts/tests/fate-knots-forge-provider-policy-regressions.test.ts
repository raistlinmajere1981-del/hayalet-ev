import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  FATE_KNOTS_DEFAULT_FORGE_EXECUTION_POLICY,
  readFateKnotsForgeExecutionPolicy,
} from "../../rooms/game-room/main-functions/fate-knots/host/forge-provider-policy.js";

async function readRepoFile(relativePath: string): Promise<string> {
  return await readFile(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

void test("Fate Knots Forge provider policy preserves AI1 defaults and accepts split providers", () => {
  assert.deepEqual(readFateKnotsForgeExecutionPolicy(undefined), {
    ok: true,
    policy: { authoringProvider: "ai1", assetProvider: "ai1" },
  });
  assert.deepEqual(FATE_KNOTS_DEFAULT_FORGE_EXECUTION_POLICY, {
    authoringProvider: "ai1",
    assetProvider: "ai1",
  });
  assert.deepEqual(
    readFateKnotsForgeExecutionPolicy({
      authoringProvider: "ai2",
      assetProvider: "ai0-local",
    }),
    {
      ok: true,
      policy: { authoringProvider: "ai2", assetProvider: "ai0-local" },
    }
  );
});

void test("Fate Knots Forge provider policy rejects explicit unknown providers", () => {
  assert.deepEqual(readFateKnotsForgeExecutionPolicy({ authoringProvider: "ai0" }), {
    ok: false,
    code: "invalid-authoring-provider",
    message: "Fate Knots Forge authoring provider must be ai1 or ai2.",
  });
  assert.deepEqual(readFateKnotsForgeExecutionPolicy({ assetProvider: "ai2" }), {
    ok: false,
    code: "invalid-asset-provider",
    message: "Fate Knots Forge asset provider must be ai1 or ai0-local.",
  });
});

void test("Fate Knots Forge keeps authoring and asset provider boundaries separate", async () => {
  const [providerTransport, authoring, forgeService, materializerExtension] = await Promise.all([
    readRepoFile("rooms/game-room/main-functions/fate-knots/host/forge-provider-transport.ts"),
    readRepoFile("rooms/game-room/main-functions/fate-knots/host/world-forge-authoring.ts"),
    readRepoFile("rooms/game-room/main-functions/fate-knots/host/forge-service.ts"),
    readRepoFile("rooms/game-room/host/fate-knots-materializer-extension.ts"),
  ]);

  assert.match(providerTransport, /provider === "ai1"/);
  assert.match(providerTransport, /toSlot:\s*provider/);
  assert.match(authoring, /provider = options\.provider \?\? "ai1"/);
  assert.match(authoring, /openFateKnotsForgeProviderSession/);
  assert.match(authoring, /dispatchFateKnotsForgeProviderJsonPrompt/);

  assert.match(
    forgeService,
    /Map<\s*FateKnotsForgeAssetProvider,\s*FateKnotsAssetMaterializerAdapter\s*>/
  );
  assert.match(forgeService, /materializerAdapters\.get\(policy\.assetProvider\)/);
  assert.doesNotMatch(
    forgeService,
    /materializerAdapters\.get\(policy\.assetProvider\) \?\? materializerAdapters\.get\("ai1"\)/
  );

  assert.match(materializerExtension, /registerFateKnotsAssetMaterializerForProvider\(/);
  assert.match(materializerExtension, /"ai1"/);
});

void test("Fate Knots production host and Hub expose provider-aware universe creation", async () => {
  const [forgeExtension, hostIndex, forgeControls, hubUi, uiIndex] = await Promise.all([
    readRepoFile("rooms/game-room/host/fate-knots-forge-extension.ts"),
    readRepoFile("rooms/game-room/host/index.ts"),
    readRepoFile("rooms/game-room/main-functions/fate-knots/ui/forge-controls.js"),
    readRepoFile("rooms/game-room/main-functions/fate-knots/ui/hub.js"),
    readRepoFile("rooms/game-room/ui/index.html"),
  ]);

  assert.match(forgeExtension, /GameRoomFateKnotsGetForgeCapabilities/);
  assert.match(forgeExtension, /GameRoomFateKnotsCreateUniverse/);
  assert.match(forgeExtension, /readFateKnotsForgeExecutionPolicy/);
  assert.match(forgeExtension, /hasFateKnotsAssetMaterializer\(policy\.assetProvider\)/);
  assert.match(forgeExtension, /createFateKnotsUniverseThroughForge/);
  assert.match(forgeExtension, /function isAuthoringProviderSelectable/);
  assert.match(forgeExtension, /slot\.assigned === true && slot\.urlExcluded !== true/);
  assert.doesNotMatch(
    forgeExtension,
    /context\.slots\[policy\.authoringProvider\]\.dispatchable !== true/
  );

  assert.match(hostIndex, /extendGameRoomHostRuntimeWithFateKnotsForge/);
  assert.match(hubUi, /createElement\("div", "fate-knots-hub__actions"\)/);
  assert.match(forgeControls, /\.fate-knots-hub__header > \.fate-knots-hub__actions/);
  assert.match(forgeControls, /openButton\.disabled = forgeState\.submitting/);
  assert.match(forgeControls, /forgeState\.capabilities && force !== true/);
  assert.match(forgeControls, /forgeState\.capabilities = null/);
  assert.match(forgeControls, /authoringProvider/);
  assert.match(forgeControls, /assetProvider/);
  assert.match(forgeControls, /AI0/);
  assert.match(forgeControls, /option\.disabled = !providerAvailable/);
  assert.match(forgeControls, /unwrapCommandResult/);
  assert.match(forgeControls, /readRecord\(result\.data\) \|\| result/);
  assert.doesNotMatch(
    forgeControls,
    /forgeState\.assetProvider = readString\(readRecord\(fallback\)\?\.provider\)/
  );
  assert.match(uiIndex, /fate-knots\/ui\/forge-controls\.js/);
});
