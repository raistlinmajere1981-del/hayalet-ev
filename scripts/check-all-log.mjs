import { spawn } from "node:child_process";
import { copyFileSync, createWriteStream, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

// Wraps the full check pipeline so failures stay inspectable after the terminal
// scrolls away. Output is mirrored to the console and written under logs/.
const logDir = join(process.cwd(), "logs");
mkdirSync(logDir, { recursive: true });

const targetScript = process.argv[2] ?? "check:all:steps";
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const runLogPath = join(logDir, `check-all-${stamp}.log`);
const latestLogPath = join(logDir, "check-all.log");
const errorLogPath = join(logDir, "check-all-errors.log");
// Only the latest failure should exist; stale copies would mislead the next run.
rmSync(errorLogPath, { force: true });

const streams = [createWriteStream(runLogPath), createWriteStream(latestLogPath)];

function append(chunk) {
  for (const stream of streams) stream.write(chunk);
}

let completed = false;
async function complete(code, signal) {
  if (completed) return;
  completed = true;
  const detail = signal === null ? `exit code ${code ?? 0}` : `signal ${signal}`;
  const passed = signal === null && code === 0;
  const summary = passed
    ? `\n[check:all] passed. Log: ${runLogPath}\n`
    : `\n[check:all] failed (${detail}). Log: ${runLogPath} | Errors: ${errorLogPath}\n`;
  process.stdout.write(summary);
  append(summary);
  await new Promise((resolve) => {
    let pending = streams.length;
    for (const stream of streams) {
      stream.end(() => {
        pending -= 1;
        if (pending === 0) resolve();
      });
    }
  });
  if (!passed) copyFileSync(runLogPath, errorLogPath);
  process.exitCode = passed ? 0 : 1;
}

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const child = spawn(npmCommand, ["run", targetScript], {
  cwd: process.cwd(),
  env: process.env,
  shell: process.platform === "win32",
  stdio: ["inherit", "pipe", "pipe"],
});

child.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  append(chunk);
});
child.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
  append(chunk);
});

child.on("error", (error) => {
  const message = `[check:all] failed to start: ${error.message}\n`;
  process.stderr.write(message);
  append(message);
  void complete(1, null);
});

child.on("close", (code, signal) => {
  void complete(code, signal);
});
