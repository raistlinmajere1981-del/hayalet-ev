import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { fileExists, readJsonFile, writeJsonFile } from "./android-companion-platform-utils.mjs";
import {
  projectRoot,
  companionRoot,
  artifactRoot,
  sherpaTtsRoot,
  whisperCppSourceRoot,
  sherpaTtsJniLibsRoot,
  sherpaTtsAssetsRoot,
  ncnnPiperRoot,
  ncnnPiperSdkRoot,
  ncnnPiperAssetsRoot,
  ncnnPiperJniLibsRoot,
  artifactManifestPath,
  sourceManifestPath,
  wrapperPath,
  managedJdkRoot,
  managedAndroidSdkRoot,
  ANDROID_COMPILE_SDK,
  WHISPER_CPP_TAG,
  SHERPA_ONNX_VERSION,
  SHERPA_TTS_MODELS,
  NCNN_ANDROID_VERSION,
  NCNN_PIPER_RELEASE,
  NCNN_PIPER_TR_MODEL,
  runCommand,
} from "./android-companion-command-runner.mjs";
import {
  resolveCompatibleJavaRuntime,
  inspectJavaHome,
  inspectPathJava,
} from "./android-companion-java-runtime.mjs";
import { resolveUsableAndroidSdk } from "./android-companion-android-sdk.mjs";
import {
  installManagedJdk,
  installManagedAndroidSdk,
  ensureWhisperCppSource,
  ensureSherpaTtsRuntime,
  ensureNcnnPiperTtsRuntime,
} from "./android-companion-installers.mjs";
import { inspectCompanionArtifactCache } from "./android-companion-artifact.mjs";
import { normalizeProgressEmitter } from "./android-companion-archive-utils.mjs";

export async function loadSourceManifest() {
  return await readJsonFile(sourceManifestPath);
}

async function readArtifactManifest() {
  if ((await fileExists(artifactManifestPath)) !== true) {
    return null;
  }

  return await readJsonFile(artifactManifestPath);
}

export async function planCompanionBuildEnvironment() {
  const plan = {
    needsConfirmation: false,
    details: [],
  };

  const javaRuntime = await resolveCompatibleJavaRuntime();
  if (javaRuntime === null) {
    plan.details.push(`JDK 21 will be downloaded into ${managedJdkRoot}.`);
  }

  const androidSdk = await resolveUsableAndroidSdk();
  if (androidSdk === null) {
    plan.details.push(
      `Android SDK command-line tools, API ${ANDROID_COMPILE_SDK}, CMake, and NDK packages will be installed into ${managedAndroidSdkRoot}.`
    );
  }

  if ((await fileExists(join(whisperCppSourceRoot, "CMakeLists.txt"))) !== true) {
    plan.details.push(
      `whisper.cpp ${WHISPER_CPP_TAG} will be cloned into ${whisperCppSourceRoot}.`
    );
  }

  if (
    (await fileExists(join(sherpaTtsJniLibsRoot, "arm64-v8a", "libsherpa-onnx-jni.so"))) !== true
  ) {
    plan.details.push(
      `sherpa-onnx ${SHERPA_ONNX_VERSION} Android TTS runtime will be cached into ${sherpaTtsRoot}.`
    );
  }

  for (const model of SHERPA_TTS_MODELS) {
    if (
      (await fileExists(join(sherpaTtsAssetsRoot, "tts-models", model.assetDir, "tokens.txt"))) !==
      true
    ) {
      plan.details.push(
        `${model.modelId} Piper TTS assets will be cached into ${sherpaTtsAssetsRoot}.`
      );
    }
  }

  if (
    (await fileExists(
      join(ncnnPiperSdkRoot, "armeabi-v7a", "lib", "cmake", "ncnn", "ncnnConfig.cmake")
    )) !== true
  ) {
    plan.details.push(
      `ncnn ${NCNN_ANDROID_VERSION} Android runtime will be cached into ${ncnnPiperRoot}.`
    );
  }

  if ((await fileExists(join(ncnnPiperAssetsRoot, "en-word_id.bin"))) !== true) {
    plan.details.push(
      `ncnn Piper English assets will be extracted from ${NCNN_PIPER_RELEASE} into ${ncnnPiperAssetsRoot}.`
    );
  }

  if ((await fileExists(join(ncnnPiperAssetsRoot, "tr_enc_p.ncnn.bin"))) !== true) {
    plan.details.push(
      `${NCNN_PIPER_TR_MODEL.modelId} ncnn Piper assets will be cached into ${ncnnPiperAssetsRoot}.`
    );
  }

  if (
    (await fileExists(join(ncnnPiperJniLibsRoot, "armeabi-v7a", "libhayalet_tts_ncnn.so"))) !==
      true ||
    (await fileExists(join(ncnnPiperJniLibsRoot, "arm64-v8a", "libhayalet_tts_ncnn.so"))) !== true
  ) {
    plan.details.push(
      `Hayalet ncnn Piper native TTS libraries will be built into ${ncnnPiperJniLibsRoot}.`
    );
  }

  plan.needsConfirmation = plan.details.length > 0;
  return plan;
}

async function writeCompanionLocalProperties(androidSdkRoot) {
  const normalizedSdkRoot = String(androidSdkRoot).replace(/\\/g, "/");
  await writeFile(
    join(companionRoot, "local.properties"),
    `sdk.dir=${normalizedSdkRoot}\n`,
    "utf8"
  );
}

