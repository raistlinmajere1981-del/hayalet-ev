import assert from "node:assert/strict";
import test from "node:test";

import { createAndroidTools } from "../../mcp-server/core/handlers/android-handlers.ts";
import { takeAndroidScreenshot } from "../../mcp-server/tools/android-tools.ts";

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

function commandResult(stdout: Buffer | string, exitCode = 0, stderr = "") {
  return {
    exitCode,
    stdout: Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout),
    stderr,
    timedOut: false,
  };
}

void test("android tool registry includes ADB screenshot tool", () => {
  const entries = createAndroidTools({ PROJECT_ROOT: "/repo", LOG_DIR: "/repo/logs" });
  const definitions = new Map(
    entries.map((entry) => [(entry.definition as any).name, entry.definition] as const)
  );
  const screenshot: any = definitions.get("hev_take_android_screenshot");

  assert.ok(screenshot);
  assert.equal(screenshot.inputSchema.properties?.deviceId?.type, "string");
  assert.equal(screenshot.inputSchema.properties?.savePath?.type, "string");
  assert.equal(screenshot.inputSchema.properties?.adbPath?.type, "string");
  assert.equal(screenshot.inputSchema.properties?.timeoutMs?.type, "number");
  assert.deepEqual(screenshot.inputSchema.properties?.strategy?.enum, [
    "auto",
    "exec-out",
    "file-pull",
  ]);
});

void test("android screenshot uses exec-out when PNG data is available", async () => {
  const calls: string[][] = [];
  let writtenPath = "";
  let writtenBytes = Buffer.alloc(0);

  const result = await takeAndroidScreenshot("/repo", {
    _timestamp: 1234,
    _resolveAdbPath: async () => "/sdk/platform-tools/adb",
    _mkdir: async () => undefined,
    _writeFile: async (filePath: any, data: any) => {
      writtenPath = filePath;
      writtenBytes = data;
    },
    _runCommand: async (_command: any, args: any[]) => {
      calls.push(args);
      if (args.join(" ") === "devices -l") {
        return commandResult("List of devices attached\nabc123 device product:test\n");
      }
      if (args.join(" ") === "-s abc123 exec-out screencap -p") {
        return commandResult(PNG_BYTES);
      }
      throw new Error(`Unexpected command: ${args.join(" ")}`);
    },
  });

  const text = String(result.content[0]?.text ?? "");
  assert.equal(result.isError, undefined);
  assert.match(text, /Strategy: exec-out/);
  assert.equal(writtenPath, "/repo/data/android-screenshots/android-screenshot-1234.png");
  assert.deepEqual(writtenBytes, PNG_BYTES);
  assert.deepEqual(
    calls.map((args) => args.join(" ")),
    ["devices -l", "-s abc123 exec-out screencap -p"]
  );
});

void test("android screenshot falls back to device file pull for older adb paths", async () => {
  const calls: string[][] = [];

  const result = await takeAndroidScreenshot("/repo", {
    _timestamp: 5678,
    _resolveAdbPath: async () => "/sdk/platform-tools/adb",
    _mkdir: async () => undefined,
    _readFile: async () => PNG_BYTES,
    _runCommand: async (_command: any, args: any[]) => {
      calls.push(args);
      if (args.join(" ") === "devices -l") {
        return commandResult("List of devices attached\nabc123 device product:test\n");
      }
      if (args.join(" ") === "-s abc123 exec-out screencap -p") {
        return commandResult("exec-out unsupported", 1, "unknown command exec-out");
      }
      if (
        args.join(" ") === "-s abc123 shell screencap /sdcard/hayalet-ev-debug-screenshot-5678.png"
      ) {
        return commandResult("");
      }
      if (
        args.join(" ") ===
        "-s abc123 pull /sdcard/hayalet-ev-debug-screenshot-5678.png /repo/data/android-screenshots/android-screenshot-5678.png"
      ) {
        return commandResult("");
      }
      if (args.join(" ") === "-s abc123 shell rm /sdcard/hayalet-ev-debug-screenshot-5678.png") {
        return commandResult("");
      }
      throw new Error(`Unexpected command: ${args.join(" ")}`);
    },
  });

  const text = String(result.content[0]?.text ?? "");
  assert.equal(result.isError, undefined);
  assert.match(text, /Strategy: file-pull/);
  assert.match(text, /Fallback reason: unknown command exec-out/);
  assert.deepEqual(
    calls.map((args) => args.join(" ")),
    [
      "devices -l",
      "-s abc123 exec-out screencap -p",
      "-s abc123 shell screencap /sdcard/hayalet-ev-debug-screenshot-5678.png",
      "-s abc123 pull /sdcard/hayalet-ev-debug-screenshot-5678.png /repo/data/android-screenshots/android-screenshot-5678.png",
      "-s abc123 shell rm /sdcard/hayalet-ev-debug-screenshot-5678.png",
    ]
  );
});

void test("android screenshot requires deviceId when multiple devices are ready", async () => {
  const result = await takeAndroidScreenshot("/repo", {
    _resolveAdbPath: async () => "/sdk/platform-tools/adb",
    _mkdir: async () => undefined,
    _runCommand: async (_command: any, args: any[]) => {
      if (args.join(" ") === "devices -l") {
        return commandResult(
          "List of devices attached\nabc123 device product:test\nxyz789 device product:test\n"
        );
      }
      throw new Error(`Unexpected command: ${args.join(" ")}`);
    },
  });

  const text = String(result.content[0]?.text ?? "");
  assert.equal(result.isError, true);
  assert.match(text, /Multiple Android devices are ready/);
});
