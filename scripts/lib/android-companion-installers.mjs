import { cp, mkdir, mkdtemp, rename, rm, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

import { fileExists, resolveExecutableOnPath } from "./android-companion-platform-utils.mjs";
import {
  runCommand,
  managedJdkRoot,
  managedAndroidSdkRoot,
  downloadCacheRoot,
  whisperCppSourceRoot,
  sherpaTtsRoot,
  sherpaTtsGeneratedKotlinRoot,
  sherpaTtsJniLibsRoot,
  sherpaTtsAssetsRoot,
  ncnnPiperRoot,
  ncnnPiperSdkRoot,
  ncnnPiperAssetsRoot,
  ncnnPiperJniLibsRoot,
  projectRoot,
  ANDROID_COMPILE_SDK,
  ANDROID_BUILD_TOOLS,
  ANDROID_CMAKE_VERSION,
  ANDROID_NDK_VERSION,
  ADOPTIUM_API_URL,
  ANDROID_CMDLINE_TOOLS_REPOSITORY_URL,
  WHISPER_CPP_REPOSITORY_URL,
  WHISPER_CPP_TAG,
  SHERPA_ONNX_VERSION,
  SHERPA_ANDROID_RUNTIME_URL,
  SHERPA_TTS_KOTLIN_API_URL,
  NCNN_ANDROID_VERSION,
  NCNN_ANDROID_RUNTIME_URL,
  NCNN_PIPER_RELEASE,
  NCNN_PIPER_APK_URL,
  NCNN_PIPER_TR_MODEL,
  SHERPA_TTS_MODELS,
  USER_AGENT,
  resolveAdoptiumPlatform,
  resolveAdoptiumArch,
  resolveAndroidCmdlineToolsHost,
  getManagedSdkManagerPath,
  getExpectedAndroidSdkPaths,
} from "./android-companion-command-runner.mjs";
import { inspectJavaHome, getManagedJdkHome } from "./android-companion-java-runtime.mjs";
import {
  inspectAndroidSdkRoot,
  resolveUsableAndroidSdk,
} from "./android-companion-android-sdk.mjs";
import {
  extractZipArchive,
  extractTarBzipArchive,
  downloadFile,
  findDirectoryContaining,
  normalizeProgressEmitter,
} from "./android-companion-archive-utils.mjs";

async function fetchManagedJdkPackageInfo() {
  const apiUrl = new URL(ADOPTIUM_API_URL);
  apiUrl.searchParams.set("architecture", resolveAdoptiumArch());
  apiUrl.searchParams.set("heap_size", "normal");
  apiUrl.searchParams.set("image_type", "jdk");
  apiUrl.searchParams.set("jvm_impl", "hotspot");
  apiUrl.searchParams.set("os", resolveAdoptiumPlatform());
  apiUrl.searchParams.set("page_size", "1");
  apiUrl.searchParams.set("project", "jdk");
  apiUrl.searchParams.set("vendor", "eclipse");

  const response = await fetch(apiUrl, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Temurin download manifest could not be loaded: ${response.statusText}`);
  }

  const records = await response.json();
  const packageRecord = records?.[0]?.binary?.package ?? null;
  const link = typeof packageRecord?.link === "string" ? packageRecord.link : null;
  if (link === null) {
    throw new Error("Temurin download manifest did not include a JDK package link.");
  }

  return {
    link,
    name:
      typeof packageRecord?.name === "string" && packageRecord.name.trim() !== ""
        ? packageRecord.name.trim()
        : (new URL(link).pathname.split("/").pop() ?? "temurin-jdk.tar.gz"),
  };
}

async function fetchAndroidCmdlineToolsInfo() {
  const response = await fetch(ANDROID_CMDLINE_TOOLS_REPOSITORY_URL, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "application/xml,text/xml",
    },
  });
  if (!response.ok) {
    throw new Error(
      `Android command-line tools manifest could not be loaded: ${response.statusText}`
    );
  }

  const xml = await response.text();
  const hostToken = resolveAndroidCmdlineToolsHost();
  const urlMatches = [
    ...xml.matchAll(
      new RegExp(`<url>(commandlinetools-${hostToken}-(\\d+)_latest\\.zip)</url>`, "g")
    ),
  ];
  const latestMatch =
    urlMatches
      .map((match) => ({
        full: match[1] ?? null,
        version: Number.parseInt(match[2] ?? "", 10),
      }))
      .filter((entry) => entry.full !== null && Number.isFinite(entry.version))
      .sort((left, right) => right.version - left.version)[0] ?? null;
  const relativeUrl = latestMatch?.full ?? null;
  if (relativeUrl === null) {
    throw new Error("Android command-line tools manifest did not include a matching host package.");
  }

  return {
    link: `https://dl.google.com/android/repository/${relativeUrl}`,
    name: relativeUrl,
  };
}

export async function installManagedJdk(emitProgress) {
  const notify = normalizeProgressEmitter(emitProgress);
  const existing = await inspectJavaHome(getManagedJdkHome());
  if (existing) {
    notify({
      message: "Managed JDK 21 is already ready.",
      progress: 0.18,
      detail: `Managed JDK is already available at ${existing.javaHome}.`,
    });
    return existing;
  }

  notify({
    message: "Downloading the managed JDK 21 bundle.",
    progress: 0.12,
    detail: `Hayalet Ev will install a repo-local JDK into ${managedJdkRoot}.`,
  });
  const jdkPackage = await fetchManagedJdkPackageInfo();
  const archivePath = join(downloadCacheRoot, jdkPackage.name);
  if ((await fileExists(archivePath)) !== true) {
    await downloadFile(jdkPackage.link, archivePath);
  }

  notify({
    message: "Extracting the managed JDK 21 bundle.",
    progress: 0.22,
    detail: `The downloaded JDK archive is being unpacked from ${archivePath}.`,
  });
  const extractDir = await mkdtemp(join(tmpdir(), "hayalet-ev-jdk-"));
  const extractResult = await runCommand("tar", ["-xzf", archivePath, "-C", extractDir]);
  if (extractResult.exitCode !== 0) {
    throw new Error(
      extractResult.stderr.trim() || extractResult.stdout.trim() || "Managed JDK extraction failed."
    );
  }

  const extractedHome = await findDirectoryContaining(
    extractDir,
    ["bin", process.platform === "win32" ? "java.exe" : "java"],
    4
  );
  if (extractedHome === null) {
    throw new Error("The managed JDK archive did not expose a usable java binary.");
  }

  await mkdir(managedJdkRoot, { recursive: true });
  await rm(getManagedJdkHome(), { recursive: true, force: true });
  await rename(extractedHome, getManagedJdkHome());
  await rm(extractDir, { recursive: true, force: true });

  const runtime = await inspectJavaHome(getManagedJdkHome());
  if (runtime === null) {
    throw new Error("Managed JDK installation completed but java could not be resolved.");
  }

  notify({
    message: "Managed JDK 21 is ready.",
    progress: 0.32,
    detail: `Managed JDK is ready at ${runtime.javaHome}.`,
  });
  return runtime;
}

export async function installManagedAndroidSdk(javaRuntime, emitProgress) {
  const notify = normalizeProgressEmitter(emitProgress);
  const existing = await inspectAndroidSdkRoot(managedAndroidSdkRoot);
  if (existing?.complete === true) {
    notify({
      message: "Managed Android SDK is already ready.",
      progress: 0.48,
      detail: `Managed Android SDK is already available at ${existing.rootPath}.`,
    });
    return existing;
  }

  notify({
    message: "Downloading Android command-line tools.",
    progress: 0.36,
    detail: `Hayalet Ev will install a repo-local Android SDK into ${managedAndroidSdkRoot}.`,
  });
  const sdkPackage = await fetchAndroidCmdlineToolsInfo();
  const archivePath = join(downloadCacheRoot, sdkPackage.name);
  if ((await fileExists(archivePath)) !== true) {
    await downloadFile(sdkPackage.link, archivePath);
  }

  notify({
    message: "Extracting Android command-line tools.",
    progress: 0.46,
    detail: `The command-line tools archive is being unpacked from ${archivePath}.`,
  });
  const extractDir = await mkdtemp(join(tmpdir(), "hayalet-ev-android-sdk-"));
  await extractZipArchive(archivePath, extractDir).catch((error) => {
    throw new Error(
      `Android command-line tools extraction failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  });

  const extractedTools = await findDirectoryContaining(
    extractDir,
    ["bin", process.platform === "win32" ? "sdkmanager.bat" : "sdkmanager"],
    4
  );
  if (extractedTools === null) {
    throw new Error("The Android command-line tools archive did not expose sdkmanager.");
  }

  const latestToolsDir = join(managedAndroidSdkRoot, "cmdline-tools", "latest");
  await mkdir(join(managedAndroidSdkRoot, "cmdline-tools"), { recursive: true });
  await rm(latestToolsDir, { recursive: true, force: true });
  try {
    await rename(extractedTools, latestToolsDir);
  } catch (error) {
    if (error?.code !== "EXDEV") {
      throw error;
    }
    await cp(extractedTools, latestToolsDir, { recursive: true });
    await rm(extractedTools, { recursive: true, force: true });
  }
  await rm(extractDir, { recursive: true, force: true });

  const sdkManagerPath = getManagedSdkManagerPath();
  const sdkEnv = {
    ...process.env,
    JAVA_HOME: javaRuntime.javaHome,
    ANDROID_HOME: managedAndroidSdkRoot,
    ANDROID_SDK_ROOT: managedAndroidSdkRoot,
  };

  notify({
    message: "Accepting Android SDK licenses.",
    progress: 0.54,
    detail: "Android SDK license prompts are being accepted for the managed toolchain.",
  });
  const licensesResult = await runCommand(
    sdkManagerPath,
    [`--sdk_root=${managedAndroidSdkRoot}`, "--licenses"],
    {
      env: sdkEnv,
      input: `${"y\n".repeat(80)}`,
    }
  );
  if (licensesResult.exitCode !== 0) {
    throw new Error(
      licensesResult.stderr.trim() ||
        licensesResult.stdout.trim() ||
        "Android SDK license acceptance failed."
    );
  }

  notify({
    message: `Installing Android SDK packages for API ${ANDROID_COMPILE_SDK}.`,
    progress: 0.64,
    detail: `platform-tools, platforms;android-${ANDROID_COMPILE_SDK}, build-tools;${ANDROID_BUILD_TOOLS}, CMake, and NDK are being installed.`,
  });
  const packageResult = await runCommand(
    sdkManagerPath,
    [
      `--sdk_root=${managedAndroidSdkRoot}`,
      "platform-tools",
      `platforms;android-${ANDROID_COMPILE_SDK}`,
      `build-tools;${ANDROID_BUILD_TOOLS}`,
      `cmake;${ANDROID_CMAKE_VERSION}`,
      `ndk;${ANDROID_NDK_VERSION}`,
    ],
    {
      env: sdkEnv,
      input: `${"y\n".repeat(20)}`,
    }
  );
  if (packageResult.exitCode !== 0) {
    throw new Error(
      packageResult.stderr.trim() ||
        packageResult.stdout.trim() ||
        "Android SDK package installation failed."
    );
  }

  const sdk = await inspectAndroidSdkRoot(managedAndroidSdkRoot);
  if (sdk?.complete !== true) {
    throw new Error(
      "Managed Android SDK installation completed but required packages are still missing."
    );
  }

  notify({
    message: "Managed Android SDK is ready.",
    progress: 0.72,
    detail: `Managed Android SDK is ready at ${sdk.rootPath}.`,
  });
  return sdk;
}

async function resolveWhisperCppCheckoutTag(rootPath) {
  if ((await fileExists(join(rootPath, ".git"))) !== true) {
    return null;
  }

  const gitPath = await resolveExecutableOnPath("git");
  if (gitPath === null) {
    return null;
  }

  const result = await runCommand(gitPath, ["-C", rootPath, "describe", "--tags", "--exact-match"]);
  return result.exitCode === 0 ? result.stdout.trim() : null;
}

export async function ensureWhisperCppSource(emitProgress) {
  const notify = normalizeProgressEmitter(emitProgress);
  if ((await fileExists(join(whisperCppSourceRoot, "CMakeLists.txt"))) === true) {
    const checkoutTag = await resolveWhisperCppCheckoutTag(whisperCppSourceRoot);
    if (checkoutTag === WHISPER_CPP_TAG) {
      notify({
        message: "Using the prepared whisper.cpp source checkout.",
        progress: 0.76,
        detail: `whisper.cpp ${WHISPER_CPP_TAG} source is ready at ${whisperCppSourceRoot}.`,
      });
      return whisperCppSourceRoot;
    }

    notify({
      message: "Refreshing whisper.cpp source checkout.",
      progress: 0.73,
      detail: `Existing checkout is ${checkoutTag ?? "unverified"}; ${WHISPER_CPP_TAG} is required.`,
    });
  }

  const gitPath = await resolveExecutableOnPath("git");
  if (gitPath === null) {
    throw new Error("Android companion build needs git to prepare whisper.cpp sources.");
  }

  notify({
    message: "Cloning whisper.cpp for the Android native transcript runtime.",
    progress: 0.74,
    detail: `whisper.cpp ${WHISPER_CPP_TAG} will be cloned into ${whisperCppSourceRoot}.`,
  });
  await mkdir(dirname(whisperCppSourceRoot), { recursive: true });
  await rm(whisperCppSourceRoot, { recursive: true, force: true });
  const cloneResult = await runCommand(gitPath, [
    "clone",
    "--depth",
    "1",
    "--branch",
    WHISPER_CPP_TAG,
    WHISPER_CPP_REPOSITORY_URL,
    whisperCppSourceRoot,
  ]);
  if (cloneResult.exitCode !== 0) {
    throw new Error(
      cloneResult.stderr.trim() || cloneResult.stdout.trim() || "whisper.cpp clone failed."
    );
  }
  return whisperCppSourceRoot;
}

export async function ensureSherpaTtsRuntime(emitProgress) {
  const notify = normalizeProgressEmitter(emitProgress);
  const runtimeLibraryPath = join(sherpaTtsJniLibsRoot, "arm64-v8a", "libsherpa-onnx-jni.so");
  const bindingPath = join(
    sherpaTtsGeneratedKotlinRoot,
    "com",
    "k2fsa",
    "sherpa",
    "onnx",
    "Tts.kt"
  );
  const ttsModelsRoot = join(sherpaTtsAssetsRoot, "tts-models");

  notify({
    message: "Preparing sherpa-onnx Android TTS runtime.",
    progress: 0.78,
    detail: `sherpa-onnx Android runtime and Piper voices are prepared under ${sherpaTtsRoot}.`,
  });

  await mkdir(downloadCacheRoot, { recursive: true });
  const runtimeArchivePath = join(
    downloadCacheRoot,
    `sherpa-onnx-${SHERPA_ONNX_VERSION}-android.tar.bz2`
  );
  if ((await fileExists(runtimeArchivePath)) !== true) {
    await downloadFile(SHERPA_ANDROID_RUNTIME_URL, runtimeArchivePath);
  }

  if ((await fileExists(runtimeLibraryPath)) !== true) {
    const extractDir = await mkdtemp(join(tmpdir(), "hayalet-ev-sherpa-android-"));
    try {
      await extractTarBzipArchive(runtimeArchivePath, extractDir);
    } catch (error) {
      throw new Error(
        `sherpa-onnx Android runtime extraction failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error }
      );
    }
    await rm(sherpaTtsJniLibsRoot, { recursive: true, force: true });
    await mkdir(dirname(sherpaTtsJniLibsRoot), { recursive: true });
    await cp(join(extractDir, "jniLibs"), sherpaTtsJniLibsRoot, { recursive: true });
    await rm(extractDir, { recursive: true, force: true });
  }

  await downloadFile(SHERPA_TTS_KOTLIN_API_URL, bindingPath);

  await mkdir(ttsModelsRoot, { recursive: true });
  for (const model of SHERPA_TTS_MODELS) {
    const modelRoot = join(ttsModelsRoot, model.assetDir);
    if ((await fileExists(join(modelRoot, "tokens.txt"))) === true) {
      continue;
    }

    const archivePath = join(downloadCacheRoot, model.archiveName);
    if ((await fileExists(archivePath)) !== true) {
      await downloadFile(model.url, archivePath);
    }

    await rm(modelRoot, { recursive: true, force: true });
    try {
      await extractTarBzipArchive(archivePath, ttsModelsRoot);
    } catch (error) {
      throw new Error(
        `${model.modelId} Piper TTS model extraction failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error }
      );
    }
  }

  notify({
    message: "sherpa-onnx Android TTS runtime is ready.",
    progress: 0.8,
    detail: `TTS runtime, bindings, and Piper voices are ready at ${sherpaTtsRoot}.`,
  });
}

export async function buildNcnnPiperNativeLibraries(env) {
  const sdkRootCandidate = env.ANDROID_HOME ?? env.ANDROID_SDK_ROOT ?? null;
  const androidSdk =
    typeof sdkRootCandidate === "string"
      ? await inspectAndroidSdkRoot(sdkRootCandidate)
      : await resolveUsableAndroidSdk();
  if (androidSdk === null) {
    throw new Error("ncnn Piper native TTS build needs a usable Android SDK.");
  }

  const { cmakePath, ndkPath } = getExpectedAndroidSdkPaths(androidSdk.rootPath);
  const executableSuffix = process.platform === "win32" ? ".exe" : "";
  const cmakeBin = join(cmakePath, "bin", `cmake${executableSuffix}`);
  const ninjaBin = join(cmakePath, "bin", `ninja${executableSuffix}`);
  const toolchainFile = join(ndkPath, "build", "cmake", "android.toolchain.cmake");
  const sourceDir = join(projectRoot, "scripts", "android-ncnn-piper-native");

  for (const executable of [cmakeBin, ninjaBin, toolchainFile]) {
    if ((await fileExists(executable)) !== true) {
      throw new Error(`ncnn Piper native TTS build dependency is missing: ${executable}`);
    }
  }

  for (const abi of ["armeabi-v7a", "arm64-v8a"]) {
    const buildDir = join(ncnnPiperRoot, "native-build", abi);
    const outputDir = join(ncnnPiperJniLibsRoot, abi);
    await mkdir(buildDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });

    const configureResult = await runCommand(
      cmakeBin,
      [
        "-S",
        sourceDir,
        "-B",
        buildDir,
        "-G",
        "Ninja",
        `-DCMAKE_MAKE_PROGRAM=${ninjaBin}`,
        `-DANDROID_ABI=${abi}`,
        "-DANDROID_PLATFORM=android-28",
        `-DANDROID_NDK=${ndkPath}`,
        `-DCMAKE_TOOLCHAIN_FILE=${toolchainFile}`,
        "-DCMAKE_BUILD_TYPE=Release",
        `-DNCNN_ANDROID_SDK_DIR=${ncnnPiperSdkRoot}`,
      ],
      { env }
    );
    if (configureResult.exitCode !== 0) {
      throw new Error(
        configureResult.stderr.trim() ||
          configureResult.stdout.trim() ||
          `ncnn Piper native TTS configure failed for ${abi}.`
      );
    }

    const buildResult = await runCommand(
      cmakeBin,
      ["--build", buildDir, "--target", "hayalet_tts_ncnn", "--parallel", "2"],
      { env }
    );
    if (buildResult.exitCode !== 0) {
      throw new Error(
        buildResult.stderr.trim() ||
          buildResult.stdout.trim() ||
          `ncnn Piper native TTS build failed for ${abi}.`
      );
    }

    const builtLibraryPath = join(buildDir, "libhayalet_tts_ncnn.so");
    if ((await fileExists(builtLibraryPath)) !== true) {
      throw new Error(`ncnn Piper native TTS output is missing: ${builtLibraryPath}`);
    }
    await cp(builtLibraryPath, join(outputDir, "libhayalet_tts_ncnn.so"));
  }
}

export async function ensureNcnnPiperTtsRuntime(emitProgress, env = process.env) {
  const notify = normalizeProgressEmitter(emitProgress);
  const ncnnConfigPath = join(
    ncnnPiperSdkRoot,
    "armeabi-v7a",
    "lib",
    "cmake",
    "ncnn",
    "ncnnConfig.cmake"
  );

  notify({
    message: "Preparing ncnn Piper Android TTS runtime.",
    progress: 0.81,
    detail: `ncnn runtime and Piper assets are prepared under ${ncnnPiperRoot}.`,
  });

  await mkdir(downloadCacheRoot, { recursive: true });
  const runtimeArchivePath = join(
    downloadCacheRoot,
    `ncnn-${NCNN_ANDROID_VERSION}-android-vulkan.zip`
  );
  if ((await fileExists(runtimeArchivePath)) !== true) {
    await downloadFile(NCNN_ANDROID_RUNTIME_URL, runtimeArchivePath);
  }

  if ((await fileExists(ncnnConfigPath)) !== true) {
    await rm(ncnnPiperSdkRoot, { recursive: true, force: true });
    await mkdir(ncnnPiperRoot, { recursive: true });
    await extractZipArchive(runtimeArchivePath, ncnnPiperRoot).catch((error) => {
      throw new Error(
        `ncnn Android runtime extraction failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    });
  }

  await mkdir(ncnnPiperAssetsRoot, { recursive: true });

  const sampleApkPath = join(downloadCacheRoot, `ncnn-android-piper-${NCNN_PIPER_RELEASE}.apk`);
  if ((await fileExists(sampleApkPath)) !== true) {
    await downloadFile(NCNN_PIPER_APK_URL, sampleApkPath);
  }

  if ((await fileExists(join(ncnnPiperAssetsRoot, "en-word_id.bin"))) !== true) {
    await extractZipArchive(sampleApkPath, ncnnPiperAssetsRoot, {
      entries: ["assets/en_*", "assets/en-word_id.bin"],
      junkPaths: true,
    }).catch((error) => {
      throw new Error(
        `ncnn Piper English asset extraction failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    });
  }

  const trArchivePath = join(downloadCacheRoot, NCNN_PIPER_TR_MODEL.archiveName);
  if ((await fileExists(trArchivePath)) !== true) {
    await downloadFile(NCNN_PIPER_TR_MODEL.url, trArchivePath);
  }

  if ((await fileExists(join(ncnnPiperAssetsRoot, "tr_enc_p.ncnn.bin"))) !== true) {
    await extractZipArchive(trArchivePath, ncnnPiperAssetsRoot, {
      entries: ["tr_TR-fahrettin/tr_*"],
      junkPaths: true,
    }).catch((error) => {
      throw new Error(
        `${NCNN_PIPER_TR_MODEL.modelId} ncnn Piper asset extraction failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    });
  }

  await buildNcnnPiperNativeLibraries(env);

  notify({
    message: "ncnn Piper Android TTS runtime is ready.",
    progress: 0.82,
    detail: `ncnn runtime and Piper assets are ready at ${ncnnPiperRoot}.`,
  });
}
