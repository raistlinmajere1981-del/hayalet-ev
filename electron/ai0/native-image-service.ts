import type { Ai0Engine } from "./opencode-process.js";
import { isRecord, unwrap } from "./opencode-process.js";
import { readFile } from "node:fs/promises";
import { verifyPngArtifact, validatePng } from "./png-artifact.js";

export const IMAGE_TOOL = "gpt_imagegen";
export const IMAGE_PLUGIN = "opencode-gpt-imagegen";
export async function assertImagePlugin(engine: Ai0Engine): Promise<void> {
  const entries = unwrap(
    await engine.request("GET", "/api/plugin?directory=" + encodeURIComponent(engine.workspacePath))
  );
  if (
    !Array.isArray(entries) ||
    !entries.some(
      (entry) =>
        isRecord(entry) &&
        entry["id"] === IMAGE_PLUGIN &&
        isRecord(entry["state"]) &&
        entry["state"]["status"] === "active"
    )
  )
    throw new Error(
      "OpenCode image plugin unavailable: install and configure " + IMAGE_PLUGIN + " in OpenCode"
    );
}
const sizes = [
  [1254, 1254],
  [1536, 1024],
  [1024, 1536],
  [1448, 1086],
  [1086, 1448],
  [1672, 941],
  [941, 1672],
] as const;
export function imageSize(aspect: string): string {
  const [w = 0, h = 0] = aspect.split(":").map(Number);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0)
    throw new Error("Invalid image aspect ratio");
  const target = Math.log(w / h);
  const closest = [...sizes].sort(
    (a, b) => Math.abs(Math.log(a[0] / a[1]) - target) - Math.abs(Math.log(b[0] / b[1]) - target)
  )[0];
  if (closest === undefined) throw new Error("No image size available");
  return closest.join("x");
}
export async function readImageToolResult(
  messages: Record<string, unknown>[],
  root: string,
  output: string
): Promise<Buffer> {
  const calls = messages
    .flatMap((msg): unknown[] => {
      const content = msg["content"];
      return Array.isArray(content) ? (content as unknown[]) : [];
    })
    .filter(isRecord)
    .filter((part) => part["type"] === "tool");
  if (calls.length !== 1 || calls[0]?.["name"] !== IMAGE_TOOL)
    throw new Error("OpenCode must complete exactly one image tool call");
  const state = calls[0]["state"];
  if (!isRecord(state) || state["status"] !== "completed")
    throw new Error("OpenCode image tool failed; check plugin and account configuration");
  const metadata = state["metadata"],
    input = state["input"];
  if (
    !isRecord(metadata) ||
    metadata["out"] !== output ||
    metadata["versioned"] !== false ||
    !isRecord(input) ||
    input["out"] !== output ||
    (input["images"] != null && (!Array.isArray(input["images"]) || input["images"].length !== 0))
  )
    throw new Error("OpenCode image tool returned an unexpected output path or references");
  const verified = await verifyPngArtifact(root, output);
  const bytes = await readFile(verified.path);
  if (validatePng(bytes).sha256 !== verified.sha256)
    throw new Error("Image changed after verification");
  return bytes;
}
