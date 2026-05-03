export interface SystemActiveServerStatus {
  running: boolean;
  port?: number;
}

export async function detectSystemActiveServerStatus(): Promise<SystemActiveServerStatus> {
  const electronApi = window.electronAPI;
  if (electronApi === undefined) {
    return { running: false };
  }

  try {
    if (typeof electronApi.opencodeServeStatus === "function") {
      const status = await electronApi.opencodeServeStatus();
      if (status.running === true) {
        return {
          running: true,
          ...(typeof status.port === "number" ? { port: status.port } : {}),
        };
      }
    }
  } catch {
    // NOTE: Intentionally ignored.
  }

  try {
    if (typeof electronApi.opencodeServeFindRunning === "function") {
      const status = await electronApi.opencodeServeFindRunning();
      if (status.running === true) {
        return {
          running: true,
          ...(typeof status.port === "number" ? { port: status.port } : {}),
        };
      }
    }
  } catch {
    // NOTE: Intentionally ignored.
  }

  return {
    running: false,
  };
}
