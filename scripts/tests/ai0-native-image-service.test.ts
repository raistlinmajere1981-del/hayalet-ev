import assert from "node:assert/strict";
import test from "node:test";
import { deflateSync } from "node:zlib";
import {
  decodeNativeImageResult,
  generateNativeImage,
  hasNativeImageCapability,
  NATIVE_IMAGE_ROUTE,
} from "../../electron/ai0/native-image-service.ts";
import type { Ai0Engine } from "../../electron/ai0/opencode-process.ts";

function png(): Buffer {
  const chunk = (name: string, bytes: Buffer): Buffer => {
    const data = Buffer.concat([Buffer.from(name), bytes]);
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) === 1 ? 0xedb88320 : 0);
    }
    const out = Buffer.alloc(bytes.length + 12);
    out.writeUInt32BE(bytes.length, 0);
    data.copy(out, 4);
    out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, out.length - 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.from([0, 0, 0, 255, 255]))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

void test("native image transport uses the user's OpenCode image API without dispatcher or custom OAuth", async () => {
  const bytes = png();
  const calls: Array<{ method: string; path: string; body: unknown; timeout: unknown }> = [];
  const engine: Ai0Engine = {
    workspacePath: "/tmp/hev-native-images",
    port: 4151,
    stop: async () => {},
    request: async (method, path, body, timeout) => {
      calls.push({ method, path, body, timeout });
      if (method === "GET")
        return { data: [{ id: "opencode.config.image", state: { status: "active" } }] };
      return {
        data: { images: [{ type: "image", mime: "image/png", data: bytes.toString("base64") }] },
      };
    },
  };
  assert.equal(await hasNativeImageCapability(engine), true);
  const result = await generateNativeImage(
    engine,
    { providerID: "openai", id: "gpt-image-2" },
    "glowing blue dragon",
    "3:2",
    10_000
  );
  assert.deepEqual(result, bytes);
  assert.equal(calls[1]?.path, NATIVE_IMAGE_ROUTE);
  assert.equal(calls[1]?.method, "POST");
  assert.deepEqual(calls[1]?.body, {
    model: { providerID: "openai", id: "gpt-image-2" },
    prompt: "glowing blue dragon",
    n: 1,
    aspect: "3:2",
    resolution: "1K",
  });
  assert.equal(calls[1]?.timeout, 10_000);
});

void test("native image output rejects missing, unsafe, and unverified files", () => {
  const bytes = png();
  const ok = (data: string): unknown => ({
    data: { images: [{ type: "image", mime: "image/png", data }] },
  });
  assert.deepEqual(decodeNativeImageResult(ok(bytes.toString("base64"))), bytes);
  assert.throws(() => decodeNativeImageResult({ data: { images: [] } }), /exactly one/);
  assert.throws(() => decodeNativeImageResult(ok("not-base64!")), /invalid base64/);
  assert.throws(() => decodeNativeImageResult(ok(Buffer.from("fake").toString("base64"))), /PNG/);
  assert.throws(
    () =>
      decodeNativeImageResult({
        data: { images: [{ type: "image", mime: "image/webp", data: bytes.toString("base64") }] },
      }),
    /PNG/
  );
});

void test("a missing or inactive native image plugin never claims readiness", async () => {
  const engine: Ai0Engine = {
    workspacePath: "/tmp/hev-native-images",
    port: 4151,
    stop: async () => {},
    request: async () => ({
      data: [{ id: "opencode.config.image", state: { status: "inactive" } }],
    }),
  };
  assert.equal(await hasNativeImageCapability(engine), false);
});
