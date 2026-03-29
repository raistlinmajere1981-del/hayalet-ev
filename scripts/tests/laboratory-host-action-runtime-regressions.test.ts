import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRoomBuiltArtifact, createRoomInstalledCopy } from "./helpers/room-installed-copy.ts";

test("laboratory host action composition is extracted into a shared host boundary", async () => {
  const workspaceHostSource = readFileSync("rooms/laboratory/host/index.ts", "utf8");
  const workspaceHostRuntimeSource = readFileSync("rooms/laboratory/host/runtime.ts", "utf8");
  const workspaceHostFoundationSource = readFileSync(
    "rooms/laboratory/host/foundation-runtimes.ts",
    "utf8"
  );
  const workspaceHostProjectSource = readFileSync(
    "rooms/laboratory/host/project-runtimes.ts",
    "utf8"
  );
  const workspaceHostFeatureSource = readFileSync(
    "rooms/laboratory/host/feature-runtimes.ts",
    "utf8"
  );
  const workspaceActionCompositionSource = readFileSync(
    "rooms/laboratory/shared/host/action-composition.ts",
    "utf8"
  );
  const workspaceActionRuntimeSource = readFileSync(
    "rooms/laboratory/shared/host/action-runtime.ts",
    "utf8"
  );
  const workspaceActionRouterSource = readFileSync(
    "rooms/laboratory/shared/host/action-router.ts",
    "utf8"
  );
  const workspaceFeatureAdaptersSource = readFileSync(
    "rooms/laboratory/host/feature-adapters.ts",
    "utf8"
  );

  assert.equal(existsSync("rooms/laboratory/shared/host/action-composition.ts"), true);
  assert.equal(existsSync("rooms/laboratory/shared/host/action-runtime.ts"), true);
  assert.equal(existsSync("rooms/laboratory/host/foundation-runtimes.ts"), true);
  assert.equal(existsSync("rooms/laboratory/host/project-runtimes.ts"), true);
  assert.equal(existsSync("rooms/laboratory/host/feature-runtimes.ts"), true);
  assert.equal(existsSync("rooms/laboratory/host/feature-adapters.ts"), true);
  assert.equal(existsSync("rooms/laboratory/host/runtime.ts"), true);
  assert.match(workspaceHostSource, /\.\/runtime\.js/);
  assert.match(workspaceHostRuntimeSource, /from "\.\/foundation-runtimes\.js"/);
  assert.match(workspaceHostRuntimeSource, /from "\.\/project-runtimes\.js"/);
  assert.match(workspaceHostRuntimeSource, /from "\.\/feature-runtimes\.js"/);
  assert.match(workspaceHostFoundationSource, /export function createLaboratoryHostFoundation\(deps\)/);
  assert.match(workspaceHostProjectSource, /export function createLaboratoryHostProjectRuntimes\(deps\)/);
  assert.match(workspaceHostFeatureSource, /export function createLaboratoryHostFeatureRuntimes\(deps\)/);
  assert.doesNotMatch(workspaceHostSource, /shared\/host\/action-composition\.js/);
  assert.match(workspaceActionRuntimeSource, /export function createLaboratoryHostActionRuntime\(deps\)/);
  assert.match(workspaceActionRuntimeSource, /function getActionRouter\(\)/);
  assert.match(workspaceActionRuntimeSource, /function handleToolMutation\(api, runtime, requestId, action, toolId, featureStage\)/);
  assert.match(workspaceActionRuntimeSource, /function handleMediaAction\(api, runtime, payload\)/);
  assert.match(workspaceActionRuntimeSource, /from "\.\/action-router\.js"/);
  assert.match(workspaceActionCompositionSource, /export function createLaboratoryActionCompositionRuntime\(deps\)/);
  assert.match(workspaceActionCompositionSource, /from "\.\/action-runtime\.js"/);
  assert.match(workspaceActionCompositionSource, /from "\.\/tool-mutations\.js"/);
  assert.match(
    workspaceActionCompositionSource,
    /from "\.\.\/\.\.\/main-functions\/media-analysis\/host\/action-handlers\.js"/
  );
  assert.match(workspaceActionRouterSource, /export function createLaboratoryActionRouter\(deps\)/);
  assert.match(workspaceFeatureAdaptersSource, /export function createLaboratoryFeatureAdapters\(deps\)/);
  assert.match(workspaceFeatureAdaptersSource, /from "\.\.\/shared\/host\/action-composition\.js"/);
  assert.match(
    workspaceFeatureAdaptersSource,
    /from "\.\.\/main-functions\/subtitle-analysis\/host\/runtime\.js"/
  );
  assert.match(workspaceHostFeatureSource, /from "\.\/feature-adapters\.js"/);
  assert.doesNotMatch(workspaceHostRuntimeSource, /from "\.\.\/shared\/host\/action-composition\.js"/);
  assert.doesNotMatch(workspaceHostRuntimeSource, /from "\.\.\/shared\/host\/action-runtime\.js"/);

  const installedCopy = await createRoomInstalledCopy("laboratory");
  const buildArtifact = await createRoomBuiltArtifact("laboratory");

  try {
    const builtHostSource = readFileSync(`${buildArtifact.rootDir}/host/index.js`, "utf8");
    const builtHostRuntimeSource = readFileSync(`${buildArtifact.rootDir}/host/runtime.js`, "utf8");
    const builtHostFoundationSource = readFileSync(
      `${buildArtifact.rootDir}/host/foundation-runtimes.js`,
      "utf8"
    );
    const builtHostProjectSource = readFileSync(
      `${buildArtifact.rootDir}/host/project-runtimes.js`,
      "utf8"
    );
    const builtHostFeatureSource = readFileSync(
      `${buildArtifact.rootDir}/host/feature-runtimes.js`,
      "utf8"
    );
    const builtActionCompositionSource = readFileSync(
      `${buildArtifact.rootDir}/shared/host/action-composition.js`,
      "utf8"
    );
    const builtActionRuntimeSource = readFileSync(
      `${buildArtifact.rootDir}/shared/host/action-runtime.js`,
      "utf8"
    );
    const builtFeatureAdaptersSource = readFileSync(
      `${buildArtifact.rootDir}/host/feature-adapters.js`,
      "utf8"
    );
    const installedHostSource = readFileSync(`${installedCopy.rootDir}/host/index.js`, "utf8");
    const installedHostRuntimeSource = readFileSync(`${installedCopy.rootDir}/host/runtime.js`, "utf8");
    const installedHostFoundationSource = readFileSync(
      `${installedCopy.rootDir}/host/foundation-runtimes.js`,
      "utf8"
    );
    const installedHostProjectSource = readFileSync(
      `${installedCopy.rootDir}/host/project-runtimes.js`,
      "utf8"
    );
    const installedHostFeatureSource = readFileSync(
      `${installedCopy.rootDir}/host/feature-runtimes.js`,
      "utf8"
    );
    const installedActionCompositionSource = readFileSync(
      `${installedCopy.rootDir}/shared/host/action-composition.js`,
      "utf8"
    );
    const installedActionRuntimeSource = readFileSync(`${installedCopy.rootDir}/shared/host/action-runtime.js`, "utf8");
    const installedFeatureAdaptersSource = readFileSync(`${installedCopy.rootDir}/host/feature-adapters.js`, "utf8");

    assert.equal(existsSync(`${installedCopy.rootDir}/shared/host/action-composition.js`), true);
    assert.equal(existsSync(`${installedCopy.rootDir}/shared/host/action-runtime.js`), true);
    assert.equal(existsSync(`${installedCopy.rootDir}/host/foundation-runtimes.js`), true);
    assert.equal(existsSync(`${installedCopy.rootDir}/host/project-runtimes.js`), true);
    assert.equal(existsSync(`${installedCopy.rootDir}/host/feature-runtimes.js`), true);
    assert.equal(existsSync(`${installedCopy.rootDir}/host/feature-adapters.js`), true);
    assert.equal(existsSync(`${installedCopy.rootDir}/host/runtime.js`), true);
    assert.equal(installedHostSource, builtHostSource);
    assert.equal(installedHostRuntimeSource, builtHostRuntimeSource);
    assert.equal(installedHostFoundationSource, builtHostFoundationSource);
    assert.equal(installedHostProjectSource, builtHostProjectSource);
    assert.equal(installedHostFeatureSource, builtHostFeatureSource);
    assert.equal(installedActionCompositionSource, builtActionCompositionSource);
    assert.equal(installedActionRuntimeSource, builtActionRuntimeSource);
    assert.equal(installedFeatureAdaptersSource, builtFeatureAdaptersSource);
  } finally {
    await buildArtifact.cleanup();
    await installedCopy.cleanup();
  }
});
