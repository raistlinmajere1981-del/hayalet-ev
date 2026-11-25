import { crc32, deflateSync } from "node:zlib";

function chunk(name: string, bytes: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(name), bytes]);
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}

export function gridPng(): Buffer {
  const width = 400;
  const height = 600;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;

  const stride = width * 3 + 1;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = y * stride + 1 + x * 3;
      const shade = x % 10 === 0 || y % 10 === 0 ? 210 : 255;
      const color =
        Math.abs(y - 30) <= 2 && Math.abs(x - 20) <= 2
          ? [210, 40, 58]
          : Math.abs(y - 30) <= 2 && Math.abs(x - 120) <= 2
            ? [40, 96, 210]
            : [shade, shade, shade];
      pixels.set(color, offset);
    }
  }

  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
