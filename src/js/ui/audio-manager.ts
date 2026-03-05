import { LogCategory } from "@shared/logging-core";
/**
 * Audio Manager (Placeholder)
 *
 * Future implementation for audio/sound effects.
 * Planned features:
 * - Notification sounds
 * - UI feedback sounds
 * - Background music
 * - Voice playback integration
 *
 * @example
 * ```typescript
 * import { Audio } from './ui';
 *
 * // Initialize
 * await Audio.init();
 *
 * // Play sounds
 * Audio.play('notification');
 * Audio.play('click');
 * Audio.play('success');
 *
 * // Volume control
 * Audio.setVolume(0.5);
 * Audio.mute();
 * Audio.unmute();
 *
 * // Custom sounds
 * Audio.register('custom', '/sounds/custom.mp3');
 * Audio.play('custom');
 * ```
 */

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
    Logger.debug(LogCategory.UI_AUDIO, "Initialized (placeholder mode)");
  },

  register(id: string, url: string): boolean {
    try {
      const audio = new window.Audio(url);
      audio.load();
      audioCache.set(id, audio);
      Logger.debug(LogCategory.UI_AUDIO, "Sound registered", { id, url });
      return true;
    } catch (error) {
      Logger.debug(LogCategory.UI_AUDIO, "Failed to register sound", { id, error });
      return false;
    }
  },

  play(id: SoundId, options: AudioOptions = {}): void {
    if (isMuted) return;

    const audio = audioCache.get(id);
    if (!audio) {
      Logger.debug(LogCategory.UI_AUDIO, "Sound not found (placeholder mode)", { id });
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

  /**
   * Set global volume
   * @param volume 0.0 to 1.0
   */
  setVolume(volume: number): void {
    globalVolume = Math.max(0, Math.min(1, volume));
    Logger.debug(LogCategory.UI_AUDIO, "Volume set", { volume: globalVolume });
  },

  getVolume(): number {
    return globalVolume;
  },

  mute(): void {
    isMuted = true;
    Logger.debug(LogCategory.UI_AUDIO, "Muted", { previousMuteState: isMuted });
  },

  unmute(): void {
    isMuted = false;
    Logger.debug(LogCategory.UI_AUDIO, "Unmuted");
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
