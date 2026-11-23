import {
  callFateKnotsAi0ImageRoomTool,
  readFateKnotsAi0ImageCapabilityStatus,
  type FateKnotsAi0ImageCapabilityStatus,
} from "./electron-bridge.js";
import {
  readFateKnotsJsonFile,
  readFateKnotsLocalFileBase64,
  verifyFateKnotsManagedAssetFiles,
  writeFateKnotsManagedImageFile,
} from "./storage-bridge.js";

export const FATE_KNOTS_AI0_IMAGE_SMOKE_PROMPT =
  "An old leather-bound fantasy book resting on a dark wooden table, warm candlelight, no text, painterly dark fantasy concept art.";

const FATE_KNOTS_AI0_IMAGE_SMOKE_ASSET_ID = "ai0-smoke-book-cover";
const FATE_KNOTS_AI0_IMAGE_MIME_TYPE = "image/png";
const FATE_KNOTS_AI0_IMAGE_TIMEOUT_MS = 10 * 60_000;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

export interface FateKnotsAi0ImageSmokeSuccess {
  ok: true;
  jobId: string;
  prompt: string;
  activeModelKey: string;
  toolId: "image_generate";
  stagingPath: string;
  manifestPath: string;
  managedPath: string;
  port: number;
  bytes: number;
}

export interface FateKnotsAi0ImageSmokeFailure {
  ok: false;
  error: "ai0-local-unavailable" | "ai0-image-smoke-failed";
  message: string;
  capability?: FateKnotsAi0ImageCapabilityStatus;
}

export type FateKnotsAi0ImageSmokeResult =
  FateKnotsAi0ImageSmokeSuccess | FateKnotsAi0ImageSmokeFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeComparablePath(value: string): string | null {
  const raw = value
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/\/$/, "");
  if (raw === "" || raw.split("/").some((segment) => segment === "..")) return null;
  return /^[A-Za-z]:\//.test(raw) ? raw.toLowerCase() : raw;
}

function assertContainedFile(
  rootPath: string,
  filePath: string,
  expectedFileName: "source.png" | "result.json"
): string {
  const root = normalizeComparablePath(rootPath);
  const file = normalizeComparablePath(filePath);
  if (root === null || file === null || !file.startsWith(root + "/")) {
    throw new Error("Fate Knots AI0 smoke artifact escaped the image-worker staging root.");
  }
  if (!file.endsWith("/" + expectedFileName)) {
    throw new Error("Fate Knots AI0 smoke expected staging file " + expectedFileName + ".");
  }
  return file;
}

function decodeAndVerifyPng(base64: string): number {
  const normalized = base64.replace(/\s+/g, "");
  if (normalized === "") {
    throw new Error("Fate Knots AI0 smoke source.png is missing or empty.");
  }

  let binary: string;
  try {
    binary = atob(normalized);
  } catch {
    throw new Error("Fate Knots AI0 smoke source.png is not valid base64.");
  }
  if (
    binary.length < PNG_SIGNATURE.length ||
    !PNG_SIGNATURE.every((byte, index) => binary.charCodeAt(index) === byte)
  ) {
    throw new Error("Fate Knots AI0 smoke source.png failed PNG signature verification.");
  }
  return binary.length;
}

function verifyManifest(
  value: unknown,
  expected: {
    jobId: string;
    activeModelKey: string;
    stagingPath: string;
    bytes: number;
  }
): void {
  if (!isRecord(value)) {
    throw new Error("Fate Knots AI0 smoke result.json is missing or invalid.");
  }
  const artifact = value["artifact"];
  if (
    value["schemaVersion"] !== 1 ||
    value["success"] !== true ||
    value["jobId"] !== expected.jobId ||
    value["activeModelKey"] !== expected.activeModelKey ||
    !isRecord(artifact) ||
    normalizeComparablePath(String(artifact["path"] ?? "")) !==
      normalizeComparablePath(expected.stagingPath) ||
    artifact["mimeType"] !== FATE_KNOTS_AI0_IMAGE_MIME_TYPE ||
    artifact["bytes"] !== expected.bytes
  ) {
    throw new Error("Fate Knots AI0 smoke result.json does not match the generated PNG artifact.");
  }
}

