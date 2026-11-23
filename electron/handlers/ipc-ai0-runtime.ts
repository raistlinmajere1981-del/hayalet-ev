import { shell, nativeImage } from "electron";
import { registerHandler } from "./ipc-helpers.ts";
import { ai0RuntimeHost } from "../ai0/runtime-host.js";
import type { Ai0RuntimeRequest } from "../../shared/ai0-runtime.js";

export function setupAi0RuntimeHandlers(): void {
  registerHandler("ai0-runtime-request", async (_event, payload: unknown) => {
    if (payload === null || typeof payload !== "object" || Array.isArray(payload))
      throw new Error("Invalid AI0 request");
    const request = payload as Ai0RuntimeRequest;
    let data: unknown;
    switch (request.action) {
      case "models":
        data = await ai0RuntimeHost.models();
        break;
      case "model-selections":
        data = ai0RuntimeHost.modelSelections();
        break;
      case "model-select":
        await ai0RuntimeHost.selectModel(request.scope, request.model);
        data = { selected: true };
        break;
      case "image-status":
        data = await ai0RuntimeHost.imageStatus(request.scope);
        break;
      case "image-generate":
        data = await ai0RuntimeHost.generateImage(
          request.prompt,
          request.aspectRatio,
          request.scope,
          request.timeoutMs
        );
        break;
      case "chat":
        data = await ai0RuntimeHost.chat(
          request.text,
          request.scope,
          request.sessionId,
          request.timeoutMs
        );
        break;
      case "image-open": {
        const path = await ai0RuntimeHost.verifyGeneratedImage(request.path);
        if (nativeImage.createFromPath(path).isEmpty())
          throw new Error("Generated PNG could not be decoded for opening");
        const error = await shell.openPath(path);
        if (error !== "") throw new Error(error);
        data = { opened: true };
        break;
      }
      default:
        throw new Error("Unknown AI0 request action");
    }
    return { success: true, data };
  });
}
