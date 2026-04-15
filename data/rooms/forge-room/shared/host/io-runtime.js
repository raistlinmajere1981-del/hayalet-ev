import {
  callForgeRoomTools,
  getForgeElectronApi,
  listForgeDirectory,
  readForgeJsonFile,
  readForgeTextFile,
  writeForgeJsonFile,
  writeForgeTextFile
} from "./electron-bridge.js";
export function createForgeHostIoRuntime(deps) {
  const { roomId } = deps;
  async function ensureRuntimeDirectory(dirPath, requestId) {
    await callForgeRoomTools({
      operation: "ensure-dir",
      roomId,
      targetPath: dirPath,
      ...requestId ? { requestId } : {}
    });
  }
  async function resolveRuntimePaths(requestId) {
    const result = await callForgeRoomTools({
      operation: "resolve-paths",
      roomId,
      ...requestId ? { requestId } : {}
    });
    return result["paths"];
  }
  return {
    callRoomTools: callForgeRoomTools,
    ensureRuntimeDirectory,
    getElectronApi: getForgeElectronApi,
    listDirectory: listForgeDirectory,
    readJsonFile: readForgeJsonFile,
    readTextFile: readForgeTextFile,
    resolveRuntimePaths,
    writeJsonFile: writeForgeJsonFile,
    writeTextFile: writeForgeTextFile
  };
}
