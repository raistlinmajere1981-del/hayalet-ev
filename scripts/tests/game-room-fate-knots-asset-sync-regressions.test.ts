import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  normalizeRelativePath,
  syncGameRoomFateKnotsAssets,
} from "../../rooms/game-room/main-functions/fate-knots/scripts/sync-assets.mjs";

const tempRoots: string[] = [];

test.afterEach(async () => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      await rm(root, { recursive: true, force: true });
    }
  }
});

async function createSyncFixture() {
  const root = await mkdtemp(join(tmpdir(), "fk-sync-"));
  tempRoots.push(root);

  const projectRoot = join(root, "project");
  const featureRoot = join(projectRoot, "rooms", "game-room", "main-functions", "fate-knots");
  const featureAssetsDir = join(featureRoot, "assets");
  const featureDataDir = join(featureRoot, "data");
  const sourceDir = join(projectRoot, "fixtures", "source");
  const directorySourceDir = join(projectRoot, "fixtures", "directory-source");

  await mkdir(join(featureDataDir, "scenarios"), { recursive: true });
  await mkdir(join(featureDataDir, "combat"), { recursive: true });
  await mkdir(featureAssetsDir, { recursive: true });
  await mkdir(sourceDir, { recursive: true });
  await mkdir(directorySourceDir, { recursive: true });
  await mkdir(join(featureAssetsDir, "legacy"), { recursive: true });

  await writeFile(join(sourceDir, "feature-view.webp"), "feature-view", "utf8");
  await writeFile(join(directorySourceDir, "badge.png"), "badge", "utf8");
  await writeFile(join(directorySourceDir, "pulse.png"), "pulse", "utf8");
  await writeFile(join(featureAssetsDir, "legacy", "stale.png"), "stale", "utf8");

  await writeFile(
    join(featureDataDir, "asset-import.manifest.json"),
    JSON.stringify(
      {
        entries: [
          {
            mode: "file",
            kind: "feature-view",
            source: "fixtures/source/feature-view.webp",
            target: "feature/feature-view.webp",
          },
          {
            mode: "directory",
            kind: "ui-status",
            sourceDir: "fixtures/directory-source",
            targetDir: "ui/status",
          },
        ],
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  await writeFile(
    join(featureDataDir, "selections.manifest.json"),
    JSON.stringify({ version: 1, avatars: [], classes: [], backgrounds: [] }, null, 2) + "\n",
    "utf8"
  );
  await writeFile(
    join(featureDataDir, "map.manifest.json"),
    JSON.stringify({ version: 1, mapAssetId: "map_01", startingLocationId: "start", nodes: [] }, null, 2) + "\n",
    "utf8"
  );
  await writeFile(
    join(featureDataDir, "scenarios", "intro.manifest.json"),
    JSON.stringify({ version: 1, scenarioId: "intro", entryStepId: "start", steps: [] }, null, 2) + "\n",
    "utf8"
  );
  await writeFile(
    join(featureDataDir, "combat", "cards.manifest.json"),
    JSON.stringify({ version: 1, cards: [] }, null, 2) + "\n",
    "utf8"
  );
  await writeFile(
    join(featureDataDir, "combat", "config.manifest.json"),
    JSON.stringify({ version: 1, startingEnergy: 3, enemyActions: [], encounters: [] }, null, 2) + "\n",
    "utf8"
  );

  return { projectRoot, featureRoot, featureAssetsDir, featureDataDir };
}

test("Fate Knots asset sync rejects unsafe relative paths before file operations", () => {
  assert.equal(normalizeRelativePath("feature/view.webp"), "feature/view.webp");
  assert.equal(normalizeRelativePath("feature\\view.webp"), "feature/view.webp");
  assert.equal(normalizeRelativePath("../escape.webp"), null);
  assert.equal(normalizeRelativePath("/absolute/view.webp"), null);
  assert.equal(normalizeRelativePath("C:/absolute/view.webp"), null);
  assert.equal(normalizeRelativePath("nested/../escape.webp"), null);
});

test("Fate Knots asset sync removes stale files and emits portable runtime manifests", async () => {
  const fixture = await createSyncFixture();

  const summary = await syncGameRoomFateKnotsAssets({
    projectRoot: fixture.projectRoot,
    featureRoot: fixture.featureRoot,
  });

  assert.equal(summary.copiedAssets, 3);
  const runtimeAssetsManifest = JSON.parse(
    await readFile(join(fixture.featureDataDir, "runtime-assets.manifest.json"), "utf8")
  ) as { assets: Array<{ id: string; kind: string; src: string; uiSrc: string }> };
  const runtimeContentModule = await readFile(
    join(fixture.featureDataDir, "runtime-content.module.js"),
    "utf8"
  );
  const runtimeAssetsModule = await readFile(
    join(fixture.featureDataDir, "runtime-assets.module.js"),
    "utf8"
  );
  const runtimeAssetsWorldModule = await readFile(
    join(fixture.featureDataDir, "runtime-assets-world.module.js"),
    "utf8"
  );
  const runtimeAssetsUiModule = await readFile(
    join(fixture.featureDataDir, "runtime-assets-ui.module.js"),
    "utf8"
  );
  const selectionsModule = await readFile(
    join(fixture.featureDataDir, "selections.module.js"),
    "utf8"
  );
  const mapModule = await readFile(join(fixture.featureDataDir, "map.module.js"), "utf8");
  const introScenarioModule = await readFile(
    join(fixture.featureDataDir, "scenarios", "intro.module.js"),
    "utf8"
  );
  const combatCardsModule = await readFile(
    join(fixture.featureDataDir, "combat", "cards.module.js"),
    "utf8"
  );
  const combatConfigModule = await readFile(
    join(fixture.featureDataDir, "combat", "config.module.js"),
    "utf8"
  );

  assert.deepEqual(
    runtimeAssetsManifest.assets.map((asset) => asset.id),
    ["feature-view", "badge", "pulse"]
  );
  runtimeAssetsManifest.assets.forEach((asset) => {
    assert.match(asset.src, /^main-functions\/fate-knots\/assets\//);
    assert.match(asset.uiSrc, /^\.\.\/main-functions\/fate-knots\/assets\//);
  });
  assert.match(runtimeContentModule, /import \{ fateKnotsRuntimeAssetsManifest \} from "\.\/runtime-assets\.module\.js";/);
  assert.match(runtimeContentModule, /import \{ fateKnotsSelectionsManifest \} from "\.\/selections\.module\.js";/);
  assert.match(
    runtimeAssetsModule,
    /import \{ fateKnotsRuntimeWorldAssetsManifest \} from "\.\/runtime-assets-world\.module\.js";/
  );
  assert.match(
    runtimeAssetsModule,
    /import \{ fateKnotsRuntimeUiAssetsManifest \} from "\.\/runtime-assets-ui\.module\.js";/
  );
  assert.match(runtimeAssetsModule, /export const fateKnotsRuntimeAssetsManifest/);
  assert.match(runtimeAssetsWorldModule, /export const fateKnotsRuntimeWorldAssetsManifest/);
  assert.match(runtimeAssetsUiModule, /export const fateKnotsRuntimeUiAssetsManifest/);
  assert.match(selectionsModule, /export const fateKnotsSelectionsManifest/);
  assert.match(mapModule, /export const fateKnotsMapManifest/);
  assert.match(introScenarioModule, /export const fateKnotsIntroScenarioManifest/);
  assert.match(combatCardsModule, /export const fateKnotsCombatCardsManifest/);
  assert.match(combatConfigModule, /export const fateKnotsCombatConfigManifest/);
  await assert.rejects(readFile(join(fixture.featureAssetsDir, "legacy", "stale.png"), "utf8"));
});

test("Fate Knots asset sync supports room-local feature-view sources without self-copying", async () => {
  const fixture = await createSyncFixture();

  await writeFile(join(fixture.featureAssetsDir, "fate-knots-view.webp"), "room-local-view", "utf8");
  await writeFile(
    join(fixture.featureDataDir, "asset-import.manifest.json"),
    JSON.stringify(
      {
        entries: [
          {
            mode: "file",
            kind: "feature-view",
            source: "rooms/game-room/main-functions/fate-knots/assets/fate-knots-view.webp",
            target: "fate-knots-view.webp",
          },
        ],
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  const summary = await syncGameRoomFateKnotsAssets({
    projectRoot: fixture.projectRoot,
    featureRoot: fixture.featureRoot,
  });

  assert.equal(summary.copiedAssets, 1);
  assert.equal(
    await readFile(join(fixture.featureAssetsDir, "fate-knots-view.webp"), "utf8"),
    "room-local-view"
  );
  const runtimeAssetsManifest = JSON.parse(
    await readFile(join(fixture.featureDataDir, "runtime-assets.manifest.json"), "utf8")
  ) as { assets: Array<{ id: string; src: string; uiSrc: string }> };
  assert.deepEqual(runtimeAssetsManifest.assets.map((asset) => asset.id), ["fate-knots-view"]);
});
