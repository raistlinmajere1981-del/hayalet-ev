import { join } from "node:path";
import { initPaths } from "../../electron/paths.ts";
import { RoomPackageManager } from "../../electron/room-package-manager.ts";

async function main(): Promise<void> {
  initPaths(join(process.cwd(), "electron"));
  const manager = new RoomPackageManager();
  const workspaceRooms = await manager.listWorkspaceRooms();
  const roomIds = workspaceRooms
    .filter((room) => room.manifest !== undefined)
    .map((room) => room.manifest?.id ?? room.dirName)
    .sort((left, right) => left.localeCompare(right));

  if (roomIds.length === 0) {
    console.log("No workspace rooms found.");
    return;
  }

  for (const roomId of roomIds) {
    const result = await manager.buildWorkspaceRoom(roomId);
    if (result.success !== true || result.path === undefined) {
      throw new Error(result.error ?? `Failed to build room: ${roomId}`);
    }

    console.log(`${roomId}: ${result.path}`);
  }
}

await main();
