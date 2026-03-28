#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const PACKAGE_NAME = "@u4/opencv4nodejs";
const PACKAGE_VERSION = "7.1.2";
const BUILD_LIST = "core,imgproc,imgcodecs";
const OPENCV_BUILD_ROOT = path.join(ROOT, "tmp", "opencv-build");
const OPENCV_PACKAGE_ROOT = path.join(ROOT, "node_modules", "@u4", "opencv4nodejs");
const OPENCV_BUILD_PACKAGE_ROOT = path.join(ROOT, "node_modules", "@u4", "opencv-build");

function log(message) {
  console.log(`[opencv:install] ${message}`);
}

async function readInstalledVersion() {
  try {
    const packageJsonPath = path.join(OPENCV_PACKAGE_ROOT, "package.json");
    const raw = await readFile(packageJsonPath, "utf8");
    const parsed = JSON.parse(raw);
    return typeof parsed.version === "string" ? parsed.version : null;
  } catch {
    return null;
  }
}

async function removeExistingInstall() {
  await rm(OPENCV_PACKAGE_ROOT, { recursive: true, force: true });
  await rm(OPENCV_BUILD_PACKAGE_ROOT, { recursive: true, force: true });
}

async function runInstall(env) {
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  const args = ["install", "--no-save", `${PACKAGE_NAME}@${PACKAGE_VERSION}`];

  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: "inherit",
      env: {
        ...process.env,
        ...env,
      },
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      if (signal) {
        reject(new Error(`Install terminated by signal ${signal}.`));
        return;
      }
      reject(new Error(`Install exited with code ${code}.`));
    });
  });
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const force = args.has("--force");
  const installedVersion = await readInstalledVersion();

  if (installedVersion === PACKAGE_VERSION && !force) {
    log(`Optional package already installed (${PACKAGE_VERSION}). Use --force to rebuild.`);
    log('Run "npm run assets:process:opencv" to use the OpenCV path.');
    return;
  }

  if (installedVersion && installedVersion !== PACKAGE_VERSION) {
    log(`Replacing optional package ${installedVersion} with ${PACKAGE_VERSION}.`);
    await removeExistingInstall();
  } else if (force) {
    log("Removing previous optional OpenCV install before rebuild.");
    await removeExistingInstall();
  }

  await mkdir(OPENCV_BUILD_ROOT, { recursive: true });

  log(`Installing ${PACKAGE_NAME}@${PACKAGE_VERSION}`);
  log(`Build root: ${path.relative(ROOT, OPENCV_BUILD_ROOT)}`);
  log(`Build list: ${BUILD_LIST}`);

  await runInstall({
    OPENCV_BUILD_ROOT,
    OPENCV4NODEJS_AUTOBUILD_FLAGS: `-DBUILD_LIST=${BUILD_LIST}`,
    OPENCV4NODEJS_AUTOBUILD_WITHOUT_CONTRIB: "1",
  });

  log('OpenCV support is ready. Run "npm run assets:process:opencv" to use it.');
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[opencv:install] ${message}`);
  process.exitCode = 1;
});
