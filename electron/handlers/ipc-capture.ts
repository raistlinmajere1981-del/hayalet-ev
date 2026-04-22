import { registerHandler } from "./ipc-helpers.ts";
import { captureService } from "../capture-service.ts";

export function setupCaptureHandlers(): void {
  registerHandler("capture-status", async () => {
    return await captureService.getStatus();
  });

  registerHandler("capture-refresh-status", async () => {
    return await captureService.refreshStatus();
  });

  registerHandler("capture-consume-analyze-assets", async () => {
    return await captureService.consumeAnalyzeInboxAssets();
  });

  registerHandler(
    "capture-install-companion",
    async (_event, options?: { allowBootstrap?: boolean }) => {
      return await captureService.installCompanion(options);
    }
  );

  registerHandler("capture-dismiss-operation", async () => {
    return await captureService.dismissOperation();
  });

  registerHandler("capture-connect-device", async (_event, address: string) => {
    return await captureService.connectDevice(address);
  });

  registerHandler("capture-disconnect-device", async (_event, deviceId: string) => {
    return await captureService.disconnectDevice(deviceId);
  });

  registerHandler("capture-launch-companion", async () => {
    return await captureService.launchCompanion();
  });

  registerHandler("capture-start-analyze-session", async () => {
    return await captureService.requestAnalyzeSession();
  });

  registerHandler("capture-stop-analyze-session", async () => {
    return await captureService.stopAnalyzeSession();
  });

  registerHandler("capture-request-analyze-photo", async () => {
    return await captureService.requestAnalyzeCapture("capture-photo");
  });

  registerHandler("capture-retake-analyze-photo", async () => {
    return await captureService.requestAnalyzeCapture("retake-photo");
  });
}
