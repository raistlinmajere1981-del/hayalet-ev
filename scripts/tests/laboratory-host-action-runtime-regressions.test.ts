import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

test("laboratory host action composition is extracted into a shared host boundary", () => {
  const workspaceHostSource = readFileSync("rooms/laboratory/host/index.js", "utf8");
  const workspaceHostRuntimeSource = readFileSync("rooms/laboratory/host/runtime.js", "utf8");
  const workspaceActionCompositionSource = readFileSync(
    "rooms/laboratory/shared/host/action-composition.js",
    "utf8"
  );
  const workspaceActionRuntimeSource = readFileSync(
    "rooms/laboratory/shared/host/action-runtime.js",
    "utf8"
  );
  const workspaceActionRouterSource = readFileSync(
    "rooms/laboratory/shared/host/action-router.js",
    "utf8"
  );
  const installedHostSource = readFileSync("data/rooms/laboratory/host/index.js", "utf8");
  const installedHostRuntimeSource = readFileSync("data/rooms/laboratory/host/runtime.js", "utf8");
  const installedActionCompositionSource = readFileSync(
    "data/rooms/laboratory/shared/host/action-composition.js",
    "utf8"
  );
  const installedActionRuntimeSource = readFileSync(
    "data/rooms/laboratory/shared/host/action-runtime.js",
    "utf8"
  );

  assert.equal(existsSync("rooms/laboratory/shared/host/action-composition.js"), true);
  assert.equal(existsSync("rooms/laboratory/shared/host/action-runtime.js"), true);
  assert.equal(existsSync("rooms/laboratory/host/runtime.js"), true);
  assert.equal(existsSync("data/rooms/laboratory/shared/host/action-composition.js"), true);
  assert.equal(existsSync("data/rooms/laboratory/shared/host/action-runtime.js"), true);
  assert.equal(existsSync("data/rooms/laboratory/host/runtime.js"), true);
  assert.match(workspaceHostSource, /\.\/runtime\.js/);
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
  assert.match(workspaceHostRuntimeSource, /from "\.\.\/shared\/host\/action-composition\.js"/);
  assert.doesNotMatch(workspaceHostRuntimeSource, /from "\.\.\/shared\/host\/action-runtime\.js"/);
  assert.equal(installedHostSource, workspaceHostSource);
  assert.equal(installedHostRuntimeSource, workspaceHostRuntimeSource);
  assert.equal(installedActionCompositionSource, workspaceActionCompositionSource);
  assert.equal(installedActionRuntimeSource, workspaceActionRuntimeSource);
});
