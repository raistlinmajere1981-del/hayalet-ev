import { AI0_ASSISTANT_SCOPE, AI0_IMAGE_SCOPE } from "../shared/ai0-runtime.js";
import { fileURLToPath } from "node:url";
import { initPaths } from "../electron/paths.ts";
import { ai0RuntimeHost } from "../electron/ai0/runtime-host.ts";
import { closeAgentProfileRegistry } from "../electron/agent-profile-service.ts";

initPaths(fileURLToPath(new URL("../electron", import.meta.url)));
try {
  const modelArg = process.argv.find((arg) => arg.startsWith("--model="))?.slice(8);
  if (modelArg !== undefined) {
    const separator = modelArg.indexOf("/");
    if (separator <= 0) throw new Error("Use --model=provider/modelId");
    await ai0RuntimeHost.selectModel(
      process.argv.includes("--chat") ? AI0_ASSISTANT_SCOPE : AI0_IMAGE_SCOPE,
      { providerID: modelArg.slice(0, separator), id: modelArg.slice(separator + 1) }
    );
  }
  if (process.argv.includes("--models")) {
    const models = await ai0RuntimeHost.models();
    process.stdout.write(`${JSON.stringify(models)}\n`);
  } else if (process.argv.includes("--chat")) {
    const reply = await ai0RuntimeHost.chat("Reply with only: AI0 runtime verified.");
    process.stdout.write(
      `${JSON.stringify({ text: reply.text, model: reply.model, profileHash: reply.profileHash })}\n`
    );
  } else if (process.argv.includes("--image")) {
    const image = await ai0RuntimeHost.generateImage(
      "A small blue ghost on a plain white background, clean simple illustration, no text."
    );
    process.stdout.write(
      `${JSON.stringify({ ...image, openable: (await ai0RuntimeHost.verifyGeneratedImage(image.path)) === image.path })}\n`
    );
  } else {
    const status = await ai0RuntimeHost.imageStatus();
    process.stdout.write(`${JSON.stringify(status)}\n`);
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  await ai0RuntimeHost.shutdown();
  closeAgentProfileRegistry();
}
