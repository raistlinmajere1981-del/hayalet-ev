#!/usr/bin/env node
/**
 * MCP Server Entry Point
 * app MCP Server - 87 development tools
 */

// Load environment variables first (silent to avoid JSONRPC pollution)
import dotenv from "dotenv";

// Suppress dotenv console output to prevent JSONRPC parsing errors
const originalWrite = process.stdout.write;
process.stdout.write = (() => true) as typeof process.stdout.write;
dotenv.config();
process.stdout.write = originalWrite;

import { main } from "./core/server-setup.js";

const VERSION = "1.7.0";

if (process.argv.includes("--version") || process.argv.includes("-v")) {
  process.stdout.write(`${VERSION}\n`);
  process.exit(0);
}

void main();
