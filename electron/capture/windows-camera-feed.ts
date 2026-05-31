import { spawn, type ChildProcess, type ChildProcessWithoutNullStreams } from "child_process";
import { randomUUID } from "crypto";
import { EventEmitter } from "events";
import { createServer, type Server, type ServerResponse } from "http";
import type {
  CaptureScrcpyPreviewVideoStatus,
  CaptureHostAction,
} from "../../src/types/capture.ts";
import type { TranscriptTargetId } from "../../src/types/transcript.ts";
import type { ScrcpyChildProcess } from "../scrcpy-session-manager.ts";
import { setAdbServerTouched } from "./adb-helper.ts";

const STREAM_HOST = "127.0.0.1";
const STREAM_INIT_SEGMENT_LIMIT_BYTES = 512 * 1024;
const SCREENRECORD_RESTART_DELAY_MS = 350;

type WindowsCameraFeedStartOptions = {
  action: CaptureHostAction;
  adbPath: string;
  cameraFps: number;
  cameraSize: string;
  deviceId: string;
  ffmpegPath: string;
  requestId: string | null;
  target: TranscriptTargetId | null;
};

type WindowsCameraFeedStartResult =
  | {
      ok: true;
      message: string;
      previewVideo: CaptureScrcpyPreviewVideoStatus;
      process: ScrcpyChildProcess;
    }
  | { ok: false; message: string };

type CameraStreamClient = {
  response: ServerResponse;
  waitingForFragment: boolean;
};

function splitCameraSize(cameraSize: string): { width: number; height: number } {
  const match = cameraSize.match(/^(\d+)x(\d+)$/);
  return {
    width: match?.[1] !== undefined ? Number(match[1]) : 640,
    height: match?.[2] !== undefined ? Number(match[2]) : 480,
  };
}

function normalizeCommandChunk(chunk: Buffer | string): string {
  return typeof chunk === "string" ? chunk : chunk.toString("utf8");
}

function findMp4BoxOffset(buffer: Buffer, boxName: string): number {
  const boxNameOffset = buffer.indexOf(Buffer.from(boxName, "ascii"));
  return boxNameOffset >= 4 ? boxNameOffset - 4 : -1;
}

class WindowsCameraFeedProcess implements ScrcpyChildProcess {
  readonly stdout = new EventEmitter();
  readonly stderr = new EventEmitter();
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;

  private adbProcess: ChildProcess | null = null;
  private ffmpegProcess: ChildProcessWithoutNullStreams | null = null;
  private readonly lifecycle = new EventEmitter();
  private readonly clients = new Map<ServerResponse, CameraStreamClient>();
  private readonly initializationChunks: Buffer[] = [];
  private initializationBytes = 0;
  private initializationCaptured = false;
  private started = false;
  private stopping = false;
  private closeSettled = false;

  constructor(
    private readonly server: Server,
    private readonly options: WindowsCameraFeedStartOptions
  ) {}

  once(
    event: "close" | "error",
    listener:
      | ((exitCode: number | null, signal: NodeJS.Signals | null) => void)
      | ((error: Error) => void)
  ): ScrcpyChildProcess {
    this.lifecycle.once(event, listener);
    return this;
  }

  start(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    this.startFfmpeg();
    this.startAdbScreenrecord();
  }

  kill(signal: NodeJS.Signals = "SIGTERM"): boolean {
    this.stopping = true;
    this.closeClients();
    this.server.close(() => undefined);
    this.adbProcess?.kill(signal);
    this.ffmpegProcess?.kill(signal);
    return true;
  }

  attachHttpServer(): void {
    this.server.on("request", (request, response) => {
      if (request.url?.startsWith("/capture/") !== true) {
        response.writeHead(404);
        response.end();
        return;
      }

      response.writeHead(200, {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
        "Connection": "close",
        "Content-Type": "video/mp4",
      });
      this.initializationChunks.forEach((chunk) => {
        response.write(chunk);
      });
      this.clients.set(response, {
        response,
        waitingForFragment: this.initializationCaptured,
      });
      const cleanup = (): void => {
        this.clients.delete(response);
      };
      response.on("close", cleanup);
      response.on("error", cleanup);
      this.start();
    });
  }

