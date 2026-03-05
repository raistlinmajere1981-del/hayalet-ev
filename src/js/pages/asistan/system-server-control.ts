export interface AdapterServerRuntimeStatus {
  adapterId: string;
  running: boolean;
  port?: number;
}

export interface SystemActiveServerStatus {
  running: boolean;
  adapterId?: string;
  port?: number;
}

export function resolveSystemActiveServerStatus(
  statuses: AdapterServerRuntimeStatus[]
): SystemActiveServerStatus {
  const runningStatus = statuses.find((status) => status.running === true);
  if (runningStatus === undefined) {
    return { running: false };
  }

  return {
    running: true,
    adapterId: runningStatus.adapterId,
    ...(typeof runningStatus.port === "number" ? { port: runningStatus.port } : {}),
  };
}
