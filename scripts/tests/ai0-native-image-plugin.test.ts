import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { randomUUID } from "node:crypto";
import {
  setupNativeImagePlugin,
  parseImageResponse,
  buildImageRequest,
  classifyCodexHttpError,
} from "../../electron/ai0/native-image-plugin.ts";
import type { NativeImagePluginContext } from "../../electron/ai0/native-image-plugin.ts";

function png(): Buffer {
  const chunk = (name: string, bytes: Buffer): Buffer => {
    const data = Buffer.concat([Buffer.from(name), bytes]);
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) === 1 ? 0xedb88320 : 0);
    }
    const out = Buffer.alloc(bytes.length + 12);
    out.writeUInt32BE(bytes.length);
    data.copy(out, 4);
    out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, out.length - 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1);
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
function imageResponse(bytes = png()): string {
  return JSON.stringify({
    created: 1,
    data: [{ b64_json: bytes.toString("base64") }],
    quality: "low",
    size: "1024x1024",
  });
}
async function fixture(
  behavior: "ok" | "denied" | "bad-request" | "transport" | "api-key" | "resolve-error" = "ok"
) {
  const root = await mkdtemp(join(tmpdir(), "hev-native-image-"));
  await mkdir(join(root, "images"));
  const sentinel = "SYNTHETIC_SECRET_NEVER_LOG";
  const token = `header.${Buffer.from(JSON.stringify({ "https://api.openai.com/auth": { chatgpt_account_id: "test-account" } })).toString("base64url")}.${sentinel}`;
  let resolveCount = 0;
  let requests = 0;
  let registrations = 0;
  let disposed = 0;
  let tool: Parameters<Parameters<NativeImagePluginContext["tool"]["transform"]>[0]>[0] extends {
    add: (info: infer Info) => void;
  }
    ? Info | undefined
    : never;
  let rpc: Record<string, (input: unknown) => Promise<unknown>> = {};
  let modelGuard: (event: unknown) => void = () => {};
  const registration = () => {
    registrations += 1;
    return {
      dispose: async () => {
        disposed += 1;
      },
    };
  };
  const ctx: NativeImagePluginContext = {
    location: { directory: root },
    integration: {
      connection: {
        active: async (id) => {
          assert.equal(id, "openai");
          return { type: "credential", id: "test" };
        },
        resolve: async () => {
          resolveCount += 1;
          if (behavior === "resolve-error") throw new Error(sentinel);
          return behavior === "api-key"
            ? { type: "key", key: sentinel }
            : { type: "oauth", access: token };
        },
      },
    },
    session: {
      hook: async (name, callback) => {
        assert.equal(name, "model.request");
        modelGuard = callback;
        return registration();
      },
    },
    tool: {
      transform: async (callback) => {
        callback({
          add: (info) => {
            tool = info;
          },
        });
        return registration();
      },
    },
    rpc: {
      register: async (definition, methods) => {
        assert.equal(definition["id"], "hev.ai0.image");
        rpc = methods;
        return registration();
      },
    },
  };
  const request: typeof fetch = async (url, options) => {
    requests += 1;
    assert.equal(String(url), "https://chatgpt.com/backend-api/codex/images/generations");
    assert.equal(new Headers(options?.headers).get("accept"), "application/json");
    assert.ok(new Headers(options?.headers).get("x-codex-image-turn-id"));
    assert.equal(options?.redirect, "error");
    const body: unknown = JSON.parse(String(options?.body));
    assert.ok(typeof body === "object" && body !== null);
    assert.doesNotMatch(String(options?.body), /referencePaths|input_image|SYNTHETIC_SECRET/);
    if (behavior === "transport") throw new Error(sentinel);
    if (behavior === "bad-request")
      return new Response(
        JSON.stringify({
          error: {
            param: "tools[0].type",
            code: "unsupported_value",
            message: sentinel,
          },
        }),
        { status: 400 }
      );
    return behavior === "denied"
      ? new Response(sentinel, { status: 403 })
      : new Response(imageResponse());
  };
  const cleanupPlugin = await setupNativeImagePlugin(ctx, request);
  assert.ok(tool);
  const grant = {
    sessionId: "session",
    path: `images/${randomUUID()}.png`,
    prompt: "blue ghost",
    size: "1024x1024",
    responseModel: "gpt-5.5",
  };
  const reserve = async (input: unknown = grant) => await rpc["reserve"]?.(input);
  const execute = async (
    input: unknown = { prompt: grant.prompt, output_path: grant.path },
    sessionID = "session"
  ) => await tool?.execute(input, { sessionID, signal: new AbortController().signal });
  return {
    root,
    sentinel,
    tool,
    grant,
    rpc,
    reserve,
    execute,
    guard: (event: unknown) => modelGuard(event),
    counts: () => ({ requests, resolveCount, registrations, disposed }),
    cleanup: async () => {
      await cleanupPlugin();
      await rm(root, { recursive: true, force: true });
    },
  };
}

