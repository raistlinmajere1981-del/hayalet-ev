import type { ChildProcess } from "child_process";
import { execFile, spawn } from "child_process";
import { mkdir, writeFile } from "fs/promises";
import * as net from "net";
import { extname, join } from "path";
import { Paths } from "./paths.ts";
import { opencodeServerManager } from "./opencode-server-manager.ts";
import type {
  RoomToolFateKnotsAi0CallRequest,
  RoomToolFateKnotsAi0Result,
} from "../src/types/room-tools.ts";

const FATE_KNOTS_AI0_PORT_START = 4120;
const FATE_KNOTS_AI0_PORT_END = 4134;
const FATE_KNOTS_AI0_READY_TIMEOUT_MS = 90_000;
const FATE_KNOTS_AI0_DEFAULT_CALL_TIMEOUT_MS = 180_000;
const FATE_KNOTS_AI0_IDLE_STOP_MS = 10 * 60_000;

const FATE_KNOTS_AI0_OPENCODE_CONFIG = Object.freeze({
  $schema: "https://opencode.ai/config.json",
  permission: {
    "*": "deny",
  },
  tools: {
    "*": false,
  },
});

type RuntimeServerState = {
  process: ChildProcess;
  port: number;
  universeId: string;
  workspacePath: string;
};

type OpenCodeSessionRecord = {
  id?: unknown;
};

type OpenCodeMessagePart = {
  type?: unknown;
  text?: unknown;
};

type OpenCodeMessageResponse = {
  parts?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}

function sanitizeWorkspaceSegment(value: string): string {
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "universe";
}

function normalizeTimeoutMs(value: number | undefined): number {
  if (typeof value !== "number" || Number.isFinite(value) !== true) {
    return FATE_KNOTS_AI0_DEFAULT_CALL_TIMEOUT_MS;
  }
  return Math.max(5_000, Math.min(10 * 60_000, Math.trunc(value)));
}

function quoteWindowsCommandArg(value: string): string {
  if (/^[A-Za-z0-9_./:=+\\-]+$/.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '\\"')}"`;
}

function buildSpawnSpec(command: string, args: string[]): {
  command: string;
  args: string[];
  shell: boolean;
} {
  if (process.platform !== "win32") {
    return { command, args, shell: false };
  }

  const extension = extname(command).toLowerCase();
  if (extension === ".cmd" || extension === ".bat") {
    return {
      command: "cmd.exe",
      args: [
        "/d",
        "/s",
        "/c",
        [quoteWindowsCommandArg(command), ...args.map(quoteWindowsCommandArg)].join(" "),
      ],
      shell: false,
    };
  }

  if (extension === ".ps1") {
    return {
      command: "powershell.exe",
      args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", command, ...args],
      shell: false,
    };
  }

  return { command, args, shell: command === "opencode" };
}

async function isPortAvailable(port: number): Promise<boolean> {
  return await new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function findAvailablePort(): Promise<number | null> {
  for (let port = FATE_KNOTS_AI0_PORT_START; port <= FATE_KNOTS_AI0_PORT_END; port += 1) {
    // Sequential probing is deliberate: choose the first stable port deterministically.
    // eslint-disable-next-line no-await-in-loop
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  return null;
}

async function fetchJson(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`OpenCode request failed (${response.status}): ${text.slice(0, 500)}`);
    }
    if (text.trim() === "") {
      return null;
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  } finally {
    clearTimeout(timer);
  }
}

function extractSessionId(value: unknown): string {
  const source = isRecord(value) ? (value as OpenCodeSessionRecord) : {};
  return typeof source.id === "string" ? source.id.trim() : "";
}

