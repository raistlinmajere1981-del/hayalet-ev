#!/usr/bin/env node
// NOTE: Load environment variables silently to avoid JSON-RPC output pollution.
import dotenv from "dotenv";

// NOTE: Suppress dotenv console output to prevent JSON-RPC parsing errors.
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
