import { getFateKnotsImageSheetCropRect } from "../forge/image-sheet.js";
import type {
  FateKnotsAssetMaterializerAdapter,
  FateKnotsAssetMaterializerJob,
} from "../forge/materializer.js";
import type { FateKnotsMaterializedAsset } from "../forge/world-forge.js";
import { FATE_KNOTS_PAGE_ID } from "../../../shared/host/feature-meta.js";
import { readFateKnotsLocalFileBase64, writeFateKnotsManagedImageFile } from "./storage-bridge.js";
import {
  openFateKnotsAi1Session,
  type FateKnotsSessionRef,
  type FateKnotsTransportApi,
} from "./transport.js";

const FATE_KNOTS_IMAGE_PROVIDER_TIMEOUT_MS = 600_000;
const FATE_KNOTS_CROP_MIME_TYPE = "image/png";

type ProviderImageArtifact = {
  path: string;
  mimeType: string;
};

type LoadedImage = {
  element: HTMLImageElement;
  width: number;
  height: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLocalFilePath(value: string): boolean {
  const normalized = value.trim();
  return (
    normalized !== "" &&
    !normalized.startsWith("data:") &&
    !normalized.startsWith("blob:") &&
    !/^https?:\/\//i.test(normalized)
  );
}

function inferImageMimeType(path: string): string | null {
  const clean = path.trim().toLowerCase().split(/[?#]/, 1)[0] ?? "";
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) return "image/jpeg";
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".gif")) return "image/gif";
  if (clean.endsWith(".bmp")) return "image/bmp";
  if (clean.endsWith(".avif")) return "image/avif";
  if (clean.endsWith(".svg")) return "image/svg+xml";
  return null;
}

function readImageArtifact(value: unknown): ProviderImageArtifact | null {
  if (!isRecord(value)) return null;
  const declaredMime = typeof value["mimeType"] === "string" ? value["mimeType"].trim() : "";
  const kind = typeof value["kind"] === "string" ? value["kind"] : "";
  if (kind !== "generated-image" && !declaredMime.toLowerCase().startsWith("image/")) {
    return null;
  }

  const archivePath = typeof value["archivePath"] === "string" ? value["archivePath"].trim() : "";
  const directPath = typeof value["path"] === "string" ? value["path"].trim() : "";
  const path = isLocalFilePath(archivePath)
    ? archivePath
    : isLocalFilePath(directPath)
      ? directPath
      : "";
  if (path === "") return null;

  const mimeType = declaredMime.toLowerCase().startsWith("image/")
    ? (declaredMime.toLowerCase().split(";", 1)[0] ?? "")
    : (inferImageMimeType(path) ?? "");
  return mimeType.startsWith("image/") ? { path, mimeType } : null;
}

function appendArtifactArray(target: ProviderImageArtifact[], value: unknown): void {
  if (!Array.isArray(value)) return;
  for (const entry of value) {
    const artifact = readImageArtifact(entry);
    if (artifact) target.push(artifact);
  }
}

function collectGeneratedImages(rawResult: unknown): ProviderImageArtifact[] {
  if (!isRecord(rawResult)) return [];
  const candidates: ProviderImageArtifact[] = [];
  const roots = [rawResult];
  if (isRecord(rawResult["data"])) roots.push(rawResult["data"]);

  for (const root of roots) {
    appendArtifactArray(candidates, root["artifacts"]);
    const reply = isRecord(root["reply"]) ? root["reply"] : null;
    if (reply) appendArtifactArray(candidates, reply["attachments"]);
  }

  const unique = new Map<string, ProviderImageArtifact>();
  for (const candidate of candidates) {
    const key = candidate.path.replace(/\\/g, "/").toLowerCase();
    if (!unique.has(key)) unique.set(key, candidate);
  }
  return Array.from(unique.values());
}

