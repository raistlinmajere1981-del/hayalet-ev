import { existsSync } from "fs";
import { cp, mkdir, mkdtemp, readdir, rename, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { Paths } from "./paths.ts";
import {
  collectFilesRecursive,
  extractArchive,
  fetchGitHubRelease,
  markExecutable,
  runCommand,
} from "./room-tool/archive-helper.ts";
import { detectPlatformKey } from "./room-tool/python-manager.ts";
import {
  findVersion,
  resolveSystemCommandBinaryPath,
} from "./room-tool/system-command-helper.ts";

const FFMPEG_RELEASE_PROVIDER = {
  type: "github-release" as const,
  owner: "yt-dlp",
  repo: "FFmpeg-Builds",
  releaseUrl: "https://github.com/yt-dlp/FFmpeg-Builds/releases/latest",
};

const FFMPEG_ASSET_MATCH: Record<string, RegExp> = {
  "linux-x64": /^ffmpeg-master-latest-linux64-gpl\.tar\.xz$/,
  "linux-arm64": /^ffmpeg-master-latest-linuxarm64-gpl\.tar\.xz$/,
  "win32-x64": /^ffmpeg-master-latest-win64-gpl\.zip$/,
  "win32-arm64": /^ffmpeg-master-latest-winarm64-gpl\.zip$/,
};

const FFMPEG_VERSION_REGEX = "ffmpeg version\\s+([^\\s]+)";

export function getHostDependencyRoot(): string {
  return join(Paths.getDataDir(), "host-dependencies");
}

export function getManagedAndroidSdkRoot(): string {
  return join(Paths.getProjectRoot(), "dist", "android-toolchain", "android-sdk");
}

export function getManagedJdkHome(): string {
  return join(Paths.getProjectRoot(), "dist", "android-toolchain", "jdk", "current");
}

export function getManagedAdbPath(): string {
  return join(
    getManagedAndroidSdkRoot(),
    "platform-tools",
    process.platform === "win32" ? "adb.exe" : "adb"
  );
}

export function getManagedFfmpegDir(): string {
  return join(
    getHostDependencyRoot(),
    "ffmpeg",
    detectPlatformKey() ?? `${process.platform}-${process.arch}`
  );
}

export function getManagedFfmpegPath(): string {
  return join(getManagedFfmpegDir(), process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
}

export function getManagedFfprobePath(): string {
  return join(getManagedFfmpegDir(), process.platform === "win32" ? "ffprobe.exe" : "ffprobe");
}

export function getManagedFfmpegCandidatePaths(): string[] {
  return [getManagedFfmpegPath()];
}

export function getManagedFfprobeCandidatePaths(): string[] {
  return [getManagedFfprobePath()];
}

async function getWindowsScrcpyBundleCandidatePaths(executableName: string): Promise<string[]> {
  if (process.platform !== "win32") {
    return [];
  }

  const roots = [
    process.env["ProgramFiles"],
    process.env["ProgramFiles(x86)"],
    join(Paths.getProjectRoot(), "dist"),
    join(Paths.getProjectRoot(), "tools"),
  ].filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "");
  const candidates: string[] = [];
  await Promise.all(
    roots.map(async (root) => {
      if (!existsSync(root)) {
        return;
      }

      const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
      entries
        .filter((entry) => entry.isDirectory() && /^scrcpy/i.test(entry.name))
        .forEach((entry) => {
          candidates.push(join(root, entry.name, executableName));
        });
    })
  );
  return candidates;
}

export async function getManagedAdbCandidatePaths(): Promise<string[]> {
  const bundledExecutableName = process.platform === "win32" ? "adb.exe" : "adb";
  return [
    getManagedAdbPath(),
    ...(await getWindowsScrcpyBundleCandidatePaths(bundledExecutableName)),
  ];
}

export async function getManagedScrcpyCandidatePaths(): Promise<string[]> {
  return await getWindowsScrcpyBundleCandidatePaths(
    process.platform === "win32" ? "scrcpy.exe" : "scrcpy"
  );
}

export async function resolveAdbPath(): Promise<string | null> {
  return await resolveSystemCommandBinaryPath("adb", {
    envVarNames: ["HAYALET_ADB_PATH", "ADB_PATH"],
    candidatePaths: await getManagedAdbCandidatePaths(),
  });
}

export async function resolveScrcpyPath(): Promise<string | null> {
  return await resolveSystemCommandBinaryPath("scrcpy", {
    envVarNames: ["HAYALET_SCRCPY_PATH", "SCRCPY_PATH"],
    candidatePaths: await getManagedScrcpyCandidatePaths(),
  });
}

export async function resolveFfmpegPath(): Promise<string | null> {
  return await resolveSystemCommandBinaryPath("ffmpeg", {
    envVarNames: ["HAYALET_FFMPEG_PATH", "FFMPEG_PATH"],
    candidatePaths: getManagedFfmpegCandidatePaths(),
  });
}

export async function resolveFfprobePath(): Promise<string | null> {
  return await resolveSystemCommandBinaryPath("ffprobe", {
    envVarNames: ["HAYALET_FFPROBE_PATH", "FFPROBE_PATH"],
    candidatePaths: getManagedFfprobeCandidatePaths(),
  });
}

export async function inspectFfmpegDependency(): Promise<{
  installed: boolean;
  ffmpegPath: string | null;
  ffprobePath: string | null;
  version: string | null;
  managedDir: string;
  message: string;
}> {
  const ffmpegPath = await resolveFfmpegPath();
  const ffprobePath = await resolveFfprobePath();
  if (ffmpegPath === null) {
    return {
      installed: false,
      ffmpegPath: null,
      ffprobePath,
      version: null,
      managedDir: getManagedFfmpegDir(),
      message: "FFmpeg is not available yet.",
    };
  }

  const probe = await runCommand(ffmpegPath, ["-version"], dirname(ffmpegPath), undefined, 12_000);
  const version =
    probe.exitCode === 0
      ? findVersion(`${probe.stdout}\n${probe.stderr}`, FFMPEG_VERSION_REGEX)
      : null;
  return {
    installed: probe.exitCode === 0,
    ffmpegPath,
    ffprobePath,
    version,
    managedDir: getManagedFfmpegDir(),
    message:
      probe.exitCode === 0
        ? "FFmpeg is ready for capture and room workflows."
        : "FFmpeg was found but did not pass its version probe.",
  };
}

async function downloadFile(url: string, destinationPath: string): Promise<void> {
  const response = await fetch(url, { headers: { "user-agent": "hayalet-ev-host-dependencies" } });
  if (!response.ok || response.body === null) {
    throw new Error(`FFmpeg download failed: ${response.status} ${response.statusText}`);
  }
  await mkdir(dirname(destinationPath), { recursive: true });
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(destinationPath, buffer);
}

export async function installManagedFfmpeg(
  emitProgress: (event: { message: string; progress: number; details: string[] }) => void = () => {}
): Promise<Awaited<ReturnType<typeof inspectFfmpegDependency>>> {
  const platformKey = detectPlatformKey() ?? `${process.platform}-${process.arch}`;
  const matcher = FFMPEG_ASSET_MATCH[platformKey];
  if (matcher === undefined) {
    throw new Error(`Managed FFmpeg is not available for ${platformKey}.`);
  }

  const details: string[] = [];
  const notify = (message: string, progress: number): void => {
    details.push(message);
    emitProgress({ message, progress, details: details.slice(-12) });
  };

  notify("Resolving the latest managed FFmpeg package.", 0.08);
  const release = await fetchGitHubRelease(FFMPEG_RELEASE_PROVIDER);
  const asset = (release.assets ?? []).find((candidate) => matcher.test(candidate.name)) ?? null;
  if (asset === null) {
    throw new Error(`No managed FFmpeg asset matched ${matcher.source}.`);
  }

  const tempRoot = await mkdtemp(join(tmpdir(), "hayalet-ffmpeg-"));
  const archivePath = join(tempRoot, asset.name);
  const extractDir = join(tempRoot, "extract");
  try {
    notify(`Downloading ${asset.name}.`, 0.18);
    await downloadFile(asset.browser_download_url, archivePath);
    notify("Extracting FFmpeg binaries.", 0.58);
    await extractArchive(archivePath, extractDir, asset.name.endsWith(".zip") ? "zip" : "tar.xz");
    const files = await collectFilesRecursive(extractDir);
    const ffmpegSource =
      files.find((filePath) => /(^|[\\/])ffmpeg(?:\.exe)?$/i.test(filePath)) ?? null;
    const ffprobeSource =
      files.find((filePath) => /(^|[\\/])ffprobe(?:\.exe)?$/i.test(filePath)) ?? null;
    if (ffmpegSource === null || ffprobeSource === null) {
      throw new Error("The managed FFmpeg archive did not include ffmpeg and ffprobe.");
    }

    const installDir = getManagedFfmpegDir();
    const stagingDir = `${installDir}.staging-${String(process.pid)}-${String(Date.now())}`;
    const backupDir = `${installDir}.previous-${String(process.pid)}-${String(Date.now())}`;
    const stagingFfmpegPath = join(
      stagingDir,
      process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"
    );
    const stagingFfprobePath = join(
      stagingDir,
      process.platform === "win32" ? "ffprobe.exe" : "ffprobe"
    );

    await rm(stagingDir, { recursive: true, force: true });
    await mkdir(stagingDir, { recursive: true });
    await cp(ffmpegSource, stagingFfmpegPath);
    await cp(ffprobeSource, stagingFfprobePath);
    await Promise.all([
      markExecutable(stagingFfmpegPath),
      markExecutable(stagingFfprobePath),
    ]);

    const stagingProbe = await runCommand(
      stagingFfmpegPath,
      ["-version"],
      dirname(stagingFfmpegPath),
      undefined,
      12_000
    );
    if (stagingProbe.exitCode !== 0) {
      throw new Error("The downloaded FFmpeg binary did not pass its version probe.");
    }

    let backupCreated = false;
    try {
      if (existsSync(installDir)) {
        await rename(installDir, backupDir);
        backupCreated = true;
      }
      await mkdir(dirname(installDir), { recursive: true });
      await rename(stagingDir, installDir);
      if (backupCreated) {
        await rm(backupDir, { recursive: true, force: true });
      }
    } catch (error) {
      await rm(stagingDir, { recursive: true, force: true }).catch(() => undefined);
      if (backupCreated && !existsSync(installDir) && existsSync(backupDir)) {
        await rename(backupDir, installDir).catch(() => undefined);
      }
      throw error;
    }
    notify("Managed FFmpeg is ready.", 0.92);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }

  const status = await inspectFfmpegDependency();
  if (status.installed !== true) {
    throw new Error(status.message);
  }
  return status;
}

export function hasManagedFfmpeg(): boolean {
  return existsSync(getManagedFfmpegPath()) && existsSync(getManagedFfprobePath());
}
