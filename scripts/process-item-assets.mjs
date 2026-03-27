#!/usr/bin/env node
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import { glob } from "glob";
import sharp from "sharp";
import { Jimp } from "jimp";
import { removeBackground } from "@imgly/background-removal-node";

const require = createRequire(import.meta.url);
const ENABLE_OPENCV = process.env.ASSET_ENABLE_OPENCV === "1";
let cv = null;
if (ENABLE_OPENCV) {
  process.env.OPENCV4NODEJS_DISABLE_AUTOBUILD = process.env.OPENCV4NODEJS_DISABLE_AUTOBUILD ?? "1";
  try {
    cv = require("@u4/opencv4nodejs");
  } catch {
    cv = null;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const RAW_ROOT = path.join(ROOT, "assets", "raw");
const BATCH_DIR = path.join(RAW_ROOT, "batch");
const DONE_DIR = path.join(RAW_ROOT, "done");
const METADATA_FILE = path.join(ROOT, "assets", "metadata", "items.json");

function logProgress(message) {
  const timestamp = new Date().toISOString().slice(11, 19);
  console.log(`[assets:process ${timestamp}] ${message}`);
}

function toSlug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.map((tag) => toSlug(tag)).filter(Boolean);
}

function sortBoxes(a, b) {
  if (Math.abs(a.y - b.y) > 16) return a.y - b.y;
  return a.x - b.x;
}

function detectBoxesWithOpenCv(imageBuffer) {
  if (!cv) return null;
  const mat = cv.imdecode(imageBuffer);
  const width = mat.cols;
  const height = mat.rows;
  const totalArea = Math.max(1, width * height);

  const gray =
    mat.channels === 4
      ? mat.cvtColor(cv.COLOR_BGRA2GRAY)
      : mat.channels === 3
        ? mat.cvtColor(cv.COLOR_BGR2GRAY)
        : mat;

  const blurred = gray.gaussianBlur(new cv.Size(5, 5), 0);
  const thresholded = blurred.threshold(0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
  const kernel = new cv.Mat(3, 3, cv.CV_8U, 1);
  const morphed = thresholded.morphologyEx(cv.MORPH_OPEN, kernel);
  const contours = morphed.findContours(cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  const boxes = contours
    .map((contour) => contour.boundingRect())
    .filter((rect) => rect.width > 8 && rect.height > 8 && (rect.width * rect.height) / totalArea > 0.001)
    .map((rect) => ({
      x: Math.max(0, rect.x),
      y: Math.max(0, rect.y),
      width: Math.min(width - rect.x, rect.width),
      height: Math.min(height - rect.y, rect.height),
    }))
    .sort(sortBoxes);

  if (boxes.length > 0) return boxes;
  return [{ x: 0, y: 0, width, height }];
}

async function detectBoxesFallback(imageBuffer, options = {}) {
  const alphaOnly = options.alphaOnly === true;
  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const totalArea = Math.max(1, width * height);
  const visited = new Uint8Array(width * height);
  const boxes = [];
  const queue = new Int32Array(width * height);

  const isForeground = (x, y) => {
    const idx = (y * width + x) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];
    if (alphaOnly) return a > 24;
    if (a <= 8) return false;
    return r < 245 || g < 245 || b < 245;
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x;
      if (visited[start] === 1 || !isForeground(x, y)) {
        visited[start] = 1;
        continue;
      }

      let head = 0;
      let tail = 0;
      queue[tail++] = start;
      visited[start] = 1;
      let minX = x;
      let minY = y;
      let maxX = x;
      let maxY = y;
      let pixels = 0;

      while (head < tail) {
        const pos = queue[head++];
        const px = pos % width;
        const py = Math.floor(pos / width);
        pixels += 1;

        if (px < minX) minX = px;
        if (py < minY) minY = py;
        if (px > maxX) maxX = px;
        if (py > maxY) maxY = py;

        for (let oy = -1; oy <= 1; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            if (ox === 0 && oy === 0) continue;
            const nx = px + ox;
            const ny = py + oy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const nextPos = ny * width + nx;
            if (visited[nextPos] === 1) continue;
            visited[nextPos] = 1;
            if (!isForeground(nx, ny)) continue;
            queue[tail++] = nextPos;
          }
        }
      }

      const boxWidth = maxX - minX + 1;
      const boxHeight = maxY - minY + 1;
      const areaRatio = (boxWidth * boxHeight) / totalArea;
      if (pixels >= 20 && boxWidth > 8 && boxHeight > 8 && areaRatio > 0.001) {
        boxes.push({ x: minX, y: minY, width: boxWidth, height: boxHeight });
      }
    }
  }

  boxes.sort(sortBoxes);
  if (boxes.length > 0) return boxes;
  return [{ x: 0, y: 0, width, height }];
}

