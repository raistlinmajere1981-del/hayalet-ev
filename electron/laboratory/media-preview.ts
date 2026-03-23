import { spawn } from "child_process";
import { mkdir } from "fs/promises";
import { extname, join } from "path";
import type { LaboratoryMediaProbe } from "@shared/index.js";

interface BinaryResult {
  stdout: string;
  stderr: string;
}

interface FfprobeJson {
  streams?: Array<Record<string, unknown>>;
  format?: Record<string, unknown>;
}

async function runBinary(binary: string, args: string[]): Promise<BinaryResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const trimmedStderr = stderr.trim();
      reject(
        new Error(
          trimmedStderr !== "" ? trimmedStderr : `${binary} exited with code ${String(code)}`
        )
      );
    });
  });
}

function parseFrameRate(rawValue: unknown): { raw: string; value: number } {
  const raw = typeof rawValue === "string" && rawValue.trim() !== "" ? rawValue.trim() : "0/1";
  const parts = raw.split("/");
  const numerator = Number(parts[0] ?? 0);
  const denominator = Number(parts[1] ?? 1);

  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return { raw, value: 0 };
  }

  return { raw, value: numerator / denominator };
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeCodec(value: unknown): string {
  return readString(value, "unknown").toLowerCase();
}

function isPreviewCompatible(filePath: string, probe: LaboratoryMediaProbe): boolean {
  const extension = extname(filePath).toLowerCase();

  if (extension === ".mp4") {
    const videoOkay = probe.videoCodec === "h264" || probe.videoCodec === "avc1";
    const audioOkay =
      probe.audioCodec === null ||
      probe.audioCodec === "aac" ||
      probe.audioCodec === "mp3" ||
      probe.audioCodec === "mp4a";
    return videoOkay && audioOkay;
  }

  if (extension === ".webm") {
    const videoOkay =
      probe.videoCodec === "vp8" || probe.videoCodec === "vp9" || probe.videoCodec === "av1";
    const audioOkay =
      probe.audioCodec === null || probe.audioCodec === "opus" || probe.audioCodec === "vorbis";
    return videoOkay && audioOkay;
  }

  return false;
}

export async function probeLaboratoryMedia(filePath: string): Promise<LaboratoryMediaProbe> {
  const { stdout } = await runBinary("ffprobe", [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    filePath,
  ]);

  const parsed = JSON.parse(stdout) as FfprobeJson;
  const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
  const format = parsed.format ?? {};
  const videoStream = streams.find((stream) => readString(stream["codec_type"]) === "video") ?? {};
  const audioStream = streams.find((stream) => readString(stream["codec_type"]) === "audio") ?? {};
  const avgFrameRate = parseFrameRate(videoStream["avg_frame_rate"]);
  const realFrameRate = parseFrameRate(videoStream["r_frame_rate"]);
  const width = readNumber(videoStream["width"]) ?? 0;
  const height = readNumber(videoStream["height"]) ?? 0;
  const audioCodec = readString(audioStream["codec_name"]);
  const tags =
    typeof format["tags"] === "object" && format["tags"] !== null ? format["tags"] : null;
  const encoderTag = tags !== null ? readString((tags as Record<string, unknown>)["encoder"]) : "";

  return {
    durationSec: readNumber(format["duration"]) ?? 0,
    width,
    height,
    fps: avgFrameRate.value > 0 ? avgFrameRate.value : realFrameRate.value,
    avgFrameRateRaw: avgFrameRate.raw,
    realFrameRateRaw: realFrameRate.raw,
    frameCount: readNumber(videoStream["nb_frames"]),
    bitrate: readNumber(format["bit_rate"]) ?? readNumber(videoStream["bit_rate"]),
    container: readString(format["format_name"], "unknown"),
    formatName: readString(
      format["format_long_name"],
      readString(format["format_name"], "unknown")
    ),
    videoCodec: normalizeCodec(videoStream["codec_name"]),
    audioCodec: audioCodec !== "" ? audioCodec : null,
    encoder: encoderTag !== "" ? encoderTag : null,
    hasVideo: width > 0 && height > 0,
    hasAudio: audioCodec !== "",
  };
}

export async function ensureLaboratoryPreview(
  sourcePath: string,
  workspaceDir: string,
  probe: LaboratoryMediaProbe
): Promise<string> {
  if (isPreviewCompatible(sourcePath, probe)) {
    return sourcePath;
  }

  const previewDir = join(workspaceDir, "preview");
  const previewPath = join(previewDir, "preview.mp4");

  await mkdir(previewDir, { recursive: true });
  await runBinary("ffmpeg", [
    "-y",
    "-i",
    sourcePath,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-vf",
    "scale='min(1280,iw)':-2:flags=lanczos",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    previewPath,
  ]);

  return previewPath;
}
