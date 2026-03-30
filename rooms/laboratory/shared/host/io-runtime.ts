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

type LaboratoryRecord = Record<string, unknown>;

type LaboratoryHostIoRuntimeDeps = {
  getProjectDirectoryFallbackMarkerList: (runtime: unknown, project: unknown) => string[];
  getProjectDirectoryList: (runtime: unknown, project: unknown) => string[];
  roomId: string;
};

export function createLaboratoryHostIoRuntime(deps: LaboratoryHostIoRuntimeDeps) {
  const { getProjectDirectoryFallbackMarkerList, getProjectDirectoryList, roomId } = deps;

  function getElectronApi() {
    return getLaboratoryElectronApi();
  }

  async function digestSha1(bytes: unknown) {
    return digestLaboratorySha1(bytes as Uint8Array);
  }

  async function readJsonFile(filePath: string) {
    return readLaboratoryJsonFile(filePath);
  }

  async function readTextFile(filePath: string) {
    return readLaboratoryTextFile(filePath);
  }

  async function readBinaryFileBytes(filePath: string) {
    return readLaboratoryBinaryFileBytes(filePath);
  }

  async function writeJsonFile(filePath: string, value: unknown) {
    return writeLaboratoryJsonFile(filePath, value);
  }

  async function writeTextFile(filePath: string, value: string) {
    return writeLaboratoryTextFile(filePath, value);
  }

  async function listDirectory(dirPath: string) {
    return listLaboratoryDirectory(dirPath);
  }

  async function callRoomTools(request: LaboratoryRecord) {
    return callLaboratoryRoomTools(request);
  }

  async function ensureRuntimeDirectory(dirPath: string, requestId?: string | null) {
    return ensureLaboratoryRuntimeDirectory({
      roomId,
      dirPath,
      ...(requestId ? { requestId } : {}),
    });
  }

  async function ensureProjectDirectories(
    runtime: unknown,
    project: unknown,
    requestId?: string | null
  ) {
    return ensureLaboratoryProjectDirectories({
      roomId,
      dirPaths: getProjectDirectoryList(runtime, project),
      fallbackMarkerPaths: getProjectDirectoryFallbackMarkerList(runtime, project),
      ...(requestId ? { requestId } : {}),
    });
  }

  async function cancelRoomTool(cancelRoomId: string, jobId: string, requestId: string) {
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