async function detectBoxes(imageBuffer, options = {}) {
  const alphaOnly = options.alphaOnly === true;
  const openCvBoxes = alphaOnly ? null : detectBoxesWithOpenCv(imageBuffer);
  if (openCvBoxes && openCvBoxes.length > 0) return openCvBoxes;
  return detectBoxesFallback(imageBuffer, options);
}

async function toBuffer(result) {
  if (Buffer.isBuffer(result)) return result;
  if (result instanceof Uint8Array) return Buffer.from(result);
  if (result instanceof ArrayBuffer) return Buffer.from(result);
  if (typeof Blob !== "undefined" && result instanceof Blob) {
    return Buffer.from(await result.arrayBuffer());
  }
  throw new Error("Unsupported background removal output.");
}

async function removeBg(buffer) {
  try {
    const source = new Blob([buffer], { type: "image/png" });
    const output = await removeBackground(source, {
      output: { format: "image/png", quality: 1, type: "foreground" },
    });
    return { buffer: await toBuffer(output), removed: true };
  } catch {
    return { buffer: await sharp(buffer).ensureAlpha().png().toBuffer(), removed: false };
  }
}

async function trimWithAlpha(inputBuffer) {
  const image = await Jimp.read(inputBuffer);
  const { width, height, data } = image.bitmap;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];
      if (alpha > 8) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) return inputBuffer;
  return sharp(inputBuffer)
    .extract({
      left: minX,
      top: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    })
    .png()
    .toBuffer();
}

async function normalizeOutput(buffer, outputPath, target, outputFormat) {
  const width = Math.max(1, target.width);
  const height = Math.max(1, target.height);
  const padding = Math.max(0, target.padding ?? 0);
  const innerWidth = Math.max(1, width - padding * 2);
  const innerHeight = Math.max(1, height - padding * 2);

  let pipeline = sharp(buffer)
    .ensureAlpha()
    .resize(innerWidth, innerHeight, {
      fit: target.fit,
      position: "center",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });

  if (padding > 0) {
    pipeline = pipeline.extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }

  if (outputFormat === "png") {
    await pipeline.png().toFile(outputPath);
    return;
  }

  if (outputFormat === "jpg" || outputFormat === "jpeg") {
    await pipeline.flatten({ background: { r: 255, g: 255, b: 255 } }).jpeg({ quality: 95 }).toFile(outputPath);
    return;
  }

  await pipeline.webp({ quality: 95, alphaQuality: 100, effort: 6, smartSubsample: true }).toFile(outputPath);
}

function parseManifest(imagePath, manifestRaw) {
  if (!manifestRaw || typeof manifestRaw !== "object") {
    throw new Error(`Invalid JSON manifest near ${path.basename(imagePath)}.`);
  }

  const sourceFile = path.basename(imagePath);
  if (String(manifestRaw.source || "").trim() !== sourceFile) {
    throw new Error(`Manifest source mismatch for ${sourceFile}.`);
  }

  const outputDirRaw = String(manifestRaw.outputDir || "").trim();
  if (!outputDirRaw) {
    throw new Error(`Manifest outputDir missing for ${sourceFile}.`);
  }
  const outputDirAbs = path.resolve(ROOT, outputDirRaw);
  if (!outputDirAbs.startsWith(ROOT + path.sep)) {
    throw new Error(`Manifest outputDir must stay within project root for ${sourceFile}.`);
  }

  const targetCfg = manifestRaw.target || {};
  const target = {
    width: Number(targetCfg.width) || 512,
    height: Number(targetCfg.height) || 512,
    fit: String(targetCfg.fit || "contain"),
    padding: Number(targetCfg.padding) || 0,
  };

  const outputFormat = toSlug(manifestRaw.outputFormat || "webp") || "webp";
  const isCollection = Array.isArray(manifestRaw.items) && manifestRaw.items.length > 0;

  if (!isCollection) {
    const id = String(manifestRaw.id || "").trim();
    if (!id || !toSlug(id)) {
      throw new Error(`Manifest id missing for ${sourceFile}.`);
    }
    const name = String(manifestRaw.name || id).trim();
    const tags = normalizeTags(Array.isArray(manifestRaw.tags) ? manifestRaw.tags : String(id).split("_"));
    if (!toSlug(name)) {
      throw new Error(`Manifest name missing for ${sourceFile}.`);
    }
    if (tags.length === 0) {
      throw new Error(`Manifest tags missing for ${sourceFile}.`);
    }
    return {
      sourceFile,
      outputDirAbs,
      outputFormat,
      target,
      mode: "single",
      entry: { id, name, tags },
    };
  }

  const items = manifestRaw.items.map((item, i) => {
    const index = Number(item?.index);
    const id = String(item?.id || "").trim();
    const name = String(item?.name || "").trim();
    const tags = normalizeTags(item?.tags);

    if (!Number.isInteger(index) || index < 0) {
      throw new Error(`Invalid item.index at ${sourceFile} items[${i}].`);
    }
    if (!id) {
      throw new Error(`Invalid item.id at ${sourceFile} items[${i}].`);
    }
    if (!toSlug(id)) {
      throw new Error(`Invalid item.id at ${sourceFile} items[${i}].`);
    }
    if (!toSlug(name)) {
      throw new Error(`Invalid item.name at ${sourceFile} items[${i}].`);
    }
    if (tags.length === 0) {
      throw new Error(`Invalid item.tags at ${sourceFile} items[${i}].`);
    }

    return { index, id, name, tags };
  });

  const sorted = [...items].sort((a, b) => a.index - b.index);
  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i].index !== i) {
      throw new Error(`Manifest indexes must be contiguous from 0 for ${sourceFile}.`);
    }
  }

  return { sourceFile, outputDirAbs, outputFormat, target, mode: "collection", items: sorted };
}

