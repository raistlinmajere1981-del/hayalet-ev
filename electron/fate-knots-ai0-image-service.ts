import type { ChildProcess } from "child_process";
import { execFile, spawn } from "child_process";
import { createHash } from "crypto";
import { mkdir, readFile, rm, stat, writeFile } from "fs/promises";
import * as net from "net";
import { extname, join, relative, resolve } from "path";
import { Paths } from "./paths.ts";
import { opencodeServerManager } from "./opencode-server-manager.ts";
import type {
  RoomToolFateKnotsAi0ImageGenerateRequest,
  RoomToolFateKnotsAi0ImageResult,
} from "../src/types/room-tools.ts";

const FATE_KNOTS_AI0_IMAGE_PORT_START = 4135;
const FATE_KNOTS_AI0_IMAGE_PORT_END = 4149;
const FATE_KNOTS_AI0_IMAGE_READY_TIMEOUT_MS = 120_000;
const FATE_KNOTS_AI0_IMAGE_DEFAULT_CALL_TIMEOUT_MS = 10 * 60_000;
const FATE_KNOTS_AI0_IMAGE_IDLE_STOP_MS = 10 * 60_000;
const FATE_KNOTS_AI0_IMAGE_TOOL_ID = "image_generate";
const FATE_KNOTS_AI0_IMAGE_PLUGIN = "opencode-image-generation@0.5.0";

const FATE_KNOTS_AI0_IMAGE_POLICY = [
  "You are the dedicated Fate Knots image worker.",
  "You are not a coding assistant and must not inspect or modify Hayalet Ev.",
  `Use exactly one ${FATE_KNOTS_AI0_IMAGE_TOOL_ID} tool call for each request.`,
  "Use only the output_path, size, format, quality, and prompt supplied by the system message.",
  "Do not use bash, edit, write, read, web, MCP, task, or any other tool.",
  "Do not create alternative images or extra files.",
  "After the image tool succeeds, reply with only {\"ok\":true}.",
].join("\n");

type ImageServerState = {
  process: ChildProcess;
  port: number;
  workspacePath: string;
  stagingRoot: string;
};

type OpenCodeSessionRecord = { id?: unknown };
type OpenCodeMessagePart = { type?: unknown; text?: unknown };
type OpenCodeMessageResponse = { parts?: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeSegment(value: string): string {
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 64);
  const hash = createHash("sha256").update(value).digest("hex").slice(0, 12);
  return `${normalized || "job"}-${hash}`;
}

function normalizeTimeoutMs(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return FATE_KNOTS_AI0_IMAGE_DEFAULT_CALL_TIMEOUT_MS;
  }
  return Math.max(30_000, Math.min(15 * 60_000, Math.trunc(value)));
}

function parseMajorVersion(version: string | undefined): number | null {
  if (!version) return null;
  const match = /^(\d+)/.exec(version.trim());
  if (!match) return null;
  const major = Number(match[1]);
  return Number.isInteger(major) ? major : null;
}

function buildOpenCodeConfig(version: string | undefined): Record<string, unknown> {
  const major = parseMajorVersion(version);
  const config: Record<string, unknown> = {
    $schema: "https://opencode.ai/config.json",
    permission: {
      "*": "deny",
      [FATE_KNOTS_AI0_IMAGE_TOOL_ID]: "allow",
    },
  };
  if (major !== null && major >= 2) {
    config["plugins"] = [FATE_KNOTS_AI0_IMAGE_PLUGIN];
  } else {
    config["plugin"] = [FATE_KNOTS_AI0_IMAGE_PLUGIN];
    config["tools"] = {
      "*": false,
      [FATE_KNOTS_AI0_IMAGE_TOOL_ID]: true,
    };
  }
  return config;
}

