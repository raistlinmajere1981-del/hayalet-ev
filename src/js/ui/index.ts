/**
 * UI Module - Barrel Export
 *
 * Central export point for all UI-related modules.
 * Import UI utilities from here for cleaner imports.
 *
 * @example
 * ```typescript
 * import { ThemeManager, Toast, ButtonStates, Modal } from './ui';
 * ```
 */

// Theme Management
export { ThemeManager } from './theme-manager';
export type { ThemeId } from './theme-manager';

// Toast Notifications
export { Toast, ToastManager } from './toast-manager';
export type { ToastType, ToastOptions, ToastAction } from './toast-manager';

// Button States
export { ButtonStates } from './button-states';

// Modal Dialogs
export { Modal, ModalManager } from './modal-manager';

// Splash Screen
export { SplashScreen } from './splash-screen';

// Animation Controller (GSAP)
export { AnimationController, Anim } from './animation-controller';
export type { AnimationDirection, AnimationOptions, StaggerOptions } from './animation-controller';

// Canvas Manager (Placeholder)
export { CanvasManager, Canvas } from './canvas-manager';
export type { CanvasOptions, CanvasInstance } from './canvas-manager';

// Audio Manager (Placeholder)
export { AudioManager, Audio } from './audio-manager';
export type { SoundId, AudioOptions } from './audio-manager';
