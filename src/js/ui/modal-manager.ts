/**
 * Modal Manager
 *
 * Manages modal dialogs with animations and keyboard support.
 *
 * @example
 * ```typescript
 * import { Modal } from './ui';
 *
 * // Basic modal
 * const modal = Modal.open({
 *   title: 'Onay',
 *   content: 'Bu işlemi yapmak istediğinize emin misiniz?',
 *   buttons: [
 *     { label: 'İptal', variant: 'secondary', onClick: () => modal.close() },
 *     { label: 'Onayla', variant: 'primary', onClick: () => handleConfirm() }
 *   ]
 * });
 *
 * // Confirm dialog (shorthand)
 * const confirmed = await Modal.confirm({
 *   title: 'Silme Onayı',
 *   message: 'Bu öğeyi silmek istediğinize emin misiniz?',
 *   confirmText: 'Sil',
 *   confirmVariant: 'danger'
 * });
 *
 * // Alert (shorthand)
 * await Modal.alert('Hata', 'Bir şeyler ters gitti.');
 * ```
 */

import { LogManager } from '../modules/log-manager';

// ============================================================================
// Types
// ============================================================================

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ModalButton {
  label: string;
  variant?: ButtonVariant;
  onClick?: () => void | Promise<void>;
  closeOnClick?: boolean; // default: true
}

interface ModalOptions {
  title?: string;
  content: string | HTMLElement;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closable?: boolean; // default: true
  closeOnOverlay?: boolean; // default: true
  closeOnEscape?: boolean; // default: true
  buttons?: ModalButton[];
  onClose?: () => void;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: ButtonVariant;
  icon?: string;
}

interface ModalInstance {
  id: string;
  element: HTMLDivElement;
  options: ModalOptions;
  close: () => void;
}

// ============================================================================
// State
// ============================================================================

let idCounter = 0;
const modals: Map<string, ModalInstance> = new Map();
let activeModal: ModalInstance | null = null;

// ============================================================================
// Private Functions
// ============================================================================

function generateId(): string {
  return `modal-${++idCounter}-${Date.now()}`;
}

function createModalElement(id: string, options: ModalOptions): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('data-modal-id', id);

  const modal = document.createElement('div');
  modal.className = `modal modal-${options.size || 'md'}`;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  // Header
  if (options.title || options.closable !== false) {
    const header = document.createElement('div');
    header.className = 'modal-header';

    if (options.title) {
      const title = document.createElement('h2');
      title.className = 'modal-title';
      title.textContent = options.title;
      header.appendChild(title);
    }

    if (options.closable !== false) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'modal-close';
      closeBtn.setAttribute('aria-label', 'Kapat');
      closeBtn.innerHTML = '×';
      closeBtn.addEventListener('click', () => Modal.close(id));
      header.appendChild(closeBtn);
    }

    modal.appendChild(header);
  }

  // Body
  const body = document.createElement('div');
  body.className = 'modal-body';

  if (typeof options.content === 'string') {
    body.innerHTML = options.content;
  } else {
    body.appendChild(options.content);
  }

  modal.appendChild(body);

  // Footer with buttons
  if (options.buttons && options.buttons.length > 0) {
    const footer = document.createElement('div');
    footer.className = 'modal-footer';

    options.buttons.forEach((btnConfig) => {
      const btn = document.createElement('button');
      btn.className = `btn btn-${btnConfig.variant || 'secondary'}`;
      btn.textContent = btnConfig.label;

      btn.addEventListener('click', async () => {
        if (btnConfig.onClick) {
          await btnConfig.onClick();
        }
        if (btnConfig.closeOnClick !== false) {
          Modal.close(id);
        }
      });

      footer.appendChild(btn);
    });

    modal.appendChild(footer);
  }

  overlay.appendChild(modal);

  // Close on overlay click
  if (options.closeOnOverlay !== false) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        Modal.close(id);
      }
    });
  }

  return overlay;
}

function handleKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && activeModal) {
    const options = activeModal.options;
    if (options.closeOnEscape !== false && options.closable !== false) {
      Modal.close(activeModal.id);
    }
  }
}

// ============================================================================
// Public API
// ============================================================================

