interface ConnectionIndicatorInput {
  isConnected: boolean;
  isServerRunning: boolean;
  port?: number;
}

function isValidPort(port: number | undefined): port is number {
  return typeof port === "number" && Number.isFinite(port) && port > 0;
}

export function formatConnectionIndicatorText(input: ConnectionIndicatorInput): string {
  if (input.isConnected && isValidPort(input.port)) {
    return `Bağlı Port: ${input.port}`;
  }

  if (input.isServerRunning && isValidPort(input.port)) {
    return `Bağlı Değil: sunucu:${input.port}`;
  }

  return "Bağlı Değil: <sunucu pasif>";
}
