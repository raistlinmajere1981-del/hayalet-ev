import type { ChildProcess } from "child_process";
import { execFile, spawn } from "child_process";
import { createHash } from "crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "fs/promises";
import { homedir } from "os";
import * as net from "net";
import { extname, isAbsolute, join, relative, resolve } from "path";
import { readFateKnotsAi0ActiveModel, type FateKnotsAi0ActiveModel } from "./fate-knots-ai0-active-model.ts";
import { opencodeServerManager } from "./opencode-server-manager.ts";
import { Paths } from "./paths.ts";
import type {
  RoomToolFateKnotsAi0ImageGenerateRequest,
  RoomToolFateKnotsAi0ImageResult,
  RoomToolFateKnotsAi0ImageStatus,
  RoomToolFateKnotsAi0ImageStatusRequest,
} from "../src/types/room-tools.ts";

const FATE_KNOTS_AI0_IMAGE_PORT_START = 4135;
const FATE_KNOTS_AI0_IMAGE_PORT_END = 4149;
const FATE_KNOTS_AI0_IMAGE_READY_TIMEOUT_MS = 90_000;
const FATE_KNOTS_AI0_IMAGE_DEFAULT_CALL_TIMEOUT_MS = 10 * 60_000;
const FATE_KNOTS_AI0_IMAGE_IDLE_STOP_MS = 10 * 60_000;
const FATE_KNOTS_AI0_IMAGE_TOOL_ID = "image_generate";
const FATE_KNOTS_SKILL_TOOL_ID = "skill";

const FATE_KNOTS_AI0_IMAGE_POLICY = [
  "You are the dedicated Fate Knots image worker.",
  "You are not a coding assistant and must not inspect or modify Hayalet Ev.",
  "Use only the image-generation capability explicitly enabled for this message.",
  "Create exactly one image for the requested art brief.",
  "Do not create alternatives, edit project files, browse the web, or perform unrelated work.",
  "After the image tool succeeds, reply with only {\"ok\":true}.",
].join("\n");

type ImageServerState = {
  process: ChildProcess;
  port: number;
  workspacePath: string;
  stagingRoot: string;
};

type ImageCapabilityProbe = {
  status: RoomToolFateKnotsAi0ImageStatus;
  model: FateKnotsAi0ActiveModel | null;
  toolIds: string[];
};

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

function quoteWindowsCommandArg(value: string): string {
  if (/^[A-Za-z0-9_./:=+\\-]+$/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

function buildSpawnSpec(
  command: string,
  args: string[]
): { command: string; args: string[]; shell: boolean } {
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
    server.once("listening", () => server.close(() => resolvePromise(true)));
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
  return isRecord(value) && typeof value["id"] === "string" ? value["id"].trim() : "";
}

function extractResponseText(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value["parts"])) return "";
  return value["parts"]
    .filter((part): part is Record<string, unknown> => isRecord(part))
    .filter((part) => part["type"] === "text" && typeof part["text"] === "string")
    .map((part) => String(part["text"]).trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function readToolIds(value: unknown): string[] {
  const source = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value["ids"])
      ? value["ids"]
      : isRecord(value) && Array.isArray(value["tools"])
        ? value["tools"]
        : isRecord(value) && Array.isArray(value["data"])
          ? value["data"]
          : [];
  return Array.from(
    new Set(source.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== ""))
  );
}

function toolHasRequiredOutputContract(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  const item = value.find(
    (entry) => isRecord(entry) && entry["id"] === FATE_KNOTS_AI0_IMAGE_TOOL_ID
  );
  if (!isRecord(item) || !isRecord(item["parameters"])) return false;
  const parameters = item["parameters"];
  const properties = isRecord(parameters["properties"]) ? parameters["properties"] : null;
  return properties !== null && isRecord(properties["prompt"]) && isRecord(properties["output_path"]);
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
  if (distance === "" || (!distance.startsWith("..") && !isAbsolute(distance))) return;
  throw new Error("Fate Knots AI0 image output escaped its staging root.");
}

