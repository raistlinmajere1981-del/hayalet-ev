import { LogCategory } from "@shared/logging-core";
// NOTE: Placeholder implementation; audio features are intentionally minimal.
import { Logger } from "../modules/logger/index.js";

export type SoundId =
  | "notification"
  | "success"
  | "error"
  | "warning"
  | "click"
  | "message"
  | "connect"
  | "disconnect";

export interface AudioOptions {
  volume?: number;
  loop?: boolean;
}

let isInitialized = false;
let isMuted = false;
let globalVolume = 1.0;
const audioCache: Map<string, HTMLAudioElement> = new Map();

const audioManager = {
  async init(): Promise<void> {
    if (isInitialized) {
      await Promise.resolve();
      return;
    }

    isInitialized = true;
    Logger.debugT(LogCategory.UI_AUDIO, "app.logs.uiAudio.initializedPlaceholder");
  },

  register(id: string, url: string): boolean {
    try {
      const audio = new window.Audio(url);
      audio.load();
      audioCache.set(id, audio);
      Logger.debugT(LogCategory.UI_AUDIO, "app.logs.uiAudio.soundRegistered", { id }, { id, url });
      return true;
    } catch (error) {
      Logger.debugT(
        LogCategory.UI_AUDIO,
        "app.logs.uiAudio.soundRegisterFailed",
        { id, message: error instanceof Error ? error.message : String(error) },
        { id, error }
      );
      return false;
    }
  },

  play(id: SoundId, options: AudioOptions = {}): void {
    if (isMuted) return;

    const audio = audioCache.get(id);
    if (!audio) {
      Logger.debugT(
        LogCategory.UI_AUDIO,
        "app.logs.uiAudio.soundNotFoundPlaceholder",
        { id },
        { id }
      );
      return;
    }

    const { volume = globalVolume, loop = false } = options;

    try {
      audio.volume = volume;
      audio.loop = loop;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch {}
  },

  stop(id: string): void {
    const audio = audioCache.get(id);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  },

  stopAll(): void {
    audioCache.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
  },

  setVolume(volume: number): void {
    globalVolume = Math.max(0, Math.min(1, volume));
    Logger.debugT(
      LogCategory.UI_AUDIO,
      "app.logs.uiAudio.volumeSet",
      { volume: globalVolume },
      { volume: globalVolume }
    );
  },

  getVolume(): number {
    return globalVolume;
  },

  mute(): void {
    const previousMuteState = isMuted;
    isMuted = true;
    Logger.debugT(LogCategory.UI_AUDIO, "app.logs.uiAudio.muted", undefined, { previousMuteState });
  },

  unmute(): void {
    isMuted = false;
    Logger.debugT(LogCategory.UI_AUDIO, "app.logs.uiAudio.unmuted");
  },

  toggleMute(): boolean {
    isMuted = !isMuted;
    return isMuted;
  },

  get isMuted(): boolean {
    return isMuted;
  },

  get isReady(): boolean {
    return isInitialized;
  },
};

export { audioManager as AudioManager, audioManager as Audio };
