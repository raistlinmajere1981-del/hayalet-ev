export interface SlotBridgeCoreEngineRef {
  setConnection(
    provider: string,
    connected: boolean,
    opts?: { force?: boolean; url?: string }
  ): Promise<{ success: boolean; message?: string }>;
  sendBatch(payload: {
    targets?: string[];
    text?: string;
    page?: string;
    attachments?: Array<{ name: string; path: string; mimeType?: string }>;
    [key: string]: unknown;
  }): Promise<{ success: boolean; message?: string }>;
  sendMessage(payload: {
    provider?: string;
    text?: string;
    page?: string;
    attachments?: unknown[];
    [key: string]: unknown;
  }): Promise<{ success: boolean; message?: string }>;
}

let slotBridgeCoreEngine: SlotBridgeCoreEngineRef | null = null;

export function registerSlotBridgeCoreEngine(coreEngine: SlotBridgeCoreEngineRef): void {
  slotBridgeCoreEngine = coreEngine;
}

export function getSlotBridgeCoreEngine(): SlotBridgeCoreEngineRef {
  if (slotBridgeCoreEngine === null) {
    throw new Error("SlotBridge core engine runtime is not registered");
  }

  return slotBridgeCoreEngine;
}
