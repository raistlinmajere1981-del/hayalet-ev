function toApiRecord(value) {
  return typeof value === "object" && value !== null ? value : null;
}
function isForgeElectronApi(value) {
  const record = toApiRecord(value);
  return record !== null && typeof record["readFile"] === "function" && typeof record["fmWriteFileAtomic"] === "function" && typeof record["readDirectoryFiles"] === "function" && typeof record["roomToolsCall"] === "function";
}
export function getForgeElectronApi() {
  if (typeof window === "undefined" || isForgeElectronApi(window.electronAPI) !== true) {
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
  } catch {
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
export function decodeForgeBase64Text(base64Value) {
  const binary = decodeBase64Binary(base64Value);
  if (binary === null) {
    return null;
  }
  return new TextDecoder("utf-8").decode(binaryToBytes(binary));
}
export async function readForgeJsonFile(filePath) {
  const electronApi = getForgeElectronApi();
  if (electronApi === null) {
    return null;
  }
  const encoded = await electronApi.readFile(filePath);
  const raw = decodeForgeBase64Text(encoded ?? "");
  if (typeof raw !== "string" || raw.trim() === "") {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
export async function readForgeTextFile(filePath) {
  const electronApi = getForgeElectronApi();
  if (electronApi === null) {
    return null;
  }
  const encoded = await electronApi.readFile(filePath);
  return decodeForgeBase64Text(encoded ?? "");
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
  const electronApi = getForgeElectronApi();
  if (electronApi === null) {
    throw new Error("Electron API is unavailable.");
  }
  const result = await electronApi.fmWriteFileAtomic(payload);
  if (result.success !== true) {
    throw new Error(getWriteErrorMessage(result));
  }
}
export async function writeForgeJsonFile(filePath, value) {
  await writeElectronFile({
    path: filePath,
    data: JSON.stringify(value, null, 2)
  });
}
export async function writeForgeTextFile(filePath, value) {
  await writeElectronFile({
    path: filePath,
    data: value
  });
}
export async function listForgeDirectory(dirPath) {
  const electronApi = getForgeElectronApi();
  if (electronApi === null) {
    return [];
  }
  try {
    return await electronApi.readDirectoryFiles(dirPath);
  } catch {
    return [];
  }
}
export async function callForgeRoomTools(request) {
  const electronApi = getForgeElectronApi();
  if (electronApi === null) {
    throw new Error("Room tools bridge is unavailable.");
  }
  const result = await electronApi.roomToolsCall(request);
  if (result.success !== true) {
    throw new Error(result.error || "Room tools call failed.");
  }
  return result;
}