function extractResponseText(value: unknown): string {
  const source = isRecord(value) ? (value as OpenCodeMessageResponse) : {};
  const parts = Array.isArray(source.parts) ? source.parts : [];
  return parts
    .map((part) => (isRecord(part) ? (part as OpenCodeMessagePart) : {}))
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => (part.text as string).trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

class FateKnotsAi0RuntimeService {
  private server: RuntimeServerState | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  async call(request: RoomToolFateKnotsAi0CallRequest): Promise<RoomToolFateKnotsAi0Result> {
    const run = this.queue.then(async () => await this.runCall(request));
    this.queue = run.catch(() => undefined);
    return await run;
  }

  private async runCall(request: RoomToolFateKnotsAi0CallRequest): Promise<RoomToolFateKnotsAi0Result> {
    if (request.roomId !== "game-room") {
      throw new Error("Fate Knots AI0 runtime is restricted to game-room.");
    }

    const universeId = request.universeId.trim();
    if (universeId === "") {
      throw new Error("Fate Knots AI0 universeId is required.");
    }
    if (request.policyText.trim() === "") {
      throw new Error("Fate Knots AI0 policyText is required.");
    }
    if (request.systemPrompt.trim() === "") {
      throw new Error("Fate Knots AI0 systemPrompt is required.");
    }

    const workspacePath = await this.ensureWorkspace(universeId, request.policyText);
    const server = await this.ensureServer(universeId, workspacePath);
    this.armIdleStop();

    const timeoutMs = normalizeTimeoutMs(request.timeoutMs);
    const baseUrl = `http://127.0.0.1:${server.port}`;
    let sessionId = "";

    try {
      const created = await fetchJson(
        `${baseUrl}/session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: `Fate Knots AI0 ${request.requestId ?? "runtime"}` }),
        },
        Math.min(timeoutMs, 30_000)
      );
      sessionId = extractSessionId(created);
      if (sessionId === "") {
        throw new Error("Fate Knots AI0 session id was unavailable.");
      }

      const message = await fetchJson(
        `${baseUrl}/session/${encodeURIComponent(sessionId)}/message`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system: request.systemPrompt.trim(),
            parts: [
              {
                type: "text",
                text: JSON.stringify(request.payload),
              },
            ],
          }),
        },
        timeoutMs
      );
      const text = extractResponseText(message);
      if (text === "") {
        throw new Error("Fate Knots AI0 returned an empty response.");
      }

      return {
        text,
        workspacePath: server.workspacePath,
        port: server.port,
      };
    } finally {
      if (sessionId !== "") {
        try {
          await fetchJson(
            `${baseUrl}/session/${encodeURIComponent(sessionId)}`,
            { method: "DELETE" },
            10_000
          );
        } catch {
          // Session cleanup is best-effort; statelessness is also enforced by never reusing the id.
        }
      }
      this.armIdleStop();
    }
  }

  private async ensureWorkspace(universeId: string, policyText: string): Promise<string> {
    const workspacePath = join(
      Paths.getRoomStorageDir("game-room"),
      "fate-knots",
      "ai0-runtime",
      sanitizeWorkspaceSegment(universeId)
    );
    await mkdir(workspacePath, { recursive: true });
    await Promise.all([
      writeFile(join(workspacePath, "AGENTS.md"), `${policyText.trim()}\n`, "utf8"),
      writeFile(
        join(workspacePath, "opencode.json"),
        `${JSON.stringify(FATE_KNOTS_AI0_OPENCODE_CONFIG, null, 2)}\n`,
        "utf8"
      ),
    ]);
    return workspacePath;
  }

  private async ensureServer(
    universeId: string,
    workspacePath: string
  ): Promise<RuntimeServerState> {
    if (
      this.server !== null &&
      this.server.universeId === universeId &&
      this.server.workspacePath === workspacePath &&
      this.server.process.exitCode === null
    ) {
      return this.server;
    }

    await this.stopServer();

    const diagnosis = await opencodeServerManager.diagnoseBinary();
    if (!diagnosis.available) {
      throw new Error(diagnosis.error ?? "OpenCode binary is unavailable.");
    }

    const port = await findAvailablePort();
    if (port === null) {
      throw new Error("No isolated Fate Knots AI0 OpenCode port is available.");
    }

    const command = diagnosis.resolvedPath ?? diagnosis.command;
    const args = [
      "serve",
      "--port",
      String(port),
      "--hostname",
      "127.0.0.1",
      workspacePath,
    ];
    const spec = buildSpawnSpec(command, args);
    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      OPENCODE_CONFIG_CONTENT: JSON.stringify(FATE_KNOTS_AI0_OPENCODE_CONFIG),
    };
    delete childEnv["CDP_PORT"];
    delete childEnv["NODE_OPTIONS"];
    delete childEnv["NODE_INSPECT_RESUME_ON_START"];

    const child = spawn(spec.command, spec.args, {
      cwd: workspacePath,
      detached: false,
      env: childEnv,
      shell: spec.shell,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderrTail = "";
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderrTail = `${stderrTail}${String(chunk)}`.slice(-4_000);
    });

    const candidate: RuntimeServerState = {
      process: child,
      port,
      universeId,
      workspacePath,
    };
    this.server = candidate;
    child.once("close", () => {
      if (this.server?.process === child) {
        this.server = null;
      }
    });

    const ready = await this.waitForReady(candidate);
    if (!ready) {
      await this.stopServer();
      throw new Error(
        stderrTail.trim() !== ""
          ? `Fate Knots AI0 OpenCode server did not become ready: ${stderrTail.trim()}`
          : "Fate Knots AI0 OpenCode server did not become ready."
      );
    }

    return candidate;
  }

  private async waitForReady(server: RuntimeServerState): Promise<boolean> {
    const deadline = Date.now() + FATE_KNOTS_AI0_READY_TIMEOUT_MS;
    const url = `http://127.0.0.1:${server.port}/global/health`;
    while (Date.now() <= deadline) {
      if (server.process.exitCode !== null) {
        return false;
      }
      try {
        const response = await fetch(url);
        if (response.ok) {
          return true;
        }
      } catch {
        // Keep polling until the bounded startup deadline.
      }
      // Sequential readiness polling preserves bounded startup semantics.
      // eslint-disable-next-line no-await-in-loop
      await new Promise<void>((resolve) => setTimeout(resolve, 400));
    }
    return false;
  }

  private armIdleStop(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
    }
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      void this.stopServer();
    }, FATE_KNOTS_AI0_IDLE_STOP_MS);
  }

  private async stopServer(): Promise<void> {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    const current = this.server;
    this.server = null;
    if (current === null || current.process.exitCode !== null) {
      return;
    }

    const pid = current.process.pid;
    if (process.platform === "win32" && typeof pid === "number") {
      await new Promise<void>((resolve) => {
        execFile("taskkill.exe", ["/PID", String(pid), "/T", "/F"], { windowsHide: true }, () => {
          resolve();
        });
      });
      return;
    }

    try {
      current.process.kill("SIGTERM");
    } catch {
      return;
    }

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        try {
          current.process.kill("SIGKILL");
        } catch {}
        finish();
      }, 2_000);
      current.process.once("close", finish);
    });
  }
}

export const fateKnotsAi0RuntimeService = new FateKnotsAi0RuntimeService();
