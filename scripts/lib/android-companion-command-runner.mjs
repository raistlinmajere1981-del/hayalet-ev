import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const currentDir = dirname(fileURLToPath(import.meta.url));
export const projectRoot = resolve(currentDir, "..", "..");

export const ANDROID_COMPILE_SDK = "37.0";
export const ANDROID_BUILD_TOOLS = "37.0.0";
export const ANDROID_CMAKE_VERSION = "3.22.1";
export const ANDROID_NDK_VERSION = "26.3.11579264";
const ANDROID_CMDLINE_TOOLS_REPOSITORY_URL =
  "https://dl.google.com/android/repository/repository2-1.xml";
const ADOPTIUM_API_URL = "https://api.adoptium.net/v3/assets/latest/21/hotspot";
const WHISPER_CPP_REPOSITORY_URL = "https://github.com/ggml-org/whisper.cpp.git";
const WHISPER_CPP_TAG = "v1.8.4";
export const SHERPA_ONNX_VERSION = "v1.13.2";
const SHERPA_ANDROID_RUNTIME_URL = `https://github.com/k2-fsa/sherpa-onnx/releases/download/${SHERPA_ONNX_VERSION}/sherpa-onnx-${SHERPA_ONNX_VERSION}-android.tar.bz2`;
const SHERPA_TTS_KOTLIN_API_URL = `https://raw.githubusercontent.com/k2-fsa/sherpa-onnx/${SHERPA_ONNX_VERSION}/sherpa-onnx/kotlin-api/Tts.kt`;
export const NCNN_ANDROID_VERSION = "20260113";
const NCNN_ANDROID_RUNTIME_URL = `https://github.com/Tencent/ncnn/releases/download/${NCNN_ANDROID_VERSION}/ncnn-${NCNN_ANDROID_VERSION}-android-vulkan.zip`;
const NCNN_PIPER_RELEASE = "20260114.270a6be";
const NCNN_PIPER_APK_URL = `https://github.com/nihui/ncnn-android-piper/releases/download/${NCNN_PIPER_RELEASE}/ncnn-android-piper-${NCNN_PIPER_RELEASE}.apk`;
export const NCNN_PIPER_TR_MODEL = {
  modelId: "tr_TR-fahrettin",
  archiveName: "tr_TR-fahrettin-ncnn.zip",
  url: "https://huggingface.co/gyroing/PiperTTS-NCNN-Models/resolve/main/tr_TR-fahrettin.zip",
};
export const SHERPA_TTS_MODELS = [
  {
    modelId: "tr_TR-dfki-medium",
    archiveName: "vits-piper-tr_TR-dfki-medium.tar.bz2",
    assetDir: "vits-piper-tr_TR-dfki-medium",
    url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-tr_TR-dfki-medium.tar.bz2",
  },
  {
    modelId: "en_US-lessac-medium",
    archiveName: "vits-piper-en_US-lessac-medium.tar.bz2",
    assetDir: "vits-piper-en_US-lessac-medium",
    url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-lessac-medium.tar.bz2",
  },
];
const USER_AGENT = "HayaletEvAndroidCompanion/1.0";

export const companionRoot = join(projectRoot, "android-companion");
export const artifactRoot = join(projectRoot, "dist", "android-companion");
export const toolchainRoot = join(projectRoot, "dist", "android-toolchain");
export const downloadCacheRoot = join(toolchainRoot, "downloads");
export const managedJdkRoot = join(toolchainRoot, "jdk");
export const managedAndroidSdkRoot = join(toolchainRoot, "android-sdk");
export const whisperCppSourceRoot = join(projectRoot, "data", "transcript", "whisper.cpp-src");
export const sherpaTtsRoot = join(projectRoot, "dist", "android-sherpa-tts");
export const sherpaTtsGeneratedKotlinRoot = join(sherpaTtsRoot, "generated", "kotlin");
export const sherpaTtsJniLibsRoot = join(sherpaTtsRoot, "jniLibs");
export const sherpaTtsAssetsRoot = join(sherpaTtsRoot, "assets");
export const ncnnPiperRoot = join(projectRoot, "dist", "android-ncnn-piper");
export const ncnnPiperSdkRoot = join(ncnnPiperRoot, `ncnn-${NCNN_ANDROID_VERSION}-android-vulkan`);
export const ncnnPiperAssetsRoot = join(ncnnPiperRoot, "assets");
export const ncnnPiperJniLibsRoot = join(ncnnPiperRoot, "jniLibs");
export const sourceManifestPath = join(
  companionRoot,
  "app",
  "src",
  "main",
  "assets",
  "companion-manifest.json"
);
export const artifactManifestPath = join(artifactRoot, "manifest.json");
export const wrapperPath =
  process.platform === "win32"
    ? join(companionRoot, "gradlew.bat")
    : join(companionRoot, "gradlew");

