import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("room tool run request supports companion executable selection", () => {
  const typeSource = readFileSync("src/types/room-tools.ts", "utf8");
  const serviceSource = readFileSync("electron/room-tool-service.ts", "utf8");

  assert.match(typeSource, /export interface RoomToolRunRequest[\s\S]*executableName\?: string;/);
  assert.match(serviceSource, /const requestedExecutableName = asNonEmptyString\(request\.executableName\);/);
  assert.match(serviceSource, /let allowedExecutableNames: string\[\] = \[\];/);
  assert.match(serviceSource, /does not expose companion executable/);
});

test("room tool service stays generic and avoids laboratory-specific branching", () => {
  const serviceSource = readFileSync("electron/room-tool-service.ts", "utf8");
  const handlerSource = readFileSync("electron/handlers/ipc-room-tools.ts", "utf8");

  assert.match(handlerSource, /registerHandler\("room-tools-call"/);
  assert.match(handlerSource, /registerHandler\("room-tools-cancel"/);
  assert.match(serviceSource, /case "ensure-dir":/);
  assert.match(serviceSource, /private async ensureDirPath\(/);
  assert.match(serviceSource, /ensuredPath: targetPath,/);
  assert.match(serviceSource, /private async downloadToPath\(/);
  assert.match(serviceSource, /return await this\.downloadToPath\(event, request, \{ enforceRoomManagedPath: true \}\);/);
  assert.match(serviceSource, /\{ enforceRoomManagedPath: false \}/);
  assert.doesNotMatch(serviceSource, /ROOM_ID\s*=\s*"laboratory"/);
  assert.doesNotMatch(serviceSource, /yt-dlp command/i);
});

test("room tool service can describe planned and system-command tools without forcing an installer contract", () => {
  const serviceSource = readFileSync("electron/room-tool-service.ts", "utf8");

  assert.match(serviceSource, /type ToolAvailability = "installable" \| "system-command" \| "planned";/);
  assert.match(serviceSource, /type SystemCommandSpec = \{/);
  assert.match(serviceSource, /plannedReason\?: string;/);
  assert.match(serviceSource, /systemCommand\?: SystemCommandSpec;/);
  assert.match(serviceSource, /availability: "planned"/);
  assert.match(serviceSource, /availability: "system-command"/);
  assert.match(serviceSource, /installable: false/);
  assert.match(serviceSource, /async function resolveSystemCommandBinaryPath\(executableName: string\): Promise<string \| null>/);
  assert.match(serviceSource, /private isToolInstallable\(toolManifest: ToolManifest\): boolean/);
  assert.match(serviceSource, /private isSystemCommandTool\(toolManifest: ToolManifest\): boolean/);
  assert.match(serviceSource, /private resolveSystemCommandTool\(manifest: ToolchainManifest, toolId: string\): \{/);
  assert.match(serviceSource, /private getPlannedToolMessage\(toolId: string, toolManifest: ToolManifest\): string/);
});

test("room tool preload and global typings expose the generic room-tools seam", () => {
  const preloadSource = readFileSync("electron/preload.cjs", "utf8");
  const globalTypes = readFileSync("src/js/global.d.ts", "utf8");

  assert.match(preloadSource, /roomToolsCall: \(request\) => ipcRenderer\.invoke\("room-tools-call", request\)/);
  assert.match(preloadSource, /roomToolsCancel: \(request\) => ipcRenderer\.invoke\("room-tools-cancel", request\)/);
  assert.match(preloadSource, /onRoomToolsProgress: \(callback\)/);
  assert.match(globalTypes, /roomToolsCall: \(request: RoomToolCallRequest\) => Promise<RoomToolCallResult>;/);
  assert.match(globalTypes, /roomToolsCancel: \(request: RoomToolCancelRequest\) => Promise<RoomToolCancelResult>;/);
});
