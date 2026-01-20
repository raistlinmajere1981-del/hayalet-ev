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

import { LogManager } from '../modules/log-manager';

// ============================================================================
// Types
// ============================================================================

export type SoundId =
  | 'notification'
  | 'success'
  | 'error'
  | 'warning'
  | 'click'
  | 'message'
  | 'connect'
  | 'disconnect';

export interface AudioOptions {
  volume?: number;
  loop?: boolean;
}

// ============================================================================
// State
// ============================================================================

let isInitialized = false;
let isMuted = false;
let globalVolume = 1.0;
const audioCache: Map<string, HTMLAudioElement> = new Map();

// ============================================================================
// Placeholder Implementation
// ============================================================================

export const AudioManager = {
  /**
   * Initialize audio system
   * @placeholder Loads default sounds
   */
  async init(): Promise<void> {
    if (isInitialized) return;

    // In future: preload default sounds
    // await Promise.all([
    //   AudioManager.register('notification', '/sounds/notification.mp3'),
    //   AudioManager.register('success', '/sounds/success.mp3'),
    //   ...
    // ]);

    isInitialized = true;
    LogManager.addEvent('AudioManager', 'info', 'Initialized (placeholder mode)', { visibility: 2 });
  },

  /**
   * Register a custom sound
   * @placeholder Future implementation
   */
  async register(id: string, url: string): Promise<boolean> {
    try {
      const audio = new window.Audio(url);
      await audio.load();
      audioCache.set(id, audio);
      LogManager.addEvent('AudioManager', 'debug', 'Sound registered', { id, url });
      return true;
    } catch (error) {
      LogManager.addEvent('AudioManager', 'error', 'Failed to register sound', { id, error });
      return false;
    }
  },

  /**
   * Play a sound
   * @placeholder Returns immediately without playing
   */
  play(id: SoundId | string, options: AudioOptions = {}): void {
    if (isMuted) return;

    const audio = audioCache.get(id);
    if (!audio) {
      LogManager.addEvent('AudioManager', 'debug', 'Sound not found (placeholder mode)', { id });
      return;
    }

    const { volume = globalVolume, loop = false } = options;

    try {
      audio.volume = volume;
      audio.loop = loop;
      audio.currentTime = 0;
      audio.play().catch(() => {
        // Autoplay might be blocked
      });
    } catch {
      // Ignore errors in placeholder mode
    }
  },

  /**
   * Stop a sound
   */
  stop(id: string): void {
    const audio = audioCache.get(id);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  },

  /**
   * Stop all sounds
   */
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
    LogManager.addEvent('AudioManager', 'debug', 'Volume set', { volume: globalVolume });
  },

  /**
   * Get current volume
   */
  getVolume(): number {
    return globalVolume;
  },

  /**
   * Mute all sounds
   */
  mute(): void {
    isMuted = true;
    LogManager.addEvent('AudioManager', 'debug', 'Muted');
  },

  /**
   * Unmute all sounds
   */
  unmute(): void {
    isMuted = false;
    LogManager.addEvent('AudioManager', 'debug', 'Unmuted');
  },

  /**
   * Toggle mute state
   */
  toggleMute(): boolean {
    isMuted = !isMuted;
    return isMuted;
  },

  /**
   * Check if muted
   */
  get isMuted(): boolean {
    return isMuted;
  },

  /**
   * Check if initialized
   */
  get isReady(): boolean {
    return isInitialized;
  },
};

// Shorter alias
export const Audio = AudioManager;
