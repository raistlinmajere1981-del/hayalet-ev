import type { IpcMainInvokeEvent } from "electron";
import { registerHandler } from "./ipc-helpers.ts";
import { transcriptService } from "../transcript-service.ts";
import type {
  TranscriptSubmitIngressRequest,
  TranscriptTranscriptionRequest,
} from "../../src/types/transcript.ts";

export function setupTranscriptHandlers(): void {
  registerHandler("transcript-status", async () => {
    return await transcriptService.getStatus();
  });

  registerHandler("transcript-ensure-runtime", async () => {
    return await transcriptService.ensureRuntime();
  });

  registerHandler(
    "transcript-transcribe-local",
    async (_event: IpcMainInvokeEvent, request: unknown) => {
      return await transcriptService.transcribeLocal(request as TranscriptTranscriptionRequest);
    }
  );

  registerHandler("transcript-submit-ingress", (_event: IpcMainInvokeEvent, request) => {
    return transcriptService.submitIngress(request as TranscriptSubmitIngressRequest);
  });
}