export const Modal = {
  /**
   * Open a modal dialog
   * @returns Modal instance with close method
   */
  open(options: ModalOptions): ModalInstance {
    const id = generateId();
    const element = createModalElement(id, options);

    document.body.appendChild(element);
    document.body.style.overflow = 'hidden';

    // Focus trap setup
    const focusableElements = element.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    const instance: ModalInstance = {
      id,
      element,
      options,
      close: () => Modal.close(id),
    };

    modals.set(id, instance);
    activeModal = instance;

    // Add escape key listener
    document.addEventListener('keydown', handleKeyDown);

    LogManager.addEvent('Modal', 'info', 'Opened', { id, title: options.title });

    return instance;
  },

  /**
   * Close a specific modal or the active one
   */
  close(id?: string): void {
    const modalId = id || activeModal?.id;
    if (!modalId) return;

    const instance = modals.get(modalId);
    if (!instance) return;

    // Animate out
    instance.element.classList.add('modal-closing');

    setTimeout(() => {
      instance.element.remove();
      modals.delete(modalId);

      // Update active modal
      if (activeModal?.id === modalId) {
        activeModal = modals.size > 0 
          ? Array.from(modals.values()).pop() || null 
          : null;
      }

      // Restore body scroll if no modals
      if (modals.size === 0) {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleKeyDown);
      }

      // Callback
      instance.options.onClose?.();

      LogManager.addEvent('Modal', 'info', 'Closed', { id: modalId, visibility: 3 });
    }, 200);
  },

  /**
   * Close all open modals
   */
  closeAll(): void {
    modals.forEach((_, id) => Modal.close(id));
  },

  /**
   * Confirm dialog - returns promise that resolves to boolean
   */
  async confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      const content = document.createElement('div');
      content.className = 'modal-confirm';

      if (options.icon) {
        const iconDiv = document.createElement('div');
        iconDiv.className = 'modal-confirm-icon';
        iconDiv.textContent = options.icon;
        content.appendChild(iconDiv);
      }

      const titleEl = document.createElement('div');
      titleEl.className = 'modal-confirm-title';
      titleEl.textContent = options.title;
      content.appendChild(titleEl);

      const messageEl = document.createElement('div');
      messageEl.className = 'modal-confirm-message';
      messageEl.textContent = options.message;
      content.appendChild(messageEl);

      Modal.open({
        content,
        size: 'sm',
        closable: false,
        closeOnOverlay: false,
        buttons: [
          {
            label: options.cancelText || 'İptal',
            variant: 'secondary',
            onClick: () => resolve(false),
          },
          {
            label: options.confirmText || 'Onayla',
            variant: options.confirmVariant || 'primary',
            onClick: () => resolve(true),
          },
        ],
      });
    });
  },

  /**
   * Alert dialog - simple message with OK button
   */
  async alert(title: string, message: string): Promise<void> {
    return new Promise((resolve) => {
      Modal.open({
        title,
        content: `<p>${message}</p>`,
        size: 'sm',
        buttons: [
          {
            label: 'Tamam',
            variant: 'primary',
            onClick: () => resolve(),
          },
        ],
      });
    });
  },

  /**
   * Prompt dialog - input with OK/Cancel
   */
  async prompt(
    title: string,
    message: string,
    defaultValue: string = ''
  ): Promise<string | null> {
    return new Promise((resolve) => {
      const content = document.createElement('div');

      const messageEl = document.createElement('p');
      messageEl.textContent = message;
      messageEl.style.marginBottom = 'var(--space-4)';
      content.appendChild(messageEl);

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'input';
      input.value = defaultValue;
      content.appendChild(input);

      const modal = Modal.open({
        title,
        content,
        size: 'sm',
        buttons: [
          {
            label: 'İptal',
            variant: 'secondary',
            onClick: () => resolve(null),
          },
          {
            label: 'Tamam',
            variant: 'primary',
            onClick: () => resolve(input.value),
          },
        ],
      });

      // Focus input after modal opens
      setTimeout(() => input.focus(), 100);

      // Submit on Enter
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          resolve(input.value);
          modal.close();
        }
      });
    });
  },

  /**
   * Check if any modal is open
   */
  get isOpen(): boolean {
    return modals.size > 0;
  },

  /**
   * Get active modal instance
   */
  get active(): ModalInstance | null {
    return activeModal;
  },
};

// Alias for convenience
export const ModalManager = Modal;
