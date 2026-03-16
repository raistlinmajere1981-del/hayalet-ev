import { spawn } from "node:child_process";
import { access, appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultControl,
  formatWrapperEvent,
  normalizeMainAppUiMode,
  normalizeControl,
  resolveMainAppScriptName,
  shouldStartGhost,
  shouldReopenMainAfterGhost,
  toGhostOnlyStartControl,
  toGhostRunningControl,
  toMainRunningControl,
  toPostGhostControl,
} from "./lib/ghost-wrapper-runtime.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = dirname(__dirname);

const ghostEntry = join(root, "dist", "ghost-agent", "electron", "main.js");
const runtimeControlPath = join(root, "data", "assistant-runtime.json");
const runtimeEventLogPath = join(root, "data", "assistant-runtime-events.log");

const env = {
  ...process.env,
  APP_UI_MODE: normalizeMainAppUiMode(process.env.APP_UI_MODE),
  LIBVA_DRIVER_NAME: process.env.LIBVA_DRIVER_NAME ?? "i965",
};

function nowIso() {
  return new Date().toISOString();
}

async function ensureControlFile() {
  await mkdir(dirname(runtimeControlPath), { recursive: true });
  try {
    await access(runtimeControlPath);
  } catch {
    await writeFile(
      runtimeControlPath,
      `${JSON.stringify(defaultControl(nowIso()), null, 2)}\n`,
      "utf-8"
    );
  }
}

async function logWrapperEvent(event, details = {}) {
  const line = formatWrapperEvent(event, details, nowIso());
  await appendFile(runtimeEventLogPath, `${line}\n`, "utf-8");
  console.info(`[ghost-agent-wrapper] ${line}`);
}

async function readControl() {
  await ensureControlFile();
  try {
    const raw = await readFile(runtimeControlPath, "utf-8");
    const parsed = JSON.parse(raw);
    return normalizeControl(parsed, nowIso());
  } catch {
    return defaultControl(nowIso());
  }
}

async function writeControl(nextControl) {
  const normalized = normalizeControl(nextControl, nowIso());
  await writeFile(runtimeControlPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf-8");
  return normalized;
}

function run(command, args, label) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      env,
    });

    child.on("spawn", () => {
      void logWrapperEvent("process.spawn", {
        label,
        pid: child.pid,
        command,
      });
    });

    child.on("close", (code) => {
      if (code !== 0) {
        console.error(`[ghost-agent-wrapper] ${label} exited with code ${String(code)}`);
      }
      void logWrapperEvent("process.exit", { label, code: code ?? 0 });
      resolve(code ?? 0);
    });
  });
}

async function runMainApp(useAssistantStartupFlags = false) {
  const currentControl = await readControl();
  const runningMainControl = toMainRunningControl(currentControl, nowIso());
  const uiMode = normalizeMainAppUiMode(env.APP_UI_MODE);
  const scriptName = resolveMainAppScriptName(useAssistantStartupFlags, uiMode);
  await writeControl(runningMainControl);
  await logWrapperEvent("cycle.main.sync", {
    desiredMode: runningMainControl.desiredMode,
    phase: runningMainControl.phase,
    workflowSessionId: runningMainControl.workflowSessionId,
    assistantStartup: useAssistantStartupFlags,
    uiMode,
  });

  return await run("npm", ["run", scriptName], "app");
}

async function runGhostApp() {
  const cdpPort = process.env.CDP_PORT ?? "9222";
  return await run(
    "electron",
    [ghostEntry, "--no-sandbox", `--remote-debugging-port=${cdpPort}`],
    "ghost-agent"
  );
}

async function runGhostOnly() {
  await ensureControlFile();
  await logWrapperEvent("wrapper.start", { runtimeControlPath, mode: "ghost-only" });

  // Runtime'ı ghost-only moduna al: desiredMode=ghost-agent, phase=in-ghost
  const startControl = await readControl();
  const ghostOnlyControl = toGhostOnlyStartControl(startControl, nowIso());
  await writeControl(ghostOnlyControl);
  await logWrapperEvent("cycle.ghost.start", {
    nextTarget: "ghost",
    desiredMode: ghostOnlyControl.desiredMode,
    phase: ghostOnlyControl.phase,
  });

  const code = await runGhostApp();

  // Ghost kapandı — runtime'ı oku ve post-ghost durumuna geçir
  const afterControl = await readControl();
  const idleControl = toPostGhostControl(afterControl, nowIso());
  await writeControl(idleControl);
  await logWrapperEvent("cycle.ghost.closed", {
    code,
    desiredMode: idleControl.desiredMode,
    phase: idleControl.phase,
  });

  // "Hayalet-ev'e Geç" butonuna basıldıysa (desiredMode=soft) app'i aç
  if (shouldReopenMainAfterGhost(idleControl)) {
    await logWrapperEvent("cycle.main.start", { nextTarget: "app", assistantStartup: true });
    await runMainApp(true);
  } else {
    await logWrapperEvent("cycle.stop", {
      reason: "ghost-close-requested",
      desiredMode: idleControl.desiredMode,
      phase: idleControl.phase,
    });
  }

  process.exitCode = code !== 0 ? code : 0;
}

async function main() {
  if (process.argv.includes("--ghost-only")) {
    return runGhostOnly();
  }

  await ensureControlFile();
  await logWrapperEvent("wrapper.start", { runtimeControlPath });

  let nextTarget = "app";
  let launchAssistantOnNextMain = false;

  while (true) {
    if (nextTarget === "app") {
      await logWrapperEvent("cycle.main.start", {
        nextTarget,
        assistantStartup: launchAssistantOnNextMain,
      });
      const code = await runMainApp(launchAssistantOnNextMain);
      launchAssistantOnNextMain = false;
      if (code !== 0) {
        await logWrapperEvent("cycle.main.crash", { code });
        process.exitCode = code;
        return;
      }

      const control = await readControl();
      await logWrapperEvent("cycle.main.closed", {
        desiredMode: control.desiredMode,
        phase: control.phase,
        workflowSessionId: control.workflowSessionId,
      });

      if (!shouldStartGhost(control)) {
        await logWrapperEvent("cycle.stop", {
          reason: "ghost-not-requested",
          desiredMode: control.desiredMode,
          phase: control.phase,
        });
        return;
      }

      const inGhostControl = toGhostRunningControl(control, nowIso());
      await writeControl(inGhostControl);
      await logWrapperEvent("cycle.ghost.prepare", {
        desiredMode: inGhostControl.desiredMode,
        phase: inGhostControl.phase,
      });
      nextTarget = "ghost";
      continue;
    }

    await logWrapperEvent("cycle.ghost.start", { nextTarget });
    const ghostCode = await runGhostApp();
    if (ghostCode !== 0) {
      console.error("[ghost-agent-wrapper] ghost-agent ended with non-zero exit; returning to app");
    }

    const control = await readControl();
    const idleControl = toPostGhostControl(control, nowIso());
    await writeControl(idleControl);
    await logWrapperEvent("cycle.ghost.closed", {
      code: ghostCode,
      desiredMode: idleControl.desiredMode,
      phase: idleControl.phase,
      workflowSessionId: idleControl.workflowSessionId,
    });

    if (!shouldReopenMainAfterGhost(idleControl)) {
      await logWrapperEvent("cycle.stop", {
        reason: "ghost-close-requested",
        desiredMode: idleControl.desiredMode,
        phase: idleControl.phase,
      });
      return;
    }

    launchAssistantOnNextMain = true;
    nextTarget = "app";
  }
}

void main();
