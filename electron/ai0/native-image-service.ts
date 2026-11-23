import type { Ai0Engine } from "./opencode-process.js";
import type { Ai0Model } from "../../shared/ai0-runtime.js";
import { isRecord, unwrap } from "./opencode-process.js";
import { validatePng } from "./png-artifact.js";

const MAX_IMAGE_BYTES = 64 * 1024 * 1024;
export const NATIVE_IMAGE_ROUTE = "/api/experimental/generate/image";

export function decodeNativeImageResult(response: unknown): Buffer {
  const result = unwrap(response);
  const images = isRecord(result) ? result["images"] : null;
  if (!Array.isArray(images) || images.length !== 1 || !isRecord(images[0]))
    throw new Error("OpenCode image API did not return exactly one image");
  const image = images[0];
  if (image["type"] !== "image" || image["mime"] !== "image/png")
    throw new Error("OpenCode image API did not return a PNG");
  const raw = image["data"];
  if (typeof raw !== "string") throw new Error("OpenCode image API returned no image bytes");
  const encoded = raw.startsWith("data:image/png;base64,")
    ? raw.slice("data:image/png;base64,".length)
    : raw;
  if (
    encoded.length === 0 ||
    encoded.length > MAX_IMAGE_BYTES * 2 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)
  )
    throw new Error("OpenCode image API returned invalid base64");
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length > MAX_IMAGE_BYTES || bytes.toString("base64") !== encoded)
    throw new Error("OpenCode image API returned invalid image bytes");
  validatePng(bytes);
  return bytes;
}

/**
 * The V2.3 native image endpoint uses the user's existing OpenCode auth and
 * configured image provider. No dispatcher LLM, image skill or custom Codex
 * endpoint is involved. Explicit model assignment prevents silent fallback.
 */
export async function generateNativeImage(
  engine: Ai0Engine,
  model: Ai0Model,
  prompt: string,
  aspectRatio: string,
  timeoutMs: number
): Promise<Buffer> {
  return decodeNativeImageResult(
    await engine.request(
      "POST",
      NATIVE_IMAGE_ROUTE,
      {
        model,
        prompt,
        n: 1,
        aspect: aspectRatio,
        resolution: "1K",
      },
      timeoutMs
    )
  );
}

export async function hasNativeImageCapability(engine: Ai0Engine): Promise<boolean> {
  const response = unwrap(
    await engine.request("GET", `/api/plugin?directory=${encodeURIComponent(engine.workspacePath)}`)
  );
  return (
    Array.isArray(response) &&
    response.some(
      (entry) =>
        isRecord(entry) &&
        entry["id"] === "opencode.config.image" &&
        isRecord(entry["state"]) &&
        entry["state"]["status"] === "active"
    )
  );
}
