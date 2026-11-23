export interface FateKnotsAi0RoomToolCallRequest {
  roomId: "game-room";
  operation: "fate-knots-ai0-call";
  requestId: string;
  universeId: string;
  payload: unknown;
  timeoutMs?: number;
  /** Accepted only as an internal compatibility field; never forwarded to IPC. */
  policyText?: string;
  /** Accepted only as an internal compatibility field; never forwarded to IPC. */
  systemPrompt?: string;
}

interface FateKnotsAi0ElectronRequest {
  roomId: "game-room";
  operation: "fate-knots-ai0-call";
  requestId: string;
  universeId: string;
  payload: unknown;
  timeoutMs?: number;
}

export interface FateKnotsAi0RoomToolCallResult {
  success: boolean;
  operation?: string;
  requestId?: string | null;
  error?: string;
  fateKnotsAi0?: {
    text: string;
    workspacePath: string;
    port: number;
  };
}

export interface FateKnotsAi0ImageStatusRoomToolCallRequest {
  roomId: "game-room";
  operation: "ai0-image-status";
  requestId: string;
}

export interface FateKnotsAi0ImageCapabilityStatus {
  available: boolean;
  activeModelKey: string | null;
  providerId: string | null;
  modelId: string | null;
  toolId: string | null;
  compatibleTool: boolean;
  imageSkillDetected: boolean;
  imageSkillNames: string[];
  reason: string | null;
  workspacePath?: string;
  stagingRoot?: string;
  port?: number;
}

export interface FateKnotsAi0ImageStatusRoomToolCallResult {
  success: boolean;
  operation?: string;
  requestId?: string | null;
  error?: string;
  ai0ImageStatus?: FateKnotsAi0ImageCapabilityStatus;
}

export interface FateKnotsAi0ImageRoomToolCallRequest {
  roomId: "game-room";
  operation: "ai0-image-generate";
  requestId: string;
  jobId: string;
  prompt: string;
  sourceAspectRatio: string;
  timeoutMs?: number;
}

type FateKnotsAi0ImageElectronRequest = FateKnotsAi0ImageRoomToolCallRequest;

export interface FateKnotsAi0ImageRoomToolCallResult {
  success: boolean;
  operation?: string;
  requestId?: string | null;
  jobId?: string | null;
  error?: string;
  fateKnotsAi0Image?: {
    path: string;
    mimeType: "image/png";
    bytes: number;
    manifestPath: string;
    workspacePath: string;
    stagingRoot: string;
    port: number;
    activeModelKey: string;
  };
  ai0Image?: FateKnotsAi0ImageRoomToolCallResult["fateKnotsAi0Image"];
}

type FateKnotsElectronRequest =
  | FateKnotsAi0ElectronRequest
  | FateKnotsAi0ImageStatusRoomToolCallRequest
  | FateKnotsAi0ImageElectronRequest;
type FateKnotsElectronResult =
  | FateKnotsAi0RoomToolCallResult
  | FateKnotsAi0ImageStatusRoomToolCallResult
  | FateKnotsAi0ImageRoomToolCallResult;

type FateKnotsElectronApi = {
  roomToolsCall: (request: FateKnotsElectronRequest) => Promise<FateKnotsElectronResult>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}

function isFateKnotsElectronApi(value: unknown): value is FateKnotsElectronApi {
  return isRecord(value) && typeof value["roomToolsCall"] === "function";
}

export function getFateKnotsElectronApi(): FateKnotsElectronApi | null {
  if (typeof window === "undefined" || isFateKnotsElectronApi(window.electronAPI) !== true) {
    return null;
  }
  return window.electronAPI;
}

export async function callFateKnotsAi0RoomTool(
  request: FateKnotsAi0RoomToolCallRequest
): Promise<FateKnotsAi0RoomToolCallResult> {
  const electronApi = getFateKnotsElectronApi();
  if (electronApi === null) {
    return {
      success: false,
      operation: request.operation,
      requestId: request.requestId,
      error: "Fate Knots AI0 Electron room-tool bridge is unavailable.",
    };
  }

  const ipcRequest: FateKnotsAi0ElectronRequest = {
    roomId: "game-room",
    operation: "fate-knots-ai0-call",
    requestId: request.requestId,
    universeId: request.universeId,
    payload: request.payload,
    ...(request.timeoutMs !== undefined ? { timeoutMs: request.timeoutMs } : {}),
  };

  try {
    const result = (await electronApi.roomToolsCall(ipcRequest)) as FateKnotsAi0RoomToolCallResult;
    return result.success === true
      ? result
      : {
          ...result,
          success: false,
          error: result.error ?? "Fate Knots AI0 room-tool call failed.",
        };
  } catch (error) {
    return {
      success: false,
      operation: request.operation,
      requestId: request.requestId,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function readFateKnotsAi0ImageCapabilityStatus(): Promise<FateKnotsAi0ImageCapabilityStatus> {
  const electronApi = getFateKnotsElectronApi();
  const fallback: FateKnotsAi0ImageCapabilityStatus = {
    available: false,
    activeModelKey: null,
    providerId: null,
    modelId: null,
    toolId: null,
    compatibleTool: false,
    imageSkillDetected: false,
    imageSkillNames: [],
    reason: "Fate Knots AI0 image Electron room-tool bridge is unavailable.",
  };
  if (electronApi === null) return fallback;

  const request: FateKnotsAi0ImageStatusRoomToolCallRequest = {
    roomId: "game-room",
    operation: "ai0-image-status",
    requestId: `fate-knots-ai0-image-status:${Date.now().toString(36)}`,
  };
  try {
    const result = (await electronApi.roomToolsCall(
      request
    )) as FateKnotsAi0ImageStatusRoomToolCallResult;
    return result.success === true && result.ai0ImageStatus
      ? result.ai0ImageStatus
      : { ...fallback, reason: result.error ?? "Fate Knots AI0 image status check failed." };
  } catch (error) {
    return { ...fallback, reason: error instanceof Error ? error.message : String(error) };
  }
}

export async function callFateKnotsAi0ImageRoomTool(
  request: FateKnotsAi0ImageRoomToolCallRequest
): Promise<FateKnotsAi0ImageRoomToolCallResult> {
  const electronApi = getFateKnotsElectronApi();
  if (electronApi === null) {
    return {
      success: false,
      operation: request.operation,
      requestId: request.requestId,
      jobId: request.jobId,
      error: "Fate Knots AI0 image Electron room-tool bridge is unavailable.",
    };
  }

  const ipcRequest: FateKnotsAi0ImageElectronRequest = {
    roomId: "game-room",
    operation: "ai0-image-generate",
    requestId: request.requestId,
    jobId: request.jobId,
    prompt: request.prompt,
    sourceAspectRatio: request.sourceAspectRatio,
    ...(request.timeoutMs !== undefined ? { timeoutMs: request.timeoutMs } : {}),
  };

  try {
    const result = (await electronApi.roomToolsCall(
      ipcRequest
    )) as FateKnotsAi0ImageRoomToolCallResult;
    return result.success === true && result.ai0Image
      ? { ...result, fateKnotsAi0Image: result.ai0Image }
      : {
          ...result,
          success: false,
          error: result.error ?? "Shared AI0 image room-tool returned no image.",
        };
  } catch (error) {
    return {
      success: false,
      operation: request.operation,
      requestId: request.requestId,
      jobId: request.jobId,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