void test("native lifecycle registers image_generate without SDK/Effect dependencies and disposes all registrations", async () => {
  const f = await fixture();
  assert.equal(f.tool.name, "image_generate");
  assert.deepEqual(f.tool.input["required"], ["prompt", "output_path"]);
  assert.equal(f.tool.input["additionalProperties"], false);
  assert.deepEqual(f.counts(), { requests: 0, resolveCount: 0, registrations: 3, disposed: 0 });
  assert.throws(
    () => f.guard({ model: { providerID: "openai" }, baseURL: "https://api.openai.com/v1" }),
    /OAUTH_CODEX_ROUTE_REQUIRED/
  );
  assert.throws(
    () =>
      f.guard({ model: { providerID: "other" }, baseURL: "https://chatgpt.com/backend-api/codex" }),
    /OAUTH_CODEX_ROUTE_REQUIRED/
  );
  f.guard({ model: { providerID: "openai" }, baseURL: "https://chatgpt.com/backend-api/codex" });
  await f.cleanup();
  assert.equal(f.counts().disposed, 3);
});
void test("only the exact host reservation can execute, and neither references nor a second attempt can reach OAuth or the provider", async () => {
  const f = await fixture();
  try {
    await assert.rejects(f.execute(), /UNRESERVED/);
    await f.reserve();
    await assert.rejects(f.reserve(), /INVALID_RESERVATION/);
    for (const input of [
      { prompt: "changed", output_path: f.grant.path },
      { prompt: f.grant.prompt, output_path: "../escape.png" },
      { prompt: f.grant.prompt, output_path: f.grant.path, referencePaths: ["/secret"] },
      { prompt: f.grant.prompt, output_path: f.grant.path, outputFormat: "jpeg" },
    ])
      await assert.rejects(f.execute(input), /UNRESERVED/);
    await assert.rejects(f.execute(undefined, "other-session"), /UNRESERVED/);
    assert.equal(f.counts().resolveCount, 1);
    const result = await f.execute();
    assert.equal(result?.output["mimeType"], "image/png");
    assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC_SECRET|test-account/);
    assert.deepEqual(await readFile(join(f.root, f.grant.path)), png());
    await assert.rejects(f.execute(), /REPEATED/);
    assert.equal(f.counts().requests, 1);
  } finally {
    await f.cleanup();
  }
});
void test("authorization denial and connection/transport failures are sanitized and cannot trigger credential fallback or retries", async () => {
  for (const behavior of [
    "denied",
    "bad-request",
    "transport",
    "api-key",
    "resolve-error",
  ] as const) {
    const f = await fixture(behavior);
    try {
      if (behavior === "api-key" || behavior === "resolve-error") {
        await assert.rejects(f.reserve(), /OAUTH_CONNECTION_REQUIRED/);
        assert.equal(f.counts().requests, 0);
        await assert.rejects(f.execute(), /UNRESERVED/);
        continue;
      }
      await f.reserve();
      await assert.rejects(f.execute(), (error) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message.includes(f.sentinel), false);
        assert.equal((error as Error & { cause?: unknown }).cause, undefined);
        assert.match(
          error.message,
          behavior === "denied"
            ? /CODEX_HTTP_403/
            : behavior === "bad-request"
              ? /CODEX_HTTP_400_PARAM_TOOL_TYPE_CODE_UNSUPPORTED_VALUE/
              : behavior === "transport"
                ? /CODEX_REQUEST_FAILED/
                : /OAUTH_CONNECTION_REQUIRED/
        );
        return true;
      });
      await assert.rejects(f.execute(), /REPEATED/);
      assert.equal(f.counts().requests, 1);
      const result = await f.rpc["result"]?.({ sessionId: "session" });
      assert.equal(JSON.stringify(result).includes(f.sentinel), false);
      await assert.rejects(readFile(join(f.root, f.grant.path)), /ENOENT/);
    } finally {
      await f.cleanup();
    }
  }
});
void test("symlinked output directories fail before OAuth resolution or a billable request", async () => {
  const f = await fixture();
  const outside = await mkdtemp(join(tmpdir(), "hev-image-outside-"));
  try {
    await rm(join(f.root, "images"), { recursive: true });
    await symlink(outside, join(f.root, "images"));
    await assert.rejects(f.reserve(), /OUTPUT_DIRECTORY_ESCAPE/);
    assert.equal(f.counts().requests, 0);
    assert.equal(f.counts().resolveCount, 0);
  } finally {
    await f.cleanup();
    await rm(outside, { recursive: true, force: true });
  }
});
void test("native Images response requires one valid PNG and no free-form provider error bodies", () => {
  assert.deepEqual(parseImageResponse(imageResponse()), png());
  assert.throws(() => parseImageResponse('{"created":1}'), /NO_SINGLE/);
  assert.throws(
    () =>
      parseImageResponse(
        JSON.stringify({
          data: [{ b64_json: png().toString("base64") }, { b64_json: png().toString("base64") }],
        })
      ),
    /NO_SINGLE/
  );
  assert.throws(() => parseImageResponse(imageResponse(Buffer.from("not PNG"))), /INVALID_PNG/);
  assert.throws(
    () => parseImageResponse(JSON.stringify({ error: { message: "SYNTHETIC_SECRET_NEVER_LOG" } })),
    /NO_SINGLE/
  );
  assert.throws(() => parseImageResponse("SECRET"), /INVALID_RESPONSE/);
  const body = buildImageRequest({ prompt: "ghost", size: "1024x1024" });
  assert.deepEqual(body, {
    prompt: "ghost",
    model: "gpt-image-2",
    n: 1,
    quality: "low",
    size: "1024x1024",
    background: "opaque",
  });
  assert.equal(JSON.stringify(body).includes("gpt-5.5"), false);
});

void test("400 diagnostics expose only finite error param/code labels and never response details", () => {
  const secret = "PRIVATE_OAUTH_TOKEN_AND_USER_INPUT";
  assert.equal(
    classifyCodexHttpError(
      400,
      JSON.stringify({
        error: { param: "tools[0].type", code: "unsupported_value", message: secret },
      })
    ),
    "CODEX_HTTP_400_PARAM_TOOL_TYPE_CODE_UNSUPPORTED_VALUE"
  );
  assert.equal(
    classifyCodexHttpError(
      400,
      JSON.stringify({ error: { param: secret, code: secret, message: secret } })
    ),
    "CODEX_HTTP_400"
  );
  assert.equal(classifyCodexHttpError(400, secret), "CODEX_HTTP_400");
  assert.equal(
    classifyCodexHttpError(
      400,
      JSON.stringify({ error: { param: "__proto__", code: "toString" } })
    ),
    "CODEX_HTTP_400"
  );
  assert.equal(
    classifyCodexHttpError(403, '{"error": {"code": "access_denied"}}'),
    "CODEX_HTTP_403_CODE_ACCESS_DENIED"
  );
});
