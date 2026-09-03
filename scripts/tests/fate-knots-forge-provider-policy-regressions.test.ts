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

  assert.match(forgeService, /Map<FateKnotsForgeAssetProvider, FateKnotsAssetMaterializerAdapter>/);
  assert.match(forgeService, /materializerAdapters\.get\(policy\.assetProvider\)/);
  assert.doesNotMatch(forgeService, /materializerAdapters\.get\(policy\.assetProvider\) \?\? materializerAdapters\.get\("ai1"\)/);

  assert.match(materializerExtension, /registerFateKnotsAssetMaterializerForProvider\(/);
  assert.match(materializerExtension, /"ai1"/);
});
