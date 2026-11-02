import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { validatePng } from "./png-artifact.js";

const ENDPOINT = "https://chatgpt.com/backend-api/codex/images/generations";
const MAX_RESPONSE_BYTES = 96 * 1024 * 1024;
const OUTPUT_PATTERN =
  /^images\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/;
const SIZES = ["1024x1024", "1536x1024", "1024x1536"];

interface Registration {
  dispose: () => Promise<void>;
}
interface ToolContext {
  sessionID: string;
  signal: AbortSignal;
}
interface ImageTool {
  name: string;
  description: string;
  input: Record<string, unknown>;
  options: { codemode: false };
  execute: (
    input: unknown,
    context: ToolContext
  ) => Promise<{
    output: Record<string, unknown>;
    content: string;
  }>;
}
export interface NativeImagePluginContext {
  location: { directory: string };
  integration: {
    connection: {
      active: (id: string) => Promise<unknown>;
      resolve: (connection: unknown) => Promise<unknown>;
    };
  };
  session: {
    hook: (name: "model.request", callback: (event: unknown) => void) => Promise<Registration>;
  };
  tool: {
    transform: (
      callback: (editor: { add: (tool: ImageTool) => void }) => void
    ) => Promise<Registration>;
  };
  rpc: {
    register: (
      definition: Record<string, unknown>,
      methods: Record<string, (input: unknown) => Promise<unknown>>
    ) => Promise<Registration>;
  };
}
interface Grant {
  sessionId: string;
  path: string;
  prompt: string;
  size: string;
  responseModel: string;
  consumed: boolean;
  error?: string;
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function failure(code: string): Error {
  // Never attach provider bodies, credentials, headers or underlying connection errors.
  return new Error(`AI0 image generation: ${code}`);
}
async function resolveOAuth(ctx: NativeImagePluginContext): Promise<{ access: string }> {
  try {
    const connection = await ctx.integration.connection.active("openai");
    if (connection === undefined) throw failure("OPENAI_OAUTH_CONNECTION_REQUIRED");
    const credential = await ctx.integration.connection.resolve(connection);
    if (
      !record(credential) ||
      credential["type"] !== "oauth" ||
      typeof credential["access"] !== "string"
    )
      throw failure("OPENAI_OAUTH_CONNECTION_REQUIRED");
    return { access: credential["access"] };
  } catch {
    throw failure("OPENAI_OAUTH_CONNECTION_REQUIRED");
  }
}
export function codexAccountId(access: string): string {
  try {
    const claims: unknown = JSON.parse(
      Buffer.from(access.split(".")[1] ?? "", "base64url").toString("utf8")
    );
    const auth = record(claims) ? claims["https://api.openai.com/auth"] : undefined;
    const id = record(auth) ? auth["chatgpt_account_id"] : undefined;
    if (typeof id === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(id)) return id;
  } catch {}
  throw failure("INVALID_OAUTH_ACCOUNT");
}
// Native Codex Images endpoint: no chat dispatcher or Responses hosted-tool spec.
export function buildImageRequest(grant: Pick<Grant, "prompt" | "size">): Record<string, unknown> {
  return {
    prompt: grant.prompt,
    model: "gpt-image-2",
    n: 1,
    quality: "low",
    size: grant.size,
    background: "opaque",
  };
}
export function parseImageResponse(body: string): Buffer {
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    throw failure("INVALID_RESPONSE");
  }
  if (!record(value) || !Array.isArray(value["data"]) || value["data"].length !== 1)
    throw failure("NO_SINGLE_COMPLETED_IMAGE");
  const image: unknown = value["data"][0];
  const base64 = record(image) ? image["b64_json"] : null;
  if (typeof base64 !== "string" || base64.length === 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64))
    throw failure("INVALID_IMAGE_RESULT");
  const bytes = Buffer.from(base64, "base64");
  if (bytes.toString("base64") !== base64) throw failure("INVALID_IMAGE_RESULT");
  try {
    validatePng(bytes);
  } catch {
    throw failure("INVALID_PNG");
  }
  return bytes;
}
// Convert untrusted provider errors to finite diagnostic labels; never surface free-form messages.
const SAFE_ERROR_PARAMS: Record<string, string> = {
  model: "MODEL",
  tools: "TOOLS",
  "tools[0].type": "TOOL_TYPE",
  "tools[0].model": "IMAGE_MODEL",
  tool_choice: "TOOL_CHOICE",
  reasoning: "REASONING",
  text: "TEXT",
  input: "INPUT",
  size: "SIZE",
  output_format: "OUTPUT_FORMAT",
  output_compression: "OUTPUT_COMPRESSION",
  quality: "QUALITY",
  background: "BACKGROUND",
  parallel_tool_calls: "PARALLEL_TOOL_CALLS",
  stream: "STREAM",
  include: "INCLUDE",
};
const SAFE_ERROR_CODES: Record<string, string> = {
  invalid_request_error: "INVALID_REQUEST",
  invalid_request: "INVALID_REQUEST",
  invalid_value: "INVALID_VALUE",
  unsupported_value: "UNSUPPORTED_VALUE",
  unsupported_parameter: "UNSUPPORTED_PARAMETER",
  unknown_parameter: "UNKNOWN_PARAMETER",
  model_not_found: "MODEL_NOT_FOUND",
  unsupported_model: "UNSUPPORTED_MODEL",
  tool_not_supported: "TOOL_NOT_SUPPORTED",
  invalid_tool_choice: "INVALID_TOOL_CHOICE",
  insufficient_quota: "INSUFFICIENT_QUOTA",
  rate_limit_exceeded: "RATE_LIMIT",
  access_denied: "ACCESS_DENIED",
};
export function classifyCodexHttpError(status: number, body: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return `CODEX_HTTP_${status}`;
  }
  const nested = record(parsed) ? parsed["error"] : null;
  const error = record(nested) ? nested : record(parsed) ? parsed : null;
  if (!error) return `CODEX_HTTP_${status}`;
  const rawParam = error["param"];
  const rawCode = error["code"];
  const param =
    typeof rawParam === "string" &&
    Object.prototype.hasOwnProperty.call(SAFE_ERROR_PARAMS, rawParam)
      ? SAFE_ERROR_PARAMS[rawParam]
      : undefined;
  const code =
    typeof rawCode === "string" && Object.prototype.hasOwnProperty.call(SAFE_ERROR_CODES, rawCode)
      ? SAFE_ERROR_CODES[rawCode]
      : undefined;
  return `CODEX_HTTP_${status}${param ? `_PARAM_${param}` : ""}${code ? `_CODE_${code}` : ""}`;
}
async function boundedErrorBody(response: Response): Promise<string> {
  // A 400 response may include confidential details. Inspect at most 8 KiB in memory.
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < 8192) {
      // eslint-disable-next-line no-await-in-loop
      const part = await reader.read();
      if (part.done) break;
      const take = Math.min(part.value.byteLength, 8192 - total);
      chunks.push(part.value.subarray(0, take));
      total += take;
    }
    return Buffer.concat(chunks).toString("utf8");
  } catch {
    return "";
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}
async function boundedBody(response: Response): Promise<string> {
  if (!response.body) throw failure("EMPTY_RESPONSE");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      // eslint-disable-next-line no-await-in-loop
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_RESPONSE_BYTES) throw failure("RESPONSE_TOO_LARGE");
      chunks.push(chunk.value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}
