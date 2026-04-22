import { createWriteStream, constants as fsConstants } from "node:fs";
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const currentDir = dirname(fileURLToPath(import.meta.url));

const ANDROID_COMPILE_SDK = "35";
const ANDROID_BUILD_TOOLS = "35.0.0";
const ANDROID_CMDLINE_TOOLS_REPOSITORY_URL =
  "https://dl.google.com/android/repository/repository2-1.xml";
const ADOPTIUM_API_URL = "https://api.adoptium.net/v3/assets/latest/21/hotspot";
const USER_AGENT = "HayaletEvAndroidCompanion/1.0";

export const projectRoot = resolve(currentDir, "..");
export const companionRoot = join(projectRoot, "android-companion");
export const artifactRoot = join(projectRoot, "dist", "android-companion");
export const toolchainRoot = join(projectRoot, "dist", "android-toolchain");
export const downloadCacheRoot = join(toolchainRoot, "downloads");
export const managedJdkRoot = join(toolchainRoot, "jdk");
export const managedAndroidSdkRoot = join(toolchainRoot, "android-sdk");
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
  process.platform === "win32" ? join(companionRoot, "gradlew.bat") : join(companionRoot, "gradlew");

export async function fileExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function isExecutable(targetPath) {
  try {
    await access(targetPath, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function resolveExecutableOnPath(name) {
  const entries = (process.env.PATH ?? "")
    .split(process.platform === "win32" ? ";" : ":")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const suffixes = process.platform === "win32" ? ["", ".exe", ".cmd", ".bat"] : [""];

  for (const entry of entries) {
    for (const suffix of suffixes) {
      const candidate = join(entry, `${name}${suffix}`);
      if (await isExecutable(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

export async function readJsonFile(filePath) {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content);
}

export async function loadSourceManifest() {
  return await readJsonFile(sourceManifestPath);
}

export async function readArtifactManifest() {
  if ((await fileExists(artifactManifestPath)) !== true) {
    return null;
  }

  return await readJsonFile(artifactManifestPath);
}

export async function writeJsonFile(filePath, value) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function runCommand(command, args, options = {}) {
  const { cwd = projectRoot, stdio = "pipe", env = process.env, input = null } = options;

  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
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

function parseJavaMajorVersion(output) {
  const text = typeof output === "string" ? output.trim() : "";
  if (text === "") {
    return null;
  }

  const versionToken =
    text.match(/version "([^"]+)"/)?.[1] ??
    text.match(/openjdk (\d+(?:\.\d+){0,2})/)?.[1] ??
    null;
  if (versionToken == null) {
    return null;
  }

  const major = Number.parseInt(versionToken.split(".")[0] ?? "", 10);
  return Number.isFinite(major) ? major : null;
}

function normalizeProgressEmitter(emitProgress) {
  return typeof emitProgress === "function" ? emitProgress : () => {};
}

function sanitizeDetail(detail) {
  return typeof detail === "string" && detail.trim() !== "" ? detail.trim() : null;
}

function getManagedJdkHome() {
  return join(managedJdkRoot, "current");
}

function getManagedJavaPath() {
  return join(
    getManagedJdkHome(),
    "bin",
    process.platform === "win32" ? "java.exe" : "java"
  );
}

function getManagedSdkManagerPath() {
  return join(
    managedAndroidSdkRoot,
    "cmdline-tools",
    "latest",
    "bin",
    process.platform === "win32" ? "sdkmanager.bat" : "sdkmanager"
  );
}

function getExpectedAndroidSdkPaths(rootPath) {
  return {
    platformPath: join(rootPath, "platforms", `android-${ANDROID_COMPILE_SDK}`),
    buildToolsPath: join(rootPath, "build-tools", ANDROID_BUILD_TOOLS),
    sdkManagerPath: join(
      rootPath,
      "cmdline-tools",
      "latest",
      "bin",
      process.platform === "win32" ? "sdkmanager.bat" : "sdkmanager"
    ),
  };
}

async function inspectJavaHome(javaHome) {
  if (typeof javaHome !== "string" || javaHome.trim() === "") {
    return null;
  }

  const candidateHome = javaHome.trim();
  const javaPath = join(
    candidateHome,
    "bin",
    process.platform === "win32" ? "java.exe" : "java"
  );
  if ((await isExecutable(javaPath)) !== true) {
    return null;
  }

  const version = await runCommand(javaPath, ["-version"]).catch(() => null);
  const major = parseJavaMajorVersion(`${version?.stderr ?? ""}\n${version?.stdout ?? ""}`);
  if (major === null || major < 17 || major > 21) {
    return null;
  }

  return {
    javaHome: candidateHome,
    javaPath,
    major,
    source: candidateHome === getManagedJdkHome() ? "managed" : "system",
  };
}

async function inspectPathJava() {
  const javaPath = await resolveExecutableOnPath("java");
  if (javaPath === null) {
    return null;
  }

  const version = await runCommand(javaPath, ["-version"]).catch(() => null);
  const major = parseJavaMajorVersion(`${version?.stderr ?? ""}\n${version?.stdout ?? ""}`);
  if (major === null || major < 17 || major > 21) {
    return null;
  }

  return {
    javaHome: dirname(dirname(javaPath)),
    javaPath,
    major,
    source: "system",
  };
}

export async function resolveCompatibleJavaRuntime() {
  const fromManaged = await inspectJavaHome(getManagedJdkHome());
  if (fromManaged) {
    return fromManaged;
  }

  const fromHome = await inspectJavaHome(process.env.JAVA_HOME ?? "");
  if (fromHome) {
    return fromHome;
  }

  return await inspectPathJava();
}

async function inspectAndroidSdkRoot(rootPath) {
  if (typeof rootPath !== "string" || rootPath.trim() === "") {
    return null;
  }

  const normalizedRoot = rootPath.trim();
  const { platformPath, buildToolsPath, sdkManagerPath } = getExpectedAndroidSdkPaths(normalizedRoot);
  const [platformReady, buildToolsReady, sdkManagerReady] = await Promise.all([
    fileExists(platformPath),
    fileExists(buildToolsPath),
    isExecutable(sdkManagerPath),
  ]);

  return {
    rootPath: normalizedRoot,
    sdkManagerPath,
    platformReady,
    buildToolsReady,
    sdkManagerReady,
    complete: platformReady && buildToolsReady && sdkManagerReady,
    source: normalizedRoot === managedAndroidSdkRoot ? "managed" : "system",
  };
}

export async function resolveUsableAndroidSdk() {
  const candidates = [
    managedAndroidSdkRoot,
    process.env.ANDROID_SDK_ROOT ?? null,
    process.env.ANDROID_HOME ?? null,
    "/usr/lib/android-sdk",
  ].filter((value, index, list) => typeof value === "string" && value.trim() !== "" && list.indexOf(value) === index);

  for (const candidate of candidates) {
    const inspected = await inspectAndroidSdkRoot(candidate);
    if (inspected?.complete === true) {
      return inspected;
    }
  }

  return null;
}

function resolveAdoptiumPlatform() {
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

function resolveAdoptiumArch() {
  switch (process.arch) {
    case "x64":
      return "x64";
    case "arm64":
      return "aarch64";
    default:
      throw new Error(`Unsupported architecture for managed JDK bootstrap: ${process.arch}`);
  }
}

function resolveAndroidCmdlineToolsHost() {
  switch (process.platform) {
    case "linux":
      return "linux";
    case "darwin":
      return "mac";
    case "win32":
      return "win";
    default:
      throw new Error(`Unsupported platform for managed Android SDK bootstrap: ${process.platform}`);
  }
}

async function downloadFile(url, destinationPath) {
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
    },
    redirect: "follow",
  });
  if (!response.ok || response.body == null) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  await mkdir(dirname(destinationPath), { recursive: true });
  const bodyStream = Readable.fromWeb(response.body);
  await pipeline(bodyStream, createWriteStream(destinationPath));
  return destinationPath;
}

async function findDirectoryContaining(rootPath, relativeSegments, maxDepth = 4) {
  const queue = [{ dir: rootPath, depth: 0 }];

  while (queue.length > 0) {
    const entry = queue.shift();
    if (!entry) {
      continue;
    }

    const candidate = join(entry.dir, ...relativeSegments);
    if (await fileExists(candidate)) {
      return entry.dir;
    }

    if (entry.depth >= maxDepth) {
      continue;
    }

    const children = await readdir(entry.dir, { withFileTypes: true }).catch(() => []);
    for (const child of children) {
      if (child.isDirectory()) {
        queue.push({ dir: join(entry.dir, child.name), depth: entry.depth + 1 });
      }
    }
  }

  return null;
}

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
        : new URL(link).pathname.split("/").pop() ?? "temurin-jdk.tar.gz",
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
    throw new Error(`Android command-line tools manifest could not be loaded: ${response.statusText}`);
  }

  const xml = await response.text();
  const hostToken = resolveAndroidCmdlineToolsHost();
  const urlMatches = [...xml.matchAll(new RegExp(`<url>(commandlinetools-${hostToken}-(\\d+)_latest\\.zip)</url>`, "g"))];
  const latestMatch =
    urlMatches
      .map((match) => ({
        full: match[1] != null ? `commandlinetools-${hostToken}-${match[1]}_latest.zip` : null,
        version: Number.parseInt(match[1] ?? "", 10),
      }))
      .filter(
        (entry) => entry.full !== null && Number.isFinite(entry.version)
      )
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

async function installManagedJdk(emitProgress) {
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
    throw new Error(extractResult.stderr.trim() || extractResult.stdout.trim() || "Managed JDK extraction failed.");
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

async function installManagedAndroidSdk(javaRuntime, emitProgress) {
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
  const extractResult = await runCommand("unzip", ["-q", archivePath, "-d", extractDir]);
  if (extractResult.exitCode !== 0) {
    throw new Error(
      extractResult.stderr.trim() || extractResult.stdout.trim() || "Android command-line tools extraction failed."
    );
  }

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
  await rename(extractedTools, latestToolsDir);
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
      licensesResult.stderr.trim() || licensesResult.stdout.trim() || "Android SDK license acceptance failed."
    );
  }

  notify({
    message: "Installing Android SDK packages for API 35.",
    progress: 0.64,
    detail: "platform-tools, platforms;android-35, and build-tools;35.0.0 are being installed.",
  });
  const packageResult = await runCommand(
    sdkManagerPath,
    [
      `--sdk_root=${managedAndroidSdkRoot}`,
      "platform-tools",
      `platforms;android-${ANDROID_COMPILE_SDK}`,
      `build-tools;${ANDROID_BUILD_TOOLS}`,
    ],
    {
      env: sdkEnv,
      input: `${"y\n".repeat(20)}`,
    }
  );
  if (packageResult.exitCode !== 0) {
    throw new Error(
      packageResult.stderr.trim() || packageResult.stdout.trim() || "Android SDK package installation failed."
    );
  }

  const sdk = await inspectAndroidSdkRoot(managedAndroidSdkRoot);
  if (sdk?.complete !== true) {
    throw new Error("Managed Android SDK installation completed but required packages are still missing.");
  }

  notify({
    message: "Managed Android SDK is ready.",
    progress: 0.72,
    detail: `Managed Android SDK is ready at ${sdk.rootPath}.`,
  });
  return sdk;
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
      `Android SDK command-line tools and API ${ANDROID_COMPILE_SDK} packages will be installed into ${managedAndroidSdkRoot}.`
    );
  }

  plan.needsConfirmation = plan.details.length > 0;
  return plan;
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

export async function buildCompanionArtifact(options = {}) {
  const {
    env = process.env,
    emitProgress = null,
    stdio = "inherit",
  } = options;
  const notify = normalizeProgressEmitter(emitProgress);
  await mkdir(artifactRoot, { recursive: true });

  if ((await fileExists(wrapperPath)) !== true) {
    throw new Error(
      "android-companion Gradle wrapper is missing. Run npm run android:check after syncing wrapper files."
    );
  }

  const javaRuntime = await inspectJavaHome(env.JAVA_HOME ?? "") ?? (await inspectPathJava());
  if (javaRuntime === null) {
    throw new Error("Android companion build is blocked: Java was not found on PATH.");
  }
  if (javaRuntime.major > 21) {
    throw new Error(
      `Android companion build is blocked: Java ${String(javaRuntime.major)} is not supported. Use JDK 17 or 21.`
    );
  }

  notify({
    message: "Building the Android companion APK with Gradle.",
    progress: 0.82,
    detail: "Gradle is running assembleDebug for android-companion.",
  });
  const buildResult = await runCommand(wrapperPath, ["assembleDebug"], {
    cwd: companionRoot,
    stdio,
    env,
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

export async function resolveInstallableArtifact({
  buildIfMissing = false,
  autoBootstrap = false,
  emitProgress = null,
} = {}) {
  const artifactManifest = await readArtifactManifest();
  if (artifactManifest && (await fileExists(artifactManifest.apkPath)) === true) {
    return artifactManifest;
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
