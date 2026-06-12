import type {
  OperationAcquireResult,
  OperationCapability,
  OperationOwner,
  OperationReleaseResult,
  OperationsStatus,
} from "../../../types/operations.js";

const FALLBACK_OPERATIONS_STATUS: OperationsStatus = {
  records: [],
  updatedAt: 0,
};

function getElectronApi(): typeof window.electronAPI | undefined {
  return window.electronAPI;
}

function normalizeStatus(value: unknown): OperationsStatus {
  if (typeof value === "object" && value !== null && "records" in value && "updatedAt" in value) {
    return value as OperationsStatus;
  }

  return FALLBACK_OPERATIONS_STATUS;
}

export async function getOperationsStatus(): Promise<OperationsStatus> {
  const api = getElectronApi();
  if (api?.operationsStatus === undefined) {
    return FALLBACK_OPERATIONS_STATUS;
  }

  return normalizeStatus(await api.operationsStatus());
}

export async function acquireOperationCapability(
  capability: OperationCapability,
  owner: OperationOwner
): Promise<OperationAcquireResult> {
  const api = getElectronApi();
  if (api?.operationsAcquire === undefined) {
    return {
      success: false,
      error: "Electron operations bridge is unavailable.",
      status: FALLBACK_OPERATIONS_STATUS,
    };
  }

  return await api.operationsAcquire(capability, owner);
}

export async function releaseOperationCapability(
  capability: OperationCapability,
  owner: OperationOwner
): Promise<OperationReleaseResult> {
  const api = getElectronApi();
  if (api?.operationsRelease === undefined) {
    return {
      success: false,
      error: "Electron operations bridge is unavailable.",
      status: FALLBACK_OPERATIONS_STATUS,
    };
  }

  return await api.operationsRelease(capability, owner);
}

export function onOperationsStatus(callback: (status: OperationsStatus) => void): () => void {
  const api = getElectronApi();
  if (api?.operationsOnStatus === undefined || api.operationsOffStatus === undefined) {
    return () => {};
  }

  const handler = (payload: OperationsStatus): void => {
    callback(normalizeStatus(payload));
  };

  api.operationsOnStatus(handler);
  return () => {
    api.operationsOffStatus?.(handler);
  };
}
