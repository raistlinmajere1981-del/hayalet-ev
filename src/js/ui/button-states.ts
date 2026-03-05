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

import { Logger } from "../modules/logger/index.js";
import { LogCategory } from "@shared/logging-core";
import { DEFAULT_SUCCESS_DURATION, DEFAULT_ERROR_DURATION } from "@ui-constants";

type ButtonState = "idle" | "loading" | "success" | "error";

interface ButtonData {
  originalText: string;
  originalDisabled: boolean;
  state: ButtonState;
  timeoutId?: ReturnType<typeof setTimeout>;
}

const STATE_CLASSES = {
  loading: "btn-loading",
  success: "btn-state-success",
  error: "btn-state-error",
};

const STATE_ICONS = {
  success: "✓",
  error: "✕",
};

const buttonDataMap: WeakMap<HTMLButtonElement, ButtonData> = new WeakMap();

function getButtonData(button: HTMLButtonElement): ButtonData {
  let data = buttonDataMap.get(button);
  if (!data) {
    data = {
      originalText: button.textContent.trim(),
      originalDisabled: button.disabled,
      state: "idle",
    };
    buttonDataMap.set(button, data);
  }
  return data;
}

function clearStateClasses(button: HTMLButtonElement): void {
  button.classList.remove(STATE_CLASSES.loading, STATE_CLASSES.success, STATE_CLASSES.error);
}

function clearTimeout(data: ButtonData): void {
  if (data.timeoutId) {
    globalThis.clearTimeout(data.timeoutId);
    delete data.timeoutId;
  }
}

const buttonStates = {
  /**
   * Set button to loading state
   * @param button - Target button element
   * @param text - Optional loading text (replaces button content)
   */
  setLoading(button: HTMLButtonElement, text?: string): void {
    const data = getButtonData(button);

    clearTimeout(data);

    if (data.state === "idle") {
      data.originalText = button.textContent.trim();
      data.originalDisabled = button.disabled;
    }

    clearStateClasses(button);
    button.classList.add(STATE_CLASSES.loading);
    button.disabled = true;
    data.state = "loading";

    if (text != null && text !== "") {
      button.textContent = text;
    }

    Logger.debug(LogCategory.UI, "Loading state set", {
      text: text ?? data.originalText,
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

    clearTimeout(data);

    clearStateClasses(button);
    button.classList.add(STATE_CLASSES.success);
    button.disabled = false;
    data.state = "success";

    if (text != null && text !== "") {
      button.textContent = `${STATE_ICONS.success} ${text}`;
    } else {
      button.textContent = `${STATE_ICONS.success} ${data.originalText}`;
    }

    if (duration > 0) {
      data.timeoutId = globalThis.setTimeout(() => {
        buttonStates.reset(button);
      }, duration);
    }

    Logger.debug(LogCategory.UI, "Success state set", {
      text: text ?? data.originalText,
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

    clearTimeout(data);

    clearStateClasses(button);
    button.classList.add(STATE_CLASSES.error);
    button.disabled = false;
    data.state = "error";

    if (text != null && text !== "") {
      button.textContent = `${STATE_ICONS.error} ${text}`;
    } else {
      button.textContent = `${STATE_ICONS.error} ${data.originalText}`;
    }

    if (duration > 0) {
      data.timeoutId = globalThis.setTimeout(() => {
        buttonStates.reset(button);
      }, duration);
    }

    Logger.debug(LogCategory.UI, "Error state set", {
      text: text ?? data.originalText,
    });
  },

  /**
   * Reset button to original state
   * @param button - Target button element
   */
  reset(button: HTMLButtonElement): void {
    const data = getButtonData(button);

    clearTimeout(data);

    clearStateClasses(button);

    button.textContent = data.originalText;
    button.disabled = data.originalDisabled;
    data.state = "idle";

    Logger.debug(LogCategory.UI, "Button reset", {
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
    return data?.state ?? "idle";
  },

  /**
   * Check if button is in loading state
   * @param button - Target button element
   */
  isLoading(button: HTMLButtonElement): boolean {
    return buttonStates.getState(button) === "loading";
  },

  destroy(): void {
    Logger.debug(LogCategory.UI, "Destroy called - WeakMap will auto-cleanup on GC");
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
    buttonStates.setLoading(button, options?.loadingText);

    try {
      const result = await fn();
      buttonStates.setSuccess(button, options?.successText);
      return result;
    } catch (error) {
      buttonStates.setError(button, options?.errorText);
      throw error;
    }
  },
};

export { buttonStates as ButtonStates };
