import { spawn } from "node:child_process";
import { join } from "node:path";

import { buildMainAppLaunchArgs, normalizeMainAppUiMode } from "./ghost-wrapper-runtime.mjs";
import { createUserMessage, formatCommand, formatProcessLine, isNoiseLogLine } from "./wrapper-events.mjs";

const VITE_URLS = ["http://127.0.0.1:5174", "http://localhost:5174"];

function resolveExecutable(name) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

function createDeferred() {
  let resolve;
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

export function splitLines(chunk, remainder = "") {
  const text = `${remainder}${chunk.toString("utf-8")}`;
  const parts = text.split(/\r?\n/);
  const tail = parts.pop() ?? "";
  return {
    lines: parts,
    remainder: tail,
  };
}

async function waitForHttpReady(urls, timeoutMs = 30000, intervalMs = 250) {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    for (const url of urls) {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(2000),
        });
        if (response.ok || response.status < 500) {
          return url;
        }
      } catch {
        // Keep polling until timeout.
      }
    }

    await new Promise((resolve) => {
      setTimeout(resolve, intervalMs);
    });
  }

  throw new Error(`Timed out while waiting for Vite readiness after ${timeoutMs}ms.`);
}

export function createWrapperSupervisor({ root, env, dashboard, sessionId, onEvent = () => {} }) {
  const children = new Map();
  const npmCommand = resolveExecutable("npm");
  const viteCommand = resolveExecutable("vite");
  const electronCommand = resolveExecutable("electron");
  const mainEntry = join(root, "dist", "electron", "main.js");
  const ghostEntry = join(root, "dist", "ghost-agent", "electron", "main.js");

  function emit(event, details = {}) {
    dashboard.user(createUserMessage(event, details));
    onEvent(event, details);
  }

  function developer(message) {
    dashboard.developer(message);
  }

  function registerChild(role, child, command, args) {
    const closed = createDeferred();
    let settled = false;
    const record = {
      role,
      child,
      command,
      args,
      closed: closed.promise,
    };

    child.once("close", (code, signal) => {
      if (settled) return;
      settled = true;
      if (children.get(role)?.child === child) {
        children.delete(role);
      }
      developer(`${role} exited code=${code ?? 0} signal=${signal ?? "none"}`);
      closed.resolve(code ?? 0);
    });

    child.once("error", (error) => {
      developer(`${role} spawn error: ${error.message}`);
      if (settled) return;
      settled = true;
      if (children.get(role)?.child === child) {
        children.delete(role);
      }
      closed.resolve(1);
    });

    children.set(role, record);
    return record;
  }

  function attachPipe(role, streamName, stream) {
    if (stream == null) return;
    let remainder = "";
    stream.on("data", (chunk) => {
      const next = splitLines(chunk, remainder);
      remainder = next.remainder;
      for (const line of next.lines) {
        if (isNoiseLogLine(line)) continue;
        developer(formatProcessLine(role, streamName, line));
      }
    });
    stream.on("end", () => {
      const finalLine = remainder.trim();
      if (finalLine !== "" && !isNoiseLogLine(finalLine)) {
        developer(formatProcessLine(role, streamName, finalLine));
      }
    });
  }

  function spawnManaged(role, command, args, options = {}) {
    developer(`$ ${formatCommand(command, args)}`);
    const child = spawn(command, args, {
      cwd: root,
      env: { ...env, ...(options.env ?? {}) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    attachPipe(role, "stdout", child.stdout);
    attachPipe(role, "stderr", child.stderr);
    return registerChild(role, child, command, args);
  }

  async function runShortCommand(role, command, args, { eventName = null } = {}) {
    if (eventName !== null) {
      emit(eventName);
    }

    const record = spawnManaged(role, command, args);
    const code = await record.closed;
    if (code !== 0) {
      throw new Error(`${role} failed with exit code ${code}`);
    }
  }

  async function stopRole(role, { signal = "SIGTERM" } = {}) {
    const record = children.get(role);
    if (record === undefined) return;

    developer(`Stopping ${role} with ${signal}`);
    record.child.kill(signal);
    await record.closed;
  }

  async function resetVite() {
    dashboard.setPhase("resetting-vite");
    emit("vite.reset");
    await stopRole("vite");
    const record = spawnManaged("vite", viteCommand, [], {
      env: {
        FORCE_COLOR: "0",
      },
    });
    await waitForHttpReady(VITE_URLS);
    emit("vite.ready");
    return record;
  }

  function buildMainArgs({ assistantStartup = false, uiMode = "classic", sceneDebug = false }) {
    return buildMainAppLaunchArgs(mainEntry, {
      assistantStartup,
      uiMode,
      sceneDebug,
      cdpPort: process.env.CDP_PORT ?? "9222",
    });
  }

  function buildGhostArgs() {
    return [ghostEntry, "--no-sandbox", `--remote-debugging-port=${process.env.CDP_PORT ?? "9222"}`];
  }

  async function runMainAppCycle({ assistantStartup = false, uiMode = "classic", sceneDebug = false } = {}) {
    dashboard.setPhase("preparing-app");
    emit("main.prepare", { assistantStartup });
    await runShortCommand("build-main", npmCommand, ["run", "electron:build"], {
      eventName: "main.build",
    });
    await resetVite();
    dashboard.setPhase("running-app");
    emit("main.launch");
    const record = spawnManaged("main-app", electronCommand, buildMainArgs({
      assistantStartup,
      uiMode: normalizeMainAppUiMode(uiMode),
      sceneDebug,
    }), {
      env: {
        HAYALET_WRAPPER_MANAGED: "1",
        HAYALET_WRAPPER_SESSION_ID: sessionId,
        LIBVA_DRIVER_NAME: env.LIBVA_DRIVER_NAME ?? "i965",
      },
    });
    const code = await record.closed;
    emit("main.closed");
    await stopRole("vite");
    return code;
  }

  async function runGhostAppCycle() {
    dashboard.setPhase("preparing-ghost");
    emit("ghost.prepare");
    await runShortCommand("build-ghost", npmCommand, ["run", "ghost:build:all"], {
      eventName: "ghost.build",
    });
    dashboard.setPhase("running-ghost");
    emit("ghost.launch");
    const record = spawnManaged("ghost-app", electronCommand, buildGhostArgs(), {
      env: {
        LIBVA_DRIVER_NAME: env.LIBVA_DRIVER_NAME ?? "i965",
      },
    });
    const code = await record.closed;
    emit("ghost.closed");
    return code;
  }

  async function cleanup() {
    dashboard.setPhase("cleanup");
    emit("cleanup");
    await stopRole("main-app");
    await stopRole("ghost-app");
    await stopRole("vite");
  }

  developer(`wrapper session ${sessionId} initialized`);

  return {
    cleanup,
    emit,
    runGhostAppCycle,
    runMainAppCycle,
  };
}