function failure(
  error: FateKnotsAi0ImageSmokeFailure["error"],
  message: string,
  capability?: FateKnotsAi0ImageCapabilityStatus
): FateKnotsAi0ImageSmokeFailure {
  return {
    ok: false,
    error,
    message,
    ...(capability !== undefined ? { capability } : {}),
  };
}

export async function runFateKnotsAi0ImageSmoke(): Promise<FateKnotsAi0ImageSmokeResult> {
  const capability = await readFateKnotsAi0ImageCapabilityStatus();
  if (capability.available !== true) {
    return failure(
      "ai0-local-unavailable",
      capability.reason ?? "AI0 Local image generation is unavailable.",
      capability
    );
  }

  const nonce = Date.now().toString(36);
  const jobId = "fate-knots-ai0-smoke-" + nonce;
  try {
    const generated = await callFateKnotsAi0ImageRoomTool({
      roomId: "game-room",
      operation: "ai0-image-generate",
      requestId: "fate-knots-ai0-image-smoke:" + nonce,
      jobId,
      prompt: FATE_KNOTS_AI0_IMAGE_SMOKE_PROMPT,
      sourceAspectRatio: "1:1",
      timeoutMs: FATE_KNOTS_AI0_IMAGE_TIMEOUT_MS,
    });
    if (generated.success !== true || !generated.fateKnotsAi0Image) {
      throw new Error(generated.error ?? "Fate Knots AI0 image worker returned no smoke artifact.");
    }

    const source = generated.fateKnotsAi0Image;
    if (!Number.isInteger(source.port) || source.port < 4135 || source.port > 4149) {
      throw new Error("Fate Knots AI0 smoke worker returned a port outside 4135-4149.");
    }
    if (capability.port !== undefined && capability.port !== source.port) {
      throw new Error("Fate Knots AI0 smoke worker port changed after capability readiness.");
    }

    const stagingPath = assertContainedFile(source.stagingRoot, source.path, "source.png");
    const manifestPath = assertContainedFile(
      source.stagingRoot,
      source.manifestPath,
      "result.json"
    );
    if (
      stagingPath.slice(0, stagingPath.lastIndexOf("/")) !==
      manifestPath.slice(0, manifestPath.lastIndexOf("/"))
    ) {
      throw new Error("Fate Knots AI0 smoke source.png and result.json are not in the same job.");
    }

    const sourceBase64 = await readFateKnotsLocalFileBase64(source.path);
    const bytes = decodeAndVerifyPng(sourceBase64);
    if (source.bytes !== bytes) {
      throw new Error("Fate Knots AI0 smoke source.png byte count does not match worker metadata.");
    }

    const manifest = await readFateKnotsJsonFile(source.manifestPath);
    verifyManifest(manifest, {
      jobId,
      activeModelKey: source.activeModelKey,
      stagingPath: source.path,
      bytes,
    });

    const managedPath = await writeFateKnotsManagedImageFile({
      jobId,
      fileId: FATE_KNOTS_AI0_IMAGE_SMOKE_ASSET_ID,
      base64: sourceBase64,
      mimeType: FATE_KNOTS_AI0_IMAGE_MIME_TYPE,
    });
    const verification = await verifyFateKnotsManagedAssetFiles([
      {
        assetId: FATE_KNOTS_AI0_IMAGE_SMOKE_ASSET_ID,
        path: managedPath,
        mimeType: FATE_KNOTS_AI0_IMAGE_MIME_TYPE,
      },
    ]);
    if (!verification.valid) {
      throw new Error(
        verification.failures[0]?.message ??
          "Fate Knots AI0 smoke managed-storage promotion failed verification."
      );
    }

    const managedBase64 = await readFateKnotsLocalFileBase64(managedPath);
    if (managedBase64 !== sourceBase64) {
      throw new Error("Fate Knots AI0 smoke managed image bytes differ from source.png.");
    }

    return {
      ok: true,
      jobId,
      prompt: FATE_KNOTS_AI0_IMAGE_SMOKE_PROMPT,
      activeModelKey: source.activeModelKey,
      toolId: "image_generate",
      stagingPath: source.path,
      manifestPath: source.manifestPath,
      managedPath,
      port: source.port,
      bytes,
    };
  } catch (error) {
    return failure(
      "ai0-image-smoke-failed",
      error instanceof Error ? error.message : String(error),
      capability
    );
  }
}