function inferTypeFromId(id) {
  const firstToken = String(id).split("_")[0];
  return toSlug(firstToken) || "item";
}

async function archiveProcessedPair(imagePath, manifestPath) {
  const stem = path.basename(imagePath, path.extname(imagePath));
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archiveDir = path.join(DONE_DIR, `${stem}_${timestamp}`);
  await fs.ensureDir(archiveDir);

  await fs.move(imagePath, path.join(archiveDir, path.basename(imagePath)), { overwrite: false });
  await fs.move(manifestPath, path.join(archiveDir, path.basename(manifestPath)), { overwrite: false });
  return path.relative(ROOT, archiveDir).replace(/\\/g, "/");
}

async function processSource(imagePath, metadata, context, sourceIndex, totalSources) {
  const manifestPath = path.join(
    path.dirname(imagePath),
    `${path.basename(imagePath, path.extname(imagePath))}.json`
  );
  if (!(await fs.pathExists(manifestPath))) {
    throw new Error(`Missing required manifest for ${path.basename(imagePath)}.`);
  }

  logProgress(`Source ${sourceIndex}/${totalSources}: ${path.basename(imagePath)} started`);
  const manifest = parseManifest(imagePath, await fs.readJson(manifestPath));
  await fs.ensureDir(manifest.outputDirAbs);
  context.outputDirs.add(manifest.outputDirAbs);
  logProgress(
    `Source ${sourceIndex}/${totalSources}: manifest loaded -> ${path.relative(ROOT, manifest.outputDirAbs).replace(/\\/g, "/")}`
  );

  const imageBuffer = await fs.readFile(imagePath);
  if (manifest.mode === "single") {
    const extension = manifest.outputFormat === "jpeg" ? "jpg" : manifest.outputFormat;
    const fileName = `${toSlug(manifest.entry.name)}.${extension}`;
    const outputPath = path.join(manifest.outputDirAbs, fileName);
    const outputKey = path.normalize(outputPath);
    if (context.generatedFiles.has(outputKey)) {
      throw new Error(`Duplicate output file name detected: ${path.relative(ROOT, outputPath)}`);
    }
    context.generatedFiles.add(outputKey);

    logProgress(`Source ${sourceIndex}/${totalSources}: exporting single asset ${fileName}`);
    await normalizeOutput(imageBuffer, outputPath, manifest.target, manifest.outputFormat);
    metadata.push({
      id: manifest.entry.id,
      file: path.relative(ROOT, outputPath).replace(/\\/g, "/"),
      type: inferTypeFromId(manifest.entry.id),
      tags: manifest.entry.tags,
    });

    const archivedAt = await archiveProcessedPair(imagePath, manifestPath);
    context.archivedPairs.push(archivedAt);
    logProgress(`Source ${sourceIndex}/${totalSources}: archived -> ${archivedAt}`);
    return;
  }

  logProgress(`Source ${sourceIndex}/${totalSources}: removing background and detecting objects`);
  const fullRemoved = await removeBg(imageBuffer);
  let boxes = await detectBoxes(fullRemoved.buffer, { alphaOnly: true });
  if (boxes.length <= 1 && !fullRemoved.removed) {
    boxes = await detectBoxes(imageBuffer, { alphaOnly: false });
  }

  if (boxes.length !== manifest.items.length) {
    throw new Error(
      `Detected ${boxes.length} objects in ${manifest.sourceFile} but manifest declares ${manifest.items.length} items.`
    );
  }
  logProgress(`Source ${sourceIndex}/${totalSources}: detected ${boxes.length} objects`);

  for (let i = 0; i < boxes.length; i += 1) {
    const box = boxes[i];
    const item = manifest.items[i];
    const fileName = `${toSlug(item.name)}.webp`;
    const outputPath = path.join(manifest.outputDirAbs, fileName);
    const outputKey = path.normalize(outputPath);
    if (context.generatedFiles.has(outputKey)) {
      throw new Error(`Duplicate output file name detected: ${path.relative(ROOT, outputPath)}`);
    }
    context.generatedFiles.add(outputKey);
    logProgress(
      `Source ${sourceIndex}/${totalSources}: exporting ${i + 1}/${boxes.length} -> ${fileName}`
    );

    const sourceForCrop = fullRemoved.removed ? fullRemoved.buffer : imageBuffer;
    const cropped = await sharp(sourceForCrop)
      .extract({ left: box.x, top: box.y, width: box.width, height: box.height })
      .png()
      .toBuffer();

    const noBg = fullRemoved.removed ? { buffer: cropped } : await removeBg(cropped);
    const trimmed = await trimWithAlpha(noBg.buffer);
    await normalizeOutput(trimmed, outputPath, manifest.target, manifest.outputFormat);

    metadata.push({
      id: item.id,
      file: path.relative(ROOT, outputPath).replace(/\\/g, "/"),
      type: inferTypeFromId(item.id),
      tags: item.tags,
    });
  }

  const archivedAt = await archiveProcessedPair(imagePath, manifestPath);
  context.archivedPairs.push(archivedAt);
  logProgress(`Source ${sourceIndex}/${totalSources}: archived -> ${archivedAt}`);
}

