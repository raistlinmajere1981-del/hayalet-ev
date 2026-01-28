#!/usr/bin/env node
/**
 * MCP Server Launcher
 * Wraps tsx to run TypeScript entry point
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const tsxPath = join(__dirname, 'node_modules', '.bin', 'tsx');
const entryPoint = join(__dirname, 'index.ts');

const child = spawn(tsxPath, [entryPoint], {
  stdio: 'inherit',
  shell: false
});

child.on('error', (err) => {
  console.error('Failed to start MCP server:', err);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
