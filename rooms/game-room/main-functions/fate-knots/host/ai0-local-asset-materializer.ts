import { getFateKnotsImageSheetCropRect } from "../forge/image-sheet.js";
import type {
  FateKnotsAssetMaterializerAdapter,
  FateKnotsAssetMaterializerJob,
} from "../forge/materializer.js";
import type { FateKnotsMaterializedAsset } from "../forge/world-forge.js";
import { callFateKnotsAi0ImageRoomTool } from "./electron-bridge.js";
import { readFateKnotsLocalFileBase64, writeFateKnotsManagedImageFile } from "./storage-bridge.js";
import type { FateKnotsTransportApi } from "./transport.js";

const FATE_KNOTS_AI0_IMAGE_TIMEOUT_MS = 10 * 60_000;
const FATE_KNOTS_AI0_IMAGE_MIME_TYPE = "image/png";

type LoadedImage = {
  element: HTMLImageElement;
  width: number;
  height: number;
};

type Ai0ImageArtifact = {
  path: string;
  mimeType: "image/png";
};

function sourceAspectRatio(job: FateKnotsAssetMaterializerJob): string {
  return job.kind === "single"
    ? job.aspectRatio
    : `${job.sourceAspectRatio.width}:${job.sourceAspectRatio.height}`;
}

function loadImageFromBase64(base64: string, mimeType: string): Promise<LoadedImage> {
  if (typeof document === "undefined") {
    return Promise.reject(
      new Error("Fate Knots AI0 image crop browser primitives are unavailable.")
    );
  }
  return new Promise((resolvePromise, rejectPromise) => {
    const image = document.createElement("img");
    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      if (width <= 0 || height <= 0) {
        rejectPromise(new Error("Fate Knots AI0 generated image decoded with invalid dimensions."));
        return;
      }
      resolvePromise({ element: image, width, height });
    };
    image.onerror = () =>
      rejectPromise(new Error("Fate Knots AI0 generated image could not be decoded."));
    image.src = `data:${mimeType};base64,${base64}`;
  });
}

function cropImageToPngBase64(
  source: LoadedImage,
  crop: { x: number; y: number; width: number; height: number }
): string {
  if (typeof document === "undefined") {
    throw new Error("Fate Knots AI0 image crop browser primitives are unavailable.");
  }
  const sourceX = Math.max(0, Math.floor(crop.x * source.width));
  const sourceY = Math.max(0, Math.floor(crop.y * source.height));
  const sourceRight = Math.min(source.width, Math.ceil((crop.x + crop.width) * source.width));
  const sourceBottom = Math.min(source.height, Math.ceil((crop.y + crop.height) * source.height));
  const width = sourceRight - sourceX;
  const height = sourceBottom - sourceY;
  if (width <= 0 || height <= 0) {
    throw new Error("Fate Knots AI0 sheet crop resolved to an empty pixel region.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Fate Knots AI0 image crop canvas context is unavailable.");
  context.drawImage(source.element, sourceX, sourceY, width, height, 0, 0, width, height);
  const dataUrl = canvas.toDataURL(FATE_KNOTS_AI0_IMAGE_MIME_TYPE);
  const separatorIndex = dataUrl.indexOf(",");
  if (separatorIndex < 0) throw new Error("Fate Knots AI0 image crop did not produce PNG bytes.");
  const base64 = dataUrl.slice(separatorIndex + 1).trim();
  if (base64 === "") throw new Error("Fate Knots AI0 image crop produced empty PNG bytes.");
  return base64;
}

async function materializeSingle(
  job: Extract<FateKnotsAssetMaterializerJob, { kind: "single" }>,
  source: Ai0ImageArtifact,
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
  source: Ai0ImageArtifact,
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
      api.log("warn", `Fate Knots AI0 materializer skipped invalid sheet cell ${cell.slotId}.`);
      continue;
    }
    try {
      const base64 = cropImageToPngBase64(decoded, crop);
      // eslint-disable-next-line no-await-in-loop
      const path = await writeFateKnotsManagedImageFile({
        jobId: job.jobId,
        fileId: cell.outputAssetId,
        base64,
        mimeType: FATE_KNOTS_AI0_IMAGE_MIME_TYPE,
      });
      assets.push({
        assetId: cell.outputAssetId,
        path,
        mimeType: FATE_KNOTS_AI0_IMAGE_MIME_TYPE,
      });
    } catch (error) {
      api.log(
        "warn",
        `Fate Knots AI0 materializer failed sheet cell ${cell.slotId}: ${error instanceof Error ? error.message : String(error)}`
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

async function requestAi0Image(job: FateKnotsAssetMaterializerJob): Promise<Ai0ImageArtifact> {
  const result = await callFateKnotsAi0ImageRoomTool({
    operation: "ai0-image-generate",
    roomId: "game-room",
    requestId: `fate-knots-ai0-image:${job.jobId}`,
    jobId: job.jobId,
    prompt: job.prompt.trim(),
    sourceAspectRatio: sourceAspectRatio(job),
    timeoutMs: FATE_KNOTS_AI0_IMAGE_TIMEOUT_MS,
  });
  if (result.success !== true || !result.fateKnotsAi0Image) {
    throw new Error(result.error ?? "Fate Knots AI0 image worker returned no artifact.");
  }
  const source = result.fateKnotsAi0Image;
  if (source.path.trim() === "") {
    throw new Error("Fate Knots AI0 image worker returned an invalid PNG artifact descriptor.");
  }
  return { path: source.path, mimeType: source.mimeType };
}

/**
 * World Forge consumes the common Hayalet Ev AI0 image capability.
 * AI0 owns the user's OpenCode connection, model choice and verified PNG;
 * Fate Knots only manages its own artwork and crop/storage pipeline.
 */
export function createFateKnotsAi0LocalAssetMaterializer(
  api: FateKnotsTransportApi
): FateKnotsAssetMaterializerAdapter {
  return {
    async materialize(job) {
      const source = await requestAi0Image(job);
      const sourceBase64 = await readFateKnotsLocalFileBase64(source.path);
      if (job.kind === "single") {
        return { assets: [await materializeSingle(job, source, sourceBase64)] };
      }
      return await materializeSheet(api, job, source, sourceBase64);
    },
  };
}
