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
 *   title: 'Confirm',
 *   content: 'Are you sure you want to perform this action?',
 *   buttons: [
 *     { label: 'Cancel', variant: 'secondary', onClick: () => modal.close() },
 *     { label: 'Confirm', variant: 'primary', onClick: () => handleConfirm() }
 *   ]
 * });
 *
 * // Confirm dialog (shorthand)
 * const confirmed = await Modal.confirm({
 *   title: 'Delete Confirmation',
 *   message: 'Are you sure you want to delete this item?',
 *   confirmText: 'Delete',
 *   confirmVariant: 'danger'
 * });
 *
 * // Alert (shorthand)
 * await Modal.alert('Error', 'Something went wrong.');
 * ```
 */

import { Logger } from "../modules/logger/index.js";
import { LogCategory } from "@shared/logging-core";
import { AppI18n } from "../modules/i18n/index.js";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

interface ModalButton {
  label?: string; // New API: preferred
  text?: string; // Legacy API: backward compatibility
  variant?: ButtonVariant; // New API: preferred
  class?: string; // Legacy API: backward compatibility (e.g., 'btn-primary', 'btn-ghost')
  onClick?: () => void | Promise<void>;
  closeOnClick?: boolean; // default: true
}

interface ModalOptions {
  title?: string;
  content: string | HTMLElement;
  size?: "sm" | "small" | "md" | "medium" | "lg" | "large" | "xl" | "xlarge";
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

let idCounter = 0;
const modals: Map<string, ModalInstance> = new Map();
let activeModal: ModalInstance | null = null;

function generateId(): string {
  return `modal-${++idCounter}-${Date.now()}`;
}

function createModalElement(id: string, options: ModalOptions): HTMLDivElement {
  const modalContainer = document.createElement("div");
  modalContainer.className = "modal";
  modalContainer.setAttribute("data-modal-id", id);
  modalContainer.setAttribute("role", "dialog");
  modalContainer.setAttribute("aria-modal", "true");

  const modal = document.createElement("div");
  const sizeClass = options.size ?? "medium";
  modal.className = `modal-content modal-${sizeClass}`;

  const titleId = `modal-title-${id}`;
  const descId = `modal-desc-${id}`;
  modalContainer.setAttribute("aria-labelledby", titleId);
  modalContainer.setAttribute("aria-describedby", descId);

  if ((options.title != null && options.title !== "") || options.closable !== false) {
    const header = document.createElement("div");
    header.className = "modal-header";

    if (options.title != null && options.title !== "") {
      const title = document.createElement("h2");
      title.className = "modal-title";
      title.id = titleId;
      title.textContent = options.title;
      header.appendChild(title);
    }

    if (options.closable !== false) {
      const closeBtn = document.createElement("button");
      closeBtn.className = "modal-close";
      closeBtn.setAttribute("aria-label", AppI18n.t("shell.common.closeAriaLabel"));
      closeBtn.innerHTML = "×";
      closeBtn.addEventListener("click", () => {
        modalApi.close(id);
      });
      header.appendChild(closeBtn);
    }

    modal.appendChild(header);
  }

  const body = document.createElement("div");
  body.className = "modal-body";
  body.id = descId;

  if (typeof options.content === "string") {
    body.innerHTML = options.content;
  } else {
    body.appendChild(options.content);
  }

  modal.appendChild(body);

  if (options.buttons && options.buttons.length > 0) {
    const footer = document.createElement("div");
    footer.className = "modal-footer";

    options.buttons.forEach((btnConfig) => {
      const btn = document.createElement("button");

      const buttonText = btnConfig.label ?? btnConfig.text ?? "";
      const buttonClass = btnConfig.class ?? `btn-${btnConfig.variant ?? "secondary"}`;

      btn.className = `btn ${buttonClass}`;
      btn.textContent = buttonText;

      btn.addEventListener("click", () => {
        void (async (): Promise<void> => {
          if (btnConfig.onClick) {
            await btnConfig.onClick();
          }
          if (btnConfig.closeOnClick !== false) {
            modalApi.close(id);
          }
        })();
      });

      footer.appendChild(btn);
    });

    modal.appendChild(footer);
  }

  modalContainer.appendChild(modal);

  if (options.closeOnOverlay !== false) {
    modalContainer.addEventListener("click", (e) => {
      if (e.target === modalContainer) {
        modalApi.close(id);
      }
    });
  }

  return modalContainer;
}

function handleKeyDown(e: KeyboardEvent): void {
  if (e.key === "Escape" && activeModal) {
    const options = activeModal.options;
    if (options.closeOnEscape !== false && options.closable !== false) {
      modalApi.close(activeModal.id);
    }
  }
}

const modalApi = {
  /**
   * Open a modal dialog
   * @returns Modal instance with close method
   */
  open(options: ModalOptions): ModalInstance {
    const id = generateId();
    const element = createModalElement(id, options);

    document.body.appendChild(element);
    document.body.style.overflow = "hidden";

    const focusableElements = element.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    if (firstElement) {
      firstElement.focus();
    }

    const instance: ModalInstance = {
      id,
      element,
      options,
      close: () => {
        modalApi.close(id);
      },
    };

    modals.set(id, instance);
    activeModal = instance;

    document.addEventListener("keydown", handleKeyDown);

    Logger.info(LogCategory.UI_MODAL, "Opened", { id, title: options.title });

    return instance;
  },

  close(id?: string): void {
    const modalId = id ?? activeModal?.id;
    if (modalId == null || modalId === "") return;

    const instance = modals.get(modalId);
    if (!instance) return;

    instance.element.classList.add("modal-closing");

    setTimeout(() => {
      instance.element.remove();
      modals.delete(modalId);

      if (activeModal?.id === modalId) {
        activeModal = modals.size > 0 ? (Array.from(modals.values()).pop() ?? null) : null;
      }

      if (modals.size === 0) {
        document.body.style.overflow = "";
        document.removeEventListener("keydown", handleKeyDown);
      }

      instance.options.onClose?.();

      Logger.debug(LogCategory.UI_MODAL, "Closed", { id: modalId });
    }, 200);
  },

  closeAll(): void {
    modals.forEach((_, id) => {
      modalApi.close(id);
    });
  },

  async confirm(options: ConfirmOptions): Promise<boolean> {
    return await new Promise((resolve) => {
      const content = document.createElement("div");
      content.className = "modal-confirm";

      if (options.icon != null && options.icon !== "") {
        const iconDiv = document.createElement("div");
        iconDiv.className = "modal-confirm-icon";
        iconDiv.textContent = options.icon;
        content.appendChild(iconDiv);
      }

      const titleEl = document.createElement("div");
      titleEl.className = "modal-confirm-title";
      titleEl.textContent = options.title;
      content.appendChild(titleEl);

      const messageEl = document.createElement("div");
      messageEl.className = "modal-confirm-message";
      messageEl.textContent = options.message;
      content.appendChild(messageEl);

      modalApi.open({
        content,
        size: "sm",
        closable: false,
        closeOnOverlay: false,
        buttons: [
          {
            label: options.cancelText ?? AppI18n.t("shell.common.cancel"),
            variant: "secondary",
            onClick: (): void => {
              resolve(false);
            },
          },
          {
            label: options.confirmText ?? AppI18n.t("shell.common.confirm"),
            variant: options.confirmVariant ?? "primary",
            onClick: (): void => {
              resolve(true);
            },
          },
        ],
      });
    });
  },

  async alert(title: string, message: string): Promise<void> {
    await new Promise((resolve) => {
      modalApi.open({
        title,
        content: `<p>${message}</p>`,
        size: "sm",
        buttons: [
          {
            label: AppI18n.t("shell.common.ok"),
            variant: "primary",
            onClick: (): void => {
              resolve(undefined);
            },
          },
        ],
      });
    });
  },

  async prompt(title: string, message: string, defaultValue: string = ""): Promise<string | null> {
    return await new Promise((resolve) => {
      const content = document.createElement("div");

      const messageEl = document.createElement("p");
      messageEl.textContent = message;
      messageEl.style.marginBottom = "var(--space-4)";
      content.appendChild(messageEl);

      const input = document.createElement("input");
      input.type = "text";
      input.className = "input";
      input.value = defaultValue;
      content.appendChild(input);

      const instance = modalApi.open({
        title,
        content,
        size: "sm",
        buttons: [
          {
            label: AppI18n.t("shell.common.cancel"),
            variant: "secondary",
            onClick: (): void => {
              resolve(null);
            },
          },
          {
            label: AppI18n.t("shell.common.ok"),
            variant: "primary",
            onClick: (): void => {
              resolve(input.value);
            },
          },
        ],
      });

      setTimeout(() => {
        input.focus();
      }, 100);

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          resolve(input.value);
          instance.close();
        }
      });
    });
  },

  get isOpen(): boolean {
    return modals.size > 0;
  },

  get active(): ModalInstance | null {
    return activeModal;
  },
};

const modalManager = modalApi;

export { modalApi as Modal, modalManager as ModalManager };
