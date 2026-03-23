import { app } from "electron";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { access, appendFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parseStartupFlagsFromArgv, type StartupUiMode } from "./startup-flags.ts";

type RuntimeControl = {
  workflowSessionId: string;
  desiredMode: "terminal" | "soft" | "ghost-agent";
  phase: "idle" | "preparing-handoff" | "in-ghost" | "returning";
  updatedAt: string;
};

type PackagedSurface = "wrapper" | "main" | "ghost";

type MainLaunchOptions = {
  startPage: string | null;
  autoConnect: boolean;
  uiMode: StartupUiMode;
  sceneDebug: boolean;
};

type WrapperRestartRequest = {
  uiMode: StartupUiMode;
  sceneDebug: boolean;
};

const PACKAGED_SURFACE_FLAG = "--packaged-surface";
const WRAPPER_TERMINAL_ENV_KEY = "HAYALET_WRAPPER_TERMINAL";
const runtimeControlPath = join(resolvePackagedRoot(), "data", "assistant-runtime.json");
const runtimeEventLogPath = join(resolvePackagedRoot(), "data", "assistant-runtime-events.log");
const wrapperRestartRequestPath = join(
  resolvePackagedRoot(),
  "data",
  "assistant-wrapper-restart.json"
);
const wrapperSessionId = createWrapperSessionId();
const dashboard = createWrapperDashboard({
  sessionId: wrapperSessionId,
  userLabel: "KULLANICI",
  developerLabel: "APPIMAGE",
  formatPhaseLabel(phase) {
    return (
      {
        idle: "Hazir",
        "preparing-main": "Hayalet Ev",
        "running-main": "Hayalet Ev",
        "preparing-ghost": "Ghost Agent",
        "running-ghost": "Ghost Agent",
        cleanup: "Kapanis",
      }[phase] ?? phase
    );
  },
});

function resolvePackagedExecutablePath(): string {
  const portableExecutable =
    typeof process.env["PORTABLE_EXECUTABLE_FILE"] === "string"
      ? process.env["PORTABLE_EXECUTABLE_FILE"].trim()
      : "";
  if (portableExecutable !== "") {
    return portableExecutable;
  }

  const appImagePath =
    typeof process.env["APPIMAGE"] === "string" ? process.env["APPIMAGE"].trim() : "";
  if (appImagePath !== "") {
    return appImagePath;
  }

  return process.execPath;
}

function resolvePackagedRoot(): string {
  const portableDir =
    typeof process.env["PORTABLE_EXECUTABLE_DIR"] === "string"
      ? process.env["PORTABLE_EXECUTABLE_DIR"].trim()
      : "";
  if (portableDir !== "") {
    return portableDir;
  }

  return dirname(resolvePackagedExecutablePath());
}

function nowIso(): string {
  return new Date().toISOString();
}

function createWrapperSessionId(): string {
  const stamp = nowIso()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  const random = Math.random().toString(36).slice(2, 6);
  return `${stamp}-${random}`;
}

function repeat(char: string, count: number): string {
  return count > 0 ? char.repeat(count) : "";
}

function pad(text: string, width: number): string {
  if (text.length >= width) {
    return text.slice(0, Math.max(0, width - 1)) + (width > 0 ? "~" : "");
  }
  return text + repeat(" ", width - text.length);
}

function wrapLine(text: string, width: number): string[] {
  if (width <= 0) return [""];
  const value = String(text).replace(/\s+/g, " ").trim();
  if (value === "") return [""];

  const words = value.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current === "") {
      current = word;
      continue;
    }
    if (`${current} ${word}`.length <= width) {
      current = `${current} ${word}`;
      continue;
    }
    lines.push(current);
    current = word;
  }
  if (current !== "") lines.push(current);
  return lines;
}

function normalizeLines(lines: string[], width: number, height: number): string[] {
  const output: string[] = [];
  for (const line of lines) {
    output.push(...wrapLine(line, width));
  }
  if (output.length > height) {
    return output.slice(output.length - height);
  }
  return output;
}

