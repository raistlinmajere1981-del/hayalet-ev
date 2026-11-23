import type { ChildProcess } from "node:child_process";
import { spawn, execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { realpath } from "node:fs/promises";
import { relative, isAbsolute } from "node:path";
import { opencodeServerManager } from "../opencode-server-manager.ts";

export interface Ai0SessionProbe {
  sessionId: string;
  model: { providerID: string; id: string };
  tools: Record<string, { input: { properties?: Record<string, unknown> } }>;
}

export interface Ai0Engine {
  workspacePath: string;
  port: number;
  request: (method: string, path: string, body?: unknown, timeoutMs?: number) => Promise<unknown>;
  stop: () => Promise<void>;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function unwrap(value: unknown): unknown {
  return isRecord(value) ? value["data"] : undefined;
}

/**
 * A task gets its own working directory and scoped session permissions, but
 * it inherits the user's actual OpenCode configuration, skills and OAuth
 * connections. Hayalet Ev does not install or impersonate any provider.
 */
export function buildAi0Environment(
  parent: NodeJS.ProcessEnv,
  password: string
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...parent };
  // V2 reads OPENCODE_PASSWORD ahead of the legacy variable. Set both so a
  // user's existing server password never defeats this child server's auth.
  env["OPENCODE_PASSWORD"] = password;
  env["OPENCODE_SERVER_PASSWORD"] = password;
  delete env["CDP_PORT"];
  delete env["NODE_OPTIONS"];
  delete env["NODE_INSPECT_RESUME_ON_START"];
  return env;
}

export async function startAi0Process(
  workspacePath: string,
  projectRoot: string,
  _allowedTools: string[]
): Promise<Ai0Engine> {
  const [canonicalProject, canonicalWorkspace] = await Promise.all([
    realpath(projectRoot),
    realpath(workspacePath),
  ]);
  const distance = relative(canonicalProject, canonicalWorkspace);
  if (distance === "" || (!distance.startsWith("..") && !isAbsolute(distance)))
    throw new Error("AI0 runtime workspace must be outside the development repository");

  const diagnosis = await opencodeServerManager.diagnoseBinary();
  if (!diagnosis.available) throw new Error("OpenCode is not installed or cannot be started");
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
    env: buildAi0Environment(globalThis.process.env, password),
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
    if (!response.ok)
      throw new Error(
        `OpenCode ${method} ${path.split("?")[0] ?? path} failed (HTTP ${response.status})`
      );
    const length = Number(response.headers.get("content-length") ?? "0");
    if (length > 96 * 1024 * 1024) throw new Error("OpenCode response exceeds the permitted size");
    const text = await response.text();
    if (text.length > 96 * 1024 * 1024)
      throw new Error("OpenCode response exceeds the permitted size");
    if (text === "") return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new Error("OpenCode returned a non-JSON API response");
    }
  };

  const deadline = Date.now() + 45_000;
  try {
    while (Date.now() < deadline) {
      if (state.spawnError !== null) throw state.spawnError;
      if (process.exitCode !== null) throw new Error("OpenCode exited during AI0 startup");
      try {
        // Readiness is an authenticated V2 API response, not a listening socket.
        // No provider inference is used for this check.
        // eslint-disable-next-line no-await-in-loop
        const models = unwrap(
          await request("GET", `/api/model?directory=${encodeURIComponent(workspacePath)}`)
        );
        if (Array.isArray(models)) return { workspacePath, port, request, stop };
      } catch {
        // Retry while startup plugins/config are being loaded.
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise<void>((resolve) => setTimeout(resolve, 400));
    }
    throw new Error("OpenCode did not become ready within 45 seconds");
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
  child.kill("SIGTERM");
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      resolve();
    }, 5_000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