export async function buildCompanionArtifact(options = {}) {
  const { env = process.env, emitProgress = null, stdio = "inherit" } = options;
  const notify = normalizeProgressEmitter(emitProgress);
  await mkdir(artifactRoot, { recursive: true });

  if ((await fileExists(wrapperPath)) !== true) {
    throw new Error(
      "android-companion Gradle wrapper is missing. Run npm run android:check after syncing wrapper files."
    );
  }

  await ensureWhisperCppSource(notify);
  await ensureSherpaTtsRuntime(notify);
  await ensureNcnnPiperTtsRuntime(notify, env);

  const javaRuntime = (await inspectJavaHome(env.JAVA_HOME ?? "")) ?? (await inspectPathJava());
  if (javaRuntime === null) {
    throw new Error("Android companion build is blocked: Java was not found on PATH.");
  }
  if (javaRuntime.major > 21) {
    throw new Error(
      `Android companion build is blocked: Java ${String(javaRuntime.major)} is not supported. Use JDK 17 or 21.`
    );
  }
  const androidSdkRoot = env.ANDROID_HOME ?? env.ANDROID_SDK_ROOT ?? null;
  if (typeof androidSdkRoot !== "string" || androidSdkRoot.trim() === "") {
    throw new Error("Android companion build is blocked: Android SDK root was not resolved.");
  }
  await writeCompanionLocalProperties(androidSdkRoot);

  notify({
    message: "Building the Android companion APK with Gradle.",
    progress: 0.82,
    detail: "Gradle is running assembleDebug for android-companion.",
  });
  const buildResult = await runCommand(wrapperPath, ["assembleDebug"], {
    cwd: companionRoot,
    stdio,
    env: {
      ...env,
      HAYALET_EV_WHISPER_CPP_DIR: whisperCppSourceRoot,
    },
  });
  if (buildResult.exitCode !== 0) {
    throw new Error(
      buildResult.stderr.trim() ||
        buildResult.stdout.trim() ||
        `android-companion build failed with exit code ${String(buildResult.exitCode)}`
    );
  }

  const manifest = await loadSourceManifest();
  const apkSourcePath = join(
    companionRoot,
    "app",
    "build",
    "outputs",
    "apk",
    "debug",
    "app-debug.apk"
  );
  if ((await fileExists(apkSourcePath)) !== true) {
    throw new Error(`Expected APK was not found at ${apkSourcePath}`);
  }

  notify({
    message: "Publishing the APK into the artifact cache.",
    progress: 0.94,
    detail: `The APK is being copied into ${artifactRoot}.`,
  });
  await rm(artifactRoot, { recursive: true, force: true });
  await mkdir(artifactRoot, { recursive: true });
  const apkArtifactPath = join(artifactRoot, `${manifest.applicationId}-debug.apk`);
  await cp(apkSourcePath, apkArtifactPath);

  const artifactManifest = {
    ...manifest,
    builtAt: new Date().toISOString(),
    sourceManifestPath,
    apkPath: apkArtifactPath,
    sourceApkPath: apkSourcePath,
  };
  await writeJsonFile(artifactManifestPath, artifactManifest);

  notify({
    message: "Android companion artifact is ready.",
    progress: 1,
    detail: `Artifact manifest was published to ${artifactManifestPath}.`,
  });
  return artifactManifest;
}

export async function prepareCompanionBuildEnvironment(options = {}) {
  const { autoInstall = false, emitProgress = null } = options;
  const notify = normalizeProgressEmitter(emitProgress);
  const plan = await planCompanionBuildEnvironment();
  if (plan.needsConfirmation && autoInstall !== true) {
    return {
      ...plan,
      javaRuntime: await resolveCompatibleJavaRuntime(),
      androidSdk: await resolveUsableAndroidSdk(),
      env: null,
    };
  }

  let javaRuntime = await resolveCompatibleJavaRuntime();
  if (javaRuntime === null) {
    javaRuntime = await installManagedJdk(notify);
  } else {
    notify({
      message: "Using the detected Java runtime.",
      progress: 0.14,
      detail: `Builds will use Java ${String(javaRuntime.major)} from ${javaRuntime.javaHome}.`,
    });
  }

  let androidSdk = await resolveUsableAndroidSdk();
  if (androidSdk === null) {
    androidSdk = await installManagedAndroidSdk(javaRuntime, notify);
  } else {
    notify({
      message: "Using the detected Android SDK.",
      progress: 0.42,
      detail: `Builds will use the Android SDK at ${androidSdk.rootPath}.`,
    });
  }

  return {
    needsConfirmation: false,
    details: [],
    javaRuntime,
    androidSdk,
    env: {
      ...process.env,
      JAVA_HOME: javaRuntime.javaHome,
      ANDROID_HOME: androidSdk.rootPath,
      ANDROID_SDK_ROOT: androidSdk.rootPath,
      PATH: `${join(javaRuntime.javaHome, "bin")}${process.platform === "win32" ? ";" : ":"}${
        process.env.PATH ?? ""
      }`,
    },
  };
}

export async function resolveInstallableArtifact({
  buildIfMissing = false,
  autoBootstrap = false,
  emitProgress = null,
  paths = null,
} = {}) {
  const resolvedPaths = {
    companionRoot: typeof paths?.companionRoot === "string" ? paths.companionRoot : companionRoot,
    artifactManifestPath:
      typeof paths?.artifactManifestPath === "string"
        ? paths.artifactManifestPath
        : artifactManifestPath,
    extraInputRoots: [whisperCppSourceRoot],
  };
  const artifactState = await inspectCompanionArtifactCache(resolvedPaths);
  if (artifactState.artifactReady === true && artifactState.artifactFresh === true) {
    return artifactState.artifactManifest;
  }

  if (buildIfMissing !== true) {
    return null;
  }

  const prepared = await prepareCompanionBuildEnvironment({
    autoInstall: autoBootstrap,
    emitProgress,
  });
  if (prepared.needsConfirmation === true) {
    return null;
  }

  return await buildCompanionArtifact({
    env: prepared.env,
    emitProgress,
    stdio: "inherit",
  });
}