function renderDashboardFrame({
  sessionId,
  phase,
  phaseLabel = phase,
  userLabel = "USER",
  developerLabel = "DEV",
  userLines,
  developerLines,
  width = 120,
  height = 30,
}: {
  sessionId: string;
  phase: string;
  phaseLabel?: string;
  userLabel?: string;
  developerLabel?: string;
  userLines: string[];
  developerLines: string[];
  width?: number;
  height?: number;
}): string {
  const safeWidth = Math.max(60, width);
  const safeHeight = Math.max(12, height);
  const gutter = 3;
  const paneWidth = Math.floor((safeWidth - gutter) / 2);
  const bodyHeight = safeHeight - 5;
  const leftHeader = pad(`${userLabel} ${phaseLabel}`, paneWidth);
  const rightHeader = pad(`${developerLabel} ${sessionId}`, paneWidth);
  const leftLines = normalizeLines(userLines, paneWidth, bodyHeight).map((line) =>
    pad(line, paneWidth)
  );
  const rightLines = normalizeLines(developerLines, paneWidth, bodyHeight).map((line) =>
    pad(line, paneWidth)
  );
  const totalRows = Math.max(leftLines.length, rightLines.length, bodyHeight);
  const rows: string[] = [];

  rows.push(pad(`Wrapper Session ${sessionId}`, safeWidth));
  rows.push(`${leftHeader} | ${rightHeader}`);
  rows.push(`${repeat("-", paneWidth)}-+-${repeat("-", paneWidth)}`);

  for (let index = 0; index < totalRows; index += 1) {
    rows.push(
      `${leftLines[index] ?? repeat(" ", paneWidth)} | ${rightLines[index] ?? repeat(" ", paneWidth)}`
    );
  }

  return rows.join("\n");
}

function createWrapperDashboard({
  stdout = process.stdout,
  sessionId = "wrapper",
  enabled = true,
  userLabel = "USER",
  developerLabel = "DEV",
  formatPhaseLabel = undefined,
}: {
  stdout?: NodeJS.WriteStream;
  sessionId?: string;
  enabled?: boolean;
  userLabel?: string;
  developerLabel?: string;
  formatPhaseLabel?: ((phase: string) => string) | undefined;
} = {}): {
  attach: () => void;
  dispose: (options?: { preserveLastFrame?: boolean }) => void;
  setPhase: (nextPhase: string) => void;
  user: (message: string) => void;
  developer: (message: string) => void;
} {
  const tty = enabled === true && stdout.isTTY === true;
  const userLines: string[] = [];
  const developerLines: string[] = [];
  let phase = "idle";
  let attached = false;

  function prune(lines: string[]): void {
    if (lines.length > 400) {
      lines.splice(0, lines.length - 400);
    }
  }

  function render(): void {
    if (!tty) return;
    const frame = renderDashboardFrame({
      sessionId,
      phase,
      phaseLabel: typeof formatPhaseLabel === "function" ? formatPhaseLabel(phase) : phase,
      userLabel,
      developerLabel,
      userLines,
      developerLines,
      width: stdout.columns,
      height: stdout.rows,
    });
    stdout.write("\u001b[H\u001b[2J");
    stdout.write(`${frame}\n`);
  }

  function attach(): void {
    if (!tty || attached) return;
    attached = true;
    stdout.write("\u001b[?25l");
    render();
  }

  function dispose(options: { preserveLastFrame?: boolean } = {}): void {
    if (tty && attached) {
      if (options.preserveLastFrame !== false) {
        render();
        stdout.write("\u001b[?25h");
        stdout.write("\n");
      } else {
        stdout.write("\u001b[2J\u001b[H\u001b[?25h");
      }
      attached = false;
    }
  }

  function push(lines: string[], label: string, message: string): void {
    if (typeof message !== "string" || message.trim() === "") return;
    lines.push(message.trim());
    prune(lines);
    if (!tty) {
      stdout.write(`[${label}] ${message.trim()}\n`);
      return;
    }
    render();
  }

  return {
    attach,
    dispose,
    setPhase(nextPhase: string): void {
      phase = nextPhase;
      render();
    },
    user(message: string): void {
      push(userLines, "user", message);
    },
    developer(message: string): void {
      push(developerLines, "dev", message);
    },
  };
}

function formatCommand(command: string, args: string[] = []): string {
  return [command, ...args].join(" ");
}

function formatProcessLine(role: string, streamName: string, line: string): string {
  return `[${role}:${streamName}] ${line}`;
}

