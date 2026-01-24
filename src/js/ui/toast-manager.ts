/**
 * Toast Manager
 *
 * Non-blocking notification system with auto-dismiss.
 *
 * @example
 * ```typescript
 * import { Toast } from './ui';
 *
 * // Quick methods
 * Toast.success('Başarılı!', 'Bağlantı kuruldu');
 * Toast.error('Hata!', 'Bağlantı kesildi');
 * Toast.warning('Dikkat!', 'Oturum süreniz dolmak üzere');
 * Toast.info('Bilgi', 'Yeni güncelleme mevcut');
 *
 * // Loading with update
 * const id = Toast.loading('Yükleniyor...');
 * // ... async operation
 * Toast.update(id, { type: 'success', title: 'Tamamlandı!' });
 *
 * // With action button
 * Toast.show({
 *   type: 'info',
 *   title: 'Güncelleme',
 *   message: 'Yeni sürüm mevcut',
 *   action: { label: 'Güncelle', onClick: () => update() }
 * });
 * ```
 */

import { LogManager } from '../modules/log-manager';

// ============================================================================
// Types
// ============================================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  type: ToastType;
  title: string;
  message?: string;
  duration?: number; // ms, 0 = manual close, default: 4000
  closable?: boolean; // default: true
  action?: ToastAction;
  progress?: boolean; // show progress bar
}

interface ToastInstance {
  id: string;
  element: HTMLDivElement;
  options: ToastOptions;
  timeoutId?: ReturnType<typeof setTimeout>;
}

// ============================================================================
// Constants
// ============================================================================

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
  loading: '', // CSS spinner
};

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 3000,
  error: 5000,
  warning: 4000,
  info: 4000,
  loading: 0, // No auto-dismiss
};

// ============================================================================
// State
// ============================================================================

let container: HTMLDivElement | null = null;
const toasts: Map<string, ToastInstance> = new Map();
let idCounter = 0;

// ============================================================================
// Private Functions
// ============================================================================

function generateId(): string {
  return `toast-${++idCounter}-${Date.now()}`;
}

function ensureContainer(): HTMLDivElement {
  if (!container || !document.body.contains(container)) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    container.setAttribute('role', 'alert');
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }
  return container;
}

function createToastElement(id: string, options: ToastOptions): HTMLDivElement {
  const toast = document.createElement('div');
  toast.className = `toast toast-${options.type}`;
  toast.setAttribute('data-toast-id', id);
  toast.setAttribute('role', 'alert');

  // Icon
  const iconDiv = document.createElement('div');
  iconDiv.className = 'toast-icon';
  if (options.type !== 'loading') {
    iconDiv.textContent = ICONS[options.type];
  }
  toast.appendChild(iconDiv);

  // Content
  const contentDiv = document.createElement('div');
  contentDiv.className = 'toast-content';

  const titleDiv = document.createElement('div');
  titleDiv.className = 'toast-title';
  titleDiv.textContent = options.title;
  contentDiv.appendChild(titleDiv);

  if (options.message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'toast-message';
    messageDiv.textContent = options.message;
    contentDiv.appendChild(messageDiv);
  }

  // Action button
  if (options.action) {
    const actionDiv = document.createElement('div');
    actionDiv.className = 'toast-action';

    const actionBtn = document.createElement('button');
    actionBtn.className = 'toast-action-btn';
    actionBtn.textContent = options.action.label;
    actionBtn.addEventListener('click', () => {
      options.action?.onClick();
      Toast.dismiss(id);
    });

    actionDiv.appendChild(actionBtn);
    contentDiv.appendChild(actionDiv);
  }

  toast.appendChild(contentDiv);

  // Close button
  if (options.closable !== false) {
    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.setAttribute('aria-label', 'Kapat');
    closeBtn.innerHTML = '×';
    closeBtn.addEventListener('click', () => Toast.dismiss(id));
    toast.appendChild(closeBtn);
  }

  // Progress bar
  if (options.progress && options.duration && options.duration > 0) {
    const progressDiv = document.createElement('div');
    progressDiv.className = 'toast-progress';
    progressDiv.style.animationDuration = `${options.duration}ms`;
    toast.appendChild(progressDiv);
  }

  return toast;
}

