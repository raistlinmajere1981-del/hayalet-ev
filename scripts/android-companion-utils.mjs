export {
  fileExists,
  isExecutable,
  resolveExecutableOnPath,
  readJsonFile,
  writeJsonFile,
} from "./lib/android-companion-platform-utils.mjs";

export {
  projectRoot,
  companionRoot,
  artifactRoot,
  toolchainRoot,
  downloadCacheRoot,
  managedJdkRoot,
  managedAndroidSdkRoot,
  whisperCppSourceRoot,
  sherpaTtsRoot,
  sherpaTtsGeneratedKotlinRoot,
  sherpaTtsJniLibsRoot,
  sherpaTtsAssetsRoot,
  ncnnPiperRoot,
  ncnnPiperSdkRoot,
  ncnnPiperAssetsRoot,
  ncnnPiperJniLibsRoot,
  sourceManifestPath,
  artifactManifestPath,
  wrapperPath,
  runCommand,
} from "./lib/android-companion-command-runner.mjs";

export { resolveCompatibleJavaRuntime } from "./lib/android-companion-java-runtime.mjs";

export { resolveUsableAndroidSdk } from "./lib/android-companion-android-sdk.mjs";

export {
  planCompanionBuildEnvironment,
  prepareCompanionBuildEnvironment,
  buildCompanionArtifact,
  resolveInstallableArtifact,
  loadSourceManifest,
} from "./lib/android-companion-build-environment.mjs";
