import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const projectRoot = process.cwd();
const roomPackageManagerPath = join(projectRoot, "electron", "room-package-manager.ts");
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