function scheduleRemoval(instance: ToastInstance): void {
  const duration = instance.options.duration ?? DEFAULT_DURATIONS[instance.options.type];

  if (duration > 0) {
    instance.timeoutId = setTimeout(() => {
      Toast.dismiss(instance.id);
    }, duration);
  }
}

// ============================================================================
// Public API
// ============================================================================

export const Toast = {
  /**
   * Show a toast notification
   * @returns Toast ID for later reference
   */
  show(options: ToastOptions): string {
    const id = generateId();
    const containerEl = ensureContainer();

    // Set default duration based on type
    const finalOptions: ToastOptions = {
      ...options,
      duration: options.duration ?? DEFAULT_DURATIONS[options.type],
      closable: options.closable ?? true,
      progress: options.progress ?? (options.type !== 'loading'),
    };

    const element = createToastElement(id, finalOptions);
    containerEl.appendChild(element);

    const instance: ToastInstance = {
      id,
      element,
      options: finalOptions,
    };

    toasts.set(id, instance);
    scheduleRemoval(instance);

    LogManager.addEvent('Toast', 'info', `Shown: ${options.type}`, { id, title: options.title, visibility: 3 });

    return id;
  },

  /**
   * Update an existing toast
   */
  update(id: string, options: Partial<ToastOptions>): void {
    const instance = toasts.get(id);
    if (!instance) {
      LogManager.addEvent('Toast', 'warn', 'Update failed: toast not found', { id });
      return;
    }

    // Clear existing timeout
    if (instance.timeoutId) {
      clearTimeout(instance.timeoutId);
    }

    // Update options
    const newOptions: ToastOptions = { ...instance.options, ...options };
    instance.options = newOptions;

    // Update element
    const parent = instance.element.parentNode;
    const newElement = createToastElement(id, newOptions);

    if (parent) {
      parent.replaceChild(newElement, instance.element);
    }

    instance.element = newElement;

    // Reschedule removal
    scheduleRemoval(instance);

    LogManager.addEvent('Toast', 'info', 'Updated', { id, type: newOptions.type, visibility: 3 });
  },

  /**
   * Dismiss a specific toast
   */
  dismiss(id: string): void {
    const instance = toasts.get(id);
    if (!instance) return;

    // Clear timeout
    if (instance.timeoutId) {
      clearTimeout(instance.timeoutId);
    }

    // Animate out
    instance.element.classList.add('toast-out');

    // Remove after animation
    setTimeout(() => {
      instance.element.remove();
      toasts.delete(id);
    }, 150);
  },

  /**
   * Dismiss all toasts
   */
  dismissAll(): void {
    toasts.forEach((_, id) => Toast.dismiss(id));
  },

  // === Shorthand Methods ===

  success(title: string, message?: string): string {
    return Toast.show({ type: 'success', title, message });
  },

  error(title: string, message?: string): string {
    return Toast.show({ type: 'error', title, message });
  },

  warning(title: string, message?: string): string {
    return Toast.show({ type: 'warning', title, message });
  },

  info(title: string, message?: string): string {
    return Toast.show({ type: 'info', title, message });
  },

  loading(title: string, message?: string): string {
    return Toast.show({ type: 'loading', title, message, closable: false });
  },

  /**
   * Promise helper - shows loading, then success/error based on result
   */
  async promise<T>(
    promise: Promise<T>,
    options: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: unknown) => string);
    }
  ): Promise<T> {
    const id = Toast.loading(options.loading);

    try {
      const result = await promise;
      const successMsg = typeof options.success === 'function' 
        ? options.success(result) 
        : options.success;
      Toast.update(id, { type: 'success', title: successMsg, closable: true });
      return result;
    } catch (err) {
      const errorMsg = typeof options.error === 'function' 
        ? options.error(err) 
        : options.error;
      Toast.update(id, { type: 'error', title: errorMsg, closable: true });
      throw err;
    }
  },
};

// Alias for convenience (geriye uyumluluk)
export const ToastManager = Toast;
