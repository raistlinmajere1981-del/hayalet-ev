import { nativeImage } from "electron";
import { bitmapLayout, type DecodeRaster } from "./images.ts";

const previewEdge = 1800;

function bitmapPreview(bytes: Buffer) {
  const { offset, width, height, channels, stride, topDown } = bitmapLayout(bytes);
  const ratio = Math.min(1, previewEdge / Math.max(width, height));
  const w = Math.max(1, Math.round(width * ratio));
  const h = Math.max(1, Math.round(height * ratio));
  const rgba = Buffer.allocUnsafe(w * h * 4);
  for (let y = 0; y < h; y++) {
    const row = Math.floor((y * height) / h);
    const source = offset + (topDown ? row : height - 1 - row) * stride;
    for (let x = 0; x < w; x++) {
      const index = source + Math.floor((x * width) / w) * channels;
      const destination = (y * w + x) * 4;
      bytes.copy(rgba, destination, index, index + 3);
      rgba[destination + 3] = 255;
    }
  }
  return nativeImage.createFromBitmap(rgba, { width: w, height: h });
}

export const decodeRaster: DecodeRaster = (bytes, { mime, pixels: [width, height] }, preview) => {
  if (mime === "image/bmp") {
    if (preview)
      return { mime: "image/png", image: bitmapPreview(bytes).toPNG().toString("base64") };
    return undefined;
  }
  const decoded = nativeImage.createFromBuffer(bytes);
  const size = decoded.getSize();
  if (size.width !== width || size.height !== height)
    throw new Error("Invalid Gaia reference image data");
  if (preview) {
    const image =
      Math.max(width, height) <= previewEdge
        ? decoded
        : decoded.resize(width >= height ? { width: previewEdge } : { height: previewEdge });
    const data = mime === "image/png" ? image.toPNG() : image.toJPEG(86);
    if (!data.length) throw new Error("Gaia reference preview is unavailable");
    return { mime, image: data.toString("base64") };
  }
  return undefined;
};