function isNoiseLogLine(line: string): boolean {
  if (typeof line !== "string") return true;
  const trimmed = line.trim();
  if (trimmed === "") return true;
  return ["xapp-gtk3-module", "bind() failed", "Cannot start http server for devtools"].some(
    (pattern) => trimmed.includes(pattern)
  );
}

function splitLines(
  chunk: Buffer | string,
  remainder: string = ""
): { lines: string[]; remainder: string } {
  const text = `${remainder}${chunk.toString("utf-8")}`;
  const parts = text.split(/\r?\n/);
  const tail = parts.pop() ?? "";
  return {
    lines: parts,
    remainder: tail,
  };
}

function renderUserMessage(event: string): string {
  switch (event) {
    case "wrapper.start":
      return "wrapper calisiyor";
    case "wrapper.stop":
      return "wrapper durdu";
    case "main.prepare":
      return "hayalet-ev hazirlaniyor.";
    case "main.launch":
      return "hayalet-ev aciliyor.";
    case "main.closed":
      return "hayalet-ev kapandi.";
    case "main.restart":
      return "hayalet-ev yeniden baslatiliyor.";
    case "ghost.prepare":
      return "ghost-agent hazirlaniyor.";
    case "ghost.launch":
      return "ghost-agent aciliyor.";
    case "ghost.closed":
      return "ghost-agent kapandi.";
    case "cycle.to-ghost":
      return "ghost-agent moduna geciliyor.";
    case "cycle.to-app":
      return "hayalet-ev'e geri donuluyor.";
    case "cleanup":
      return "temizlik yapiliyor.";
    case "error":
      return "wrapper hata verdi.";
    default:
      return event;
  }
}