function quoteWindowsCommandArg(value: string): string {
  if (/^[A-Za-z0-9_./:=+\\-]+$/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

function buildSpawnSpec(
  command: string,
  args: string[]
): {
  command: string;
  args: string[];
  shell: boolean;
} {
  if (process.platform !== "win32") return { command, args, shell: false };
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
  return await new Promise((resolvePromise) => {
    const server = net.createServer();
    server.once("error", () => resolvePromise(false));
    server.once("listening", () => {
      server.close(() => resolvePromise(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function findAvailablePort(): Promise<number | null> {
  for (let port = FATE_KNOTS_AI0_IMAGE_PORT_START; port <= FATE_KNOTS_AI0_IMAGE_PORT_END; port += 1) {
    // eslint-disable-next-line no-await-in-loop
    if (await isPortAvailable(port)) return port;
  }
  return null;
}

async function fetchJson(url: string, options: RequestInit, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`OpenCode request failed (${response.status}): ${text.slice(0, 800)}`);
    }
    if (text.trim() === "") return null;
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

function toolIdsContainImageGenerate(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((entry) => entry === FATE_KNOTS_AI0_IMAGE_TOOL_ID);
  }
  if (!isRecord(value)) return false;
  for (const key of ["ids", "tools", "data"] as const) {
    const candidate = value[key];
    if (Array.isArray(candidate) && candidate.some((entry) => entry === FATE_KNOTS_AI0_IMAGE_TOOL_ID)) {
      return true;
    }
  }
  return false;
}

function parseAspectRatio(value: string): { width: number; height: number } {
  const match = /^(\d{1,3}):(\d{1,3})$/.exec(value.trim());
  if (!match) throw new Error("Fate Knots AI0 image sourceAspectRatio is invalid.");
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width <= 0 || height <= 0) {
    throw new Error("Fate Knots AI0 image sourceAspectRatio must be positive.");
  }
  return { width, height };
}

function imageSizeForAspectRatio(value: string): "1024x1024" | "1536x1024" | "1024x1536" {
  const ratio = parseAspectRatio(value);
  if (ratio.width === ratio.height) return "1024x1024";
  return ratio.width > ratio.height ? "1536x1024" : "1024x1536";
}

function isPng(bytes: Buffer): boolean {
  if (bytes.length < 8) return false;
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return signature.every((byte, index) => bytes[index] === byte);
}

function ensureContainedPath(root: string, target: string): void {
  const distance = relative(resolve(root), resolve(target));
  if (distance === "" || distance === ".." || distance.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)) {
    if (distance === "") return;
    throw new Error("Fate Knots AI0 image output escaped its staging root.");
  }
  if (resolve(distance) === distance) {
    throw new Error("Fate Knots AI0 image output escaped its staging root.");
  }
}

function buildSystemPrompt(
  request: RoomToolFateKnotsAi0ImageGenerateRequest,
  outputPath: string,
  size: "1024x1024" | "1536x1024" | "1024x1536"
): string {
  return [
    FATE_KNOTS_AI0_IMAGE_POLICY,
    "Call image_generate exactly once with these arguments:",
    `output_path: ${outputPath}`,
    `size: ${size}`,
    "quality: medium",
    "format: png",
    "background: opaque",
    "The tool prompt must be exactly the art brief supplied in the user message.",
    `Job id: ${request.jobId}`,
  ].join("\n");
}

class FateKnotsAi0ImageService {
  private server: ImageServerState | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  async generate(
    request: RoomToolFateKnotsAi0ImageGenerateRequest
  ): Promise<RoomToolFateKnotsAi0ImageResult> {
    const run = this.queue.then(async () => await this.runGenerate(request));
    this.queue = run.catch(() => undefined);
    return await run;
  }

  private async runGenerate(
    request: RoomToolFateKnotsAi0ImageGenerateRequest
  ): Promise<RoomToolFateKnotsAi0ImageResult> {
    if (request.roomId !== "game-room") {
      throw new Error("Fate Knots AI0 image worker is restricted to game-room.");
    }
    if (request.requestId.trim() === "" || request.jobId.trim() === "") {
      throw new Error("Fate Knots AI0 image requestId and jobId are required.");
    }
    if (request.prompt.trim() === "") {
      throw new Error("Fate Knots AI0 image prompt is required.");
    }

    const size = imageSizeForAspectRatio(request.sourceAspectRatio);
    const paths = await this.ensureWorkspace();
    const server = await this.ensureServer(paths.workspacePath, paths.stagingRoot);
    this.armIdleStop();

    const jobSegment = sanitizeSegment(request.jobId);
    const relativeOutputPath = `jobs/${jobSegment}/source.png`;
    const outputPath = join(paths.stagingRoot, "jobs", jobSegment, "source.png");
    const manifestPath = join(paths.stagingRoot, "jobs", jobSegment, "result.json");
    ensureContainedPath(paths.stagingRoot, outputPath);
    ensureContainedPath(paths.stagingRoot, manifestPath);
    await rm(join(paths.stagingRoot, "jobs", jobSegment), { recursive: true, force: true });
    await mkdir(join(paths.stagingRoot, "jobs", jobSegment), { recursive: true });

    const timeoutMs = normalizeTimeoutMs(request.timeoutMs);
    const baseUrl = `http://127.0.0.1:${server.port}`;
    let sessionId = "";
    let responseText = "";

    try {
      const created = await fetchJson(
        `${baseUrl}/session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: `Fate Knots Image · ${request.jobId}` }),
        },
        Math.min(timeoutMs, 30_000)
      );
      sessionId = extractSessionId(created);
      if (sessionId === "") throw new Error("Fate Knots AI0 image session id was unavailable.");

      const message = await fetchJson(
        `${baseUrl}/session/${encodeURIComponent(sessionId)}/message`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system: buildSystemPrompt(request, relativeOutputPath, size),
            parts: [{ type: "text", text: request.prompt.trim() }],
          }),
        },
        timeoutMs
      );
      responseText = extractResponseText(message);

      let fileBytes: Buffer;
      try {
        fileBytes = await readFile(outputPath);
      } catch {
        throw new Error(
          responseText !== ""
            ? `Fate Knots AI0 image worker produced no staging file. OpenCode replied: ${responseText.slice(0, 500)}`
            : "Fate Knots AI0 image worker produced no staging file."
        );
      }
      if (!isPng(fileBytes)) {
        throw new Error("Fate Knots AI0 image worker staging file is not a valid PNG payload.");
      }
      const fileStat = await stat(outputPath);
      if (!fileStat.isFile() || fileStat.size <= 0) {
        throw new Error("Fate Knots AI0 image worker staging file is empty or unreadable.");
      }

      await writeFile(
        manifestPath,
        `${JSON.stringify(
          {
            schemaVersion: 1,
            jobId: request.jobId,
            success: true,
            artifact: {
              path: outputPath,
              mimeType: "image/png",
              bytes: fileStat.size,
            },
            createdAt: new Date().toISOString(),
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      return {
        path: outputPath,
        mimeType: "image/png",
        bytes: fileStat.size,
        manifestPath,
        workspacePath: server.workspacePath,
        stagingRoot: server.stagingRoot,
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
          // Best-effort stateless cleanup. Image bytes and result manifest remain in staging.
        }
      }
      this.armIdleStop();
    }
  }

  private async ensureWorkspace(): Promise<{ workspacePath: string; stagingRoot: string }> {
    const root = join(Paths.getRoomStorageDir("game-room"), "fate-knots", "ai0-image-worker");
    const workspacePath = join(root, "workspace");
    const stagingRoot = join(root, "staging");
    await Promise.all([mkdir(workspacePath, { recursive: true }), mkdir(stagingRoot, { recursive: true })]);
    await writeFile(join(workspacePath, "AGENTS.md"), `${FATE_KNOTS_AI0_IMAGE_POLICY}\n`, "utf8");
    return { workspacePath, stagingRoot };
  }

  private async ensureServer(workspacePath: string, stagingRoot: string): Promise<ImageServerState> {
    if (
      this.server !== null &&
      this.server.workspacePath === workspacePath &&
      this.server.stagingRoot === stagingRoot &&
      this.server.process.exitCode === null
    ) {
      return this.server;
    }

    await this.stopServer();
    const diagnosis = await opencodeServerManager.diagnoseBinary();
    if (!diagnosis.available) throw new Error(diagnosis.error ?? "OpenCode binary is unavailable.");

    const config = buildOpenCodeConfig(diagnosis.version);
    await writeFile(join(workspacePath, "opencode.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");

    const port = await findAvailablePort();
    if (port === null) throw new Error("No isolated Fate Knots AI0 image OpenCode port is available.");

    const command = diagnosis.resolvedPath ?? diagnosis.command;
    const args = ["serve", "--port", String(port), "--hostname", "127.0.0.1", workspacePath];
    const spec = buildSpawnSpec(command, args);
    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      OPENCODE_CONFIG_CONTENT: JSON.stringify(config),
      OPENCODE_IMAGE_GENERATION_DIR: stagingRoot,
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
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderrTail = `${stderrTail}${String(chunk)}`.slice(-8_000);
    });

    const candidate: ImageServerState = { process: child, port, workspacePath, stagingRoot };
    this.server = candidate;
    child.once("close", () => {
      if (this.server?.process === child) this.server = null;
    });

    if (!(await this.waitForReady(candidate))) {
      await this.stopServer();
      throw new Error(
        stderrTail.trim() !== ""
          ? `Fate Knots AI0 image OpenCode server did not become ready: ${stderrTail.trim()}`
          : "Fate Knots AI0 image OpenCode server did not become ready."
      );
    }
    if (!(await this.waitForImageTool(candidate))) {
      await this.stopServer();
      throw new Error(
        stderrTail.trim() !== ""
          ? `Fate Knots AI0 image tool did not become available: ${stderrTail.trim()}`
          : `Fate Knots AI0 image tool ${FATE_KNOTS_AI0_IMAGE_TOOL_ID} is unavailable.`
      );
    }
    return candidate;
  }

  private async waitForReady(server: ImageServerState): Promise<boolean> {
    const deadline = Date.now() + FATE_KNOTS_AI0_IMAGE_READY_TIMEOUT_MS;
    const url = `http://127.0.0.1:${server.port}/global/health`;
    while (Date.now() <= deadline) {
      if (server.process.exitCode !== null) return false;
      try {
        // eslint-disable-next-line no-await-in-loop
        const response = await fetch(url);
        if (response.ok) return true;
      } catch {
        // Keep polling until the bounded startup deadline.
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 400));
    }
    return false;
  }

  private async waitForImageTool(server: ImageServerState): Promise<boolean> {
    const deadline = Date.now() + FATE_KNOTS_AI0_IMAGE_READY_TIMEOUT_MS;
    const url = `http://127.0.0.1:${server.port}/experimental/tool/ids`;
    while (Date.now() <= deadline) {
      if (server.process.exitCode !== null) return false;
      try {
        // eslint-disable-next-line no-await-in-loop
        const tools = await fetchJson(url, { method: "GET" }, 10_000);
        if (toolIdsContainImageGenerate(tools)) return true;
      } catch {
        // npm plugin install can finish after the health endpoint becomes ready.
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 750));
    }
    return false;
  }

  private armIdleStop(): void {
    if (this.idleTimer !== null) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      void this.stopServer();
    }, FATE_KNOTS_AI0_IMAGE_IDLE_STOP_MS);
  }

  private async stopServer(): Promise<void> {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    const current = this.server;
    this.server = null;
    if (current?.process.exitCode !== null) return;

    const pid = current.process.pid;
    if (process.platform === "win32" && typeof pid === "number") {
      await new Promise<void>((resolvePromise) => {
        execFile("taskkill.exe", ["/PID", String(pid), "/T", "/F"], { windowsHide: true }, () => {
          resolvePromise();
        });
      });
      return;
    }

    try {
      current.process.kill("SIGTERM");
    } catch {
      return;
    }

    await new Promise<void>((resolvePromise) => {
      let settled = false;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolvePromise();
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

export const fateKnotsAi0ImageService = new FateKnotsAi0ImageService();
