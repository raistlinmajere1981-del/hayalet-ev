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
  writeLaboratoryTextFile
} from "./electron-bridge.js";
export function createLaboratoryHostIoRuntime(deps) {
  const { getProjectDirectoryFallbackMarkerList, getProjectDirectoryList, roomId } = deps;
  function getElectronApi() {
    return getLaboratoryElectronApi();
  }
  async function digestSha1(bytes) {
    if (!(bytes instanceof Uint8Array)) {
      throw new Error("SHA-1 digest requires Uint8Array input.");
    }
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
      ...requestId ? { requestId } : {}
    });
  }
  async function ensureProjectDirectories(runtime, project, requestId) {
    return ensureLaboratoryProjectDirectories({
      roomId,
      dirPaths: getProjectDirectoryList(runtime, project),
      fallbackMarkerPaths: getProjectDirectoryFallbackMarkerList(runtime, project),
      ...requestId ? { requestId } : {}
    });
  }
  async function cancelRoomTool(cancelRoomId, jobId, requestId) {
    return cancelLaboratoryRoomTool({
      roomId: cancelRoomId,
      jobId,
      requestId
    });
  }
  async function readSharedTranscriptStatus() {
    const result = await callRoomTools({
      operation: "transcript-status",
      roomId
    });
    return result["transcriptStatus"];
  }
  async function listSharedTranscriptModels() {
    const result = await callRoomTools({
      operation: "transcript-list-models",
      roomId
    });
    const transcriptModels = result["transcriptModels"];
    if (!Array.isArray(transcriptModels)) {
      return [];
    }
    const models = transcriptModels;
    return models;
  }
  async function transcribeManagedAudioFile(payload) {
    const result = await callRoomTools({
      operation: "transcript-transcribe-file",
      roomId,
      ...payload
    });
    return result["transcription"];
  }
  return {
    callRoomTools,
    cancelRoomTool,
    digestSha1,
    ensureProjectDirectories,
    ensureRuntimeDirectory,
    getElectronApi,
    listDirectory,
    listSharedTranscriptModels,
    readBinaryFileBytes,
    readJsonFile,
    readSharedTranscriptStatus,
    readTextFile,
    transcribeManagedAudioFile,
    writeJsonFile,
    writeTextFile
  };
}