  private startFfmpeg(): void {
    const ffmpegArgs = [
      "-hide_banner",
      "-loglevel",
      "warning",
      "-fflags",
      "nobuffer",
      "-flags",
      "low_delay",
      "-f",
      "h264",
      "-r",
      String(this.options.cameraFps),
      "-i",
      "pipe:0",
      "-an",
      "-c:v",
      "copy",
      "-f",
      "mp4",
      "-movflags",
      "frag_keyframe+empty_moov+default_base_moof",
      "pipe:1",
    ];
    const child = spawn(this.options.ffmpegPath, ffmpegArgs, {
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.ffmpegProcess = child;
    this.forwardLines(child.stderr, "ffmpeg");
    child.stdout?.on("data", (chunk: Buffer) => {
      const outboundChunk = this.bufferCameraStreamChunk(chunk);
      if (outboundChunk !== null) {
        this.writeCameraStreamChunkToClients(outboundChunk);
      }
    });
    child.on("error", (error) => {
      this.lifecycle.emit("error", error);
      this.settleClose(-1, null);
    });
    child.on("close", (exitCode, signal) => {
      this.settleClose(exitCode, signal);
    });
  }

  private startAdbScreenrecord(): void {
    if (this.stopping) {
      return;
    }

    const args = [
      "-s",
      this.options.deviceId,
      "exec-out",
      "screenrecord",
      "--output-format=h264",
      "--bit-rate",
      "4000000",
      "--time-limit",
      "180",
      "-",
    ];
    setAdbServerTouched();
    const child = spawn(this.options.adbPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    this.adbProcess = child;
    this.forwardLines(child.stderr, "adb");
    child.stdout.on("data", (chunk: Buffer) => {
      const ffmpegStdin = this.ffmpegProcess?.stdin;
      if (ffmpegStdin?.writable !== true) {
        return;
      }

      if (ffmpegStdin.write(chunk) !== true) {
        child.stdout.pause();
        ffmpegStdin.once("drain", () => {
          child.stdout.resume();
        });
      }
    });
    child.on("error", (error) => {
      this.stderr.emit("data", Buffer.from(`[adb] ${error.message}\n`));
    });
    child.on("close", (exitCode, signal) => {
      this.stderr.emit(
        "data",
        Buffer.from(
          `[adb] screenrecord exited with code ${String(exitCode)} signal ${String(signal)}\n`
        )
      );
      if (this.stopping || this.closeSettled) {
        return;
      }

      globalThis.setTimeout(() => {
        this.startAdbScreenrecord();
      }, SCREENRECORD_RESTART_DELAY_MS);
    });
  }

  private forwardLines(stream: NodeJS.ReadableStream, prefix: string): void {
    let pending = "";
    stream.on("data", (chunk: Buffer | string) => {
      pending += normalizeCommandChunk(chunk);
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? "";
      lines
        .map((line) => line.trim())
        .filter((line) => line !== "")
        .forEach((line) => {
          this.stderr.emit("data", Buffer.from(`[${prefix}] ${line}\n`));
        });
    });
  }

  private bufferCameraStreamChunk(chunk: Buffer): Buffer | null {
    if (this.initializationCaptured) {
      return chunk;
    }

    this.initializationChunks.push(Buffer.from(chunk));
    this.initializationBytes += chunk.byteLength;
    const pendingInitialization = Buffer.concat(this.initializationChunks);
    const firstMovieFragmentOffset = findMp4BoxOffset(pendingInitialization, "moof");
    if (firstMovieFragmentOffset >= 0) {
      const initializationSegment = pendingInitialization.subarray(0, firstMovieFragmentOffset);
      this.initializationChunks.splice(0, this.initializationChunks.length, initializationSegment);
      this.initializationBytes = initializationSegment.byteLength;
      this.initializationCaptured = true;
      return chunk;
    }

    if (this.initializationBytes > STREAM_INIT_SEGMENT_LIMIT_BYTES) {
      this.initializationCaptured = true;
    }
    return chunk;
  }

  private writeCameraStreamChunkToClients(chunk: Buffer): void {
    if (chunk.byteLength === 0) {
      return;
    }

    const fragmentOffset = findMp4BoxOffset(chunk, "moof");
    this.clients.forEach((client) => {
      if (client.waitingForFragment) {
        if (fragmentOffset < 0) {
          return;
        }

        client.waitingForFragment = false;
        client.response.write(chunk.subarray(fragmentOffset));
        return;
      }

      client.response.write(chunk);
    });
  }

  private closeClients(): void {
    this.clients.forEach((client) => {
      client.response.end();
    });
    this.clients.clear();
  }

  private settleClose(exitCode: number | null, signal: NodeJS.Signals | null): void {
    if (this.closeSettled) {
      return;
    }

    this.closeSettled = true;
    this.exitCode = exitCode;
    this.signalCode = signal;
    this.stopping = true;
    this.adbProcess?.kill("SIGTERM");
    this.closeClients();
    this.server.close(() => undefined);
    this.lifecycle.emit("close", exitCode, signal);
  }
}

export async function startWindowsCameraFeed(
  options: WindowsCameraFeedStartOptions
): Promise<WindowsCameraFeedStartResult> {
  if (process.platform !== "win32") {
    return { ok: false, message: "Windows FFmpeg camera feed is only available on Windows." };
  }

  const server = createServer();
  const processWrapper = new WindowsCameraFeedProcess(server, options);
  processWrapper.attachHttpServer();

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, STREAM_HOST, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (address === null || typeof address === "string") {
    server.close();
    return { ok: false, message: "Could not allocate a local camera stream port." };
  }

  const { width, height } = splitCameraSize(options.cameraSize);
  const streamId = randomUUID();
  const streamUrl = `http://${STREAM_HOST}:${String(address.port)}/capture/${streamId}.mp4`;
  return {
    ok: true,
    message: "Windows FFmpeg camera feed was started.",
    process: processWrapper,
    previewVideo: {
      source: "ffmpeg-stream",
      devicePath: streamUrl,
      streamUrl,
      contentType: "video/mp4",
      label: "Hayalet Ev FFmpeg Camera Feed",
      width,
      height,
      fps: options.cameraFps,
    },
  };
}