function skillRoots(workspacePath: string): string[] {
  const home = homedir();
  const globalConfigRoot =
    process.platform === "win32" && process.env["APPDATA"]
      ? join(process.env["APPDATA"], "opencode")
      : join(process.env["XDG_CONFIG_HOME"] ?? join(home, ".config"), "opencode");
  const configuredRoot = process.env["OPENCODE_CONFIG_DIR"]?.trim();
  return Array.from(
    new Set(
      [
        join(globalConfigRoot, "skill"),
        join(globalConfigRoot, "skills"),
        ...(configuredRoot ? [join(configuredRoot, "skill"), join(configuredRoot, "skills")] : []),
        join(home, ".agents", "skills"),
        join(home, ".claude", "skills"),
        join(workspacePath, ".opencode", "skill"),
        join(workspacePath, ".opencode", "skills"),
      ].map((entry) => resolve(entry))
    )
  );
}

async function collectSkillFiles(root: string, depth = 0): Promise<string[]> {
  if (depth > 5) return [];
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries.slice(0, 100)) {
    const next = join(root, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === "skill.md") {
      files.push(next);
      continue;
    }
    if (entry.isDirectory()) {
      // eslint-disable-next-line no-await-in-loop
      files.push(...(await collectSkillFiles(next, depth + 1)));
    }
    if (files.length >= 100) break;
  }
  return files.slice(0, 100);
}

function parseSkillIdentity(content: string, filePath: string): { name: string; searchText: string } {
  const head = content.slice(0, 12_000);
  const nameMatch = /^name:\s*["']?([^\r\n"']+)/im.exec(head);
  const descriptionMatch = /^description:\s*["']?([^\r\n"']+)/im.exec(head);
  const fallbackName = filePath.split(/[\\/]/).slice(-2, -1)[0] ?? "skill";
  const name = nameMatch?.[1]?.trim() || fallbackName;
  return {
    name,
    searchText: `${name}\n${descriptionMatch?.[1] ?? ""}\n${head.slice(0, 2_000)}`,
  };
}

async function detectImageSkills(workspacePath: string): Promise<string[]> {
  const paths = (
    await Promise.all(skillRoots(workspacePath).map(async (root) => await collectSkillFiles(root)))
  ).flat();
  const matches: string[] = [];
  for (const filePath of Array.from(new Set(paths))) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const content = await readFile(filePath, "utf8");
      const skill = parseSkillIdentity(content, filePath);
      if (/(?:\bimage(?:s| generation)?\b|\bpicture(?:s)?\b|\billustration\b|\bvisual asset\b|görsel|resim)/i.test(skill.searchText)) {
        matches.push(skill.name);
      }
    } catch {
      // Best-effort discovery only; OpenCode remains authoritative for actual tool availability.
    }
  }
  return Array.from(new Set(matches)).sort((left, right) => left.localeCompare(right));
}

function buildToolSelection(toolIds: readonly string[], imageSkillName: string | null): Record<string, boolean> {
  return Object.fromEntries(
    toolIds.map((toolId) => [
      toolId,
      toolId === FATE_KNOTS_AI0_IMAGE_TOOL_ID ||
        (imageSkillName !== null && toolId === FATE_KNOTS_SKILL_TOOL_ID),
    ])
  );
}

function buildSystemPrompt(
  request: RoomToolFateKnotsAi0ImageGenerateRequest,
  relativeOutputPath: string,
  size: "1024x1024" | "1536x1024" | "1024x1536",
  imageSkillName: string | null
): string {
  return [
    FATE_KNOTS_AI0_IMAGE_POLICY,
    ...(imageSkillName
      ? [`First load the user-installed skill named \"${imageSkillName}\" if it is relevant to this request.`]
      : []),
    `Then call ${FATE_KNOTS_AI0_IMAGE_TOOL_ID} exactly once.`,
    "Use the art brief from the user message as the tool prompt.",
    `Set output_path to exactly: ${relativeOutputPath}`,
    `Prefer size: ${size}`,
    "Prefer quality: medium, format: png, and opaque background when the tool supports them.",
    `Job id: ${request.jobId}`,
  ].join("\n");
}

