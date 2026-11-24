import assert from "node:assert/strict";
import test from "node:test";
import { deflateSync } from "node:zlib";
import {
  assertImagePlugin,
  imageSize,
  readImageToolResult,
} from "../../electron/ai0/native-image-service.ts";
import type { Ai0Engine } from "../../electron/ai0/opencode-process.ts";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";

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

void test("image size uses the installed plugin's supported dimensions", () => {
  assert.equal(imageSize("1:1"), "1254x1254");
  assert.equal(imageSize("3:2"), "1536x1024");
  assert.equal(imageSize("16:9"), "1672x941");
  assert.throws(() => imageSize("0:1"), /aspect/);
});
void test("plugin discovery only accepts the installed active image plugin", async () => {
  let active = true;
  const engine: Ai0Engine = {
    workspacePath: "/tmp/hev",
    port: 4151,
    stop: async () => {},
    request: async () => ({
      data: [
        { id: "opencode.config.image", state: { status: "active" } },
        { id: "opencode-gpt-imagegen", state: { status: active ? "active" : "inactive" } },
      ],
    }),
  };
  await assertImagePlugin(engine);
  active = false;
  await assert.rejects(assertImagePlugin(engine), /unavailable/);
});
void test("image tool output must be exactly one completed call and a validated owned PNG", async () => {
  const root = await mkdtemp("/tmp/hev-image-test-");
  try {
    const out = join(root, "asset.png");
    await writeFile(out, png());
    const part = {
      type: "tool",
      name: "gpt_imagegen",
      state: { status: "completed", input: { out }, metadata: { out, versioned: false } },
    };
    assert.deepEqual(await readImageToolResult([{ content: [part] }], root, out), png());
    await assert.rejects(
      readImageToolResult([{ content: [part, part] }], root, out),
      /exactly one/
    );
    await assert.rejects(
      readImageToolResult(
        [{ content: [{ ...part, state: { ...part.state, status: "error" } }] }],
        root,
        out
      ),
      /failed/
    );
    await assert.rejects(
      readImageToolResult(
        [
          {
            content: [
              {
                ...part,
                state: { ...part.state, metadata: { out: "/tmp/foreign.png", versioned: false } },
              },
            ],
          },
        ],
        root,
        out
      ),
      /unexpected output/
    );
    await writeFile(out, "fake");
    await assert.rejects(readImageToolResult([{ content: [part] }], root, out), /PNG/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
