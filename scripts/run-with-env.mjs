import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, extname, join } from "node:path";

function splitEnvAssignment(value) {
  const index = value.indexOf("=");
  if (index <= 0) return null;
  const key = value.slice(0, index);
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) !== true) return null;
  return [key, value.slice(index + 1)];
}

function resolveWindowsCommand(command) {
  if (process.platform !== "win32" || /[\\/]/.test(command) || extname(command) !== "") {
    return command;
  }

  const pathEntries = (process.env.PATH ?? "").split(delimiter).filter((entry) => entry !== "");
  const extensions = ["", ".cmd", ".exe", ".bat"];
  for (const entry of pathEntries) {
    for (const extension of extensions) {
      const candidate = join(entry, `${command}${extension}`);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return command;
}

function parseArgs(argv) {
  const separatorIndex = argv.indexOf("--");
  const envTokens = separatorIndex === -1 ? [] : argv.slice(0, separatorIndex);
  const commandTokens = separatorIndex === -1 ? argv : argv.slice(separatorIndex + 1);
  const env = { ...process.env };

  for (const token of envTokens) {
    const assignment = splitEnvAssignment(token);
    if (assignment === null) {
      throw new Error(`Expected KEY=value before --, got ${token}`);
    }
    const [key, value] = assignment;
    env[key] = value;
  }

  if (commandTokens.length === 0) {
    throw new Error("Usage: node scripts/run-with-env.mjs KEY=value -- command [args...]");
  }

  return {
    env,
    command: commandTokens[0],
    args: commandTokens.slice(1),
  };
}

const parsed = parseArgs(process.argv.slice(2));
const child = spawn(resolveWindowsCommand(parsed.command), parsed.args, {
  cwd: process.cwd(),
  env: parsed.env,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal !== null) {
    console.error(`Command interrupted by ${signal}`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 0;
});
