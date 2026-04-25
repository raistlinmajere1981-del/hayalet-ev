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
  const typeSource = readFileSync("src/types/room-tools.ts", "utf8");
  const manifestSource = readFileSync(
    "rooms/laboratory/shared/data/tools/toolchain.manifest.json",
    "utf8"
  );
  const projectToolStatusSource = readFileSync(
    "rooms/laboratory/shared/host/project-tool-status.ts",
    "utf8"
  );

  assert.match(serviceSource, /type ToolAvailability = "installable" \| "system-command" \| "planned";/);
  assert.match(serviceSource, /type SystemCommandSpec = \{/);
  assert.match(serviceSource, /type PythonVenvPipInstallerSpec = \{/);
  assert.match(serviceSource, /type ToolInstallerSpec = PythonVenvPipInstallerSpec;/);
  assert.match(serviceSource, /const PYTHON_GET_PIP_URL = "https:\/\/bootstrap\.pypa\.io\/get-pip\.py";/);
  assert.match(serviceSource, /envVarNames\?: string\[\];/);
  assert.match(serviceSource, /candidatePaths\?: string\[\];/);
  assert.match(typeSource, /packageToolRuntimeDir: string;/);
  assert.match(serviceSource, /installer\?: ToolInstallerSpec;/);
  assert.match(serviceSource, /plannedReason\?: string;/);
  assert.match(serviceSource, /systemCommand\?: SystemCommandSpec;/);
  assert.match(serviceSource, /availability: "planned"/);
  assert.match(serviceSource, /availability: "system-command"/);
  assert.match(serviceSource, /installable: false/);
  assert.match(serviceSource, /async function resolveSystemCommandBinaryPath\(/);
  assert.match(serviceSource, /expandRuntimePathTemplate\(/);
  assert.match(serviceSource, /private isToolInstallable\(toolManifest: ToolManifest\): boolean/);
  assert.match(serviceSource, /private isSystemCommandTool\(toolManifest: ToolManifest\): boolean/);
  assert.match(serviceSource, /private getInstallerType\(toolManifest: ToolManifest\): ToolInstallerSpec\["type"\] \| null/);
  assert.match(serviceSource, /private resolvePythonVenvPipInstaller\(/);
  assert.match(serviceSource, /private async resolvePythonBootstrapInvocation\(/);
  assert.match(serviceSource, /private shouldUsePythonWithoutPipFallback\(/);
  assert.match(serviceSource, /private isMissingPythonPip\(/);
  assert.match(serviceSource, /private async bootstrapPythonVenvPip\(/);
  assert.match(serviceSource, /private async installPythonVenvPipTool\(/);
  assert.match(serviceSource, /private shouldUseSystemCommandFallback\(/);
  assert.match(serviceSource, /private async probeSystemCommandToolStatus\(/);
  assert.match(serviceSource, /installerType,/);
  assert.match(serviceSource, /args: \[\.\.\.bootstrap\.argsPrefix, "-m", "venv", "--without-pip", venvDir\]/);
  assert.match(serviceSource, /Download pip bootstrap: \$\{PYTHON_GET_PIP_URL\}/);
  assert.match(typeSource, /lastError\?: string \| null;/);
  assert.match(serviceSource, /lastError: data\.lastError \?\? null,/);
  assert.match(serviceSource, /function summarizeCommandFailure\(result: \{ stderr: string; stdout: string \}\): string \| null/);
  assert.match(serviceSource, /async function resolveInstallableToolInstallDir\(/);
  assert.match(
    serviceSource,
    /packageToolRuntimeDir: join\(legacyInstalledDir, "tools", "runtime", platformKey\),/
  );
  assert.match(serviceSource, /toolRuntimeDir: join\(storageDir, "tools", "runtime", platformKey\),/);
  assert.match(serviceSource, /const legacyInstallDir = join\(paths\.packageToolRuntimeDir, installDirName\);/);
  assert.match(serviceSource, /await rename\(legacyInstallDir, preferredInstallDir\);/);
  assert.match(serviceSource, /lastError: probe\.exitCode === 0 \? null : summarizeCommandFailure\(probe\),/);
  assert.match(serviceSource, /throw new Error\(\s*asNonEmptyString\(probeTool\?\.lastError\) \?\?/);
  assert.match(projectToolStatusSource, /lastError:\s*typeof probeTool\["lastError"\] === "string"/);
  assert.match(manifestSource, /"packages": \["tensorflow", "tensorflow_hub", "numpy", "scipy", "setuptools<81"\]/);
  assert.match(manifestSource, /"packages": \["pyAudioAnalysis", "numpy", "scipy", "scikit-learn", "hmmlearn", "matplotlib", "eyed3", "pydub"\]/);
  assert.match(
    serviceSource,
    /private resolveSystemCommandTool\(\s*manifest: ToolchainManifest,\s*toolId: string\s*\): \{/
  );
  assert.match(serviceSource, /private getPlannedToolMessage\(toolId: string, toolManifest: ToolManifest\): string/);
});

test("room tool service resolves toolchain manifests from installed and workspace fallback layouts", () => {
  const serviceSource = readFileSync("electron/room-tool-service.ts", "utf8");

  assert.match(
    serviceSource,
    /function getInstalledSharedToolsDir\(paths: RoomToolRuntimePaths\): string/
  );
  assert.match(
    serviceSource,
    /function getToolchainManifestCandidates\(paths: RoomToolRuntimePaths\): string\[\]/
  );
  assert.match(
    serviceSource,
    /join\(getInstalledSharedToolsDir\(paths\), "toolchain\.manifest\.json"\)/
  );
  assert.match(
    serviceSource,
    /join\(Paths\.getInstalledRoomDir\(paths\.roomId\), "tools", "toolchain\.manifest\.json"\)/
  );
  assert.match(
    serviceSource,
    /join\(\s*paths\.storageDir,\s*"build",\s*"workspace",\s*"shared",\s*"data",\s*"tools",\s*"toolchain\.manifest\.json"\s*\)/
  );
  assert.match(
    serviceSource,
    /join\(\s*Paths\.getRoomsWorkspaceDir\(\),\s*paths\.roomId,\s*"shared",\s*"data",\s*"tools",\s*"toolchain\.manifest\.json"\s*\)/
  );
  assert.match(serviceSource, /const manifestPath = candidatePaths\.find\(\(candidate\) => existsSync\(candidate\)\);/);
  assert.match(
    serviceSource,
    /const allowedRoots = \[paths\.storageDir, paths\.toolRuntimeDir\];/
  );
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
