import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const projectRoot = process.cwd();
const roomPackageManagerPath = join(projectRoot, "electron", "room-package-manager.ts");
const installedRoomBuilderPath = join(projectRoot, "electron", "rooms", "installed-room-builder.ts");
const roomBundleOperationsPath = join(projectRoot, "electron", "rooms", "room-bundle-operations.ts");
const roomPackageTypesPath = join(projectRoot, "electron", "rooms", "room-package-types.ts");
const roomRegistryPath = join(projectRoot, "electron", "rooms", "room-registry.ts");
const workspaceRoomOperationsPath = join(
  projectRoot,
  "electron",
  "rooms",
  "workspace-room-operations.ts"
);
const workspaceDiscoveryPath = join(projectRoot, "electron", "rooms", "workspace-discovery.ts");
const ipcRoomsPath = join(projectRoot, "electron", "handlers", "ipc-rooms.ts");

test("room package manager resolves Paths lazily instead of constructor time", async () => {
  const source = await readFile(roomPackageManagerPath, "utf8");

  assert.match(source, /private getWorkspaceRoot\(\): string/);
  assert.match(source, /private getInstalledRoot\(\): string/);
  assert.match(source, /private getRegistryPath\(\): string/);
  assert.match(source, /export function getRoomPackageManager\(\): RoomPackageManager/);
  assert.doesNotMatch(source, /export const roomPackageManager = new RoomPackageManager\(\)/);

  const constructorMatch = source.match(/constructor\(options: RoomManagerOptions = \{\}\) \{([\s\S]*?)\n  \}/);
  assert.ok(constructorMatch, "constructor should exist");
  assert.doesNotMatch(constructorMatch?.[1] ?? "", /Paths\.get(ProjectRoot|InstalledRoomsDir|RoomsRegistryPath)/);
});

test("ipc room handlers resolve the room package manager at handler execution time", async () => {
  const source = await readFile(ipcRoomsPath, "utf8");

  assert.match(source, /import \{ getRoomPackageManager \} from "\.\.\/room-package-manager\.ts"/);
  assert.doesNotMatch(source, /import \{ roomPackageManager \} from "\.\.\/room-package-manager\.ts"/);
  assert.match(source, /const roomPackageManager = getRoomPackageManager\(\);/);
});

test("room package manager keeps installed room record building in a dedicated builder module", async () => {
  const managerSource = await readFile(roomPackageManagerPath, "utf8");
  const builderSource = await readFile(installedRoomBuilderPath, "utf8");
  const bundleOperationsSource = await readFile(roomBundleOperationsPath, "utf8");
  const roomPackageTypesSource = await readFile(roomPackageTypesPath, "utf8");
  const registrySource = await readFile(roomRegistryPath, "utf8");
  const workspaceRoomOperationsSource = await readFile(workspaceRoomOperationsPath, "utf8");
  const workspaceDiscoverySource = await readFile(workspaceDiscoveryPath, "utf8");

  assert.match(managerSource, /from "\.\/rooms\/installed-room-builder\.ts"/);
  assert.match(managerSource, /from "\.\/rooms\/room-bundle-operations\.ts"/);
  assert.match(managerSource, /from "\.\/rooms\/room-package-types\.ts"/);
  assert.match(managerSource, /from "\.\/rooms\/room-registry\.ts"/);
  assert.match(managerSource, /from "\.\/rooms\/workspace-room-operations\.ts"/);
  assert.match(managerSource, /from "\.\/rooms\/workspace-discovery\.ts"/);
  assert.match(managerSource, /export \{ buildInstalledRoomRecord \};/);
  assert.match(builderSource, /export function buildInstalledRoomRecord\(/);
  assert.match(builderSource, /export function optionalI18nBaseDir\(/);
  assert.match(bundleOperationsSource, /export async function packageWorkspaceRoomBundle\(/);
  assert.match(bundleOperationsSource, /export async function importRoomBundleFile\(/);
  assert.match(bundleOperationsSource, /export async function importValidatedRoomBundle\(/);
  assert.match(roomPackageTypesSource, /export interface RoomOperationResult/);
  assert.match(roomPackageTypesSource, /export type RoomPackageTranslator/);
  assert.match(registrySource, /export async function readRoomRegistry\(/);
  assert.match(registrySource, /export async function writeRoomRegistry\(/);
  assert.match(registrySource, /export async function hydrateInstalledRoomRecord\(/);
  assert.match(workspaceRoomOperationsSource, /export async function installRoomFromWorkspace\(/);
  assert.match(workspaceRoomOperationsSource, /export async function removeInstalledRoomOperation\(/);
  assert.match(workspaceRoomOperationsSource, /export async function deleteWorkspaceRoomOperation\(/);
  assert.match(
    workspaceRoomOperationsSource,
    /export async function exportInstalledRoomToWorkspaceOperation\(/
  );
  assert.match(workspaceDiscoverySource, /export function buildRoomWorkspaceRoots\(/);
  assert.match(workspaceDiscoverySource, /export async function readWorkspaceRoomsFromRoot\(/);
  assert.match(workspaceDiscoverySource, /export function pickPreferredWorkspaceRoom\(/);
});
