import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import { isAbsolute, relative } from "node:path";
import { inflateSync } from "node:zlib";

const MAX_PNG_BYTES = 64 * 1024 * 1024;
function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) === 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function validatePng(bytes: Buffer): { width: number; height: number; sha256: string } {
  if (
    bytes.length > MAX_PNG_BYTES ||
    !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    throw new Error("Artifact is not a PNG");
  let offset = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let channels = 0;
  let ended = false;
  const idat: Buffer[] = [];
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) throw new Error("Truncated PNG chunk");
    const name = bytes.toString("ascii", offset + 4, offset + 8);
    if (
      !/^[A-Za-z]{4}$/.test(name) ||
      (!/[a-z]/.test(name[0] ?? "") && !["IHDR", "PLTE", "IDAT", "IEND"].includes(name))
    )
      throw new Error("Unsupported critical PNG chunk");
    if (crc32(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4))
      throw new Error("PNG checksum failed");
    const data = bytes.subarray(offset + 8, end - 4);
    if (offset === 8 && name !== "IHDR") throw new Error("PNG is missing IHDR");
    if (name === "IHDR") {
      if (length !== 13 || width !== 0) throw new Error("Invalid PNG header");
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8] ?? 0;
      const color = data[9] ?? -1;
      channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[color] ?? 0;
      const validDepths = color === 0 ? [1, 2, 4, 8, 16] : color === 3 ? [1, 2, 4, 8] : [8, 16];
      if (
        width === 0 ||
        height === 0 ||
        channels === 0 ||
        color === 3 ||
        !validDepths.includes(depth) ||
        data[10] !== 0 ||
        data[11] !== 0 ||
        data[12] !== 0
      )
        throw new Error("Unsupported or invalid PNG dimensions/encoding");
    } else if (name === "IDAT") idat.push(data);
    else if (name === "IEND") {
      if (length !== 0 || end !== bytes.length) throw new Error("Invalid PNG ending");
      ended = true;
      break;
    }
    offset = end;
  }
  if (!ended || idat.length === 0) throw new Error("PNG is incomplete");
  const rowBytes = Math.ceil((width * channels * depth) / 8);
  const expected = (rowBytes + 1) * height;
  if (!Number.isSafeInteger(expected) || expected > MAX_PNG_BYTES)
    throw new Error("PNG exceeds the decoded image budget");
  const decoded = inflateSync(Buffer.concat(idat), { maxOutputLength: MAX_PNG_BYTES });
  if (decoded.length !== expected) throw new Error("Invalid PNG pixel payload");
  for (let row = 0; row < height; row += 1)
    if ((decoded[row * (rowBytes + 1)] ?? 255) > 4) throw new Error("Invalid PNG scanline filter");
  return { width, height, sha256: createHash("sha256").update(bytes).digest("hex") };
}
export async function verifyPngArtifact(
  root: string,
  path: string
): Promise<{ path: string; bytes: number; width: number; height: number; sha256: string }> {
  const rootPath = await realpath(root);
  const filePath = await realpath(path);
  const distance = relative(rootPath, filePath);
  if (distance === "" || distance.startsWith("..") || isAbsolute(distance))
    throw new Error("Image escaped its runtime workspace");
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size === 0 || info.size > MAX_PNG_BYTES)
    throw new Error("Image must be a bounded regular PNG file");
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > MAX_PNG_BYTES) throw new Error("Invalid image file");
    const bytes = await file.readFile();
    return { path: filePath, bytes: bytes.length, ...validatePng(bytes) };
  } finally {
    await file.close();
  }
}