async function outputPath(directory: string, selected: string): Promise<string> {
  if (!OUTPUT_PATTERN.test(selected)) throw failure("UNRESERVED_OUTPUT");
  const root = await realpath(directory);
  const parent = join(root, "images");
  const info = await lstat(parent);
  if (!info.isDirectory() || info.isSymbolicLink() || (await realpath(parent)) !== parent)
    throw failure("OUTPUT_DIRECTORY_ESCAPE");
  return join(root, selected);
}
export async function setupNativeImagePlugin(
  ctx: NativeImagePluginContext,
  request: typeof fetch = fetch
): Promise<() => Promise<void>> {
  const grants = new Map<string, Grant>();
  const registrations: Registration[] = [];
  registrations.push(
    await ctx.session.hook("model.request", (event) => {
      if (
        !record(event) ||
        !record(event["model"]) ||
        event["model"]["providerID"] !== "openai" ||
        event["baseURL"] !== "https://chatgpt.com/backend-api/codex"
      )
        throw failure("OAUTH_CODEX_ROUTE_REQUIRED");
    })
  );
  registrations.push(
    await ctx.rpc.register(
      {
        id: "hev.ai0.image",
        events: {},
        methods: {
          reserve: { input: { type: "object" }, output: { type: "object" } },
          release: { input: { type: "object" }, output: { type: "object" } },
          result: { input: { type: "object" }, output: { type: "object" } },
        },
      },
      {
        async reserve(input) {
          if (
            !record(input) ||
            typeof input["sessionId"] !== "string" ||
            typeof input["path"] !== "string" ||
            !OUTPUT_PATTERN.test(input["path"]) ||
            typeof input["prompt"] !== "string" ||
            input["prompt"].trim() === "" ||
            input["prompt"].length > 20_000 ||
            typeof input["size"] !== "string" ||
            !SIZES.includes(input["size"]) ||
            typeof input["responseModel"] !== "string" ||
            !/^gpt-[A-Za-z0-9.-]+$/.test(input["responseModel"]) ||
            grants.has(input["sessionId"])
          )
            throw failure("INVALID_RESERVATION");
          // Reject key-based dispatcher access before the host can submit a billable model prompt.
          await outputPath(ctx.location.directory, input["path"]);
          await resolveOAuth(ctx);
          if (grants.has(input["sessionId"])) throw failure("INVALID_RESERVATION");
          grants.set(input["sessionId"], {
            sessionId: input["sessionId"],
            path: input["path"],
            prompt: input["prompt"],
            size: input["size"],
            responseModel: input["responseModel"],
            consumed: false,
          });
          return { configured: true };
        },
        async release(input) {
          if (record(input) && typeof input["sessionId"] === "string")
            grants.delete(input["sessionId"]);
          return await Promise.resolve({ released: true });
        },
        async result(input) {
          const grant = record(input) ? grants.get(String(input["sessionId"])) : undefined;
          return await Promise.resolve({
            attempted: grant?.consumed === true,
            ...(grant?.error === undefined ? {} : { error: grant.error }),
          });
        },
      }
    )
  );
  registrations.push(
    await ctx.tool.transform((editor) => {
      editor.add({
        name: "image_generate",
        description:
          "Generate one real PNG using the active OpenAI ChatGPT/Codex OAuth connection. Only the host-reserved prompt and output_path are permitted. No reference files or API-key fallback.",
        input: {
          type: "object",
          properties: {
            prompt: { type: "string", minLength: 1, maxLength: 20_000 },
            output_path: { type: "string", pattern: OUTPUT_PATTERN.source },
          },
          required: ["prompt", "output_path"],
          additionalProperties: false,
        },
        options: { codemode: false },
        async execute(input, context) {
          const grant = grants.get(context.sessionID);
          if (
            !record(input) ||
            Object.keys(input).some((key) => !["prompt", "output_path"].includes(key)) ||
            !grant ||
            grant.consumed ||
            input["prompt"] !== grant.prompt ||
            input["output_path"] !== grant.path
          )
            throw failure("UNRESERVED_OR_REPEATED_REQUEST");
          grant.consumed = true;
          try {
            const savedPath = await outputPath(ctx.location.directory, grant.path);
            let credential: { access: string } | undefined = await resolveOAuth(ctx);
            const requestId = randomUUID();
            let response: Response;
            try {
              response = await request(ENDPOINT, {
                method: "POST",
                redirect: "error",
                signal: AbortSignal.any([context.signal, AbortSignal.timeout(540_000)]),
                headers: {
                  authorization: `Bearer ${credential["access"]}`,
                  "chatgpt-account-id": codexAccountId(credential["access"]),
                  originator: "opencode",
                  accept: "application/json",
                  "content-type": "application/json",
                  "x-codex-image-turn-id": requestId,
                  "x-client-request-id": requestId,
                },
                body: JSON.stringify(buildImageRequest(grant)),
              });
            } catch {
              throw failure("CODEX_REQUEST_FAILED");
            }
            // OAuth access and account identity never leave this invocation or enter tool results.
            credential = undefined;
            if (!response.ok) {
              const diagnostic = await boundedErrorBody(response);
              throw failure(classifyCodexHttpError(response.status, diagnostic));
            }
            const bytes = parseImageResponse(await boundedBody(response));
            const target = await outputPath(ctx.location.directory, grant.path);
            if (target !== savedPath) throw failure("OUTPUT_DIRECTORY_ESCAPE");
            const file = await open(
              target,
              constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
              0o600
            );
            try {
              await file.writeFile(bytes);
            } finally {
              await file.close();
            }
            return {
              output: {
                savedPath,
                mimeType: "image/png",
                responseModel: grant.responseModel,
                imageModel: "gpt-image-2",
                ...validatePng(bytes),
              },
              content: `Generated PNG saved to ${grant.path}`,
            };
          } catch (error) {
            const safe =
              error instanceof Error && /^AI0 image generation: [A-Z_0-9]+$/.test(error.message)
                ? error
                : failure("GENERATION_FAILED");
            grant.error = safe.message;
            throw safe;
          }
        },
      });
    })
  );
  return async () => {
    grants.clear();
    await Promise.all(
      registrations.map(async (registration) => {
        await registration.dispose();
      })
    );
  };
}

export default { id: "hev.ai0.image", setup: setupNativeImagePlugin };
