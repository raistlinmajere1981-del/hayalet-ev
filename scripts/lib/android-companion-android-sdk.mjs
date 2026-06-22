import { join } from "node:path";
import { fileExists, isExecutable } from "./android-companion-platform-utils.mjs";
import {
  runCommand,
  managedAndroidSdkRoot,
  ANDROID_COMPILE_SDK,
  ANDROID_BUILD_TOOLS,
  ANDROID_CMAKE_VERSION,
  ANDROID_NDK_VERSION,
  getAndroidSdkCandidatePaths,
  getExpectedAndroidSdkPaths,
} from "./android-companion-command-runner.mjs";

export async function inspectAndroidSdkRoot(rootPath) {
  if (typeof rootPath !== "string" || rootPath.trim() === "") {
    return null;
  }

  const normalizedRoot = rootPath.trim();
  const { platformPath, buildToolsPath, cmakePath, ndkPath, sdkManagerPath } =
    getExpectedAndroidSdkPaths(normalizedRoot);
  const [platformReady, buildToolsReady, cmakeReady, ndkReady, sdkManagerReady] = await Promise.all(
    [
      fileExists(platformPath),
      fileExists(buildToolsPath),
      fileExists(cmakePath),
      fileExists(ndkPath),
      isExecutable(sdkManagerPath),
    ]
  );

  return {
    rootPath: normalizedRoot,
    sdkManagerPath,
    platformReady,
    buildToolsReady,
    cmakeReady,
    ndkReady,
    sdkManagerReady,
    complete: platformReady && buildToolsReady && cmakeReady && ndkReady && sdkManagerReady,
    source: normalizedRoot === managedAndroidSdkRoot ? "managed" : "system",
  };
}

export async function resolveUsableAndroidSdk() {
  for (const candidate of getAndroidSdkCandidatePaths()) {
    const inspected = await inspectAndroidSdkRoot(candidate);
    if (inspected?.complete === true) {
      return inspected;
    }
  }

  return null;
}