class FateKnotsAi0ImageWorkerService {
  private server: ImageServerState | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  async status(request: RoomToolFateKnotsAi0ImageStatusRequest): Promise<RoomToolFateKnotsAi0ImageStatus> {
    if (request.roomId !== "game-room") {
      return this.unavailableStatus(null, [], "Fate Knots AI0 image worker is restricted to game-room.");
    }
    try {
      const workspace = await this.ensureWorkspace();
      const imageSkillNames = await detectImageSkills(workspace.workspacePath);
      const model = await readFateKnotsAi0ActiveModel();
      if (model === null) {
        return this.unavailableStatus(
          null,
          imageSkillNames,
          "AI0 has no persisted active/default OpenCode model."
        );
      }
      const server = await this.ensureServer(workspace.workspacePath, workspace.stagingRoot);
      this.armIdleStop();
      return (await this.probeCapability(server, model, imageSkillNames)).status;
    } catch (error) {
      return this.unavailableStatus(
        await readFateKnotsAi0ActiveModel().catch(() => null),
        [],
        error instanceof Error ? error.message : String(error)
      );
    }
  }

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
    if (request.roomId !== "game-room") throw new Error("Fate Knots AI0 image worker is restricted to game-room.");
    if (request.requestId.trim() === "" || request.jobId.trim() === "") {
      throw new Error("Fate Knots AI0 image requestId and jobId are required.");
    }
    if (request.prompt.trim() === "") throw new Error("Fate Knots AI0 image prompt is required.");

    const size = imageSizeForAspectRatio(request.sourceAspectRatio);
    const workspace = await this.ensureWorkspace();
    const imageSkillNames = await detectImageSkills(workspace.workspacePath);
    const model = await readFateKnotsAi0ActiveModel();
    if (model === null) throw new Error("AI0 has no persisted active/default OpenCode model.");
    const server = await this.ensureServer(workspace.workspacePath, workspace.stagingRoot);
    const capability = await this.probeCapability(server, model, imageSkillNames);
    if (!capability.status.available) {
      throw new Error(capability.status.reason ?? "AI0 image generation capability is unavailable.");
    }
    this.armIdleStop();

    const jobSegment = sanitizeSegment(request.jobId);
    const jobRoot = join(workspace.stagingRoot, "jobs", jobSegment);
    const relativeOutputPath = `jobs/${jobSegment}/source.png`;
    const outputPath = join(jobRoot, "source.png");
    const manifestPath = join(jobRoot, "result.json");
    ensureContainedPath(workspace.stagingRoot, outputPath);
    ensureContainedPath(workspace.stagingRoot, manifestPath);
    await rm(jobRoot, { recursive: true, force: true });
    await mkdir(jobRoot, { recursive: true });

