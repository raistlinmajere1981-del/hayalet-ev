#!/usr/bin/env node
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";

// NOTE: Load .env from project root (silent to avoid JSONRPC pollution).
dotenv.config({
  path: join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".env"),
  quiet: true,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..", "..");
const entryPoint = join(__dirname, "index.ts");

const child = spawn(
  globalThis.process.execPath,
  ["--import", "tsx", entryPoint, ...globalThis.process.argv.slice(2)],
  {
    stdio: "inherit",
    shell: false,
    env: globalThis.process.env,
    cwd: projectRoot,
  }
);

child.on("error", (err) => {
  globalThis.console.error("Failed to start MCP server:", err);
  globalThis.process.exit(1);
});

child.on("exit", (code) => {
  globalThis.process.exit(code || 0);
});
