import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { defaultControl, normalizeControl } from "./lib/ghost-wrapper-runtime.mjs";
import { resolveWhereamiProviderContext } from "./lib/whereami-provider-context.mjs";
import { resolveWhereAmI } from "./lib/whereami-runtime.mjs";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = dirname(__dirname);
const runtimeControlPath = join(root, "data", "assistant-runtime.json");

function nowIso() {
  return new Date().toISOString();
}

async function readRuntimeControl() {
  const fallback = defaultControl(nowIso());
  try {
    const raw = await readFile(runtimeControlPath, "utf-8");
    const parsed = JSON.parse(raw);
    return normalizeControl(parsed, nowIso());
  } catch {
    return fallback;
  }
}

function parseProcessLine(line) {
  const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/);
  if (match === null) return null;

  const pid = Number.parseInt(match[1] ?? "", 10);
  const ppid = Number.parseInt(match[2] ?? "", 10);
  const args = (match[3] ?? "").trim();
  if (!Number.isFinite(pid) || !Number.isFinite(ppid) || args === "") {
    return null;
  }

  return {
    pid,
    ppid,
    args,
  };
}

function isMainAppProcess(args) {
  return args.includes("dist/electron/main.js") && !args.includes("dist/ghost-agent/electron/main.js");
}

function isGhostAppProcess(args) {
  return args.includes("dist/ghost-agent/electron/main.js");
}

function isWrapperProcess(args) {
  return args.includes("scripts/ghost-agent-wrapper.mjs");
}

function isOpencodeServeProcess(args) {
  return /\bopencode\b.*\bserve\b/i.test(args);
}

async function readProcessEntries() {
  try {
    const { stdout } = await execFileAsync("ps", ["-eo", "pid=,ppid=,args="]);
    return stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => parseProcessLine(line))
      .filter((entry) => entry !== null);
  } catch {
    return [];
  }
}

function buildProcessProbes(entries) {
  const mainProcess = entries.some((entry) => isMainAppProcess(entry.args));
  const ghostProcess = entries.some((entry) => isGhostAppProcess(entry.args));
  const wrapperProcess = entries.some((entry) => isWrapperProcess(entry.args));
  const opencodeServerRunning = entries.some((entry) => isOpencodeServeProcess(entry.args));

  return {
    mainProcess,
    ghostProcess,
    wrapperProcess,
    opencodeServerRunning,
  };
}

function parseModeOnlyFlag(argv) {
  return argv.includes("--mode-only");
}

async function main() {
  const modeOnly = parseModeOnlyFlag(process.argv.slice(2));

  const [control, processEntries] = await Promise.all([readRuntimeControl(), readProcessEntries()]);
  const probes = buildProcessProbes(processEntries);

  const resolved = resolveWhereAmI({
    control,
    probes,
    nowIso: nowIso(),
  });
  const providerContext = resolveWhereamiProviderContext({
    entries: processEntries,
    currentPid: process.pid,
    resolvedMode: resolved.mode,
    probes,
  });
  const effectiveMode =
    typeof providerContext.effectiveMode === "string" && providerContext.effectiveMode !== ""
      ? providerContext.effectiveMode
      : resolved.mode;

  const payload = {
    ...resolved,
    mode: effectiveMode,
    appMode: resolved.mode,
    effectiveMode,
    providerContext,
    timestamp: nowIso(),
    runtimeControlPath,
  };

  if (modeOnly) {
    process.stdout.write(`${payload.mode}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  }

  if (payload.shouldStop) {
    process.exitCode = 2;
  }
}

void main();