    const timeoutMs = normalizeTimeoutMs(request.timeoutMs);
    const baseUrl = `http://127.0.0.1:${server.port}`;
    const imageSkillName = imageSkillNames[0] ?? null;
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
            model: { providerID: model.providerID, modelID: model.modelID },
            system: buildSystemPrompt(request, relativeOutputPath, size, imageSkillName),
            tools: buildToolSelection(capability.toolIds, imageSkillName),
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
            activeModelKey: model.modelKey,
            imageSkillName,
            toolId: FATE_KNOTS_AI0_IMAGE_TOOL_ID,
            artifact: { path: outputPath, mimeType: "image/png", bytes: fileStat.size },
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
        activeModelKey: model.modelKey,
      };
    } finally {
      if (sessionId !== "") {
        try {
          await fetchJson(`${baseUrl}/session/${encodeURIComponent(sessionId)}`, { method: "DELETE" }, 10_000);
        } catch {
          // Best-effort cleanup; generated staging files remain for the materializer.
        }
      }
      this.armIdleStop();
    }
  }

  private unavailableStatus(
    model: FateKnotsAi0ActiveModel | null,
    imageSkillNames: string[],
    reason: string
  ): RoomToolFateKnotsAi0ImageStatus {
    return {
      available: false,
      activeModelKey: model?.modelKey ?? null,
      providerId: model?.providerID ?? null,
      modelId: model?.modelID ?? null,
      toolId: null,
      compatibleTool: false,
      imageSkillDetected: imageSkillNames.length > 0,
      imageSkillNames,
      reason,
    };
  }

  private async probeCapability(
    server: ImageServerState,
    model: FateKnotsAi0ActiveModel,
    imageSkillNames: string[]
  ): Promise<ImageCapabilityProbe> {
    const baseUrl = `http://127.0.0.1:${server.port}`;
    const toolIds = readToolIds(await fetchJson(`${baseUrl}/experimental/tool/ids`, { method: "GET" }, 20_000));
    if (!toolIds.includes(FATE_KNOTS_AI0_IMAGE_TOOL_ID)) {
      const skillSuffix =
        imageSkillNames.length > 0
          ? ` Image-generation skill detected (${imageSkillNames.join(", ")}), but it exposes no compatible ${FATE_KNOTS_AI0_IMAGE_TOOL_ID} tool.`
          : "";
      return {
        model,
        toolIds,
        status: {
          ...this.unavailableStatus(
            model,
            imageSkillNames,
            `No compatible ${FATE_KNOTS_AI0_IMAGE_TOOL_ID} tool is installed.${skillSuffix}`
          ),
          workspacePath: server.workspacePath,
          stagingRoot: server.stagingRoot,
          port: server.port,
        },
      };
    }

    const query = new URLSearchParams({ provider: model.providerID, model: model.modelID });
    const toolList = await fetchJson(
      `${baseUrl}/experimental/tool?${query.toString()}`,
      { method: "GET" },
      30_000
    );
    const compatibleTool = toolHasRequiredOutputContract(toolList);
    return {
      model,
      toolIds,
      status: {
        available: compatibleTool,
        activeModelKey: model.modelKey,
        providerId: model.providerID,
        modelId: model.modelID,
        toolId: compatibleTool ? FATE_KNOTS_AI0_IMAGE_TOOL_ID : null,
        compatibleTool,
        imageSkillDetected: imageSkillNames.length > 0,
        imageSkillNames,
        reason: compatibleTool
          ? null
          : `${FATE_KNOTS_AI0_IMAGE_TOOL_ID} exists but does not expose the required prompt + output_path contract.`,
        workspacePath: server.workspacePath,
        stagingRoot: server.stagingRoot,
        port: server.port,
      },
    };
  }

  private async ensureWorkspace(): Promise<{ workspacePath: string; stagingRoot: string }> {
    const root = join(Paths.getRoomStorageDir("game-room"), "fate-knots", "ai0-image-worker");
    const workspacePath = join(root, "workspace");
    const stagingRoot = join(root, "staging");
    await Promise.all([mkdir(workspacePath, { recursive: true }), mkdir(stagingRoot, { recursive: true })]);
    // Remove the legacy Fate Knots-owned OpenCode config. User/global OpenCode config now owns plugins and skills.
    await rm(join(workspacePath, "opencode.json"), { force: true });
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
    const port = await findAvailablePort();
    if (port === null) throw new Error("No isolated Fate Knots AI0 image OpenCode port is available.");

    const command = diagnosis.resolvedPath ?? diagnosis.command;
    const args = ["serve", "--port", String(port), "--hostname", "127.0.0.1", workspacePath];
    const spec = buildSpawnSpec(command, args);
    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      OPENCODE_IMAGE_GENERATION_DIR: stagingRoot,
    };
    // Never inherit an app-owned inline config from a parent process; let the user's normal OpenCode config load.
    delete childEnv["OPENCODE_CONFIG_CONTENT"];
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
        execFile("taskkill.exe", ["/PID", String(pid), "/T", "/F"], { windowsHide: true }, () => resolvePromise());
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

export const fateKnotsAi0ImageWorkerService = new FateKnotsAi0ImageWorkerService();
