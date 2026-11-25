import { createHash } from "node:crypto";
import { crc32 } from "node:zlib";
import { join } from "node:path";
import {
  imageMimes,
  maxImageBytes,
  maxImagePixels,
  maxImagePayload,
  type ReferencePreview,
} from "./reference-contract.ts";
import type { ReferenceAsset, V2, World } from "../spatial/world.ts";
import { segment } from "./batch.ts";
import { directory, hasCode, readRegular } from "./files.ts";

export interface Raster extends ReferenceAsset {
  mime: (typeof imageMimes)[number];
  pixels: V2;
}
export type DecodeRaster = (
  bytes: Buffer,
  raster: Raster,
  preview: boolean
) => ReferencePreview | undefined;

class InvalidImage extends Error {
  constructor() {
    super("Invalid or unsupported Gaia reference image");
  }
}

const pngHeader = "89504e470d0a1a0a";
const jpegFrames = new Set([0xc0, 0xc1, 0xc2]);

function pngPixels(bytes: Buffer): V2 {
  if (
    bytes.length < 45 ||
    bytes.readUInt32BE(8) !== 13 ||
    bytes.toString("ascii", 12, 16) !== "IHDR"
  )
    throw new InvalidImage();
  let offset = 8;
  let data = false;
  while (offset + 12 <= bytes.length) {
    const size = bytes.readUInt32BE(offset);
    const end = offset + size + 12;
    if (
      end > bytes.length ||
      crc32(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4)
    )
      throw new InvalidImage();
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT") data = true;
    if (type === "IEND" && size === 0 && data && end === bytes.length)
      return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
    offset = end;
  }
  throw new InvalidImage();
}

function jpegPixels(bytes: Buffer): V2 {
  if (bytes.length < 12 || bytes.readUInt16BE(bytes.length - 2) !== 0xffd9)
    throw new InvalidImage();
  let pixels: V2 | undefined;
  let offset = 2;
  while (offset + 4 <= bytes.length && bytes[offset++] === 0xff) {
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (offset + 2 > bytes.length || marker === undefined) break;
    const size = bytes.readUInt16BE(offset);
    const end = offset + size;
    if (size < 2 || end > bytes.length) break;
    if (jpegFrames.has(marker) && size >= 8)
      pixels = [bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3)];
    if (marker === 0xda && pixels && end < bytes.length - 2) return pixels;
    offset = end;
  }
  throw new InvalidImage();
}

export function bitmapLayout(bytes: Buffer) {
  if (bytes.length < 54 || bytes.readUInt32LE(2) !== bytes.length) throw new InvalidImage();
  const offset = bytes.readUInt32LE(10);
  const header = bytes.readUInt32LE(14);
  const width = bytes.readInt32LE(18);
  const signedHeight = bytes.readInt32LE(22);
  const height = Math.abs(signedHeight);
  const channels = bytes.readUInt16LE(28) / 8;
  const stride = Math.ceil((width * channels) / 4) * 4;
  if (
    ![40, 52, 56, 108, 124].includes(header) ||
    offset < 14 + header ||
    width <= 0 ||
    height <= 0 ||
    bytes.readUInt16LE(26) !== 1 ||
    ![3, 4].includes(channels) ||
    bytes.readUInt32LE(30) !== 0 ||
    offset + height * stride > bytes.length
  )
    throw new InvalidImage();
  return { offset, width, height, channels, stride, topDown: signedHeight < 0 };
}

export function inspectRaster(bytes: Buffer): Raster {
  if (bytes.length > maxImageBytes) throw new InvalidImage();
  let mime: Raster["mime"];
  let pixels: V2;
  if (bytes.subarray(0, 8).toString("hex") === pngHeader) {
    mime = "image/png";
    pixels = pngPixels(bytes);
  } else if (bytes.subarray(0, 2).toString("hex") === "ffd8") {
    mime = "image/jpeg";
    pixels = jpegPixels(bytes);
  } else if (bytes.subarray(0, 2).toString("ascii") === "BM") {
    mime = "image/bmp";
    const { width, height } = bitmapLayout(bytes);
    pixels = [width, height];
  } else throw new InvalidImage();

  if (pixels.some((n) => n <= 0 || n > 32768) || pixels[0] * pixels[1] > maxImagePixels)
    throw new InvalidImage();
  return { mime, pixels };
}

export const imageDigest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

export function uploadBytes(image: string): Buffer {
  if (image.length > maxImagePayload) throw new InvalidImage();
  const bytes = Buffer.from(image, "base64");
  if (!bytes.length || bytes.length > maxImageBytes || bytes.toString("base64") !== image)
    throw new InvalidImage();
  return bytes;
}

function storedRaster(asset: ReferenceAsset): Raster {
  const { mime, sha256 } = asset;
  const pixels: unknown = asset.pixels;
  if (
    !imageMimes.some((type) => type === mime) ||
    !Array.isArray(pixels) ||
    pixels.length !== 2 ||
    !pixels.every((n) => Number.isSafeInteger(n) && n > 0) ||
    (sha256 !== undefined && (typeof sha256 !== "string" || !/^[a-f0-9]{64}$/.test(sha256)))
  )
    throw new Error("Invalid Gaia reference metadata");
  return asset as Raster;
}

export async function readAsset(dir: string, id: string, asset: ReferenceAsset) {
  segment(id);
  const raster = storedRaster(asset);
  const bytes = await readRegular(join(await directory(dir, "assets", false), id), maxImageBytes);
  if (raster.sha256 && imageDigest(bytes) !== raster.sha256) throw new InvalidImage();
  const actual = inspectRaster(bytes);
  if (actual.mime !== raster.mime || actual.pixels.some((n, i) => n !== raster.pixels[i]))
    throw new InvalidImage();
  return { bytes, raster };
}

export async function assetIssues(dir: string, world: World) {
  const missing: string[] = [];
  const damaged: string[] = [];
  for (const [id, asset] of Object.entries(world.assets)) {
    try {
      // eslint-disable-next-line no-await-in-loop -- Bound peak memory while checking original assets.
      await readAsset(dir, id, asset);
    } catch (error) {
      if (hasCode(error, "ENOENT")) missing.push(id);
      else if (error instanceof InvalidImage || hasCode(error, "ERR_GAIA_FILE_SIZE"))
        damaged.push(id);
      else throw error;
    }
  }
  return { missing, damaged };
}
