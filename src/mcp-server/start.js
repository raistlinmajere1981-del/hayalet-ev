#!/usr/bin/env node
/**
 * MCP Server Launcher
 * Runs the TypeScript entry point via Node's `--import tsx` loader to avoid
 * the tsx CLI IPC layer, which can fail before MCP initialize completes.
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";

// Load .env from project root (silent to avoid JSONRPC pollution)
dotenv.config({
  path: join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".env"),
  quiet: true, // Suppress dotenv console output
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
