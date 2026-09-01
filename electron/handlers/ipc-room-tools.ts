import type { IpcMainInvokeEvent } from "electron";
import { registerHandler } from "./ipc-helpers.ts";
import { roomToolService } from "../room-tool-service.ts";
import { fateKnotsAi0RuntimeService } from "../fate-knots-ai0-runtime-service.ts";
import type {
  RoomToolCallRequest,
  RoomToolCancelRequest,
  RoomToolFateKnotsAi0CallRequest,
} from "../../src/types/room-tools.ts";

function isFateKnotsAi0CallRequest(value: unknown): value is RoomToolFateKnotsAi0CallRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray(value) === false &&
    (value as { operation?: unknown }).operation === "fate-knots-ai0-call"
  );
}

export function setupRoomToolHandlers(): void {
  registerHandler("room-tools-call", async (event: IpcMainInvokeEvent, request: unknown) => {
    if (isFateKnotsAi0CallRequest(request)) {
      const result = await fateKnotsAi0RuntimeService.call(request);
      return {
        success: true,
        operation: request.operation,
        requestId: request.requestId ?? null,
        fateKnotsAi0: result,
      };
    }
    return await roomToolService.handleCall(event, request as RoomToolCallRequest);
  });

  registerHandler("room-tools-cancel", (_event: IpcMainInvokeEvent, request: unknown) => {
    return roomToolService.cancel(request as RoomToolCancelRequest);
  });
}
