import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { defaultControl, normalizeControl } from "./lib/ghost-wrapper-runtime.mjs";
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

async function readProcessArgs() {
  try {
    const { stdout } = await execFileAsync("ps", ["-eo", "pid=,args="]);
    return stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function buildProcessProbes(lines) {
  const mainProcess = lines.some(
    (line) => line.includes("dist/electron/main.js") && !line.includes("dist/ghost-agent/electron/main.js")
  );
  const ghostProcess = lines.some((line) => line.includes("dist/ghost-agent/electron/main.js"));
  const wrapperProcess = lines.some((line) => line.includes("scripts/ghost-agent-wrapper.mjs"));

  return {
    mainProcess,
    ghostProcess,
    wrapperProcess,
  };
}

function parseModeOnlyFlag(argv) {
  return argv.includes("--mode-only");
}

async function main() {
  const modeOnly = parseModeOnlyFlag(process.argv.slice(2));

  const [control, processLines] = await Promise.all([readRuntimeControl(), readProcessArgs()]);
  const probes = buildProcessProbes(processLines);

  const resolved = resolveWhereAmI({
    control,
    probes,
    nowIso: nowIso(),
  });

  const payload = {
    ...resolved,
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