function readBridgeFailureMessage(rawResult: unknown): string {
  if (!isRecord(rawResult)) return "Image provider transport failed.";
  for (const key of ["message", "error"] as const) {
    const value = rawResult[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return "Image provider transport failed.";
}

function bridgeSucceeded(rawResult: unknown): boolean {
  if (!isRecord(rawResult)) return false;
  if (rawResult["success"] === true) return true;
  return isRecord(rawResult["data"]) && rawResult["data"]["success"] === true;
}

function buildGenerationPrompt(job: FateKnotsAssetMaterializerJob): string {
  const sourceAspect =
    job.kind === "single"
      ? job.aspectRatio
      : `${job.sourceAspectRatio.width}:${job.sourceAspectRatio.height}`;
  return [
    "Generate exactly one image now using your image-generation capability.",
    "The reply must include one newly generated image artifact; a text-only answer is not acceptable.",
    "Do not generate multiple alternatives or a second image.",
    `Required source aspect ratio: ${sourceAspect}.`,
    "Do not add captions, readable labels, UI chrome, watermarks, or explanatory text unless the art brief explicitly requires natural in-world writing.",
    "Fate Knots art brief:",
    job.prompt.trim(),
  ].join("\n");
}

async function requestProviderImage(
  api: FateKnotsTransportApi,
  job: FateKnotsAssetMaterializerJob,
  sessionRef: FateKnotsSessionRef
): Promise<ProviderImageArtifact> {
  if (typeof api.dispatchBridge !== "function") {
    throw new Error("Fate Knots image materializer SlotBridge is unavailable.");
  }

  const rawResult = await api.dispatchBridge({
    action: "message.sendWait",
    connectPolicy: "ensure",
    clientRequestId: `fate-knots-materializer:${job.jobId}`,
    timeoutMs: FATE_KNOTS_IMAGE_PROVIDER_TIMEOUT_MS,
    toSlot: "ai1",
    sessionRef,
    payload: {
      page: FATE_KNOTS_PAGE_ID,
      text: buildGenerationPrompt(job),
    },
  });
  if (!bridgeSucceeded(rawResult)) {
    throw new Error(readBridgeFailureMessage(rawResult));
  }

  const generatedImages = collectGeneratedImages(rawResult);
  if (generatedImages.length !== 1) {
    throw new Error(
      `Fate Knots image materializer expected exactly one archived generated image, received ${generatedImages.length}.`
    );
  }
  return generatedImages[0] as ProviderImageArtifact;
}

function loadImageFromBase64(base64: string, mimeType: string): Promise<LoadedImage> {
  if (typeof document === "undefined") {
    return Promise.reject(new Error("Fate Knots image crop browser primitives are unavailable."));
  }
  return new Promise((resolve, reject) => {
    const image = document.createElement("img");
    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      if (width <= 0 || height <= 0) {
        reject(new Error("Fate Knots generated image decoded with invalid dimensions."));
        return;
      }
      resolve({ element: image, width, height });
    };
    image.onerror = () => reject(new Error("Fate Knots generated image could not be decoded."));
    image.src = `data:${mimeType};base64,${base64}`;
  });
}

function cropImageToPngBase64(
  source: LoadedImage,
  crop: { x: number; y: number; width: number; height: number }
): string {
  if (typeof document === "undefined") {
    throw new Error("Fate Knots image crop browser primitives are unavailable.");
  }
  const sourceX = Math.max(0, Math.floor(crop.x * source.width));
  const sourceY = Math.max(0, Math.floor(crop.y * source.height));
  const sourceRight = Math.min(source.width, Math.ceil((crop.x + crop.width) * source.width));
  const sourceBottom = Math.min(source.height, Math.ceil((crop.y + crop.height) * source.height));
  const width = sourceRight - sourceX;
  const height = sourceBottom - sourceY;
  if (width <= 0 || height <= 0) {
    throw new Error("Fate Knots sheet crop resolved to an empty pixel region.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Fate Knots image crop canvas context is unavailable.");
  context.drawImage(source.element, sourceX, sourceY, width, height, 0, 0, width, height);
  const dataUrl = canvas.toDataURL(FATE_KNOTS_CROP_MIME_TYPE);
  const separatorIndex = dataUrl.indexOf(",");
  if (separatorIndex < 0) throw new Error("Fate Knots image crop did not produce PNG bytes.");
  const base64 = dataUrl.slice(separatorIndex + 1).trim();
  if (base64 === "") throw new Error("Fate Knots image crop produced empty PNG bytes.");
  return base64;
}

async function materializeSingle(
  job: Extract<FateKnotsAssetMaterializerJob, { kind: "single" }>,
  source: ProviderImageArtifact,
  sourceBase64: string
): Promise<FateKnotsMaterializedAsset> {
  const path = await writeFateKnotsManagedImageFile({
    jobId: job.jobId,
    fileId: job.plan.assetId,
    base64: sourceBase64,
    mimeType: source.mimeType,
  });
  return { assetId: job.plan.assetId, path, mimeType: source.mimeType };
}

async function materializeSheet(
  api: FateKnotsTransportApi,
  job: Extract<FateKnotsAssetMaterializerJob, { kind: "sheet" }>,
  source: ProviderImageArtifact,
  sourceBase64: string
) {
  const sourcePath = await writeFateKnotsManagedImageFile({
    jobId: job.jobId,
    fileId: job.sheet.sourceAssetId,
    base64: sourceBase64,
    mimeType: source.mimeType,
  });
  const decoded = await loadImageFromBase64(sourceBase64, source.mimeType);
  const assets: FateKnotsMaterializedAsset[] = [];

  for (const cell of job.sheet.cells) {
    const crop = getFateKnotsImageSheetCropRect(job.sheet, cell.slotId);
    if (!crop) {
      api.log("warn", `Fate Knots materializer skipped invalid sheet cell ${cell.slotId}.`);
      continue;
    }
    try {
      const base64 = cropImageToPngBase64(decoded, crop);
      // eslint-disable-next-line no-await-in-loop
      const path = await writeFateKnotsManagedImageFile({
        jobId: job.jobId,
        fileId: cell.outputAssetId,
        base64,
        mimeType: FATE_KNOTS_CROP_MIME_TYPE,
      });
      assets.push({
        assetId: cell.outputAssetId,
        path,
        mimeType: FATE_KNOTS_CROP_MIME_TYPE,
      });
    } catch (error) {
      api.log(
        "warn",
        `Fate Knots materializer failed sheet cell ${cell.slotId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return {
    assets,
    sourceArtifact: {
      jobId: job.jobId,
      path: sourcePath,
      mimeType: source.mimeType,
    },
  };
}

/**
 * Concrete World Forge materializer. Provider-specific image extraction remains
 * owned by SlotBridge/conversation sync; Fate Knots consumes only the archived
 * generated-image descriptor and promotes/crops real bytes into room storage.
 */
export function createFateKnotsProviderAssetMaterializer(
  api: FateKnotsTransportApi
): FateKnotsAssetMaterializerAdapter {
  return {
    async materialize(job) {
      const opened = await openFateKnotsAi1Session(api, `Fate Knots Art · ${job.jobId}`);
      if (!opened.ok) throw new Error(opened.message);

      const source = await requestProviderImage(api, job, opened.sessionRef);
      const sourceBase64 = await readFateKnotsLocalFileBase64(source.path);
      if (job.kind === "single") {
        return { assets: [await materializeSingle(job, source, sourceBase64)] };
      }
      return materializeSheet(api, job, source, sourceBase64);
    },
  };
}
