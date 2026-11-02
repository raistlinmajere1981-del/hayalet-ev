import type { ChildProcess } from "node:child_process";
import { spawn, execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile, realpath, copyFile } from "node:fs/promises";
import { join, relative, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { AI0_BOUNDARY_PLUGIN } from "./boundary-plugin.js";
import { opencodeServerManager } from "../opencode-server-manager.ts";
import { Paths } from "../paths.ts";
import type { Ai0Model } from "../../shared/ai0-runtime.js";

export interface Ai0SessionProbe {
  sessionId: string;
  model: Ai0Model;
  tools: Record<string, { input: { properties?: Record<string, unknown> } }>;
}
export interface Ai0Engine {
  workspacePath: string;
  port: number;
  request: (method: string, path: string, body?: unknown, timeoutMs?: number) => Promise<unknown>;
  rpc: (method: string, input: unknown) => Promise<unknown>;
  stop: () => Promise<void>;
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function unwrap(value: unknown): unknown {
  return isRecord(value) ? value["data"] : undefined;
}

export function buildAi0Environment(
  parent: NodeJS.ProcessEnv,
  root: string,
  config: unknown,
  password: string
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...parent };
  for (const key of Object.keys(env)) {
    if (
      key.startsWith("OPENCODE_") ||
      ["CDP_PORT", "NODE_OPTIONS", "NODE_INSPECT_RESUME_ON_START"].includes(key)
    )
      delete env[key];
  }
  // OAuth credentials stay in OpenCode's existing store; no secret is copied or rewritten by the app.
  env["OPENCODE_SERVER_PASSWORD"] = password;
  env["OPENCODE_CONFIG_DIR"] = join(root, "config");
  env["OPENCODE_TEST_HOME"] = join(root, "home");
  env["OPENCODE_CONFIG_PROJECT_DISABLE"] = "1";
  env["OPENCODE_CONFIG_CONTENT"] = JSON.stringify(config);
  env["OPENCODE_DISABLE_AUTOUPDATE"] = "1";
  env["OPENCODE_FILEWATCHER_DISABLE"] = "1";
  env["OPENCODE_IMAGE_GENERATION_DIR"] = root;
  return env;
}

export async function startAi0Process(
  workspacePath: string,
  projectRoot: string,
  allowedTools: string[]
): Promise<Ai0Engine> {
  const [canonicalProject, canonicalWorkspace] = await Promise.all([
    realpath(projectRoot),
    realpath(workspacePath),
  ]);
  const distance = relative(canonicalProject, canonicalWorkspace);
  if (distance === "" || (!distance.startsWith("..") && !isAbsolute(distance)))
    throw new Error("AI0 runtime workspace must be outside the development repository");
  const pluginRoot = join(workspacePath, "boundary-plugin");
  await mkdir(pluginRoot, { recursive: true });
  await Promise.all([
    mkdir(join(workspacePath, "config"), { recursive: true }),
    mkdir(join(workspacePath, "home"), { recursive: true }),
    writeFile(
      join(pluginRoot, "package.json"),
      JSON.stringify({ name: "hev-ai0-boundary", type: "module", main: "server.js" }),
      "utf8"
    ),
    writeFile(join(pluginRoot, "server.js"), AI0_BOUNDARY_PLUGIN, "utf8"),
  ]);
  const imagePluginRoot = join(workspacePath, "image-plugin");
  if (allowedTools.includes("image_generate")) {
    await mkdir(imagePluginRoot, { recursive: true });
    await copyFile(Paths.getAi0ImagePluginBundlePath(), join(imagePluginRoot, "server.js"));
    await writeFile(
      join(imagePluginRoot, "package.json"),
      JSON.stringify({
        name: "hev-ai0-image",
        version: "1.0.0",
        type: "module",
        main: "server.js",
        dependencies: {},
      }),
      "utf8"
    );
  }
  const permissions = [
    { action: "*", resource: "*", effect: "deny" },
    ...allowedTools.map((action) => ({ action, resource: "*", effect: "allow" })),
  ];
  const config = {
    default_agent: "hev-ai0",
    agents: { "hev-ai0": { mode: "primary", permissions } },
    permissions,
    plugins: [
      "-opencode.config.instruction",
      "-opencode.config.compatibility",
      "-opencode.config.skill",
      "-opencode.config.mcp",
      "-opencode.skill",
      ...(allowedTools.includes("image_generate") ? [pathToFileURL(imagePluginRoot).href] : []),
      { package: pathToFileURL(pluginRoot).href, options: { allowedTools } },
    ],
  };
  const diagnosis = await opencodeServerManager.diagnoseBinary();
  if (!diagnosis.available || diagnosis.version !== "2.0.21")
    throw new Error("Common AI0 native plugins require the verified OpenCode v2.0.21 API");
  const port = await opencodeServerManager.findAvailablePort(4150, 4199);
  if (port === null) throw new Error("No common AI0 runtime port is available");
  const password = randomBytes(32).toString("base64url");
  const authorization = `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}`;
  const spec = opencodeServerManager.buildSpawnCommand(
    diagnosis.resolvedPath ?? diagnosis.command,
    ["serve", "--hostname", "127.0.0.1", "--port", String(port)]
  );
  const process = spawn(spec.command, spec.args, {
    shell: spec.shell,
    cwd: workspacePath,
    env: buildAi0Environment(globalThis.process.env, workspacePath, config, password),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const state: { spawnError: Error | null } = { spawnError: null };
  process.once("error", (error) => {
    state.spawnError = error;
  });
  process.stdout.on("data", () => {});
  process.stderr.on("data", () => {});
  const stopOnExit = (): void => {
    if (process.exitCode === null && process.signalCode === null) process.kill("SIGTERM");
  };
  globalThis.process.once("exit", stopOnExit);
  const stop = async (): Promise<void> => {
    globalThis.process.off("exit", stopOnExit);
    await stopChild(process);
  };
  const request = async (
    method: string,
    path: string,
    body?: unknown,
    timeoutMs = 30_000
  ): Promise<unknown> => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(Math.max(1, timeoutMs)),
    });
    const text = await response.text();
    if (!response.ok)
      throw new Error(
        `OpenCode v2 ${method} ${path.split("?")[0] ?? path} failed (${response.status})`
      );
    if (text === "") return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new Error("OpenCode returned a non-JSON API response");
    }
  };
  const rpc = async (method: string, input: unknown): Promise<unknown> => {
    const imageMethod = { output: "reserve", "image-release": "release", "image-result": "result" }[
      method
    ];
    const value = await request(
      "POST",
      `/api/rpc/${imageMethod === undefined ? "hev.ai0" : "hev.ai0.image"}/${imageMethod ?? method}?directory=${encodeURIComponent(workspacePath)}`,
      { input }
    );
    return isRecord(value) ? value["output"] : undefined;
  };
  const deadline = Date.now() + 90_000;
  try {
    while (Date.now() < deadline) {
      if (state.spawnError !== null) throw state.spawnError;
      if (process.exitCode !== null) throw new Error("OpenCode exited during common AI0 startup");
      try {
        // Readiness includes plugin activation; a listening socket or HTML page is insufficient.
        // eslint-disable-next-line no-await-in-loop
        const ready = await rpc("ready", {});
        if (isRecord(ready) && ready["ready"] === true) {
          const plugins = unwrap(
            // eslint-disable-next-line no-await-in-loop
            await request("GET", `/api/plugin?directory=${encodeURIComponent(workspacePath)}`)
          );
          const required = [
            "hev.ai0.boundary",
            ...(allowedTools.includes("image_generate") ? ["hev.ai0.image"] : []),
          ];
          if (
            Array.isArray(plugins) &&
            required.every((id) =>
              plugins.some(
                (item) =>
                  isRecord(item) &&
                  item["id"] === id &&
                  isRecord(item["state"]) &&
                  item["state"]["status"] === "active"
              )
            )
          )
            return { workspacePath, port, request, rpc, stop };
          throw new Error("AI0 native plugin lifecycle is not active");
        }
      } catch {}
      // eslint-disable-next-line no-await-in-loop
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 400);
      });
    }
    throw new Error("Common AI0 boundary plugin did not become ready within 90 seconds");
  } catch (error) {
    await stop();
    throw error;
  }
}
async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null || child.pid === undefined) return;
  if (globalThis.process.platform === "win32") {
    await new Promise<void>((resolve) => {
      execFile(
        "taskkill.exe",
        ["/PID", String(child.pid), "/T", "/F"],
        { windowsHide: true },
        () => {
          resolve();
        }
      );
    });
    return;
  }
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, 2_000);
    child.once("close", () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill("SIGTERM");
  });
}
