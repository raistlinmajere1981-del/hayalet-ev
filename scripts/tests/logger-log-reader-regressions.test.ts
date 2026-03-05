import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";

const projectRoot = process.cwd();
const tscCliPath = resolve(projectRoot, "node_modules", "typescript", "bin", "tsc");

test("electron typecheck has no TS2375 in log-reader", () => {
  const result = spawnSync(process.execPath, [tscCliPath, "--noEmit", "-p", "tsconfig.electron.json"], {
    cwd: projectRoot,
    encoding: "utf-8",
  });

  const output = `${result.stdout}\n${result.stderr}`;

  assert.equal(
    result.status,
    0,
    `Expected tsc to pass for tsconfig.electron.json.\nOutput:\n${output}`
  );
  assert.doesNotMatch(output, /electron\/logger\/log-reader\.ts\(\d+,\d+\): error TS2375/);
});