function escapeShellSingleQuotes(value: string): string {
  return value.replace(/'/g, `'\\''`);
}

function quoteShellArg(value: string): string {
  return `'${escapeShellSingleQuotes(value)}'`;
}

function defaultControl(now: string = nowIso()): RuntimeControl {
  return {
    workflowSessionId: "",
    desiredMode: "soft",
    phase: "idle",
    updatedAt: now,
  };
}

function normalizeControl(raw: unknown, now: string = nowIso()): RuntimeControl {
  const fallback = defaultControl(now);
  const data = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};

  const desiredModeRaw =
    typeof data["desiredMode"] === "string" ? data["desiredMode"] : fallback.desiredMode;
  const desiredMode =
    desiredModeRaw === "terminal" || desiredModeRaw === "soft" || desiredModeRaw === "ghost-agent"
      ? desiredModeRaw
      : fallback.desiredMode;

  const phaseRaw = typeof data["phase"] === "string" ? data["phase"] : fallback.phase;
  const phase =
    phaseRaw === "idle" ||
    phaseRaw === "preparing-handoff" ||
    phaseRaw === "in-ghost" ||
    phaseRaw === "returning"
      ? phaseRaw
      : fallback.phase;

  return {
    workflowSessionId:
      typeof data["workflowSessionId"] === "string"
        ? data["workflowSessionId"]
        : fallback.workflowSessionId,
    desiredMode,
    phase,
    updatedAt: typeof data["updatedAt"] === "string" ? data["updatedAt"] : fallback.updatedAt,
  };
}

async function ensureControlFile(): Promise<void> {
  await mkdir(dirname(runtimeControlPath), { recursive: true });
  try {
    await access(runtimeControlPath);
  } catch {
    await writeFile(runtimeControlPath, `${JSON.stringify(defaultControl(), null, 2)}\n`, "utf-8");
  }
}

async function readControl(): Promise<RuntimeControl> {
  await ensureControlFile();
  try {
    const raw = await readFile(runtimeControlPath, "utf-8");
    return normalizeControl(JSON.parse(raw));
  } catch {
    return defaultControl();
  }
}

async function writeControl(nextControl: RuntimeControl): Promise<RuntimeControl> {
  await mkdir(dirname(runtimeControlPath), { recursive: true });
  const normalized = normalizeControl(nextControl);
  await writeFile(runtimeControlPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf-8");
  return normalized;
}

async function appendRuntimeEvent(
  event: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  const payload = Object.entries(details)
    .filter((entry) => entry[1] !== undefined && entry[1] !== null && entry[1] !== "")
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");
  const line = `[${nowIso()}] ${event}${payload !== "" ? ` ${payload}` : ""}`;
  await mkdir(dirname(runtimeEventLogPath), { recursive: true });
  await appendFile(runtimeEventLogPath, `${line}\n`, "utf-8");
}

function buildVisibleTerminalShellCommand(): string {
  const relayArgs = process.argv
    .slice(1)
    .filter((arg) => arg !== PACKAGED_SURFACE_FLAG && !arg.startsWith(`${PACKAGED_SURFACE_FLAG}=`));
  const quotedArgs = relayArgs.map((arg) => quoteShellArg(arg)).join(" ");
  const executable = quoteShellArg(resolvePackagedExecutablePath());
  const root = quoteShellArg(resolvePackagedRoot());
  return `cd ${root}; exec ${executable}${quotedArgs !== "" ? ` ${quotedArgs}` : ""}`;
}

function shouldLaunchVisibleTerminal(surface: PackagedSurface): boolean {
  if (surface !== "wrapper") {
    return false;
  }

  if (process.platform !== "linux") {
    return false;
  }

  if (process.stdout.isTTY === true) {
    return false;
  }

  if (process.env[WRAPPER_TERMINAL_ENV_KEY] === "1") {
    return false;
  }

  return (
    typeof process.env["DISPLAY"] === "string" || typeof process.env["WAYLAND_DISPLAY"] === "string"
  );
}

async function spawnDetachedTerminal(
  command: string,
  args: string[],
  options: { shell?: boolean } = {}
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
      shell: options.shell === true,
      env: {
        ...process.env,
        [WRAPPER_TERMINAL_ENV_KEY]: "1",
        LIBVA_DRIVER_NAME: process.env["LIBVA_DRIVER_NAME"] ?? "i965",
      },
    });

    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

async function launchVisibleTerminalIfNeeded(surface: PackagedSurface): Promise<boolean> {
  if (!shouldLaunchVisibleTerminal(surface)) {
    return false;
  }

  const shellCommand = buildVisibleTerminalShellCommand();
  const launchers: Array<{ command: string; args: string[]; shell?: boolean }> = [
    {
      command: "gnome-terminal",
      args: ["--title=Hayalet Ev Wrapper", "--", "bash", "-lc", shellCommand],
    },
    {
      command: "konsole",
      args: ["-e", "bash", "-lc", shellCommand],
    },
    {
      command: "x-terminal-emulator",
      args: ["-e", "bash", "-lc", shellCommand],
    },
    {
      command: "xfce4-terminal",
      args: [
        "--title=Hayalet Ev Wrapper",
        "--command",
        `bash -lc '${escapeShellSingleQuotes(shellCommand)}'`,
      ],
    },
  ];

  // NOTE: Launcher fallback order matters, so probes remain sequential.
  /* eslint-disable no-await-in-loop */
  for (const launcher of launchers) {
    try {
      await spawnDetachedTerminal(launcher.command, launcher.args, {
        shell: launcher.shell === true,
      });
      await appendRuntimeEvent("wrapper.terminal.spawned", {
        sessionId: wrapperSessionId,
        launcher: launcher.command,
      });
      return true;
    } catch {
      continue;
    }
  }
  /* eslint-enable no-await-in-loop */

  await appendRuntimeEvent("wrapper.terminal.spawn-failed", {
    sessionId: wrapperSessionId,
  });
  return false;
}

function parsePackagedSurface(argv: readonly string[] = process.argv): PackagedSurface {
  const prefix = `${PACKAGED_SURFACE_FLAG}=`;
  const raw = argv.find((arg) => arg.startsWith(prefix));
  if (raw === undefined) {
    return "wrapper";
  }

  const value = raw.slice(prefix.length).trim();
  if (value === "main" || value === "ghost") {
    return value;
  }

  return "wrapper";
}

function normalizeWrapperRestartRequest(raw: unknown): WrapperRestartRequest | null {
  const data = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const uiModeRaw = typeof data["uiMode"] === "string" ? data["uiMode"] : "classic";

  return {
    uiMode: uiModeRaw === "scene" ? "scene" : "classic",
    sceneDebug: data["sceneDebug"] === true,
  };
}

async function consumeWrapperRestartRequest(): Promise<WrapperRestartRequest | null> {
  try {
    const raw = await readFile(wrapperRestartRequestPath, "utf-8");
    await rm(wrapperRestartRequestPath, { force: true });
    return normalizeWrapperRestartRequest(JSON.parse(raw));
  } catch {
    return null;
  }
}

function shouldStartGhost(control: RuntimeControl): boolean {
  if (control.desiredMode !== "ghost-agent") {
    return false;
  }

  return control.phase === "preparing-handoff" || control.phase === "in-ghost";
}

function shouldReopenMainAfterGhost(control: RuntimeControl): boolean {
  return control.desiredMode !== "terminal";
}

function toMainRunningControl(control: RuntimeControl): RuntimeControl {
  return normalizeControl({
    ...control,
    desiredMode: "soft",
    phase: "idle",
    updatedAt: nowIso(),
  });
}

function toGhostRunningControl(control: RuntimeControl): RuntimeControl {
  return normalizeControl({
    ...control,
    desiredMode: "ghost-agent",
    phase: "in-ghost",
    updatedAt: nowIso(),
  });
}

function buildMainArgs(options: MainLaunchOptions): string[] {
  const args = [`${PACKAGED_SURFACE_FLAG}=main`, "--no-sandbox"];
  const cdpPort = typeof process.env["CDP_PORT"] === "string" ? process.env["CDP_PORT"].trim() : "";
  if (cdpPort !== "") {
    args.push(`--remote-debugging-port=${cdpPort}`);
  }

  if (options.startPage !== null && options.startPage !== "") {
    args.push(`--start-page=${options.startPage}`);
  }

  if (options.autoConnect) {
    args.push("--auto-connect");
  }

  if (options.uiMode === "scene") {
    args.push("--ui-mode=scene");
  }

  if (options.sceneDebug) {
    args.push("--scene-debug");
  }

  return args;
}

function buildGhostArgs(): string[] {
  const args = [`${PACKAGED_SURFACE_FLAG}=ghost`, "--no-sandbox"];
  const cdpPort = typeof process.env["CDP_PORT"] === "string" ? process.env["CDP_PORT"].trim() : "";
  if (cdpPort !== "") {
    args.push(`--remote-debugging-port=${cdpPort}`);
  }
  return args;
}

function buildChildEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    HAYALET_WRAPPER_MANAGED: "1",
    HAYALET_WRAPPER_SESSION_ID: wrapperSessionId,
    LIBVA_DRIVER_NAME: process.env["LIBVA_DRIVER_NAME"] ?? "i965",
  };
}

function attachPipe(
  role: string,
  streamName: "stdout" | "stderr",
  stream: NodeJS.ReadableStream | null
): void {
  if (stream === null) return;
  let remainder = "";
  stream.on("data", (chunk) => {
    const next = splitLines(chunk as Buffer, remainder);
    remainder = next.remainder;
    for (const line of next.lines) {
      if (isNoiseLogLine(line)) continue;
      dashboard.developer(formatProcessLine(role, streamName, line));
    }
  });
  stream.on("end", () => {
    const finalLine = remainder.trim();
    if (finalLine !== "" && !isNoiseLogLine(finalLine)) {
      dashboard.developer(formatProcessLine(role, streamName, finalLine));
    }
  });
}

async function spawnSurface(label: "main" | "ghost", args: string[]): Promise<number> {
  await appendRuntimeEvent(`wrapper.spawn.${label}`, {
    sessionId: wrapperSessionId,
    executable: resolvePackagedExecutablePath(),
    args: args.join(" "),
  });
  dashboard.developer(`$ ${formatCommand(resolvePackagedExecutablePath(), args)}`);

  return await new Promise<number>((resolve, reject) => {
    const child = spawn(resolvePackagedExecutablePath(), args, {
      cwd: resolvePackagedRoot(),
      env: buildChildEnv(),
      stdio: ["ignore", "pipe", "pipe"],
    }) as unknown as ChildProcessWithoutNullStreams;

    attachPipe(`${label}-app`, "stdout", child.stdout);
    attachPipe(`${label}-app`, "stderr", child.stderr);

    child.once("error", (error) => {
      dashboard.developer(`${label}-app spawn error: ${error.message}`);
      reject(error);
    });

    child.once("close", (code, signal) => {
      dashboard.developer(`${label}-app exited code=${code ?? 0} signal=${signal ?? "none"}`);
      resolve(code ?? 0);
    });
  });
}

async function runPackagedSurface(surface: "main" | "ghost"): Promise<void> {
  if (surface === "main") {
    await import("./main.js");
    return;
  }

  await import("../ghost-agent/electron/main.js");
}

function createInitialMainLaunchOptions(): MainLaunchOptions {
  const startupFlags = parseStartupFlagsFromArgv(process.argv);
  return {
    startPage: startupFlags.startPage,
    autoConnect: startupFlags.autoConnect,
    uiMode: startupFlags.uiMode,
    sceneDebug: startupFlags.sceneDebug,
  };
}

async function runPackagedWrapper(): Promise<void> {
  await ensureControlFile();
  dashboard.attach();
  dashboard.user(renderUserMessage("wrapper.start"));
  await appendRuntimeEvent("wrapper.start", {
    sessionId: wrapperSessionId,
    root: resolvePackagedRoot(),
  });

  let nextTarget: "main" | "ghost" = "main";
  let nextMainLaunchOptions = createInitialMainLaunchOptions();

  try {
    // NOTE: Wrapper lifecycle transitions are intentionally serialized.
    /* eslint-disable no-await-in-loop */
    for (;;) {
      if (nextTarget === "main") {
        dashboard.setPhase("preparing-main");
        dashboard.user(renderUserMessage("main.prepare"));

        const currentControl = await readControl();
        await writeControl(toMainRunningControl(currentControl));

        dashboard.setPhase("running-main");
        dashboard.user(renderUserMessage("main.launch"));

        const code = await spawnSurface("main", buildMainArgs(nextMainLaunchOptions));
        dashboard.user(renderUserMessage("main.closed"));

        const restartRequest = await consumeWrapperRestartRequest();
        if (restartRequest !== null) {
          dashboard.user(renderUserMessage("main.restart"));
          nextMainLaunchOptions = {
            ...nextMainLaunchOptions,
            uiMode: restartRequest.uiMode,
            sceneDebug: restartRequest.sceneDebug,
          };
          continue;
        }

        const afterControl = await readControl();
        if (shouldStartGhost(afterControl)) {
          dashboard.user(renderUserMessage("cycle.to-ghost"));
          nextTarget = "ghost";
          continue;
        }

        process.exitCode = code;
        break;
      }

      dashboard.setPhase("preparing-ghost");
      dashboard.user(renderUserMessage("ghost.prepare"));

      const currentControl = await readControl();
      await writeControl(toGhostRunningControl(currentControl));

      dashboard.setPhase("running-ghost");
      dashboard.user(renderUserMessage("ghost.launch"));

      const code = await spawnSurface("ghost", buildGhostArgs());
      dashboard.user(renderUserMessage("ghost.closed"));

      const afterControl = await readControl();
      if (shouldReopenMainAfterGhost(afterControl)) {
        dashboard.user(renderUserMessage("cycle.to-app"));
        nextTarget = "main";
        nextMainLaunchOptions = {
          ...nextMainLaunchOptions,
          startPage: "assistant",
          autoConnect: true,
        };
        continue;
      }

      process.exitCode = code;
      break;
    }
    /* eslint-enable no-await-in-loop */
  } catch (error) {
    process.exitCode = 1;
    dashboard.user(renderUserMessage("error"));
    throw error;
  } finally {
    dashboard.setPhase("cleanup");
    dashboard.user(renderUserMessage("cleanup"));
    await appendRuntimeEvent("wrapper.stop", {
      sessionId: wrapperSessionId,
      exitCode: process.exitCode ?? 0,
    });
    dashboard.user(renderUserMessage("wrapper.stop"));
    dashboard.dispose();
  }

  app.quit();
}

async function bootstrap(): Promise<void> {
  const surface = parsePackagedSurface();
  if (surface === "main" || surface === "ghost") {
    await runPackagedSurface(surface);
    return;
  }

  if (await launchVisibleTerminalIfNeeded(surface)) {
    app.quit();
    return;
  }

  await runPackagedWrapper();
}

void bootstrap().catch((error) => {
  console.error("[packaged-wrapper]", error);
  process.exitCode = 1;
  app.quit();
});
