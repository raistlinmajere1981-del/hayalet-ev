/**
 * Button States Manager
 *
 * Manages button loading, success, and error states with animations.
 *
 * @example
 * ```typescript
 * import { ButtonStates } from './ui';
 *
 * const btn = document.querySelector('#submit-btn') as HTMLButtonElement;
 *
 * // Set loading state
 * ButtonStates.setLoading(btn, 'Kaydediliyor...');
 *
 * // After async operation
 * ButtonStates.setSuccess(btn, 'Kaydedildi!'); // Auto-resets after 1.5s
 *
 * // Or on error
 * ButtonStates.setError(btn, 'Hata!'); // Auto-resets after 2s
 *
 * // Manual reset
 * ButtonStates.reset(btn);
 * ```
 */

import { LogManager } from '../modules/log-manager';

// ============================================================================
// Types
// ============================================================================

type ButtonState = 'idle' | 'loading' | 'success' | 'error';

interface ButtonData {
  originalText: string;
  originalDisabled: boolean;
  state: ButtonState;
  timeoutId?: ReturnType<typeof setTimeout>;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SUCCESS_DURATION = 1500;
const DEFAULT_ERROR_DURATION = 2000;

const STATE_CLASSES = {
  loading: 'btn-loading',
  success: 'btn-state-success',
  error: 'btn-state-error',
};

const STATE_ICONS = {
  success: '✓',
  error: '✕',
};

// ============================================================================
// State
// ============================================================================

const buttonDataMap: WeakMap<HTMLButtonElement, ButtonData> = new WeakMap();

// ============================================================================
// Private Functions
// ============================================================================

function getButtonData(button: HTMLButtonElement): ButtonData {
  let data = buttonDataMap.get(button);
  if (!data) {
    data = {
      originalText: button.textContent?.trim() || '',
      originalDisabled: button.disabled,
      state: 'idle',
    };
    buttonDataMap.set(button, data);
  }
  return data;
}

function clearStateClasses(button: HTMLButtonElement): void {
  button.classList.remove(
    STATE_CLASSES.loading,
    STATE_CLASSES.success,
    STATE_CLASSES.error
  );
}

function clearTimeout(data: ButtonData): void {
  if (data.timeoutId) {
    globalThis.clearTimeout(data.timeoutId);
    data.timeoutId = undefined;
  }
}

// ============================================================================
// Public API
// ============================================================================

export const ButtonStates = {
  /**
   * Set button to loading state
   * @param button - Target button element
   * @param text - Optional loading text (replaces button content)
   */
  setLoading(button: HTMLButtonElement, text?: string): void {
    const data = getButtonData(button);

    // Clear any existing timeout
    clearTimeout(data);

    // Store original state if not already in a special state
    if (data.state === 'idle') {
      data.originalText = button.textContent?.trim() || '';
      data.originalDisabled = button.disabled;
    }

    // Apply loading state
    clearStateClasses(button);
    button.classList.add(STATE_CLASSES.loading);
    button.disabled = true;
    data.state = 'loading';

    if (text) {
      button.textContent = text;
    }

    LogManager.addEvent('ButtonStates', 'debug', 'Loading state set', {
      text: text || data.originalText,
    });
  },

  /**
   * Set button to success state (auto-resets after duration)
   * @param button - Target button element
   * @param text - Optional success text
   * @param duration - Time before reset (ms), default: 1500
   */
  setSuccess(
    button: HTMLButtonElement,
    text?: string,
    duration: number = DEFAULT_SUCCESS_DURATION
  ): void {
    const data = getButtonData(button);

    // Clear any existing timeout
    clearTimeout(data);

    // Apply success state
    clearStateClasses(button);
    button.classList.add(STATE_CLASSES.success);
    button.disabled = false;
    data.state = 'success';

    if (text) {
      button.textContent = `${STATE_ICONS.success} ${text}`;
    } else {
      button.textContent = `${STATE_ICONS.success} ${data.originalText}`;
    }

    // Auto-reset after duration
    if (duration > 0) {
      data.timeoutId = globalThis.setTimeout(() => {
        ButtonStates.reset(button);
      }, duration);
    }

    LogManager.addEvent('ButtonStates', 'debug', 'Success state set', {
      text: text || data.originalText,
    });
  },

  /**
   * Set button to error state (auto-resets after duration)
   * @param button - Target button element
   * @param text - Optional error text
   * @param duration - Time before reset (ms), default: 2000
   */
  setError(
    button: HTMLButtonElement,
    text?: string,
    duration: number = DEFAULT_ERROR_DURATION
  ): void {
    const data = getButtonData(button);

    // Clear any existing timeout
    clearTimeout(data);

    // Apply error state
    clearStateClasses(button);
    button.classList.add(STATE_CLASSES.error);
    button.disabled = false;
    data.state = 'error';

    if (text) {
      button.textContent = `${STATE_ICONS.error} ${text}`;
    } else {
      button.textContent = `${STATE_ICONS.error} ${data.originalText}`;
    }

    // Auto-reset after duration
    if (duration > 0) {
      data.timeoutId = globalThis.setTimeout(() => {
        ButtonStates.reset(button);
      }, duration);
    }

    LogManager.addEvent('ButtonStates', 'debug', 'Error state set', {
      text: text || data.originalText,
    });
  },

  /**
   * Reset button to original state
   * @param button - Target button element
   */
  reset(button: HTMLButtonElement): void {
    const data = getButtonData(button);

    // Clear any existing timeout
    clearTimeout(data);

    // Remove all state classes
    clearStateClasses(button);

    // Restore original state
    button.textContent = data.originalText;
    button.disabled = data.originalDisabled;
    data.state = 'idle';

    LogManager.addEvent('ButtonStates', 'debug', 'Button reset', {
      text: data.originalText,
    });
  },

  /**
   * Get current button state
   * @param button - Target button element
   * @returns Current state
   */
  getState(button: HTMLButtonElement): ButtonState {
    const data = buttonDataMap.get(button);
    return data?.state || 'idle';
  },

  /**
   * Check if button is in loading state
   * @param button - Target button element
   */
  isLoading(button: HTMLButtonElement): boolean {
    return ButtonStates.getState(button) === 'loading';
  },

  /**
   * Execute async function with automatic button states
   * @param button - Target button element
   * @param fn - Async function to execute
   * @param options - Optional text overrides
   */
  async wrap<T>(
    button: HTMLButtonElement,
    fn: () => Promise<T>,
    options?: {
      loadingText?: string;
      successText?: string;
      errorText?: string;
    }
  ): Promise<T> {
    ButtonStates.setLoading(button, options?.loadingText);

    try {
      const result = await fn();
      ButtonStates.setSuccess(button, options?.successText);
      return result;
    } catch (error) {
      ButtonStates.setError(button, options?.errorText);
      throw error;
    }
  },
};
