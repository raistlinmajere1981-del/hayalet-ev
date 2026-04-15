function toApiRecord(value) {
  return typeof value === "object" && value !== null ? value : null;
}
function isLaboratoryElectronApi(value) {
  const record = toApiRecord(value);
  return record !== null && typeof record["readFile"] === "function" && typeof record["openPath"] === "function" && typeof record["fmWriteFileAtomic"] === "function" && typeof record["readDirectoryFiles"] === "function" && typeof record["roomToolsCall"] === "function" && typeof record["roomToolsCancel"] === "function";
}
export function getLaboratoryElectronApi() {
  if (typeof window === "undefined" || isLaboratoryElectronApi(window.electronAPI) !== true) {
    return null;
  }
  return window.electronAPI;
}
function decodeBase64Binary(base64Value) {
  if (typeof base64Value !== "string" || base64Value.trim() === "") {
    return null;
  }
  try {
    return atob(base64Value);
  } catch (_error) {
    return null;
  }
}
function binaryToBytes(binary) {
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
export function decodeLaboratoryBase64Text(base64Value) {
  const binary = decodeBase64Binary(base64Value);
  if (binary === null) {
    return null;
  }
  return new TextDecoder("utf-8").decode(binaryToBytes(binary));
}
export function decodeLaboratoryBase64Bytes(base64Value) {
  const binary = decodeBase64Binary(base64Value);
  return binary === null ? null : binaryToBytes(binary);
}
function toHexString(buffer) {
  const bytes = new Uint8Array(buffer);
  let output = "";
  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index] ?? 0;
    output += byte.toString(16).padStart(2, "0");
  }
  return output;
}
export async function digestLaboratorySha1(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new Error("SHA-1 digest is unavailable in the current room host.");
  }
  const digestBytes = new Uint8Array(bytes.byteLength);
  digestBytes.set(bytes);
  return toHexString(await globalThis.crypto.subtle.digest("SHA-1", digestBytes));
}
export async function readLaboratoryJsonFile(filePath) {
  const electronApi = getLaboratoryElectronApi();
  if (electronApi === null) {
    return null;
  }
  const encoded = await electronApi.readFile(filePath);
  const raw = decodeLaboratoryBase64Text(encoded ?? "");
  if (typeof raw !== "string" || raw.trim() === "") {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}
export async function readLaboratoryTextFile(filePath) {
  const electronApi = getLaboratoryElectronApi();
  if (electronApi === null) {
    return null;
  }
  const encoded = await electronApi.readFile(filePath);
  return decodeLaboratoryBase64Text(encoded ?? "");
}
export async function readLaboratoryBinaryFileBytes(filePath) {
  const electronApi = getLaboratoryElectronApi();
  if (electronApi === null) {
    return null;
  }
  const encoded = await electronApi.readFile(filePath);
  return decodeLaboratoryBase64Bytes(encoded ?? "");
}
function getOpenPathErrorMessage(result) {
  if (typeof result.error === "string" && result.error.trim() !== "") {
    return result.error;
  }
  if (typeof result.message === "string" && result.message.trim() !== "") {
    return result.message;
  }
  return "Open path failed.";
}
export async function openLaboratoryPath(targetPath) {
  const electronApi = getLaboratoryElectronApi();
  if (electronApi === null) {
    throw new Error("Electron API is unavailable.");
  }
  const result = await electronApi.openPath(targetPath);
  if (result.success !== true) {
    throw new Error(getOpenPathErrorMessage(result));
  }
}
function getWriteErrorMessage(result) {
  if (typeof result.error === "string" && result.error.trim() !== "") {
    return result.error;
  }
  if (typeof result.message === "string" && result.message.trim() !== "") {
    return result.message;
  }
  return "Write failed.";
}
async function writeElectronFile(payload) {
  const electronApi = getLaboratoryElectronApi();
  if (electronApi === null) {
    throw new Error("Electron API is unavailable.");
  }
  const result = await electronApi.fmWriteFileAtomic(payload);
  if (result.success !== true) {
    throw new Error(getWriteErrorMessage(result));
  }
}
export async function writeLaboratoryJsonFile(filePath, value) {
  await writeElectronFile({
    path: filePath,
    data: JSON.stringify(value, null, 2)
  });
}
export async function writeLaboratoryTextFile(filePath, value) {
  await writeElectronFile({
    path: filePath,
    data: value
  });
}
export async function listLaboratoryDirectory(dirPath) {
  const electronApi = getLaboratoryElectronApi();
  if (electronApi === null) {
    return [];
  }
  try {
    return await electronApi.readDirectoryFiles(dirPath);
  } catch (_error) {
    return [];
  }
}
export async function callLaboratoryRoomTools(request) {
  const electronApi = getLaboratoryElectronApi();
  if (electronApi === null) {
    throw new Error("Room tools bridge is unavailable.");
  }
  const result = await electronApi.roomToolsCall(request);
  if (result.success !== true) {
    throw new Error(result.error || "Room tools call failed.");
  }
  return result;
}
function isUnsupportedEnsureDirError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.indexOf("Unsupported room-tools operation: ensure-dir") !== -1;
}
async function ensureDirectoryMarker(dirPath) {
  await writeElectronFile({
    path: `${dirPath}/.keep`,
    data: ""
  });
}
export async function ensureLaboratoryRuntimeDirectory(options) {
  const { dirPath, requestId, roomId } = options;
  try {
    await callLaboratoryRoomTools({
      operation: "ensure-dir",
      roomId,
      requestId: requestId || null,
      targetPath: dirPath
    });
    return;
  } catch (error) {
    if (isUnsupportedEnsureDirError(error) !== true) {
      throw error;
    }
  }
  await ensureDirectoryMarker(dirPath);
}
export async function ensureLaboratoryProjectDirectories(options) {
  const { dirPaths, fallbackMarkerPaths, requestId, roomId } = options;
  try {
    for (let index = 0; index < dirPaths.length; index += 1) {
      await callLaboratoryRoomTools({
        operation: "ensure-dir",
        roomId,
        requestId: requestId || null,
        targetPath: dirPaths[index]
      });
    }
    return;
  } catch (error) {
    if (isUnsupportedEnsureDirError(error) !== true) {
      throw error;
    }
  }
  await Promise.all(
    fallbackMarkerPaths.map(function(dirPath) {
      return ensureDirectoryMarker(dirPath);
    })
  );
}
export async function cancelLaboratoryRoomTool(options) {
  const { roomId, jobId, requestId } = options;
  const electronApi = getLaboratoryElectronApi();
  if (electronApi === null) {
    return;
  }
  const request = {
    roomId,
    jobId,
    requestId: requestId || null
  };
  await electronApi.roomToolsCancel(request);
}
