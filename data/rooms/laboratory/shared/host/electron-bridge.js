export function getLaboratoryElectronApi() {
  return typeof window !== "undefined" ? window.electronAPI || null : null;
}
export function decodeLaboratoryBase64Text(base64Value) {
  if (typeof base64Value !== "string" || base64Value.trim() === "") {
    return null;
  }
  try {
    const binary = atob(base64Value);
    const bytes = Uint8Array.from(binary, function(char) {
      return char.charCodeAt(0);
    });
    return new TextDecoder("utf-8").decode(bytes);
  } catch (_error) {
    return null;
  }
}
export function decodeLaboratoryBase64Bytes(base64Value) {
  if (typeof base64Value !== "string" || base64Value.trim() === "") {
    return null;
  }
  try {
    const binary = atob(base64Value);
    return Uint8Array.from(binary, function(char) {
      return char.charCodeAt(0);
    });
  } catch (_error) {
    return null;
  }
}
function toHexString(buffer) {
  return Array.from(new Uint8Array(buffer)).map(function(value) {
    return value.toString(16).padStart(2, "0");
  }).join("");
}
export async function digestLaboratorySha1(bytes) {
  if (!(bytes instanceof Uint8Array) || typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("SHA-1 digest is unavailable in the current room host.");
  }
  const digestBytes = new Uint8Array(bytes.byteLength);
  digestBytes.set(bytes);
  return toHexString(await crypto.subtle.digest("SHA-1", digestBytes));
}
export async function readLaboratoryJsonFile(filePath) {
  const electronApi = getLaboratoryElectronApi();
  if (electronApi === null || typeof electronApi.readFile !== "function") {
    return null;
  }
  const encoded = await electronApi.readFile(filePath);
  const raw = decodeLaboratoryBase64Text(encoded);
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
  if (electronApi === null || typeof electronApi.readFile !== "function") {
    return null;
  }
  const encoded = await electronApi.readFile(filePath);
  return decodeLaboratoryBase64Text(encoded);
}
export async function readLaboratoryBinaryFileBytes(filePath) {
  const electronApi = getLaboratoryElectronApi();
  if (electronApi === null || typeof electronApi.readFile !== "function") {
    return null;
  }
  const encoded = await electronApi.readFile(filePath);
  return decodeLaboratoryBase64Bytes(encoded);
}
export async function writeLaboratoryJsonFile(filePath, value) {
  const electronApi = getLaboratoryElectronApi();
  if (electronApi === null || typeof electronApi.fmWriteFileAtomic !== "function") {
    throw new Error("Electron API is unavailable.");
  }
  const result = await electronApi.fmWriteFileAtomic({
    path: filePath,
    data: JSON.stringify(value, null, 2)
  });
  if (!result || result.success !== true) {
    throw new Error(result && (result.message || result.error) || "Write failed.");
  }
}
export async function writeLaboratoryTextFile(filePath, value) {
  const electronApi = getLaboratoryElectronApi();
  if (electronApi === null || typeof electronApi.fmWriteFileAtomic !== "function") {
    throw new Error("Electron API is unavailable.");
  }
  const result = await electronApi.fmWriteFileAtomic({
    path: filePath,
    data: typeof value === "string" ? value : String(value || "")
  });
  if (!result || result.success !== true) {
    throw new Error(result && (result.message || result.error) || "Write failed.");
  }
}
export async function listLaboratoryDirectory(dirPath) {
  const electronApi = getLaboratoryElectronApi();
  if (electronApi === null || typeof electronApi.readDirectoryFiles !== "function") {
    return [];
  }
  try {
    const result = await electronApi.readDirectoryFiles(dirPath);
    return Array.isArray(result) ? result : [];
  } catch (_error) {
    return [];
  }
}
export async function callLaboratoryRoomTools(request) {
  const electronApi = getLaboratoryElectronApi();
  if (electronApi === null || typeof electronApi.roomToolsCall !== "function") {
    throw new Error("Room tools bridge is unavailable.");
  }
  const result = await electronApi.roomToolsCall(request);
  if (!result || result.success !== true) {
    throw new Error(result && result.error || "Room tools call failed.");
  }
  return result;
}
function isUnsupportedEnsureDirError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.indexOf("Unsupported room-tools operation: ensure-dir") !== -1;
}
async function ensureDirectoryMarker(dirPath) {
  const electronApi = getLaboratoryElectronApi();
  if (electronApi === null || typeof electronApi.fmWriteFileAtomic !== "function") {
    throw new Error("Electron API is unavailable.");
  }
  const result = await electronApi.fmWriteFileAtomic({
    path: `${dirPath}/.keep`,
    data: ""
  });
  if (!result || result.success !== true) {
    throw new Error(result && (result.message || result.error) || "Directory prepare failed.");
  }
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
  if (electronApi === null || typeof electronApi.roomToolsCancel !== "function") {
    return;
  }
  await electronApi.roomToolsCancel({
    roomId,
    jobId,
    requestId: requestId || null
  });
}