export function getManagedSdkManagerPath() {
  return join(
    managedAndroidSdkRoot,
    "cmdline-tools",
    "latest",
    "bin",
    process.platform === "win32" ? "sdkmanager.bat" : "sdkmanager"
  );
}

export function getAndroidSdkCandidatePaths() {
  const homeDir = homedir();
  const candidates = [
    managedAndroidSdkRoot,
    process.env.ANDROID_SDK_ROOT ?? null,
    process.env.ANDROID_HOME ?? null,
  ];

  if (process.platform === "win32") {
    candidates.push(
      process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "Android", "Sdk") : null,
      process.env.USERPROFILE
        ? join(process.env.USERPROFILE, "AppData", "Local", "Android", "Sdk")
        : null
    );
  } else if (process.platform === "darwin") {
    candidates.push(join(homeDir, "Library", "Android", "sdk"), join(homeDir, "Android", "Sdk"));
  } else {
    candidates.push(join(homeDir, "Android", "Sdk"), "/usr/lib/android-sdk");
  }

  return candidates.filter(
    (value, index, list) =>
      typeof value === "string" && value.trim() !== "" && list.indexOf(value) === index
  );
}

export function getExpectedAndroidSdkPaths(rootPath) {
  return {
    platformPath: join(rootPath, "platforms", `android-${ANDROID_COMPILE_SDK}`),
    buildToolsPath: join(rootPath, "build-tools", ANDROID_BUILD_TOOLS),
    cmakePath: join(rootPath, "cmake", ANDROID_CMAKE_VERSION),
    ndkPath: join(rootPath, "ndk", ANDROID_NDK_VERSION),
    sdkManagerPath: join(
      rootPath,
      "cmdline-tools",
      "latest",
      "bin",
      process.platform === "win32" ? "sdkmanager.bat" : "sdkmanager"
    ),
  };
}

export function resolveAdoptiumPlatform() {
  switch (process.platform) {
    case "linux":
      return "linux";
    case "darwin":
      return "mac";
    case "win32":
      return "windows";
    default:
      throw new Error(`Unsupported platform for managed JDK bootstrap: ${process.platform}`);
  }
}

export function resolveAdoptiumArch() {
  switch (process.arch) {
    case "x64":
      return "x64";
    case "arm64":
      return "aarch64";
    default:
      throw new Error(`Unsupported architecture for managed JDK bootstrap: ${process.arch}`);
  }
}

export function resolveAndroidCmdlineToolsHost() {
  switch (process.platform) {
    case "linux":
      return "linux";
    case "darwin":
      return "mac";
    case "win32":
      return "win";
    default:
      throw new Error(
        `Unsupported platform for managed Android SDK bootstrap: ${process.platform}`
      );
  }
}

export { ADOPTIUM_API_URL, ANDROID_CMDLINE_TOOLS_REPOSITORY_URL, WHISPER_CPP_REPOSITORY_URL, WHISPER_CPP_TAG, SHERPA_ANDROID_RUNTIME_URL, SHERPA_TTS_KOTLIN_API_URL, NCNN_ANDROID_RUNTIME_URL, NCNN_PIPER_RELEASE, NCNN_PIPER_APK_URL, USER_AGENT };

export async function runCommand(command, args, options = {}) {
  const { cwd = projectRoot, stdio = "pipe", env = process.env, input = null } = options;
  const isWindowsBatchCommand =
    process.platform === "win32" && /\.(?:bat|cmd)$/i.test(String(command));
  const spawnCommand = isWindowsBatchCommand ? (process.env.ComSpec ?? "cmd.exe") : command;
  const spawnArgs = isWindowsBatchCommand ? ["/d", "/s", "/c", command, ...args] : args;

  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(spawnCommand, spawnArgs, {
      cwd,
      env,
      stdio,
    });

    let stdout = "";
    let stderr = "";

    if (child.stdout) {
      child.stdout.on("data", (chunk) => {
        stdout += String(chunk);
      });
    }

    if (child.stderr) {
      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });
    }

    if (typeof input === "string" && child.stdin) {
      child.stdin.write(input);
      child.stdin.end();
    }

    child.on("error", rejectPromise);
    child.on("close", (code) => {
      resolvePromise({
        exitCode: typeof code === "number" ? code : -1,
        stdout,
        stderr,
      });
    });
  });
}