async function main() {
  await fs.ensureDir(BATCH_DIR);
  await fs.ensureDir(DONE_DIR);
  await fs.ensureDir(path.dirname(METADATA_FILE));

  const imageFiles = await glob("**/*.{png,jpg,jpeg,webp,bmp,tif,tiff}", {
    cwd: BATCH_DIR,
    absolute: true,
    nodir: true,
  });
  imageFiles.sort((a, b) => a.localeCompare(b));

  const existingMetadata = (await fs.pathExists(METADATA_FILE))
    ? await fs.readJson(METADATA_FILE).catch(() => [])
    : [];
  const newEntries = [];
  const context = {
    outputDirs: new Set(),
    generatedFiles: new Set(),
    archivedPairs: [],
  };

  logProgress(`Batch started: ${imageFiles.length} source file(s) in queue`);

  for (let index = 0; index < imageFiles.length; index += 1) {
    const imagePath = imageFiles[index];
    await processSource(imagePath, newEntries, context, index + 1, imageFiles.length);
  }

  const newIds = new Set(newEntries.map((entry) => entry.id));
  const newFiles = new Set(newEntries.map((entry) => entry.file));
  const preservedEntries = Array.isArray(existingMetadata)
    ? existingMetadata.filter((entry) => {
        if (!entry || typeof entry.id !== "string" || typeof entry.file !== "string") return false;
        if (newIds.has(entry.id)) return false;
        if (newFiles.has(entry.file)) return false;
        return true;
      })
    : [];

  const metadata = [...preservedEntries, ...newEntries].sort((a, b) =>
    String(a.id).localeCompare(String(b.id))
  );
  await fs.writeJson(METADATA_FILE, metadata, { spaces: 2 });
  logProgress(`Batch finished: ${newEntries.length} asset(s) exported, metadata updated`);

  console.log(
    JSON.stringify(
      {
        processedFiles: imageFiles.length,
        exportedItems: newEntries.length,
        outputDirs: [...context.outputDirs].map((dir) => path.relative(ROOT, dir).replace(/\\/g, "/")),
        metadataFile: path.relative(ROOT, METADATA_FILE).replace(/\\/g, "/"),
        doneDir: path.relative(ROOT, DONE_DIR).replace(/\\/g, "/"),
        archivedPairs: context.archivedPairs,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(`[assets:process] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
