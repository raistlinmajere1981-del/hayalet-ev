// @ts-nocheck
import {
  callLaboratoryRoomTools,
  cancelLaboratoryRoomTool,
  digestLaboratorySha1,
  ensureLaboratoryProjectDirectories,
  ensureLaboratoryRuntimeDirectory,
  getLaboratoryElectronApi,
  listLaboratoryDirectory,
  readLaboratoryBinaryFileBytes,
  readLaboratoryJsonFile,
  readLaboratoryTextFile,
  writeLaboratoryJsonFile,
  writeLaboratoryTextFile,
} from "./electron-bridge.js";

export function createLaboratoryHostIoRuntime(deps) {
  const { getProjectDirectoryFallbackMarkerList, getProjectDirectoryList, roomId } = deps;

  function getElectronApi() {
    return getLaboratoryElectronApi();
  }

  async function digestSha1(bytes) {
    return digestLaboratorySha1(bytes);
  }

  async function readJsonFile(filePath) {
    return readLaboratoryJsonFile(filePath);
  }

  async function readTextFile(filePath) {
    return readLaboratoryTextFile(filePath);
  }

  async function readBinaryFileBytes(filePath) {
    return readLaboratoryBinaryFileBytes(filePath);
  }

  async function writeJsonFile(filePath, value) {
    return writeLaboratoryJsonFile(filePath, value);
  }

  async function writeTextFile(filePath, value) {
    return writeLaboratoryTextFile(filePath, value);
  }

  async function listDirectory(dirPath) {
    return listLaboratoryDirectory(dirPath);
  }

  async function callRoomTools(request) {
    return callLaboratoryRoomTools(request);
  }

  async function ensureRuntimeDirectory(dirPath, requestId) {
    return ensureLaboratoryRuntimeDirectory({
      roomId,
      dirPath,
      requestId: requestId || null,
    });
  }

  async function ensureProjectDirectories(runtime, project, requestId) {
    return ensureLaboratoryProjectDirectories({
      roomId,
      dirPaths: getProjectDirectoryList(runtime, project),
      fallbackMarkerPaths: getProjectDirectoryFallbackMarkerList(runtime, project),
      requestId: requestId || null,
    });
  }

  async function cancelRoomTool(cancelRoomId, jobId, requestId) {
    return cancelLaboratoryRoomTool({
      roomId: cancelRoomId,
      jobId,
      requestId,
    });
  }

  return {
    callRoomTools,
    cancelRoomTool,
    digestSha1,
    ensureProjectDirectories,
    ensureRuntimeDirectory,
    getElectronApi,
    listDirectory,
    readBinaryFileBytes,
    readJsonFile,
    readTextFile,
    writeJsonFile,
    writeTextFile,
  };
}
