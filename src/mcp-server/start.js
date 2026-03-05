#!/usr/bin/env node
/**
 * MCP Server Launcher
 * Wraps tsx to run TypeScript entry point
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

// Use tsx from root node_modules (shared after migration)
const tsxPath = join(__dirname, "..", "..", "node_modules", ".bin", "tsx");
const entryPoint = join(__dirname, "index.ts");

const child = spawn(tsxPath, [entryPoint], {
  stdio: "inherit",
  shell: false,
  env: globalThis.process.env,
});

child.on("error", (err) => {
  globalThis.console.error("Failed to start MCP server:", err);
  globalThis.process.exit(1);
});

child.on("exit", (code) => {
  globalThis.process.exit(code || 0);
});
